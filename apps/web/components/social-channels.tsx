'use client';

import { useState } from 'react';
import {
  Share2,
  Sparkles,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Plus,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp, useMutation, useResource } from '@/lib/api';
import { Button } from './ui/button';
import { Panel, Modal, Badge, Loading } from './shared';

interface SocialAccountData {
  id: string;
  clientId: string;
  platform: string;
  handle: string;
  url?: string | null;
  accountName?: string | null;
  platformAccountId?: string | null;
  isConnected: boolean;
  hasToken: boolean;
  tokenExpiresAt?: string | null;
  createdAt: string;
}

const SUPPORTED_PLATFORMS = [
  {
    key: 'INSTAGRAM',
    name: 'Instagram Business',
    iconColor: '#E1306C',
    description: 'Auto-publish approved single image and carousel posts directly to the feed.',
    idLabel: 'Instagram Business Account ID',
    idPlaceholder: 'e.g. 17841405309212345',
    tokenLabel: 'Meta Page / System User Access Token',
    tokenHelp: 'Generated via Meta for Developers. Must have instagram_basic and instagram_content_publish permissions.',
    guideUrl: 'https://developers.facebook.com/docs/instagram-api/getting-started',
    guideSteps: [
      'Go to Meta for Developers (developers.facebook.com) and open or create an App (Business type).',
      'Under App settings, add the Instagram Graph API and Facebook Login for Business products.',
      'In the Graph API Explorer, select your client’s connected Facebook Page & Instagram account.',
      'Grant permissions: instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement.',
      'Generate a Page Access Token (or 60-day long-lived token) and copy the Instagram Business Account ID here.',
    ],
  },
  {
    key: 'FACEBOOK',
    name: 'Facebook Page',
    iconColor: '#1877F2',
    description: 'Auto-publish approved visual posts and updates directly to the official Facebook Page.',
    idLabel: 'Facebook Page ID',
    idPlaceholder: 'e.g. 102938475610293',
    tokenLabel: 'Page Access Token',
    tokenHelp: 'Page token with pages_manage_posts and pages_read_engagement permissions.',
    guideUrl: 'https://developers.facebook.com/docs/pages/publishing',
    guideSteps: [
      'In Meta Graph API Explorer, select the client’s Facebook Page from the User/Page dropdown.',
      'Ensure permissions include pages_manage_posts and pages_read_engagement.',
      'Click "Generate Access Token". For production, exchange for a long-lived Page Token.',
      'Copy the numeric Page ID and the Access Token into the fields below.',
    ],
  },
  {
    key: 'LINKEDIN',
    name: 'LinkedIn Company / Profile',
    iconColor: '#0A66C2',
    description: 'Auto-publish company updates and visual articles directly to LinkedIn.',
    idLabel: 'Author URN (Organization or Person)',
    idPlaceholder: 'e.g. urn:li:organization:12345678 or urn:li:person:abcdef',
    tokenLabel: 'OAuth Access Token',
    tokenHelp: 'Bearer token with w_member_social or w_organization_social permissions.',
    guideUrl: 'https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin',
    guideSteps: [
      'Create an App in LinkedIn Developer Portal (linkedin.com/developers).',
      'Enable the "Share on LinkedIn" and "Sign In with LinkedIn" products.',
      'If publishing to a Company Page, request the "Community Management API" access.',
      'Generate an OAuth 2.0 access token with w_member_social or w_organization_social scope.',
      'Enter the Organization URN (or Person URN) and Access Token below.',
    ],
  },
  {
    key: 'YOUTUBE',
    name: 'YouTube',
    iconColor: '#FF0000',
    description: 'Channel profile link & metadata for reference.',
    idLabel: 'Channel ID',
    idPlaceholder: 'e.g. UCxxxxxxxxxxxx',
    tokenLabel: 'Access Token (Optional)',
    tokenHelp: 'Optional for reference.',
    guideSteps: [],
  },
  {
    key: 'X',
    name: 'X (Twitter)',
    iconColor: '#1DA1F2',
    description: 'Account handle & profile link for reference.',
    idLabel: 'User ID (Optional)',
    idPlaceholder: 'e.g. 1234567890',
    tokenLabel: 'Bearer Token (Optional)',
    tokenHelp: 'Optional for reference.',
    guideSteps: [],
  },
];

function cleanHandle(raw?: string | null) {
  if (!raw) return '';
  let str = raw.trim();
  str = str.replace(/^https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|linkedin\.com\/in|twitter\.com|x\.com)\//i, '');
  str = str.replace(/\/.*$/, '').replace(/[@]/g, '');
  return str ? `@${str}` : raw;
}

