'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Avatar, EmptyState, Icon, PageHeader, PriorityBadge, SkeletonRows, StatTile, StatusBadge, STATUS_STYLE } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, PocRequest, ref, Status, STATUSES, STATUS_LABEL } from '@/lib/types';

export default function Dashboard() {
  const { user } = useAuth();
  const isAM = user?.role === 'account_manager';
  const [filter, setFilter] = useState<Status | ''>('');
  const [all, setAll] = useState<PocRequest[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { api<PocRequest[]>('/requests').then(setAll).catch((e) => setError(e.message)); }, []);

  const count = (s: Status[]) => (all ?? []).filter((r) => s.includes(r.status)).length;
  const rows = all && (filter ? all.filter((r) => r.status === filter) : all);

  return (
    <>
      <PageHeader
        title="PoC requests"
        subtitle="Every proof of concept in your organisation, with owner and status."
        actions={isAM && <Link href="/requests/new" className="btn btn-primary"><Icon name="plus" className="h-4 w-4" />New PoC request</Link>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total requests" value={all?.length ?? '–'} icon="layers" tint="bg-slate-100 text-slate-600" />
        <StatTile label="New requests" value={all ? count(['new_request']) : '–'} icon="circlePlus" tint={STATUS_STYLE.new_request.tint} delay={60} />
        <StatTile label="Provisioning or testing" value={all ? count(['provisioning', 'testing']) : '–'} icon="server" tint={STATUS_STYLE.provisioning.tint} delay={120} />
        <StatTile label="Completed" value={all ? count(['completed']) : '–'} icon="checkCircle" tint={STATUS_STYLE.completed.tint} delay={180} />
      </div>

      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by status">
        {(['', ...STATUSES] as (Status | '')[]).map((s) => {
          const on = filter === s;
          const n = s ? count([s]) : all?.length ?? 0;
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

      {error && <Alert>{error}</Alert>}
      <div className="card overflow-hidden">
        {rows === null && !error ? <SkeletonRows />
          : rows && rows.length === 0 ? (
            <EmptyState icon="layers" title={filter ? 'Nothing in this stage' : 'No requests yet'}
              text={filter ? 'Requests will show up here as they reach this stage.' : isAM ? 'Raise the first PoC request for a client to get started.' : 'Requests appear here once your Account Manager raises them.'}
              action={!filter && isAM ? <Link href="/requests/new" className="btn btn-primary">New PoC request</Link> : undefined} />
          ) : rows && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr><th className="th">Project</th><th className="th">Client</th><th className="th">Engineer</th><th className="th">Start</th><th className="th">End</th><th className="th">Status</th><th className="th">Priority</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="td">
                        <Link href={`/requests/${r.id}`} className="font-medium text-slate-900 transition hover:text-brand-700 focus-visible:outline-none focus-visible:underline">{r.projectName}</Link>
                        <div className="text-xs tabular-nums text-slate-400">{ref(r.number)}</div>
                      </td>
                      <td className="td"><div className="text-slate-800">{r.clientName}</div><div className="text-xs text-slate-500">{r.clientCompany}</div></td>
                      <td className="td">
                        {r.assignedEngineer
                          ? <span className="flex items-center gap-2.5"><Avatar name={r.assignedEngineer.name} className="h-7 w-7 text-[11px]" />{r.assignedEngineer.name}</span>
                          : <span className="text-slate-400">Unassigned</span>}
                      </td>
                      <td className="td whitespace-nowrap text-slate-600">{fmtDate(r.startDate)}</td>
                      <td className="td whitespace-nowrap text-slate-600">{fmtDate(r.endDate)}</td>
                      <td className="td"><StatusBadge status={r.status} /></td>
                      <td className="td"><PriorityBadge priority={r.priority} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}
