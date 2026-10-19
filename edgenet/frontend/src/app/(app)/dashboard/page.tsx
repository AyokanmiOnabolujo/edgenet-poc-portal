'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Avatar, DeadlineBadge, EmptyState, Icon, IconName, PriorityBadge, SkeletonRows, StatusBadge, STATUS_STYLE } from '@/components/ui';
import { SummaryCard } from '@/components/AppUI';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Alerts, fmtDate, PocRequest, ref, Status, STATUSES, STATUS_LABEL } from '@/lib/types';

const PREVIEW_ROWS = 5; // rows shown before "View all"
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const th = 'whitespace-nowrap px-4 py-3 text-left first:pl-6 last:pr-6';
const td = 'px-4 py-4 align-middle first:pl-6 last:pr-6';

export default function Dashboard() {
  const { user } = useAuth();
  const isAM = user?.role === 'account_manager';
  const [filter, setFilter] = useState<Status | ''>('');
  const [all, setAll] = useState<PocRequest[] | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [greeting, setGreeting] = useState('Welcome back');
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => { api<PocRequest[]>('/requests').then(setAll).catch((e) => setError(e.message)); }, []);
  useEffect(() => { api<Alerts>('/requests/alerts').then(setAlerts).catch(() => {}); }, []);
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  const list = all ?? [];
  const count = (s: Status[]) => list.filter((r) => s.includes(r.status)).length;
  const rows = all && (filter ? all.filter((r) => r.status === filter) : all);
  const shown = rows && (expanded ? rows : rows.slice(0, PREVIEW_ROWS));

  // Summary figures are all derived from the real /requests response.
  const total = list.length;
  const newThisWeek = list.filter((r) => Date.now() - new Date(r.createdAt).getTime() < WEEK_MS).length;
  const share = (n: number) => (all ? `${total ? Math.round((n / total) * 100) : 0}% of total` : '');
  const cards: { label: string; value: number; note: string; icon: IconName; tint: string; noteColor: string }[] = [
    { label: 'Total requests', value: total, note: all ? `${newThisWeek} new this week` : '', icon: 'layers', tint: 'bg-brand-50 text-brand-600', noteColor: 'text-brand-600' },
    { label: 'In progress', value: count(['new_request', 'provisioning']), note: share(count(['new_request', 'provisioning'])), icon: 'server', tint: 'bg-blue-50 text-blue-600', noteColor: 'text-blue-600' },
    { label: 'In testing', value: count(['testing']), note: share(count(['testing'])), icon: 'flask', tint: 'bg-violet-50 text-violet-600', noteColor: 'text-violet-600' },
    { label: 'Completed', value: count(['completed']), note: share(count(['completed'])), icon: 'checkCircle', tint: 'bg-emerald-50 text-emerald-600', noteColor: 'text-emerald-600' },
  ];
  const firstName = user?.name?.trim().split(/\s+/)[0];

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            {greeting}{firstName ? `, ${firstName}` : ''} <span aria-hidden="true"></span>
          </h1>
          <p className="mt-2 text-base text-slate-600">Here&apos;s a quick overview of your PoC requests.</p>
        </div>
        {isAM && (
          <Link href="/requests/new" className="btn btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            New PoC request
            <Icon name="arrowLeft" className="h-4 w-4 rotate-180" />
          </Link>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c, i) => (
          <SummaryCard key={c.label} {...c} value={all ? c.value : '–'} delay={i * 60} />
        ))}
      </div>

      {error && <Alert>{error}</Alert>}

      {alerts && alerts.items.length > 0 && (
        <section className="card mb-8 animate-slide-up overflow-hidden border-amber-200" aria-labelledby="alerts-heading">
          <div className="flex flex-wrap items-center gap-3 px-6 pb-3 pt-5">
            <Icon name="alert" className="h-5 w-5 text-amber-600" />
            <h2 id="alerts-heading" className="font-serif text-xl font-bold tracking-tight text-ink-900">Needs attention</h2>
            <p className="text-sm text-slate-500">
              {[alerts.counts.overdue && `${alerts.counts.overdue} overdue`, alerts.counts.dueSoon && `${alerts.counts.dueSoon} due within ${alerts.warnDays} days`, alerts.counts.lateStart && `${alerts.counts.lateStart} not started`].filter(Boolean).join(' · ')}
              {isAM ? '' : ' in your assignments'}
            </p>
          </div>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {alerts.items.slice(0, PREVIEW_ROWS).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-sm">
                <span className="w-20 font-semibold tabular-nums text-ink-900">{ref(r.number)}</span>
                <Link href={`/requests/${r.id}`} className="font-medium text-slate-900 transition hover:text-brand-700">{r.projectName}</Link>
                <span className="text-slate-500">{r.clientCompany}</span>
                <span className="ml-auto flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">ends {fmtDate(r.endDate)}</span><DeadlineBadge d={r.deadline} /></span>
              </li>
            ))}
          </ul>
          {alerts.items.length > PREVIEW_ROWS && <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">And {alerts.items.length - PREVIEW_ROWS} more.</p>}
        </section>
      )}

      <section className="card overflow-hidden" aria-labelledby="requests-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-6">
          <h2 id="requests-heading" className="font-serif text-xl font-bold tracking-tight text-ink-900">{expanded ? 'All requests' : 'Recent requests'}</h2>
          {rows && rows.length > PREVIEW_ROWS && (
            <button type="button" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} className="link inline-flex items-center gap-1.5 text-sm">
              {expanded ? 'Show recent only' : `View all ${rows.length}`}
              {!expanded && <Icon name="arrowLeft" className="h-4 w-4 rotate-180" />}
            </button>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto px-6 pb-5" role="group" aria-label="Filter by status">
          {(['', ...STATUSES] as (Status | '')[]).map((s) => {
            const on = filter === s;
            const n = s ? count([s]) : total;
            return (
              <button key={s || 'all'} onClick={() => setFilter(s)} aria-pressed={on}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${on ? 'bg-ink-900 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-slate-900'}`}>
                {s && <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />}
                {s ? STATUS_LABEL[s] : 'All'}
                <span className={`text-xs tabular-nums ${on ? 'text-slate-300' : 'text-slate-400'}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {shown === null && !error ? <SkeletonRows />
          : rows && rows.length === 0 ? (
            <EmptyState icon="layers" title={filter ? 'Nothing in this stage' : 'No requests yet'}
              text={filter ? 'Requests will show up here as they reach this stage.' : isAM ? 'Raise the first PoC request for a client to get started.' : 'Requests appear here once your Account Manager raises them.'}
              action={!filter && isAM ? <Link href="/requests/new" className="btn btn-primary">New PoC request</Link> : undefined} />
          ) : shown && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-y border-slate-200 bg-slate-50/80 text-[13px] font-semibold text-slate-600">
                    <th scope="col" className={th}>ID</th>
                    <th scope="col" className={th}>Client</th>
                    <th scope="col" className={th}>Project</th>
                    <th scope="col" className={th}>Status</th>
                    <th scope="col" className={th}>Priority</th>
                    <th scope="col" className={th}>Target date</th>
                    <th scope="col" className={th}>Assigned engineer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                      <td className={`${td} whitespace-nowrap font-semibold tabular-nums text-ink-900`}>{ref(r.number)}</td>
                      <td className={td}><div className="text-slate-800">{r.clientCompany}</div><div className="text-xs text-slate-500">{r.clientName}</div></td>
                      <td className={td}>
                        <Link href={`/requests/${r.id}`} className="font-medium text-slate-900 transition hover:text-brand-700 focus-visible:outline-none focus-visible:underline">{r.projectName}</Link>
                      </td>
                      <td className={td}><StatusBadge status={r.status} /></td>
                      <td className={td}><PriorityBadge priority={r.priority} /></td>
                      <td className={`${td} text-slate-600`}><span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">{fmtDate(r.endDate)}<DeadlineBadge d={r.deadline} /></span></td>
                      <td className={td}>
                        {r.assignedEngineer
                          ? <span className="flex items-center gap-2.5"><Avatar name={r.assignedEngineer.name} className="h-7 w-7 text-[11px]" />{r.assignedEngineer.name}</span>
                          : <span className="text-slate-400">Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  );
}
