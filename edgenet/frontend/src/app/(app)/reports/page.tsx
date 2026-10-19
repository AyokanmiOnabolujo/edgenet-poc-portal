'use client';
import { useEffect, useState } from 'react';
import { Alert, Avatar, Field, Icon, PRIORITY_STYLE, STATUS_STYLE } from '@/components/ui';
import { PageTitle, SummaryCard } from '@/components/AppUI';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import { EngineerRow, fmtDate, PRIORITIES, PRIORITY_LABEL, Report, ReportFilters, STATUSES, STATUS_LABEL } from '@/lib/types';

function Bars({ items, total }: { items: { key: string; label: string; color: string; value: number; note?: string }[]; total: number }) {
  return (
    <ul className="space-y-4">
      {items.map((i) => (
        <li key={i.key} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_auto]">
          <span className="truncate text-slate-600">{i.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full origin-left animate-grow-x rounded-full ${i.color}`} style={{ width: `${total ? (i.value / total) * 100 : 0}%` }} /></span>
          <span className="text-right font-medium tabular-nums text-slate-800">{i.note ?? i.value}</span>
        </li>
      ))}
    </ul>
  );
}

const query = (f: ReportFilters) => {
  const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return q ? `?${q}` : '';
};

export default function Reports() {
  const allowed = useRequireRole('account_manager');
  const [d, setD] = useState<Report | null>(null);
  const [f, setF] = useState<ReportFilters>({});
  const [engineers, setEngineers] = useState<EngineerRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => { if (allowed) api<EngineerRow[]>('/users/engineers').then(setEngineers).catch(() => {}); }, [allowed]);
  useEffect(() => {
    if (!allowed || (f.from && f.to && f.to < f.from)) return;
    setError('');
    api<Report>(`/requests/report${query(f)}`).then(setD).catch((e) => setError(e.message));
  }, [allowed, f]);
  if (!allowed) return null;
  const filtered = Object.values(f).some(Boolean);

  return (
    <>
      <PageTitle title="Reports" subtitle="How your PoC pipeline is moving and who is carrying it. Every figure is counted from live records." />

      <form className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.3fr_1fr_auto]" onSubmit={(e) => e.preventDefault()} aria-label="Report filters">
        <Field label="Raised from" htmlFor="ff"><input id="ff" type="date" className="input" value={f.from ?? ''} max={f.to} onChange={(e) => setF({ ...f, from: e.target.value || undefined })} /></Field>
        <Field label="Raised to" htmlFor="ft"><input id="ft" type="date" className="input" value={f.to ?? ''} min={f.from} onChange={(e) => setF({ ...f, to: e.target.value || undefined })} /></Field>
        <Field label="Engineer" htmlFor="fe">
          <select id="fe" className="input" value={f.engineerId ?? ''} onChange={(e) => setF({ ...f, engineerId: e.target.value || undefined })}>
            <option value="">All engineers</option>
            {engineers.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </Field>
        <Field label="Priority" htmlFor="fp">
          <select id="fp" className="input" value={f.priority ?? ''} onChange={(e) => setF({ ...f, priority: (e.target.value || undefined) as ReportFilters['priority'] })}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
        </Field>
        <div className="flex items-end"><button type="button" className="btn btn-secondary w-full" disabled={!filtered} onClick={() => setF({})}>Clear</button></div>
      </form>

      {error && <Alert>{error}</Alert>}
      {!d ? (
        !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Total requests" value={d.total} note={filtered ? 'Matching the filters' : 'All time'} icon="layers" tint="bg-brand-50 text-brand-600" />
            <SummaryCard label="Active PoCs" value={d.active} note={`${d.unassigned} without an engineer`} icon="server" tint="bg-blue-50 text-blue-600" delay={60} />
            <SummaryCard label="Completed" value={d.completed} note={`${d.cancelled} cancelled`} icon="checkCircle" tint={STATUS_STYLE.completed.tint} delay={120} />
            <SummaryCard label="Completion rate" value={d.completionRate === null ? '–' : `${d.completionRate}%`} note="Completed out of all closed PoCs" icon="chart" tint="bg-violet-50 text-violet-600" delay={180} />
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label="Overdue" value={d.overdue} note="Past end date, still open" noteColor={d.overdue ? 'text-rose-600' : undefined} icon="alert" tint="bg-rose-50 text-rose-600" delay={60} />
            <SummaryCard label="Due soon" value={d.dueSoon} note={`Ending within ${d.warnDays} days`} icon="alert" tint="bg-amber-50 text-amber-600" delay={120} />
            <SummaryCard label="Not started" value={d.lateStart} note="New requests past their start date" icon="circlePlus" tint="bg-orange-50 text-orange-600" delay={180} />
            <SummaryCard label="Avg. time to complete" value={d.avgProcessingDays === null ? '–' : `${d.avgProcessingDays} d`}
              note={d.timedCompletions ? `Raised to Completed, over ${d.timedCompletions} PoC${d.timedCompletions === 1 ? '' : 's'}` : 'No timed completions yet'} icon="flask" tint="bg-sky-50 text-sky-600" delay={240} />
          </div>

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

          <section className="card mb-6 animate-slide-up p-6" style={{ animationDelay: '170ms' }}>
            <h2 className="section-title">Resource utilisation today</h2>
            <p className="mb-5 mt-1 text-sm text-slate-500">Units allocated on {fmtDate(d.today)} out of available capacity, per resource type. Not affected by the filters; items in maintenance or retired are left out.</p>
            {d.utilisation.length === 0 ? <p className="text-sm text-slate-500">No available inventory yet.</p> : (
              <Bars total={100} items={d.utilisation.map((u) => ({
                key: `${u.type}-${u.unit}`, label: `${u.type} (${u.unit})`, color: u.percent >= 90 ? 'bg-rose-500' : 'bg-brand-500',
                value: u.percent, note: `${u.inUse} of ${u.capacity} · ${u.percent}%`,
              }))} />
            )}
          </section>

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
                        <td className="td"><span className="flex items-center gap-3"><span className="h-2 w-32 overflow-hidden rounded-full bg-slate-100"><span className="block h-full origin-left animate-grow-x rounded-full bg-brand-500" style={{ width: `${(w.total / Math.max(1, ...d.workload.map((x) => x.total))) * 100}%` }} /></span><span className="font-medium tabular-nums">{w.total}</span></span></td>
                        <td className="td tabular-nums">{w.active}</td>
                        <td className="td tabular-nums">{w.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {d.total === 0 && <p className="mt-6 flex items-center gap-2 text-sm text-slate-500"><Icon name="layers" className="h-4 w-4" />No requests match these filters.</p>}
        </>
      )}
    </>
  );
}
