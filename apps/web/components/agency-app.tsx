'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Pusher from 'pusher-js';
import { toast } from 'sonner';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'sonner';
import * as Menu from '@radix-ui/react-dropdown-menu';
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Layers3,
  CheckSquare2,
  CircleCheck,
  MessageSquare,
  Users,
  FolderOpen,
  Send,
  BarChart3,
  Activity,
  Bell,
  Settings,
  Search,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu as MenuIcon,
  X,
  ArrowRight,
  Sparkles,
  LockKeyhole,
  Eye,
  EyeOff,
  Sun,
  Moon,
  User as UserIcon,
} from 'lucide-react';
import { api, Actor, AppContext, useApp, useResource, useMutation, csrf } from '@/lib/api';
import { initials, label } from '@/lib/utils';
import { Button } from './ui/button';
import { Avatar, Field, Modal, Loading, FormFooter } from './shared';
import { Dashboard } from './dashboard';
import { ContentList, CalendarView } from './content-list';
import { ContentDetail } from './content-detail';
import { ClientsView, ClientDetail, TeamView } from './people';
import { TasksView, ApprovalsView, PublishingView, DriveView, ActivityView, NotificationsView, SettingsView, ReportsView } from './operations';
import { ChatView } from './chat';
import { CreateForm } from './forms';
import MadOMediaLogo from './MadOMediaLogo';
import { useTheme } from './ThemeProvider';

// Side panel items with vibrant distinct colors
const nav = [
  { href: '/dashboard', name: 'Overview', icon: LayoutDashboard, permission: 'content.view', group: 'Workspace', color: '#38bdf8' }, // Sky
  { href: '/clients', name: 'Clients', icon: Building2, permission: 'client.view', group: 'Workspace', color: '#a855f7' }, // Purple
  { href: '/calendar', name: 'Calendar', icon: CalendarDays, permission: 'content.view', group: 'Workspace', color: '#f59e0b' }, // Amber
  { href: '/content', name: 'Content', icon: Layers3, permission: 'content.view', group: 'Workspace', color: '#10b981' }, // Emerald
  { href: '/tasks', name: 'Tasks', icon: CheckSquare2, permission: 'task.view', group: 'Workspace', color: '#6366f1' }, // Indigo
  { href: '/approvals', name: 'Approvals', icon: CircleCheck, permission: 'content.view', group: 'Workspace', color: '#f43f5e' }, // Rose
  { href: '/chat', name: 'Messages', icon: MessageSquare, permission: 'chat.view', group: 'Studio', color: '#06b6d4' }, // Cyan
  { href: '/team', name: 'Team', icon: Users, permission: 'employee.view', group: 'Studio', color: '#f97316' }, // Orange
  { href: '/drive', name: 'Drive links', icon: FolderOpen, permission: 'drive.view', group: 'Studio', color: '#eab308' }, // Yellow
  { href: '/publishing', name: 'Publishing', icon: Send, permission: 'publish.view', group: 'Studio', color: '#ec4899' }, // Pink
  { href: '/reports', name: 'Reports', icon: BarChart3, permission: 'report.view', group: 'Studio', color: '#8b5cf6' }, // Violet
  { href: '/activity', name: 'Activity', icon: Activity, permission: 'activity.view', group: 'Studio', color: '#14b8a6' }, // Teal
];

