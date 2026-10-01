import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Module,
} from '@nestjs/common';
import https from 'node:https';
import { URL } from 'node:url';
import { Database } from '../core/database';
import { Access, CurrentActor, Require } from '../core/security';
import { Actor } from '../core/types';
import { audit } from '../core/audit';

// Helper for HTTPS JSON requests
function httpsRequest(
  urlStr: string,
  method: string,
  headers: Record<string, string>,
  body?: any,
): Promise<{ statusCode: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;

    const reqHeaders: Record<string, string> = {
      ...headers,
    };
    if (postData && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (postData) {
      reqHeaders['Content-Length'] = String(Buffer.byteLength(postData));
    }

    const req = https.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let chunks = '';
        res.on('data', (d) => (chunks += d));
        res.on('end', () => {
          let parsed = chunks;
          try {
            parsed = JSON.parse(chunks);
          } catch {}
          resolve({
            statusCode: res.statusCode || 500,
            data: parsed,
            headers: res.headers,
          });
        });
      },
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Social publishing request timed out after 30 seconds.'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Convert Google Drive view links to direct image preview links if possible
function normalizePublicMediaUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const driveMatch = rawUrl.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
  if (driveMatch && driveMatch[1]) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }
  return rawUrl;
}

@Injectable()
export class SocialPublishingService {
  constructor(private db: Database) {}