export function ClientSocialChannels({
  clientId,
  client,
}: {
  clientId: string;
  client: any;
}) {
  const { refresh } = useApp();
  const {
    data: accounts,
    loading,
    error,
  } = useResource<SocialAccountData[]>(`/social-publishing/accounts/${clientId}`);
  const { mutate, pending } = useMutation();

  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('INSTAGRAM');
  const [handle, setHandle] = useState('');
  const [platformAccountId, setPlatformAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [url, setUrl] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const activePlatformDef =
    SUPPORTED_PLATFORMS.find((p) => p.key === selectedPlatform) ||
    SUPPORTED_PLATFORMS[0];

  const handleOpenConnect = (platformKey: string, existing?: SocialAccountData) => {
    setSelectedPlatform(platformKey);
    const initialHandle = existing?.handle ? cleanHandle(existing.handle).replace(/^@/, '') : '';
    const initialUrl = existing?.url || (existing?.handle?.startsWith('http') ? existing.handle : '');
    setHandle(initialHandle);
    setPlatformAccountId(existing?.platformAccountId || '');
    setAccessToken('');
    setUrl(initialUrl);
    setShowGuide(false);
    setConnectModalOpen(true);
  };

  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) {
      toast.error('Please enter the handle or username.');
      return;
    }

    try {
      await mutate(
        `/social-publishing/accounts/${clientId}`,
        {
          platform: selectedPlatform,
          handle: handle.trim(),
          platformAccountId: platformAccountId.trim() || undefined,
          accessToken: accessToken.trim() || undefined,
          url: url.trim() || undefined,
        },
        'POST',
        `${selectedPlatform} credentials saved & verified`,
      );
      setConnectModalOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect channel');
    }
  };

  const handleDisconnect = async (id: string, platform: string) => {
    if (!confirm(`Are you sure you want to disconnect ${platform}? Auto-publishing for this platform will be paused.`)) {
      return;
    }

    try {
      await mutate(`/social-publishing/accounts/${id}`, undefined, 'DELETE', `${platform} disconnected`);
      refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect channel');
    }
  };

  const handleTestConnection = async (acc: SocialAccountData) => {
    setTestingId(acc.id);
    setTestResult(null);
    try {
      const res = await mutate(
        `/social-publishing/test-connection/${acc.id}`,
        {},
        'POST',
        'Testing connection...',
      );
      if (res?.valid) {
        setTestResult({
          id: acc.id,
          success: true,
          message: `Live connection verified! Account name: ${res.accountName || acc.handle}`,
        });
        toast.success(`Active & Verified! Connected as ${res.accountName || acc.handle}`);
      } else {
        setTestResult({
          id: acc.id,
          success: false,
          message: res?.details?.error?.message || 'Token expired or invalid permissions.',
        });
        toast.error('Connection test failed. Please refresh your access token.');
      }
    } catch (err: any) {
      setTestResult({
        id: acc.id,
        success: false,
        message: err?.message || 'Connection error',
      });
      toast.error(err?.message || 'Failed to test connection');
    } finally {
      setTestingId(null);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="space-y-6">
      {/* Informative Header Banner */}
      <div className="rounded-2xl border border-stone-200 dark:border-zinc-800 bg-gradient-to-br from-white to-stone-50/50 dark:from-zinc-900 dark:to-zinc-950 p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
                <Zap size={18} />
              </span>
              <h3 className="font-bold text-base text-stone-900 dark:text-zinc-100">
                1-Click Direct Auto-Publishing Channels
              </h3>
            </div>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              Connect {client.name}’s social accounts to publish approved visual posts directly to Instagram, Facebook, and LinkedIn with a single click. 
              <strong> 100% Free:</strong> Uses native platform Graph APIs with zero third-party subscription charges.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SUPPORTED_PLATFORMS.map((plat) => {
          const acc = accounts?.find(
            (a) => a.platform.toUpperCase() === plat.key,
          );
          const isConnected = Boolean(acc && acc.isConnected);
          const isSupportedAutoPublish = ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'].includes(
            plat.key,
          );

          return (
            <div
              key={plat.key}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${
                isConnected
                  ? 'border-emerald-500/30 bg-emerald-500/[0.02] dark:bg-emerald-950/10 shadow-sm'
                  : 'border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60'
              }`}
            >
              <div className="space-y-3.5">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: plat.iconColor }}
                    />
                    <h4 className="font-bold text-sm text-stone-900 dark:text-zinc-100">
                      {plat.name}
                    </h4>
                  </div>
                  {isConnected ? (
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-stone-500 dark:text-zinc-400 bg-stone-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                      Not Linked
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-500 dark:text-zinc-400 leading-normal">
                  {plat.description}
                </p>

                {/* Account Details if connected */}
                {acc && (
                  <div className="rounded-xl bg-stone-50 dark:bg-zinc-800/60 border border-stone-200/80 dark:border-zinc-700/60 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-stone-500 dark:text-zinc-400 font-medium">
                        Handle:
                      </span>
                      <strong className="text-stone-800 dark:text-zinc-200">
                        {cleanHandle(acc.handle)}
                      </strong>
                    </div>
                    {acc.accountName && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 dark:text-zinc-400 font-medium">
                          Account:
                        </span>
                        <span className="text-stone-700 dark:text-zinc-300 truncate max-w-[140px]">
                          {acc.accountName}
                        </span>
                      </div>
                    )}
                    {acc.platformAccountId && (
                      <div className="flex items-center justify-between">
                        <span className="text-stone-500 dark:text-zinc-400 font-medium">
                          Target ID:
                        </span>
                        <span className="font-mono text-[11px] text-stone-600 dark:text-zinc-400">
                          {acc.platformAccountId}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 dark:border-zinc-700/40">
                      <span className="text-stone-500 dark:text-zinc-400 font-medium">
                        Token Status:
                      </span>
                      <span
                        className={`font-semibold ${
                          acc.hasToken
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {acc.hasToken ? 'Securely Configured' : 'Missing Token'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Test feedback */}
                {testResult && testResult.id === acc?.id && (
                  <div
                    className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                      testResult.success
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {testResult.message}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 mt-3 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                {acc ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isSupportedAutoPublish && acc.hasToken && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 px-2.5"
                          disabled={testingId === acc.id || pending}
                          onClick={() => handleTestConnection(acc)}
                        >
                          <RefreshCw
                            size={12}
                            className={testingId === acc.id ? 'animate-spin' : ''}
                          />
                          <span>Test</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-2.5"
                        onClick={() => handleOpenConnect(plat.key, acc)}
                      >
                        <Key size={12} />
                        <span>Update</span>
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => handleDisconnect(acc.id, plat.name)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    className="w-full text-xs font-semibold h-8.5 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    onClick={() => handleOpenConnect(plat.key)}
                  >
                    <Plus size={13} />
                    <span>Configure {plat.name}</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect / Edit Channel Modal */}
      <Modal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        title={`Configure ${activePlatformDef.name}`}
        description={`Set up API credentials for 1-click auto-publishing to ${client.name}'s account.`}
      >
        <form onSubmit={handleSaveConnection} className="space-y-4 pt-1">
          {/* Handle */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              Account Handle or Username <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. @hayatihopp"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Platform Account ID */}
          {activePlatformDef.idLabel && (
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                {activePlatformDef.idLabel}
              </label>
              <input
                type="text"
                placeholder={activePlatformDef.idPlaceholder}
                value={platformAccountId}
                onChange={(e) => setPlatformAccountId(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
              <span className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 block">
                Required for direct API publishing.
              </span>
            </div>
          )}

          {/* Access Token */}
          {activePlatformDef.tokenLabel && (
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
                {activePlatformDef.tokenLabel}
              </label>
              <input
                type="password"
                placeholder="Paste API Access Token (never exposed publicly)"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500 font-mono"
              />
              {activePlatformDef.tokenHelp && (
                <span className="text-[11px] text-stone-500 dark:text-zinc-400 mt-1 block">
                  {activePlatformDef.tokenHelp}
                </span>
              )}
            </div>
          )}

          {/* Public Profile URL */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              Public Profile URL (Optional)
            </label>
            <input
              type="url"
              placeholder="https://instagram.com/hayatihopp"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Collapsible Setup Guide */}
          {activePlatformDef.guideSteps.length > 0 && (
            <div className="rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/80 dark:bg-zinc-800/40 p-3">
              <button
                type="button"
                className="w-full flex items-center justify-between text-xs font-bold text-stone-700 dark:text-zinc-300 cursor-pointer"
                onClick={() => setShowGuide(!showGuide)}
              >
                <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-400">
                  <HelpCircle size={14} />
                  How to get this free token (2-minute guide)
                </span>
                {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showGuide && (
                <div className="mt-3 pt-3 border-t border-stone-200 dark:border-zinc-700 text-xs text-stone-600 dark:text-zinc-300 space-y-2">
                  <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
                    {activePlatformDef.guideSteps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                  {activePlatformDef.guideUrl && (
                    <a
                      href={activePlatformDef.guideUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-pink-600 dark:text-pink-400 font-bold hover:underline pt-1"
                    >
                      Official Platform Documentation <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setConnectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="btn-gradient font-bold text-white shadow-md flex items-center gap-1.5"
            >
              <ShieldCheck size={14} />
              <span>Save & Verify Connection</span>
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
