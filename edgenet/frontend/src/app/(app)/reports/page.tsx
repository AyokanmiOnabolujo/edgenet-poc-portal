'use client';
import { useEffect, useState } from 'react';
import { Alert, Avatar, Icon, PRIORITY_STYLE, STATUS_STYLE } from '@/components/ui';
import { PageTitle, SummaryCard } from '@/components/AppUI';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import { PRIORITIES, PRIORITY_LABEL, Report, STATUSES, STATUS_LABEL } from '@/lib/types';

function Bars({ items, total }: { items: { key: string; label: string; color: string; value: number }[]; total: number }) {
  return (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,10rem)_1fr_2rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_2rem]">
          <span className="truncate text-slate-600">{i.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full origin-left animate-grow-x rounded-full ${i.color}`} style={{ width: `${total ? (i.value / total) * 100 : 0}%` }} /></span>
          <span className="text-right font-medium tabular-nums text-slate-800">{i.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Reports() {
  const allowed = useRequireRole('account_manager');
  const [d, setD] = useState<Report | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (allowed) api<Report>('/requests/report').then(setD).catch((e) => setError(e.message)); }, [allowed]);
  if (!allowed) return null;
  if (!d) return error ? <Alert>{error}</Alert> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>;
  const maxLoad = Math.max(1, ...d.workload.map((w) => w.total));

  return (
    <>
      <PageTitle title="Reports" subtitle="How your PoC pipeline is moving and who is carrying it." />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total requests" value={d.total} icon="layers" tint="bg-brand-50 text-brand-600" />
        <SummaryCard label="Active PoCs" value={d.active} icon="server" tint="bg-blue-50 text-blue-600" delay={60} />
        <SummaryCard label="Completed" value={d.completed} icon="checkCircle" tint={STATUS_STYLE.completed.tint} delay={120} />
        <SummaryCard label="Completion rate" value={`${d.completionRate}%`} icon="chart" tint="bg-violet-50 text-violet-600" delay={180} />
      </div>
      {d.unassigned > 0 && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="alert" className="h-4 w-4" />{d.unassigned} open request{d.unassigned === 1 ? ' has' : 's have'} no engineer assigned.
        </p>
      )}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="card animate-slide-up p-6" style={{ animationDelay: '80ms' }}>
          <h2 className="section-title mb-5">Requests by status</h2>
          <Bars total={d.total} items={STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], color: STATUS_STYLE[s].dot, value: d.byStatus[s] }))} />
        </section>
        <section className="card animate-slide-up p-6" style={{ animationDelay: '140ms' }}>
          <h2 className="section-title mb-5">Requests by priority</h2>
          <Bars total={d.total} items={PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABEL[p], color: PRIORITY_STYLE[p].dot, value: d.byPriority[p] }))} />
        </section>
      </div>
      <section className="card animate-slide-up overflow-hidden" style={{ animationDelay: '200ms' }}>
        <h2 className="section-title px-6 pb-4 pt-6">Engineer workload</h2>
        {d.workload.length === 0 ? <p className="px-6 pb-6 text-sm text-slate-500">No engineers registered yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-y border-slate-200 bg-slate-50/80"><tr><th className="th">Engineer</th><th className="th">Assigned</th><th className="th">Active</th><th className="th">Completed</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {d.workload.map((w) => (
                  <tr key={w.id} className="transition-colors hover:bg-slate-50/70">
                    <td className="td"><span className="flex items-center gap-3"><Avatar name={w.name} />{w.name}</span></td>
                    <td className="td"><span className="flex items-center gap-3"><span className="h-2 w-32 overflow-hidden rounded-full bg-slate-100"><span className="block h-full origin-left animate-grow-x rounded-full bg-brand-500" style={{ width: `${(w.total / maxLoad) * 100}%` }} /></span><span className="font-medium tabular-nums">{w.total}</span></span></td>
                    <td className="td tabular-nums">{w.active}</td>
                    <td className="td tabular-nums">{w.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
