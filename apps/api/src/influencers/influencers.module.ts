import { Body, Controller, Get, Module, OnModuleInit, Param, Post, Put, Query, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { Database } from '../core/database';
import { Access, CurrentActor, Public } from '../core/security';
import { Actor } from '../core/types';
import { NotificationsService } from '../notifications/notifications.module';
import fs from 'node:fs';
import path from 'node:path';

export const INFLUENCER_COLUMNS = [
  { key: 'name', label: 'Name', col: 'A', width: 160 },
  { key: 'instaId', label: 'Insta Id', col: 'B', width: 150 },
  { key: 'phone', label: 'Phone', col: 'C', width: 130 },
  { key: 'email', label: 'Email', col: 'D', width: 180 },
  { key: 'genre', label: 'Genre', col: 'E', width: 130 },
  { key: 'age', label: 'Age', col: 'F', width: 70 },
  { key: 'gender', label: 'Gender', col: 'G', width: 90 },
  { key: 'city', label: 'City', col: 'H', width: 120 },
  { key: 'address', label: 'Address', col: 'I', width: 220 },
  { key: 'followers', label: 'Followers', col: 'J', width: 100 },
  { key: 'brand', label: 'Brand', col: 'K', width: 150 },
  { key: 'reel', label: 'Reel Commercial', col: 'L', width: 130 },
  { key: 'story', label: 'Story Commercial', col: 'M', width: 130 },
  { key: 'status', label: 'Status', col: 'N', width: 110 },
] as const;

export function buildDefaultInfluencerWorkbook() {
  const colWidths: Record<string, number> = {
    A: 160,
    B: 150,
    C: 130,
    D: 180,
    E: 130,
    F: 70,
    G: 90,
    H: 120,
    I: 220,
    J: 100,
    K: 150,
    L: 130,
    M: 130,
    N: 110,
  };

  const headerBg = '#fdf2f8'; // subtle influencer rose
  const headerColor = '#be185d';

  const headerData: Record<string, any> = {
    A1: { v: 'Name', bold: true, bg: headerBg, color: headerColor },
    B1: { v: 'Insta Id', bold: true, bg: headerBg, color: headerColor },
    C1: { v: 'Phone', bold: true, bg: headerBg, color: headerColor },
    D1: { v: 'Email', bold: true, bg: headerBg, color: headerColor },
    E1: { v: 'Genre', bold: true, bg: headerBg, color: headerColor },
    F1: { v: 'Age', bold: true, bg: headerBg, color: headerColor, align: 'center' },
    G1: { v: 'Gender', bold: true, bg: headerBg, color: headerColor, align: 'center' },
    H1: { v: 'City', bold: true, bg: headerBg, color: headerColor },
    I1: { v: 'Address', bold: true, bg: headerBg, color: headerColor },
    J1: { v: 'Followers', bold: true, bg: headerBg, color: headerColor, align: 'right' },
    K1: { v: 'Brand', bold: true, bg: headerBg, color: headerColor },
    L1: { v: 'Reel Commercial', bold: true, bg: headerBg, color: headerColor, align: 'right' },
    M1: { v: 'Story Commercial', bold: true, bg: headerBg, color: headerColor, align: 'right' },
    N1: { v: 'Status', bold: true, bg: headerBg, color: headerColor, align: 'center' },
  };

  return {
    activeTab: 'tab_master',
    tabs: [
      {
        id: 'tab_master',
        name: '🌟 Master Influencers',
        color: '#be185d',
        rowCount: 50,
        colCount: 20,
        colWidths,
        data: headerData,
      },
    ],
  };
}

@Controller('influencers')
export class InfluencersController implements OnModuleInit {
  private fallbackDir: string;
  private docId = 'sheet_influencers';

  constructor(
    private db: Database,
    private access: Access,
    private notifications: NotificationsService
  ) {
    this.fallbackDir = path.resolve(process.cwd(), '.sheets_cache');
    try {
      if (!fs.existsSync(this.fallbackDir)) {
        fs.mkdirSync(this.fallbackDir, { recursive: true });
      }
    } catch {}
  }

  async onModuleInit() {
    await this.ensureTable();
  }

  private async ensureTable() {
    try {
      await (this.db as any).$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`Spreadsheet\` (
          \`id\` VARCHAR(191) NOT NULL PRIMARY KEY,
          \`agencyId\` VARCHAR(191) NOT NULL,
          \`title\` VARCHAR(191) NOT NULL DEFAULT 'Influencer Marketing',
          \`data\` LONGTEXT NOT NULL,
          \`updatedBy\` VARCHAR(191) NULL,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          INDEX \`Spreadsheet_agencyId_idx\` (\`agencyId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    } catch {}
  }

  private getFallbackFile(agencyId: string): string {
    return path.join(this.fallbackDir, `${agencyId}_${this.docId}.json`);
  }

  /**
   * Access check: ADMIN, SUPER_ADMIN, DEVELOPER, and SMM ONLY
   */
  private checkAccess(a: Actor) {
    if (!a) throw new UnauthorizedException('Authentication required');
    if (a.isSuperAdmin) return;
    const role = (a.roleName || '').toLowerCase().trim();
    const isPermitted =
      role === 'super admin' ||
      role === 'admin' ||
      role === 'developer' ||
      role === 'smm' ||
      role === 'social media manager' ||
      role.includes('admin') ||
      role.includes('developer') ||
      role.includes('smm');

    if (!isPermitted) {
      throw new UnauthorizedException('Access restricted: Influencer Marketing is accessible only to Admin, Developer, and SMM.');
    }
  }

  private async loadWorkbook(agencyId: string, actorName?: string): Promise<any> {
    let record: any = null;
    try {
      const rows: any[] = await (this.db as any).$queryRawUnsafe(
        'SELECT * FROM `Spreadsheet` WHERE id = ? AND agencyId = ? LIMIT 1',
        this.docId,
        agencyId
      );
      if (rows && rows.length > 0) record = rows[0];
    } catch {}

    if (!record) {
      try {
        const raw = fs.readFileSync(this.getFallbackFile(agencyId), 'utf8');
        record = JSON.parse(raw);
      } catch {}
    }

    if (!record) {
      const defaultWb = buildDefaultInfluencerWorkbook();
      record = {
        id: this.docId,
        agencyId,
        title: 'Influencer Marketing',
        data: JSON.stringify(defaultWb),
        updatedBy: actorName || 'System',
        updatedAt: new Date().toISOString(),
      };
      try {
        await (this.db as any).$executeRawUnsafe(
          'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title)',
          record.id,
          record.agencyId,
          record.title,
          record.data,
          record.updatedBy
        );
      } catch {}
      try {
        fs.writeFileSync(this.getFallbackFile(agencyId), JSON.stringify(record), 'utf8');
      } catch {}
    }

    let parsed = null;
    if (typeof record.data === 'string') {
      try {
        parsed = JSON.parse(record.data);
      } catch {
        parsed = buildDefaultInfluencerWorkbook();
      }
    } else if (record.data && typeof record.data === 'object') {
      parsed = record.data;
    } else {
      parsed = buildDefaultInfluencerWorkbook();
    }

    return {
      id: record.id || this.docId,
      agencyId,
      title: record.title || 'Influencer Marketing',
      data: parsed,
      updatedBy: record.updatedBy,
      updatedAt: record.updatedAt,
    };
  }

  private async saveWorkbook(agencyId: string, wb: any, updatedBy: string, title = 'Influencer Marketing') {
    const dataString = typeof wb === 'string' ? wb : JSON.stringify(wb);
    const now = new Date();
    try {
      await (this.db as any).$executeRawUnsafe(
        'INSERT INTO `Spreadsheet` (id, agencyId, title, data, updatedBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE title = VALUES(title), data = VALUES(data), updatedBy = VALUES(updatedBy), updatedAt = VALUES(updatedAt)',
        this.docId,
        agencyId,
        title,
        dataString,
        updatedBy,
        now
      );
    } catch {}

    try {
      fs.writeFileSync(
        this.getFallbackFile(agencyId),
        JSON.stringify({
          id: this.docId,
          agencyId,
          title,
          data: wb,
          updatedBy,
          updatedAt: now.toISOString(),
        }),
        'utf8'
      );
    } catch {}
  }

  @Get('sheet')
  async getSheet(@CurrentActor() a: Actor) {
    this.checkAccess(a);
    return this.loadWorkbook(a.agencyId, a.name);
  }

  @Put('sheet')
  async updateSheet(@CurrentActor() a: Actor, @Body() body: any) {
    this.checkAccess(a);
    const wb = body.data || body;
    const title = body.title || 'Influencer Marketing';
    await this.saveWorkbook(a.agencyId, wb, a.name, title);
    return { ok: true, updatedAt: new Date().toISOString() };
  }

  @Get('brands')
  async getBrands(@CurrentActor() a: Actor) {
    this.checkAccess(a);
    try {
      const clients = await this.db.client.findMany({
        where: { agencyId: a.agencyId, active: true },
        select: { id: true, name: true, color: true },
        orderBy: { name: 'asc' },
      });
      return clients;
    } catch {
      return [];
    }
  }

  /**
   * Helper to append a single influencer submission to the workbook
   */
  private appendInfluencerToWorkbook(wb: any, item: Record<string, string>) {
    // 1. Ensure master tab exists
    let masterTab = wb.tabs.find((t: any) => t.id === 'tab_master' || t.name.includes('Master'));
    if (!masterTab) {
      masterTab = wb.tabs[0];
    }

    // Find next empty row in master tab
    let nextRow = 2;
    while (masterTab.data[`A${nextRow}`]?.v || masterTab.data[`B${nextRow}`]?.v) {
      nextRow++;
    }
    if (nextRow > masterTab.rowCount) {
      masterTab.rowCount = nextRow + 10;
    }

    // Populate Master tab row
    masterTab.data[`A${nextRow}`] = { v: item.name || '' };
    masterTab.data[`B${nextRow}`] = { v: item.instaId || '', color: '#0284c7' };
    masterTab.data[`C${nextRow}`] = { v: item.phone || '' };
    masterTab.data[`D${nextRow}`] = { v: item.email || '' };
    masterTab.data[`E${nextRow}`] = { v: item.genre || '' };
    masterTab.data[`F${nextRow}`] = { v: item.age || '', align: 'center' };
    masterTab.data[`G${nextRow}`] = { v: item.gender || '', align: 'center' };
    masterTab.data[`H${nextRow}`] = { v: item.city || '' };
    masterTab.data[`I${nextRow}`] = { v: item.address || '' };
    masterTab.data[`J${nextRow}`] = { v: item.followers || '', align: 'right', bold: true };
    masterTab.data[`K${nextRow}`] = { v: item.brand || '', bold: true, color: '#be185d' };
    masterTab.data[`L${nextRow}`] = { v: item.reel || '', align: 'right' };
    masterTab.data[`M${nextRow}`] = { v: item.story || '', align: 'right' };
    masterTab.data[`N${nextRow}`] = {
      v: item.status || 'New Submission',
      align: 'center',
      bold: true,
      bg: '#e0f2fe',
      color: '#0369a1',
    };

    // 2. If a brand was specified, sync into that brand's separated sheet!
    const brandName = (item.brand || '').trim();
    if (brandName) {
      let brandTab = wb.tabs.find(
        (t: any) => t.id !== masterTab.id && t.name.toLowerCase().trim() === brandName.toLowerCase()
      );

      const colWidths = masterTab.colWidths || {
        A: 160, B: 150, C: 130, D: 180, E: 130, F: 70, G: 90, H: 120, I: 220, J: 100, K: 150, L: 130, M: 130, N: 110
      };

      if (!brandTab) {
        // Create new brand tab automatically
        const newTabId = 'tab_brand_' + Math.random().toString(36).substring(2, 8);
        brandTab = {
          id: newTabId,
          name: brandName,
          color: '#e1306c',
          rowCount: 50,
          colCount: 20,
          colWidths,
          data: {
            A1: { v: 'Name', bold: true, bg: '#fdf2f8', color: '#be185d' },
            B1: { v: 'Insta Id', bold: true, bg: '#fdf2f8', color: '#be185d' },
            C1: { v: 'Phone', bold: true, bg: '#fdf2f8', color: '#be185d' },
            D1: { v: 'Email', bold: true, bg: '#fdf2f8', color: '#be185d' },
            E1: { v: 'Genre', bold: true, bg: '#fdf2f8', color: '#be185d' },
            F1: { v: 'Age', bold: true, bg: '#fdf2f8', color: '#be185d', align: 'center' },
            G1: { v: 'Gender', bold: true, bg: '#fdf2f8', color: '#be185d', align: 'center' },
            H1: { v: 'City', bold: true, bg: '#fdf2f8', color: '#be185d' },
            I1: { v: 'Address', bold: true, bg: '#fdf2f8', color: '#be185d' },
            J1: { v: 'Followers', bold: true, bg: '#fdf2f8', color: '#be185d', align: 'right' },
            K1: { v: 'Brand', bold: true, bg: '#fdf2f8', color: '#be185d' },
            L1: { v: 'Reel Commercial', bold: true, bg: '#fdf2f8', color: '#be185d', align: 'right' },
            M1: { v: 'Story Commercial', bold: true, bg: '#fdf2f8', color: '#be185d', align: 'right' },
            N1: { v: 'Status', bold: true, bg: '#fdf2f8', color: '#be185d', align: 'center' },
          },
        };
        wb.tabs.push(brandTab);
      }

      // Find next empty row in brand tab
      let bRow = 2;
      while (brandTab.data[`A${bRow}`]?.v || brandTab.data[`B${bRow}`]?.v) {
        bRow++;
      }
      if (bRow > brandTab.rowCount) {
        brandTab.rowCount = bRow + 10;
      }

      brandTab.data[`A${bRow}`] = { v: item.name || '' };
      brandTab.data[`B${bRow}`] = { v: item.instaId || '', color: '#0284c7' };
      brandTab.data[`C${bRow}`] = { v: item.phone || '' };
      brandTab.data[`D${bRow}`] = { v: item.email || '' };
      brandTab.data[`E${bRow}`] = { v: item.genre || '' };
      brandTab.data[`F${bRow}`] = { v: item.age || '', align: 'center' };
      brandTab.data[`G${bRow}`] = { v: item.gender || '', align: 'center' };
      brandTab.data[`H${bRow}`] = { v: item.city || '' };
      brandTab.data[`I${bRow}`] = { v: item.address || '' };
      brandTab.data[`J${bRow}`] = { v: item.followers || '', align: 'right', bold: true };
      brandTab.data[`K${bRow}`] = { v: brandName, bold: true, color: '#be185d' };
      brandTab.data[`L${bRow}`] = { v: item.reel || '', align: 'right' };
      brandTab.data[`M${bRow}`] = { v: item.story || '', align: 'right' };
      brandTab.data[`N${bRow}`] = {
        v: item.status || 'New Submission',
        align: 'center',
        bold: true,
        bg: '#e0f2fe',
        color: '#0369a1',
      };
    }
  }

  /**
   * Public Webhook endpoint for Google Forms & Public Intake Form
   */
  @Public()
  @Post('webhook')
  async handleWebhook(@Body() rawBody: any, @Query('agencyId') agencyQuery?: string) {
    const agencyId = agencyQuery || rawBody?.agencyId || 'mad-o-media';

    // Normalize field names (supports multiple variations from Google Forms / Webhooks)
    const normalized: Record<string, string> = {
      name:
        rawBody.name ||
        rawBody['Name'] ||
        rawBody['Full Name'] ||
        rawBody['Influencer Name'] ||
        '',
      instaId:
        rawBody.instaId ||
        rawBody.instagram ||
        rawBody['Insta Id'] ||
        rawBody['Instagram Handle'] ||
        rawBody['Instagram'] ||
        rawBody['Insta ID'] ||
        '',
      phone:
        rawBody.phone ||
        rawBody.mobile ||
        rawBody['Phone'] ||
        rawBody['Phone Number'] ||
        rawBody['WhatsApp'] ||
        rawBody['Contact'] ||
        '',
      email:
        rawBody.email ||
        rawBody['Email'] ||
        rawBody['Email Address'] ||
        '',
      genre:
        rawBody.genre ||
        rawBody.niche ||
        rawBody.category ||
        rawBody['Genre'] ||
        rawBody['Niche'] ||
        rawBody['Category'] ||
        '',
      age: String(
        rawBody.age ||
        rawBody['Age'] ||
        ''
      ),
      gender:
        rawBody.gender ||
        rawBody['Gender'] ||
        '',
      city:
        rawBody.city ||
        rawBody['City'] ||
        rawBody['Location'] ||
        '',
      address:
        rawBody.address ||
        rawBody['Address'] ||
        rawBody['Shipping Address'] ||
        '',
      followers: String(
        rawBody.followers ||
        rawBody['Followers'] ||
        rawBody['Follower Count'] ||
        ''
      ),
      brand:
        rawBody.brand ||
        rawBody['Brand'] ||
        rawBody['Brand Name'] ||
        rawBody['Campaign'] ||
        'General',
      reel: String(
        rawBody.reel ||
        rawBody.commercialReel ||
        rawBody['Reel'] ||
        rawBody['Commercials Reel'] ||
        rawBody['Reel Rate'] ||
        rawBody['Reel Commercial'] ||
        ''
      ),
      story: String(
        rawBody.story ||
        rawBody.commercialStory ||
        rawBody['Story'] ||
        rawBody['Commercials Story'] ||
        rawBody['Story Rate'] ||
        rawBody['Story Commercial'] ||
        ''
      ),
      status: 'New Intake',
    };

    if (!normalized.name && !normalized.instaId && !normalized.email) {
      return { ok: false, message: 'Invalid payload: at least name or instaId required' };
    }

    const { data: wb } = await this.loadWorkbook(agencyId, 'Google Form / Webhook');
    this.appendInfluencerToWorkbook(wb, normalized);
    await this.saveWorkbook(agencyId, wb, 'Google Form / Webhook', 'Influencer Marketing');

    // Notify internal SMM and Admin users
    try {
      const internalUsers = await this.db.user.findMany({
        where: { agencyId, active: true },
        include: { role: true },
      });
      const targetUserIds = internalUsers
        .filter((u) => {
          if (u.role.isSuperAdmin) return true;
          const r = u.role.name.toLowerCase();
          return r === 'admin' || r === 'smm' || r === 'social media manager' || r === 'developer';
        })
        .map((u) => u.id);

      if (targetUserIds.length > 0) {
        await this.db.atomic(async (tx) => {
          await this.notifications.emit(
            tx,
            targetUserIds,
            {
              event: 'influencer.submission',
              title: `🌟 New Influencer: ${normalized.name || normalized.instaId}`,
              body: `${normalized.instaId} (${normalized.followers} followers) submitted for ${normalized.brand}. Rates: Reel ${normalized.reel || 'N/A'}, Story ${normalized.story || 'N/A'}.`,
              href: '/influencer-marketing',
              key: `influencer:${Date.now()}:${normalized.instaId || normalized.name}`,
            },
            agencyId
          );
        });
      }
    } catch {}

    return {
      ok: true,
      message: 'Influencer record added successfully to Master and Brand sheets',
      data: normalized,
    };
  }

  /**
   * Internal quick-add endpoint from modal
   */
  @Post('quick-add')
  async quickAdd(@CurrentActor() a: Actor, @Body() body: any) {
    this.checkAccess(a);
    const { data: wb } = await this.loadWorkbook(a.agencyId, a.name);
    this.appendInfluencerToWorkbook(wb, body);
    await this.saveWorkbook(a.agencyId, wb, a.name, 'Influencer Marketing');
    return { ok: true, message: 'Creator added successfully' };
  }
}

@Module({
  controllers: [InfluencersController],
  providers: [],
  exports: [],
})
export class InfluencersModule {}