export function AgencyApp() {
  const [actor, setActor] = useState<Actor | null>(null);
  const [ready, setReady] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [form, setForm] = useState<{ kind: string; initial?: any } | null>(null);
  const router = useRouter();
  const path = usePathname();
  const { isDark } = useTheme();

  const refresh = useCallback(() => setEpoch((v) => v + 1), []);
  const load = useCallback(
    () =>
      api<Actor>('/auth/me')
        .then(setActor)
        .catch(() => setActor(null))
        .finally(() => setReady(true)),
    []
  );

  useEffect(() => {
    load();
    const reset = () => {
      setActor(null);
      setReady(true);
    };
    window.addEventListener('agency-session-expired', reset);
    return () => window.removeEventListener('agency-session-expired', reset);
  }, [load]);

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' });
    setActor(null);
    router.push('/login');
  };

  if (!ready)
    return (
      <div className="boot">
        <MadOMediaLogo size="lg" theme={isDark ? 'dark' : 'light'} />
        <Loading />
      </div>
    );

  if (!actor)
    return (
      <>
        <Login
          onLogin={async () => {
            await load();
            router.push('/dashboard');
          }}
        />
        <Toaster richColors position="bottom-right" />
      </>
    );

  const context = {
    actor,
    epoch,
    refresh,
    can: (p: string) => actor.isSuperAdmin || actor.permissions.includes(p),
    logout,
    openForm: (kind: string, initial?: any) => setForm({ kind, initial }),
  };

  return (
    <AppContext.Provider value={context}>
      {actor.mustChangePassword ? (
        <PasswordGate onDone={load} />
      ) : (
        <Shell>
          {path.startsWith('/content/') ? (
            <ContentDetail id={Number(path.split('/')[2])} />
          ) : path.startsWith('/clients/') ? (
            actor.isClient ? <Dashboard /> : <ClientDetail id={path.split('/')[2]} />
          ) : (
            ({
              '/dashboard': <Dashboard />,
              '/calendar': <CalendarView />,
              '/content': <ContentList />,
              '/clients': actor.isClient ? <Dashboard /> : <ClientsView />,
              '/tasks': actor.isClient ? <Dashboard /> : <TasksView />,
              '/approvals': <ApprovalsView />,
              '/chat': actor.isClient ? <Dashboard /> : <ChatView />,
              '/team': actor.isClient ? <Dashboard /> : <TeamView />,
              '/drive': <DriveView />,
              '/publishing': actor.isClient ? <Dashboard /> : <PublishingView />,
              '/reports': <ReportsView />,
              '/activity': actor.isClient ? <Dashboard /> : <ActivityView />,
              '/notifications': <NotificationsView />,
              '/settings': <SettingsView />,
            } as Record<string, React.ReactNode>)[path] || <Dashboard />
          )}
        </Shell>
      )}
      <Modal
        open={!!form}
        onOpenChange={(v) => !v && setForm(null)}
        title={
          form?.kind === 'client'
            ? 'Make room for a new client'
            : form?.kind === 'user'
            ? 'Invite a team member'
            : form?.kind === 'profile'
            ? 'Edit profile & photo'
            : form?.kind === 'task'
            ? 'Create a task'
            : form?.kind === 'drive'
            ? 'Add a Drive link'
            : 'Plan something great'
        }
        description={
          form?.kind === 'client'
            ? 'Build their brief, bring the right team together, and open their workspace.'
            : form?.kind === 'content'
            ? 'One content item. Every step of production, connected.'
            : form?.kind === 'profile'
            ? 'Update your profile photo and display name.'
            : undefined
        }
        wide={form?.kind === 'client' || form?.kind === 'content' || form?.kind === 'user'}
      >
        {form && <CreateForm kind={form.kind} initial={form.initial} onDone={() => setForm(null)} />}
      </Modal>
      <Toaster richColors position="bottom-right" />
    </AppContext.Provider>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const { toggleTheme, isDark } = useTheme();

  return (
    <div
      className={`relative min-h-[100dvh] w-full overflow-hidden flex flex-col justify-between transition-colors duration-300 font-sans ${
        isDark ? 'bg-[#070708] text-white' : 'bg-[#faf9f7] text-stone-900'
      }`}
    >
      {/* Background Ambient Glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {isDark ? (
          <>
            <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-[#FF1E56]/20 via-[#00B4FF]/15 to-transparent blur-[130px] animate-pulse" />
            <div className="absolute -bottom-32 -right-32 h-[550px] w-[550px] rounded-full bg-gradient-to-tl from-[#FF8A00]/20 via-[#00B4FF]/15 to-transparent blur-[140px]" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-[#00B4FF]/10 blur-[150px]" />
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
                backgroundSize: '32px 32px',
              }}
            />
          </>
        ) : (
          <>
            <div className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-rose-200/35 via-sky-200/30 to-transparent blur-[120px]" />
            <div className="absolute -bottom-32 -right-32 h-[550px] w-[550px] rounded-full bg-gradient-to-tl from-amber-200/35 via-cyan-200/30 to-transparent blur-[130px]" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[650px] rounded-full bg-indigo-100/40 blur-[140px]" />
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #000000 1px, transparent 0)',
                backgroundSize: '32px 32px',
              }}
            />
          </>
        )}
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8 shrink-0">
        <div className="flex items-center gap-2">
          <MadOMediaLogo size="sm" theme={isDark ? 'dark' : 'light'} badgeText="OS" />
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          type="button"
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 shadow-xs ${
            isDark
              ? 'border border-white/15 bg-white/[0.06] text-zinc-200 hover:bg-white/10 hover:border-white/25'
              : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-300'
          }`}
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4 text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-indigo-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Centered Modern Login Card */}
      <main className="relative z-10 mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center px-4 py-6">
        <div
          className={`relative rounded-2xl sm:rounded-3xl p-6 sm:p-7 transition-all duration-300 backdrop-blur-2xl ${
            isDark
              ? 'border border-white/10 bg-zinc-950/85 shadow-[0_20px_70px_rgba(0,0,0,0.8),0_0_50px_rgba(0,180,255,0.1)]'
              : 'border border-stone-200/90 bg-white/90 shadow-[0_20px_50px_rgba(28,25,23,0.06)]'
          }`}
        >
          {/* Top Accent Gradient Line */}
          <div
            className="absolute inset-x-8 top-0 h-[2px]"
            style={{
              background: isDark
                ? 'linear-gradient(90deg, transparent, #FF1E56, #00B4FF, transparent)'
                : 'linear-gradient(90deg, transparent, #FF1E56, #0284C7, transparent)',
            }}
          />

          {/* Card Header */}
          <div className="text-center flex flex-col items-center">
            <div className="mb-2 flex justify-center">
              <MadOMediaLogo variant="icon" theme={isDark ? 'dark' : 'light'} size="md" />
            </div>

            <div
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                isDark ? 'border border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border border-sky-200 bg-sky-50 text-sky-700'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Agency Operating System
            </div>

            <h1
              className="mt-3 text-xl sm:text-2xl font-extrabold tracking-tight"
              style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
            >
              Welcome to <span style={{ color: isDark ? '#00B4FF' : '#0284C7' }}>MAD O MEDIA</span>
            </h1>
            <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
              Your connected creative workflow, all in one place.
            </p>
          </div>

          {/* Form */}
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              setPending(true);
              const f = new FormData(e.currentTarget);
              try {
                await api('/auth/login', {
                  method: 'POST',
                  body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
                });
                onLogin();
              } catch (err: any) {
                setError(err.message || 'Invalid email or password');
              } finally {
                setPending(false);
              }
            }}
          >
            <Field label="Work email">
              <input
                name="email"
                type="email"
                placeholder="you@madomedia.com"
                autoComplete="username"
                required
                className="w-full rounded-xl border border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  name="password"
                  type={show ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-stone-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-zinc-100 placeholder-stone-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>

            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-600 dark:text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              style={{
                background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 50%, #4f46e5 100%)',
                color: '#ffffff',
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/30 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-600/40 active:translate-y-0 disabled:opacity-50"
            >
              {pending ? (
                'Signing in…'
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer Footnote */}
          <div className="mt-5 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400 dark:text-zinc-500">
              <LockKeyhole size={12} />
              Private and secure agency workspace.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Copyright */}
      <footer className="relative z-10 py-3 text-center text-[10px] text-stone-400 dark:text-zinc-600">
        © {new Date().getFullYear()} MAD O MEDIA. All rights reserved.
      </footer>
    </div>
  );
}

function PasswordGate({ onDone }: { onDone: () => void }) {
  const { mutate, pending } = useMutation();
  const { isDark } = useTheme();

  return (
    <div className="boot">
      <div className="password-gate">
        <MadOMediaLogo size="md" theme={isDark ? 'dark' : 'light'} />
        <h1 className="mt-4">Make this account yours.</h1>
        <p>Choose a new password before entering your workspace.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              await mutate('/auth/password', Object.fromEntries(f));
              onDone();
            } catch {}
          }}
        >
          <Field label="Temporary password">
            <input name="currentPassword" type="password" required autoComplete="current-password" />
          </Field>
          <Field label="New password" hint="Use at least 12 characters.">
            <input name="newPassword" type="password" minLength={12} required autoComplete="new-password" />
          </Field>
          <FormFooter pending={pending} submit="Set my password" />
        </form>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { actor, can, logout, refresh, openForm, epoch } = useApp();
  const path = usePathname();
  const { toggleTheme, isDark } = useTheme();
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const router = useRouter();
  const [notices, setNotices] = useState<any[]>([]);
  const knownNoticeIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const fetchNotices = useCallback(async (isPolling = false) => {
    try {
      const data = await api<any[]>('/notifications');
      if (Array.isArray(data)) {
        if (initialLoadDone.current && isPolling) {
          for (const n of data) {
            if (!knownNoticeIds.current.has(n.id) && !n.readAt) {
              toast.info(n.title, {
                description: n.body,
                duration: 6000,
                action: n.href
                  ? {
                      label: 'Open',
                      onClick: () => {
                        router.push(n.href);
                      },
                    }
                  : undefined,
              });
            }
          }
        }
        knownNoticeIds.current = new Set(data.map((n: any) => n.id));
        setNotices(data);
        initialLoadDone.current = true;
      }
    } catch {}
  }, [router]);

  useEffect(() => {
    fetchNotices(false);
  }, [fetchNotices, epoch]);

  // Seamless live polling every 4 seconds for instant updates without refresh
  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchNotices(true);
      }
    }, 4000);
    const onFocus = () => fetchNotices(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchNotices]);

  // Pusher realtime notification channel binding
  useEffect(() => {
    if (!actor?.id) return;
    let pusherClient: any = null;
    api('/chat/config')
      .then((cfg) => {
        if (cfg?.enabled && cfg?.key) {
          pusherClient = new Pusher(cfg.key, {
            cluster: cfg.cluster,
            channelAuthorization: {
              endpoint: '/api/chat/authorize',
              transport: 'ajax',
              headers: { 'X-Agency-Request': '1', 'X-CSRF-Token': csrf() },
            },
          });
          const userChan = pusherClient.subscribe('private-user-' + actor.id);
          userChan.bind('notification', () => {
            fetchNotices(true);
            refresh();
          });
        }
      })
      .catch(() => {});
    return () => {
      pusherClient?.disconnect?.();
    };
  }, [actor?.id, fetchNotices, refresh]);

  const { data: contentList } = useResource<any[]>(can('content.view') ? '/content' : null);
  const unread = notices?.filter((n) => !n.readAt).length || 0;

  // Calculate pending approvals specifically waiting for the current actor's role
  const pendingApprovals = useMemo(() => {
    if (!contentList?.length) return 0;
    return contentList.filter((c) => {
      const isApprovalState = [
        'INTERNAL_SCRIPT_REVIEW',
        'CLIENT_SCRIPT_REVIEW',
        'INTERNAL_EDIT_REVIEW',
        'INTERNAL_APPROVED',
        'CLIENT_REVIEW',
      ].includes(c.status);
      if (!isApprovalState) return false;

      // Client role check
      if (actor.isClient) {
        return (
          (c.status === 'CLIENT_SCRIPT_REVIEW' || c.status === 'CLIENT_REVIEW') &&
          can('content.approve_client')
        );
      }

      // Super Admin has oversight on all reviews
      if (actor.isSuperAdmin) return true;

      // Client stage reviews are waiting on client, not internal staff
      if (c.status.startsWith('CLIENT')) return false;

      // Admin review stage check
      if (c.reviewStage === 'ADMIN') {
        return can('approval.admin');
      }
      if (c.reviewStage === 'SUPER_ADMIN') {
        return false;
      }

      // Dedicated SMM review stage check
      if (can('content.approve')) {
        const smmId = c.assignees?.smm;
        return can('content.edit_all') || smmId === actor.id || !smmId;
      }

      return false;
    }).length;
  }, [contentList, actor, can]);

  useEffect(() => {
    setMobile(false);
  }, [path]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh]);

  const title = nav.find((n) => path.startsWith(n.href))?.name || label(path.split('/')[1] || 'Overview');

  return (
    <div className="app">
      {/* Mobile backdrop */}
      <button
        className={'sidebar-backdrop ' + (mobile ? 'visible' : '')}
        aria-label="Close navigation"
        onClick={() => setMobile(false)}
      />

      {/* Sleek Sidebar with Colored Icons */}
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <Link href="/dashboard" onClick={() => setMobile(false)} className="sidebar-brand">
          <MadOMediaLogo size="sm" theme={isDark ? 'dark' : 'light'} badgeText="OS" />
        </Link>

        <div className="workspace-name">
          <span className="workspace-avatar">M</span>
          <div>
            <strong>Mad O Media</strong>
            <small>{actor.isClient ? 'Client Workspace' : 'Agency Workspace'}</small>
          </div>
          <span className="workspace-dot" />
        </div>

        <nav>
          {['Workspace', 'Studio'].map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-label">{group}</span>
              {nav
                .filter(
                  (n) =>
                    n.group === group &&
                    can(n.permission) &&
                    (!actor.isClient || !['/clients', '/team', '/tasks', '/publishing', '/activity', '/chat'].includes(n.href))
                )
                .map((n) => {
                  const isActive = path.startsWith(n.href);
                  const hasApprovals = n.href === '/approvals' && pendingApprovals > 0;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={() => setMobile(false)}
                      className={
                        'nav-item group ' +
                        (isActive ? 'active' : '') +
                        (hasApprovals && !isActive ? ' has-pending-approvals' : '')
                      }
                      style={{
                        backgroundColor: isActive
                          ? `${n.color}15`
                          : hasApprovals
                          ? `${n.color}0f`
                          : undefined,
                        borderLeft: isActive
                          ? `3px solid ${n.color}`
                          : hasApprovals
                          ? `3px solid ${n.color}`
                          : '3px solid transparent',
                      }}
                    >
                      {/* Colored icon container */}
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105 shrink-0"
                        style={{
                          backgroundColor: `${n.color}18`,
                          color: n.color,
                        }}
                      >
                        <n.icon size={15} style={{ color: n.color }} />
                      </div>
                      <span className="truncate">
                        {n.href === '/tasks' && !can('task.view_team') ? 'My tasks' : n.name}
                      </span>
                      {hasApprovals && (
                        <span
                          className="nav-approval-badge"
                          style={{
                            backgroundColor: `${n.color}22`,
                            color: n.color,
                            border: `1px solid ${n.color}45`,
                          }}
                        >
                          <span className="nav-approval-pulse" style={{ backgroundColor: n.color }} />
                          {pendingApprovals}
                        </span>
                      )}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          {/* Notifications with colored Blue icon */}
          <Link
            href="/notifications"
            onClick={() => setMobile(false)}
            className={'nav-item group ' + (path === '/notifications' ? 'active' : '')}
            style={{
              backgroundColor: path === '/notifications' ? '#3b82f615' : undefined,
              borderLeft: path === '/notifications' ? '3px solid #3b82f6' : '3px solid transparent',
            }}
          >
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105 shrink-0"
              style={{ backgroundColor: '#3b82f618', color: '#3b82f6' }}
            >
              <Bell size={15} style={{ color: '#3b82f6' }} />
            </div>
            <span>Notifications</span>
            {unread > 0 && <span className="nav-count">{unread}</span>}
          </Link>

          {/* Settings with colored Slate icon */}
          {can('settings.manage') && (
            <Link
              href="/settings"
              className={'nav-item group ' + (path === '/settings' ? 'active' : '')}
              style={{
                backgroundColor: path === '/settings' ? '#64748b15' : undefined,
                borderLeft: path === '/settings' ? '3px solid #64748b' : '3px solid transparent',
              }}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-105 shrink-0"
                style={{ backgroundColor: '#64748b18', color: '#64748b' }}
              >
                <Settings size={15} style={{ color: '#64748b' }} />
              </div>
              <span>Settings</span>
            </Link>
          )}

          <div className="sidebar-divider" />

          {/* User Profile */}
          <Menu.Root>
            <Menu.Trigger asChild>
              <button className="profile">
                <Avatar name={actor.name} color={actor.avatarColor || '#0284c7'} src={actor.avatarUrl} />
                <span>
                  <strong>{actor.name}</strong>
                  <small>{actor.roleName}</small>
                </span>
                <ChevronDown size={14} className="text-stone-400 dark:text-zinc-500" />
              </button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="dropdown-menu" side="top" align="start">
                <Menu.Label className="px-2 py-1 text-[11px] font-semibold text-stone-500 dark:text-zinc-400">
                  {actor.email}
                </Menu.Label>
                <Menu.Item onSelect={() => openForm('profile')}>
                  <UserIcon size={15} /> Edit profile / photo
                </Menu.Item>
                <Menu.Item onSelect={() => logout()}>
                  <LogOut size={15} /> Sign out
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </aside>

      {/* Main Shell */}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <MenuIcon size={20} />
            </button>
            <span className="breadcrumb-home text-xs text-stone-400 dark:text-zinc-500">Workspace</span>
            <ChevronRight size={13} className="text-stone-300 dark:text-zinc-700" />
            <strong>{title}</strong>
          </div>

          <div className="topbar-right">
            {/* Quick Search trigger */}
            <button className="search-trigger" onClick={() => setSearch(true)}>
              <Search size={15} />
              <span>Search anything…</span>
              <kbd>⌘ K</kbd>
            </button>

            {/* Theme Toggle Button (Light / Dark) */}
            <button
              id="theme-toggle"
              onClick={toggleTheme}
              type="button"
              title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 ${
                isDark
                  ? 'border border-zinc-700/80 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
                  : 'border border-stone-200/80 bg-stone-50/80 text-stone-700 hover:bg-stone-100'
              }`}
            >
              {isDark ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline text-[11px]">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="hidden sm:inline text-[11px]">Dark</span>
                </>
              )}
            </button>

            <span className="header-divider" />

            {!actor.isClient && (
              <Link href="/chat" className="icon-button" aria-label="Open messages">
                <MessageSquare size={17} />
              </Link>
            )}

            <Link
              href="/notifications"
              className="icon-button notification-bell"
              aria-label={unread + ' unread notifications'}
            >
              <Bell size={17} />
              {unread > 0 && <i />}
            </Link>

            <Avatar name={actor.name} color={actor.avatarColor || '#0284c7'} size="small" src={actor.avatarUrl} />
          </div>
        </header>

        <main className="main-content">{children}</main>

        <footer className="app-footer">
          <span>Connected Operating System for Creative Digital Agencies.</span>
          <span>
            <i /> MAD O MEDIA · Agency OS
          </span>
        </footer>
      </div>

      <SearchModal open={search} onClose={() => setSearch(false)} />
    </div>
  );
}

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const { data, loading } = useResource<any[]>(
    open && q.length >= 2 ? '/search?q=' + encodeURIComponent(q) : null
  );

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Find your flow"
      description="Search clients, content, tasks, and people."
    >
      <div className="search-field">
        <Search size={18} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try a client name or CNT-0012…"
        />
      </div>
      <div className="search-results">
        {q.length < 2 ? (
          <p>Type at least two characters to start searching.</p>
        ) : loading ? (
          <Loading />
        ) : !data?.length ? (
          <p>No results. Try another name or content ID.</p>
        ) : (
          data.map((r: any) => (
            <Link key={r.type + r.id} href={r.href} onClick={onClose}>
              <span>
                <small>{r.type}</small>
                <strong>{r.title}</strong>
              </span>
              <ArrowRight size={16} />
            </Link>
          ))
        )}
      </div>
    </Modal>
  );
}