  /**
   * Publish an image to Instagram Business via Meta Graph API v21.0
   * 1. Create Media Container: POST /{ig-user-id}/media
   * 2. Publish Container: POST /{ig-user-id}/media_publish
   * 3. Fetch Permalink: GET /{media-id}?fields=permalink
   */
  async publishToInstagram(params: {
    igUserId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ postId: string; liveUrl: string }> {
    const { igUserId, accessToken, imageUrl, caption } = params;

    // Step 1: Create media container
    const containerUrl = new URL(`https://graph.facebook.com/v21.0/${igUserId}/media`);
    containerUrl.searchParams.set('image_url', imageUrl);
    containerUrl.searchParams.set('caption', caption);
    containerUrl.searchParams.set('access_token', accessToken);

    const containerRes = await httpsRequest(containerUrl.toString(), 'POST', {});
    if (containerRes.statusCode >= 400 || !containerRes.data?.id) {
      const errorMsg =
        containerRes.data?.error?.message ||
        `Instagram media container creation failed (HTTP ${containerRes.statusCode}).`;
      throw new BadRequestException(`Meta Graph API Error: ${errorMsg}`);
    }

    const creationId = containerRes.data.id;

    // Brief delay to allow Meta CDN to ingest the image container
    await new Promise((r) => setTimeout(r, 2000));

    // Step 2: Publish the media container
    const publishUrl = new URL(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`);
    publishUrl.searchParams.set('creation_id', creationId);
    publishUrl.searchParams.set('access_token', accessToken);

    const publishRes = await httpsRequest(publishUrl.toString(), 'POST', {});
    if (publishRes.statusCode >= 400 || !publishRes.data?.id) {
      const errorMsg =
        publishRes.data?.error?.message ||
        `Instagram publishing failed (HTTP ${publishRes.statusCode}).`;
      throw new BadRequestException(`Meta Graph API Error: ${errorMsg}`);
    }

    const mediaId = publishRes.data.id;

    // Step 3: Fetch the live permalink
    let liveUrl = `https://www.instagram.com/p/${mediaId}/`;
    try {
      const infoUrl = new URL(`https://graph.facebook.com/v21.0/${mediaId}`);
      infoUrl.searchParams.set('fields', 'permalink');
      infoUrl.searchParams.set('access_token', accessToken);
      const infoRes = await httpsRequest(infoUrl.toString(), 'GET', {});
      if (infoRes.data?.permalink) {
        liveUrl = infoRes.data.permalink;
      }
    } catch {}

    return { postId: mediaId, liveUrl };
  }

  /**
   * Publish a photo or post to Facebook Page via Meta Graph API v21.0
   * POST /{page-id}/photos
   */
  async publishToFacebook(params: {
    pageId: string;
    accessToken: string;
    imageUrl: string;
    caption: string;
  }): Promise<{ postId: string; liveUrl: string }> {
    const { pageId, accessToken, imageUrl, caption } = params;

    const postUrl = new URL(`https://graph.facebook.com/v21.0/${pageId}/photos`);
    postUrl.searchParams.set('url', imageUrl);
    postUrl.searchParams.set('caption', caption);
    postUrl.searchParams.set('access_token', accessToken);

    const res = await httpsRequest(postUrl.toString(), 'POST', {});
    if (res.statusCode >= 400 || !res.data?.id) {
      const errorMsg =
        res.data?.error?.message || `Facebook post failed (HTTP ${res.statusCode}).`;
      throw new BadRequestException(`Facebook API Error: ${errorMsg}`);
    }

    const postId = res.data.post_id || res.data.id;
    const liveUrl = `https://www.facebook.com/${postId}`;

    return { postId, liveUrl };
  }

  /**
   * Publish a post to LinkedIn Company Page or Personal Profile
   * POST https://api.linkedin.com/rest/posts
   */
  async publishToLinkedIn(params: {
    authorUrn: string;
    accessToken: string;
    caption: string;
    imageUrl?: string;
  }): Promise<{ postId: string; liveUrl: string }> {
    const { authorUrn, accessToken, caption } = params;

    const payload: any = {
      author: authorUrn.startsWith('urn:li:') ? authorUrn : `urn:li:organization:${authorUrn}`,
      commentary: caption,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    const res = await httpsRequest(
      'https://api.linkedin.com/rest/posts',
      'POST',
      {
        Authorization: `Bearer ${accessToken}`,
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      payload,
    );

    if (res.statusCode >= 400) {
      const errorMsg =
        res.data?.message || `LinkedIn post failed (HTTP ${res.statusCode}).`;
      throw new BadRequestException(`LinkedIn API Error: ${errorMsg}`);
    }

    const postUrn = (res.headers['x-restli-id'] as string) || '';
    const liveUrl = postUrn
      ? `https://www.linkedin.com/feed/update/${postUrn}`
      : 'https://www.linkedin.com/feed/';

    return { postId: postUrn || 'linkedin_post', liveUrl };
  }

  /**
   * Test connection with Meta Graph API to verify token validity & page details
   */
  async testMetaConnection(account: {
    platform: string;
    platformAccountId?: string | null;
    accessToken?: string | null;
  }): Promise<{ valid: boolean; accountName?: string; details?: any }> {
    if (!account.accessToken) {
      return { valid: false };
    }

    try {
      const targetId = account.platformAccountId || 'me';
      const testUrl = new URL(`https://graph.facebook.com/v21.0/${targetId}`);
      testUrl.searchParams.set('fields', 'id,name,username');
      testUrl.searchParams.set('access_token', account.accessToken);

      const res = await httpsRequest(testUrl.toString(), 'GET', {});
      if (res.statusCode === 200 && res.data?.id) {
        return {
          valid: true,
          accountName: res.data.name || res.data.username || undefined,
          details: res.data,
        };
      }
      return { valid: false, details: res.data };
    } catch (e: any) {
      return { valid: false, details: e.message };
    }
  }

  /**
   * Master One-Click Direct Publish for a content item
   */
  async executeDirectPublish(contentId: number, actor: Actor): Promise<any> {
    const content = await this.db.contentItem.findUnique({
      where: { id: contentId },
      include: {
        client: {
          include: {
            accounts: true,
          },
        },
        script: true,
        publishing: true,
        versions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        creativeAssets: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!content) {
      throw new NotFoundException(`Content item CNT-${contentId} not found.`);
    }

    const platformUpper = content.platform.toUpperCase().trim();
    const targetPlatform =
      platformUpper.includes('INSTAGRAM')
        ? 'INSTAGRAM'
        : platformUpper.includes('FACEBOOK')
        ? 'FACEBOOK'
        : platformUpper.includes('LINKEDIN')
        ? 'LINKEDIN'
        : platformUpper;

    // Find the client's connected social account for this platform
    const connectedAccount = (content.client as any).accounts?.find(
      (acc: any) =>
        acc.platform.toUpperCase() === targetPlatform &&
        acc.isConnected &&
        Boolean(acc.accessToken),
    );

    if (!connectedAccount || !connectedAccount.accessToken) {
      throw new BadRequestException(
        `No active connected ${targetPlatform} account found for client "${content.client.name}". ` +
          `Please configure the ${targetPlatform} credentials under Client Settings → Connected Channels.`,
      );
    }

    // Determine the final media URL
    let mediaUrl =
      content.publishing?.finalDriveUrl ||
      content.creativeAssets[0]?.imageUrl ||
      content.versions[0]?.driveUrl ||
      '';

    mediaUrl = normalizePublicMediaUrl(mediaUrl);

    // Instagram & Facebook photo posts require an accessible media URL
    if (['INSTAGRAM', 'FACEBOOK'].includes(targetPlatform) && !mediaUrl) {
      throw new BadRequestException(
        `Cannot publish to ${targetPlatform} without a media asset. Please ensure an approved visual or drive link is attached.`,
      );
    }

    // Format final caption with hashtags
    const rawCaption = content.publishing?.caption || content.script?.caption || content.title;
    const rawHashtags = content.publishing?.hashtags || content.script?.hashtags || '';
    const finalCaption = rawHashtags
      ? `${rawCaption}\n\n${rawHashtags}`.trim()
      : rawCaption.trim();

    let publishResult: { postId: string; liveUrl: string };

    console.log(
      `[Social Publishing] Triggering One-Click Publish for CNT-${content.id} on ${targetPlatform} (${connectedAccount.handle})...`,
    );

    if (targetPlatform === 'INSTAGRAM') {
      if (!connectedAccount.platformAccountId) {
        throw new BadRequestException(
          'Instagram Business Account ID is missing on the connected account.',
        );
      }
      publishResult = await this.publishToInstagram({
        igUserId: connectedAccount.platformAccountId,
        accessToken: connectedAccount.accessToken,
        imageUrl: mediaUrl,
        caption: finalCaption,
      });
    } else if (targetPlatform === 'FACEBOOK') {
      const pageId = connectedAccount.platformAccountId || 'me';
      publishResult = await this.publishToFacebook({
        pageId,
        accessToken: connectedAccount.accessToken,
        imageUrl: mediaUrl,
        caption: finalCaption,
      });
    } else if (targetPlatform === 'LINKEDIN') {
      const authorUrn = connectedAccount.platformAccountId || 'me';
      publishResult = await this.publishToLinkedIn({
        authorUrn,
        accessToken: connectedAccount.accessToken,
        caption: finalCaption,
        imageUrl: mediaUrl || undefined,
      });
    } else {
      throw new BadRequestException(
        `Direct 1-Click Publishing for "${content.platform}" is not yet supported. Supported: Instagram, Facebook, LinkedIn.`,
      );
    }

    // Update publishing record and content item status to PUBLISHED atomically
    const now = new Date();
    await this.db.atomic(async (tx) => {
      await tx.publishingRecord.upsert({
        where: { contentId: content.id },
        create: {
          contentId: content.id,
          finalDriveUrl: mediaUrl,
          caption: rawCaption,
          hashtags: rawHashtags,
          status: 'PUBLISHED',
          publishedUrl: publishResult.liveUrl,
          externalPostId: publishResult.postId,
          publishedAt: now,
          publishedById: actor.id,
        },
        update: {
          status: 'PUBLISHED',
          publishedUrl: publishResult.liveUrl,
          externalPostId: publishResult.postId,
          publishedAt: now,
          publishedById: actor.id,
        },
      });

      await tx.contentItem.update({
        where: { id: content.id },
        data: {
          status: 'PUBLISHED',
        },
      });

      await tx.contentStatusHistory.create({
        data: {
          contentId: content.id,
          actorId: actor.id,
          previous: content.status,
          next: 'PUBLISHED',
          event: `content.direct_published_${targetPlatform.toLowerCase()}`,
        },
      });

      await audit(
        tx,
        actor,
        'content.published',
        'ContentItem',
        String(content.id),
        {
          clientId: content.clientId,
          contentId: content.id,
          next: {
            liveUrl: publishResult.liveUrl,
            platform: targetPlatform,
            postId: publishResult.postId,
          },
        },
      );
    });

    return {
      success: true,
      platform: targetPlatform,
      handle: connectedAccount.handle,
      liveUrl: publishResult.liveUrl,
      postId: publishResult.postId,
      publishedAt: now.toISOString(),
      contentId: content.id,
    };
  }
}

@Controller('social-publishing')
export class SocialPublishingController {
  constructor(
    private service: SocialPublishingService,
    private db: Database,
    private access: Access,
  ) {}

  /**
   * One-Click Direct Publish endpoint
   */
  @Post('publish/:contentId')
  @Require('publish.manage')
  async publishContent(
    @CurrentActor() actor: Actor,
    @Param('contentId') contentIdStr: string,
  ) {
    this.access.permission(actor, 'publish.manage');
    const contentId = parseInt(contentIdStr, 10);
    if (isNaN(contentId)) {
      throw new BadRequestException('Invalid content ID');
    }
    await this.access.content(actor, contentId);
    return this.service.executeDirectPublish(contentId, actor);
  }

  /**
   * Get connected social accounts for a client
   */
  @Get('accounts/:clientId')
  @Require('client.view')
  async getAccounts(
    @CurrentActor() actor: Actor,
    @Param('clientId') clientId: string,
  ) {
    this.access.permission(actor, 'client.view');
    await this.access.client(actor, clientId);
    const accounts = await this.db.socialAccount.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });

    // Mask sensitive access tokens in response
    return accounts.map((acc) => ({
      id: acc.id,
      clientId: acc.clientId,
      platform: acc.platform,
      handle: acc.handle,
      url: acc.url,
      accountName: acc.accountName,
      platformAccountId: acc.platformAccountId,
      isConnected: acc.isConnected && Boolean(acc.accessToken),
      tokenExpiresAt: acc.tokenExpiresAt,
      hasToken: Boolean(acc.accessToken),
      createdAt: acc.createdAt,
    }));
  }

  /**
   * Save or update connected social credentials for a client
   */
  @Post('accounts/:clientId')
  @Require('client.edit')
  async saveAccount(
    @CurrentActor() actor: Actor,
    @Param('clientId') clientId: string,
    @Body() body: any,
  ) {
    this.access.permission(actor, 'client.edit');
    this.access.internal(actor);
    await this.access.client(actor, clientId);

    const {
      platform,
      handle,
      url,
      platformAccountId,
      accountName,
      accessToken,
      refreshToken,
      tokenExpiresAt,
    } = body || {};

    if (!platform || !handle) {
      throw new BadRequestException('Platform and handle are required.');
    }

    const platformUpper = platform.toUpperCase().trim();

    // Verify token validity with Meta if token provided
    let isConnected = Boolean(accessToken);
    let verifiedName = accountName;

    if (accessToken && ['INSTAGRAM', 'FACEBOOK'].includes(platformUpper)) {
      const test = await this.service.testMetaConnection({
        platform: platformUpper,
        platformAccountId,
        accessToken,
      });
      if (test.valid) {
        isConnected = true;
        if (test.accountName && !verifiedName) {
          verifiedName = test.accountName;
        }
      }
    }

    return this.db.atomic(async (tx) => {
      // Upsert social account
      const existing = await tx.socialAccount.findFirst({
        where: { clientId, platform: platformUpper },
      });

      let saved;
      if (existing) {
        saved = await tx.socialAccount.update({
          where: { id: existing.id },
          data: {
            handle: handle.trim(),
            url: url || null,
            platformAccountId: platformAccountId?.trim() || existing.platformAccountId,
            accountName: verifiedName || existing.accountName,
            accessToken: accessToken ? accessToken.trim() : existing.accessToken,
            refreshToken: refreshToken ? refreshToken.trim() : existing.refreshToken,
            tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : existing.tokenExpiresAt,
            isConnected,
          },
        });
      } else {
        saved = await tx.socialAccount.create({
          data: {
            clientId,
            platform: platformUpper,
            handle: handle.trim(),
            url: url || null,
            platformAccountId: platformAccountId?.trim() || null,
            accountName: verifiedName || null,
            accessToken: accessToken ? accessToken.trim() : null,
            refreshToken: refreshToken ? refreshToken.trim() : null,
            tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
            isConnected,
          },
        });
      }

      await audit(
        tx,
        actor,
        'client.social_connected',
        'SocialAccount',
        saved.id,
        { clientId, next: { platform: platformUpper, handle } },
      );

      return {
        id: saved.id,
        platform: saved.platform,
        handle: saved.handle,
        accountName: saved.accountName,
        isConnected: saved.isConnected,
      };
    });
  }

  /**
   * Delete / disconnect a social account
   */
  @Delete('accounts/:id')
  @Require('client.edit')
  async deleteAccount(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ) {
    this.access.permission(actor, 'client.edit');
    this.access.internal(actor);

    const existing = await this.db.socialAccount.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    await this.access.client(actor, existing.clientId);

    await this.db.atomic(async (tx) => {
      await tx.socialAccount.delete({
        where: { id },
      });

      await audit(
        tx,
        actor,
        'client.social_disconnected',
        'SocialAccount',
        existing.id,
        {
          clientId: existing.clientId,
          previous: { platform: existing.platform, handle: existing.handle },
        },
      );
    });

    return { ok: true };
  }

  /**
   * Test connection health for an account
   */
  @Post('test-connection/:id')
  @Require('client.edit')
  async testConnection(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
  ) {
    this.access.permission(actor, 'client.edit');
    this.access.internal(actor);

    const account = await this.db.socialAccount.findUnique({
      where: { id },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    await this.access.client(actor, account.clientId);

    if (['INSTAGRAM', 'FACEBOOK'].includes(account.platform.toUpperCase())) {
      const result = await this.service.testMetaConnection(account);
      return {
        platform: account.platform,
        valid: result.valid,
        accountName: result.accountName || account.accountName,
        details: result.details,
      };
    }

    return {
      platform: account.platform,
      valid: Boolean(account.accessToken),
      accountName: account.accountName,
    };
  }
}

@Module({
  controllers: [SocialPublishingController],
  providers: [SocialPublishingService],
  exports: [SocialPublishingService],
})
export class SocialPublishingModule {}
