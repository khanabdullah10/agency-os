'use client';
import Link from 'next/link';
import { useState, useMemo, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  CalendarDays,
  Layers3,
  CircleCheck,
  Building2,
  Clock3,
  ChevronRight,
} from 'lucide-react';
import { useApp, useResource } from '@/lib/api';
import { dateLabel, timeLabel, label } from '@/lib/utils';
import { Avatar, ClientMark, Loading, ErrorState, Empty, Panel } from './shared';

const INDIGO = '#6366f1';
const SKY = '#0284c7';
const AMBER = '#f59e0b';
const EMERALD = '#10b981';

export function Dashboard() {
  const { actor, can, openForm } = useApp();
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const { data: d, loading, error } = useResource('/dashboard?date=' + selectedDate);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  if (!d) return null;

  const pendingClient = (d.counts.CLIENT_REVIEW || 0) + (d.counts.CLIENT_SCRIPT_REVIEW || 0);
  const pendingInternal =
    (d.counts.INTERNAL_EDIT_REVIEW || 0) +
    (d.counts.INTERNAL_SCRIPT_REVIEW || 0) +
    (d.counts.INTERNAL_APPROVED || 0);
  const first = actor.name.split(' ')[0];
  const hour = new Date().getHours();

  const stages = [
    { name: 'In planning', key: 'SCRIPT_WRITING', value: (d.counts.PLANNING || 0) + (d.counts.SCRIPT_WRITING || 0), color: '#818cf8' },
    { name: 'In production', key: 'EDITING', value: (d.counts.EDITING || 0) + (d.counts.SHOOT_SCHEDULED || 0) + (d.counts.RAW_FOOTAGE_READY || 0), color: '#38bdf8' },
    { name: 'In review', key: 'INTERNAL_EDIT_REVIEW', value: pendingInternal + pendingClient, color: '#fbbf24' },
    { name: 'Ready to go', key: 'READY_TO_PUBLISH', value: (d.counts.READY_TO_PUBLISH || 0) + (d.counts.SCHEDULED || 0), color: '#34d399' },
    { name: 'Published', key: 'PUBLISHED', value: d.publishedThisMonth, color: '#f43f5e' },
  ];

  return (
    <div className="dashboard animate-fade-in space-y-6">
      {/* Top Welcome / Header Strip (Lead CRM Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-stone-200/80 bg-white dark:bg-zinc-900/80 p-4 sm:p-5 shadow-xs dark:border-zinc-800">
        <div>
          <div className="eyebrow">MAD O MEDIA • AGENCY OS</div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-zinc-100">
            Good {hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, {first}
            <span className="greeting-dot">.</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-zinc-400 mt-0.5">
            {actor.isClient
              ? 'A clear, connected view of what’s coming next for your brand.'
              : 'Real-time pipeline, team workload, content deadlines & approvals.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div
            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
            className="date-chip hidden sm:flex items-center gap-1.5 cursor-pointer relative hover:border-stone-400 dark:hover:border-zinc-600 transition-colors select-none group"
            title="Click to select date and dynamically update insights"
          >
            <CalendarDays size={15} className="text-stone-500 group-hover:text-stone-800 dark:group-hover:text-zinc-200 transition-colors" />
            <span className="font-medium text-stone-700 dark:text-zinc-200">
              {dateLabel(new Date(selectedDate + 'T00:00:00'), { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate(todayStr);
                }}
                className="ml-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                title="Reset to today"
              >
                Today
              </button>
            )}
            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="absolute inset-0 opacity-0 pointer-events-none w-0 h-0"
              aria-label="Filter dashboard by date"
            />
          </div>

          {can('content.create') && (
            <button
              onClick={() => openForm('content')}
              className="btn-gradient flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white transition-all duration-150 active:translate-y-0 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #db2777 0%, #9333ea 50%, #4f46e5 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 14px -2px rgba(147, 51, 234, 0.4)',
              }}
            >
              <Plus size={16} className="text-white" />
              <span className="text-white font-semibold">Create Content</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Overview Stats Row */}
      <div className="overview-stats bg-transparent border-0 shadow-none">
        <Stat
          label={actor.isClient ? 'Your Content' : 'Active Clients'}
          value={actor.isClient ? d.contentThisMonth : d.activeClients}
          icon={actor.isClient ? Layers3 : Building2}
          sub={actor.isClient ? 'planned this month' : 'brands growing with us'}
          href={actor.isClient ? '/content' : '/clients'}
          chip={actor.isClient ? 'This month' : d.totalClients + ' total'}
          color={INDIGO}
        />
        <Stat
          label="Content This Month"
          value={d.contentThisMonth}
          icon={Layers3}
          sub="ideas moving into the world"
          href="/calendar"
          chip="On the calendar"
          color={SKY}
        />
        <Stat
          label={actor.isClient ? 'Waiting for You' : 'Awaiting Approval'}
          value={actor.isClient ? pendingClient : pendingInternal + pendingClient}
          icon={Clock3}
          sub={actor.isClient ? 'ready for feedback' : `${pendingInternal} internal · ${pendingClient} client`}
          href="/approvals"
          chip="Needs a look"
          color={AMBER}
          accent
        />
        <Stat
          label="Published Content"
          value={d.publishedThisMonth}
          icon={CircleCheck}
          sub="good work, out in the wild"
          href="/publishing"
          chip="This month"
          color={EMERALD}
        />
      </div>

      {/* Main Grid: Pipeline, Tasks, Activity & Calendar */}
      <div className="dashboard-main-grid">
        <div className="dashboard-left space-y-6">
          {/* Pipeline Stage Visualizer */}
          <Panel
            title="From Idea to Out There"
            subtitle="A little momentum at every stage."
            href="/calendar"
            className="pipeline-panel"
          >
            <div className="pipeline">
              {stages.map((s, i) => (
                <Link href={'/content?status=' + s.key} className="pipeline-stage group" key={s.name}>
                  <div className="pipeline-top">
                    <span style={{ background: s.color }} />
                    <small>0{i + 1}</small>
                    {i < 4 && <ChevronRight size={13} className="text-stone-300 dark:text-zinc-700" />}
                  </div>
                  <strong>{String(s.value).padStart(2, '0')}</strong>
                  <span className="stage-label">{s.name}</span>
                  <div className="stage-track">
                    <i
                      style={{
                        background: s.color,
                        width: Math.max(7, (s.value / (d.contentThisMonth || 1)) * 100) + '%',
                      }}
                    />
                  </div>
                </Link>
              ))}
            </div>
            <div className="pipeline-bottom">
              <span>
                <i /> {d.contentThisMonth} pieces of content. One connected workflow.
              </span>
              <Link href="/calendar">
                Open calendar <ArrowRight size={14} />
              </Link>
            </div>
          </Panel>

          {/* Team's Radar Tasks */}
          {!actor.isClient && (
            <Panel
              title="On the Team’s Radar"
              subtitle="The next items needing attention."
              href="/tasks"
              className="radar-panel"
            >
              {!d.tasks.length ? (
                <Empty
                  title="A clear runway"
                  body="No pending tasks. Plan your next piece of content to get things moving."
                />
              ) : (
                <div className="task-preview-list">
                  {d.tasks.slice(0, 5).map((t: any) => (
                    <Link href={'/tasks?task=' + t.id} className="task-preview group" key={t.id}>
                      <span className={'task-check ' + (new Date(t.dueAt) < new Date() ? 'late' : '')} />
                      <div className="task-preview-title">
                        <strong>{t.title.replace(/^[A-Z_ ]+ · /, '')}</strong>
                        <small>
                          <i style={{ background: t.client.color }} />
                          {t.client.name}
                          <span>·</span>
                          {label(t.kind)}
                        </small>
                      </div>
                      <Avatar name={t.assignee.name} color={t.assignee.avatarColor} src={t.assignee.avatarUrl} size="small" />
                      <span className={'due-label ' + (new Date(t.dueAt) < new Date() ? 'late' : '')}>
                        {dateLabel(t.dueAt)}
                      </span>
                      <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Activity Preview */}
          <Panel
            title={actor.isClient ? 'Your Recent Activity' : 'Workspace Activity'}
            subtitle="A shared memory of your team’s progress."
            href="/activity"
          >
            <div className="activity-preview">
              {d.activity.length ? (
                d.activity.slice(0, 4).map((a: any) => (
                  <div key={a.id}>
                    <Avatar name={a.actor?.name || 'Agency OS'} color={a.actor?.avatarColor} src={a.actor?.avatarUrl} size="small" />
                    <p>
                      <strong>{a.actor?.name || 'Agency OS'}</strong>{' '}
                      {a.action.split('.').pop()?.replaceAll('_', ' ')}
                      <small>
                        {a.client?.name || 'Agency workspace'}{' '}
                        {a.contentId && '· CNT-' + String(a.contentId).padStart(4, '0')}
                      </small>
                    </p>
                    <time>{timeLabel(a.createdAt)}</time>
                  </div>
                ))
              ) : (
                <Empty
                  title="Your story starts here"
                  body="Workspace activity will appear as your team starts creating."
                />
              )}
            </div>
          </Panel>
        </div>

        {/* Right Column: Upcoming, Capacity, Studio Note */}
        <div className="dashboard-right space-y-6">
          {/* Upcoming Schedule */}
          <Panel title="Coming Up Next" href="/calendar" className="upcoming-panel">
            <div className="mini-calendar-label">
              <CalendarDays size={15} />
              <span>Upcoming Publishing</span>
            </div>
            {d.upcoming.length ? (
              d.upcoming.slice(0, 4).map((c: any) => (
                <Link className="upcoming-item group" href={'/content/' + c.id} key={c.id}>
                  <div className="date-block">
                    <small>{dateLabel(c.publishAt, { month: 'short' })}</small>
                    <strong>{new Date(c.publishAt).getDate()}</strong>
                  </div>
                  <div>
                    <small>{c.client.name}</small>
                    <strong>{c.title}</strong>
                    <span>
                      {c.platform}
                      <i /> {timeLabel(c.publishAt)}
                    </span>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="text-stone-400 group-hover:text-sky-500 transition-colors"
                  />
                </Link>
              ))
            ) : (
              <Empty title="Space for your next idea" body="Planned content will appear here." />
            )}
            <Link className="calendar-bottom" href="/calendar">
              See the full calendar <ArrowRight size={15} />
            </Link>
          </Panel>

          {/* Creative Capacity */}
          {!actor.isClient && (
            <Panel
              title="Creative Capacity"
              subtitle="How the work is spread across the team."
              href="/team"
              className="workload-panel"
            >
              {d.workload.slice(0, 4).map((w: any) => (
                <div className="workload-row" key={w.user.id}>
                  <Avatar name={w.user.name} color={w.user.avatarColor} src={w.user.avatarUrl} size="small" />
                  <div>
                    <div>
                      <strong>{w.user.name}</strong>
                      <small>{w.total} tasks</small>
                    </div>
                    <div className="workload-track">
                      <i
                        style={{
                          width: Math.min((w.total / 15) * 100, 100) + '%',
                          background: w.user.avatarColor || '#0284c7',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {!d.workload.length && <Empty title="Ready for great work" body="Assign tasks to see team capacity." />}
              <div className="capacity-note">
                <span className="status-dot" />
                {d.tasksOverdue
                  ? d.tasksOverdue + ' tasks need a deadline check.'
                  : 'A little balance goes a long way.'}
              </div>
            </Panel>
          )}

          {/* Brand Philosophy Studio Note */}
          <div className="studio-note">
            <span className="note-symbol">✳</span>
            <div>
              <div className="eyebrow">THE MAD O MEDIA WAY</div>
              <h3>More room for great work.</h3>
              <p>When the workflow is connected, the creative output speaks for itself.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Brands We're Building Panel */}
      {!actor.isClient && (
        <Panel
          title="The Brands We’re Building"
          subtitle="Different stories. One creative team."
          href="/clients"
          className="brands-panel"
        >
          <div className="brand-card-grid">
            {d.clients
              .filter((c: any) => c.active)
              .slice(0, 6)
              .map((c: any) => (
                <Link href={'/clients/' + c.id} className="brand-card group" key={c.id}>
                  <ClientMark name={c.name} color={c.color} />
                  <div>
                    <strong>{c.name}</strong>
                    <small>{c.industry}</small>
                  </div>
                  <ArrowUpRight
                    size={14}
                    className="text-stone-400 group-hover:text-sky-500 transition-colors"
                  />
                </Link>
              ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Stat({
  label: title,
  value,
  icon: Icon,
  sub,
  href,
  chip,
  color = '#0284c7',
  accent,
}: {
  label: string;
  value: number;
  icon: any;
  sub: string;
  href: string;
  chip: string;
  color?: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`stat-card group ${accent ? 'stat-accent' : ''}`}
      style={
        {
          background: `linear-gradient(150deg, ${color}18 0%, var(--card-bg, #ffffff) 65%)`,
          borderColor: `${color}35`,
          '--card-glow': `${color}45`,
          '--card-hover-border': `${color}99`,
        } as React.CSSProperties
      }
    >
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        <div
          className="stat-card-icon"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon size={16} />
        </div>
      </div>
      <div className="stat-card-metric">
        <strong>{String(value).padStart(2, '0')}</strong>
        <ArrowUpRight size={16} className="stat-card-arrow" />
      </div>
      <p className="stat-card-sub">{sub}</p>
      <div className="stat-card-chip">
        <small
          style={
            accent
              ? {
                  backgroundColor: `${color}18`,
                  color: color,
                  borderColor: `${color}40`,
                }
              : undefined
          }
        >
          {accent && (
            <i
              className="stat-card-dot"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}99` }}
            />
          )}
          {chip}
        </small>
      </div>
    </Link>
  );
}
