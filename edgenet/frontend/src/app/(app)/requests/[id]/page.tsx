'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Avatar, Field, Icon, PriorityBadge, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { EngineerRow, fmtDate, fmtDateTime, PocRequest, ref, statusBody, STATUS_LABEL } from '@/lib/types';

const dt = 'text-xs font-medium uppercase tracking-wider text-slate-400';
const dd = 'mt-1 text-sm text-slate-800';

export default function Details() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [r, setR] = useState<PocRequest | null>(null);
  const [engineers, setEngineers] = useState<EngineerRow[]>([]);
  const [error, setError] = useState('');
  const isAM = user?.role === 'account_manager';

  useEffect(() => {
    api<PocRequest>(`/requests/${id}`).then(setR).catch((e) => setError(e.message));
    if (isAM) api<EngineerRow[]>('/users/engineers').then(setEngineers).catch(() => {});
  }, [id, isAM]);

  async function update(path: 'status' | 'assign', body: unknown) {
    setError('');
    try { setR(await api<PocRequest>(`/requests/${id}/${path}`, { method: 'PATCH', body })); }
    catch (e: any) { setError(e.message); }
  }

  if (!r) return error ? <Alert>{error}</Alert> : <div className="space-y-4" aria-busy="true"><div className="h-8 w-1/3 animate-pulse rounded-lg bg-slate-200/70" /><div className="h-64 animate-pulse rounded-2xl bg-slate-200/50" /></div>;
  const canMove = r.nextStatuses.length > 0;
  const blocked = r.nextStatuses.find((t) => t.blocked)?.blocked;
  const hint = !canMove
    ? r.status === 'decommissioned' ? 'This is the final stage.' : 'Only the assigned engineer or the Account Manager can change the stage.'
    : blocked ?? undefined;
  function move(to: string) {
    const t = r!.nextStatuses.find((x) => x.to === to);
    const body = t && statusBody(t);
    if (body) update('status', body);
  }

  return (
    <>
      <Link href="/dashboard" className="link mb-4 inline-flex items-center gap-1.5 text-sm"><Icon name="arrowLeft" className="h-4 w-4" />Back to requests</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tabular-nums text-slate-400">{ref(r.number)}</p>
          <h1 className="text-2xl font-semibold text-slate-900 sm:text-[1.75rem]">{r.projectName}</h1>
          <p className="mt-1 text-sm text-slate-500">{r.clientCompany}</p>
        </div>
        <div className="flex flex-wrap gap-2"><StatusBadge status={r.status} /><PriorityBadge priority={r.priority} /></div>
      </div>
      {error && <Alert>{error}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card animate-slide-up p-6">
            <h2 className="mb-5 text-base font-semibold text-slate-900">Project</h2>
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><dt className={dt}>Description</dt><dd className={dd}>{r.description || <span className="text-slate-400">No description given.</span>}</dd></div>
              <div><dt className={dt}>Timeline</dt><dd className={dd}>{fmtDate(r.startDate)} to {fmtDate(r.endDate)}</dd></div>
              <div><dt className={dt}>Raised by</dt><dd className={dd}>{r.createdBy.name}</dd></div>
              <div><dt className={dt}>Client contact</dt><dd className={dd}>{r.clientName}</dd></div>
              <div><dt className={dt}>Client email</dt><dd className={dd}><a className="link" href={`mailto:${r.clientEmail}`}>{r.clientEmail}</a></dd></div>
            </dl>
          </section>

          <section className="card animate-slide-up overflow-hidden" style={{ animationDelay: '60ms' }}>
            <h2 className="px-6 pb-4 pt-6 text-base font-semibold text-slate-900">Resource requirements</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="border-y border-slate-200 bg-slate-50/80"><tr><th className="th">Resource</th><th className="th">Qty</th><th className="th">Specs / notes</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {r.resources.map((x, i) => (
                    <tr key={i} className="transition-colors hover:bg-slate-50/70">
                      <td className="td font-medium text-slate-900">{x.type}</td>
                      <td className="td tabular-nums">{x.quantity}</td>
                      <td className="td text-slate-600">{x.notes || <span className="text-slate-400">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card animate-slide-up space-y-5 p-6" style={{ animationDelay: '100ms' }}>
            <h2 className="text-base font-semibold text-slate-900">Stage and owner</h2>
            <Field label="Status" htmlFor="st" hint={hint}>
              <select id="st" className="input" disabled={!canMove} value={r.status} onChange={(e) => move(e.target.value)}>
                <option value={r.status}>{STATUS_LABEL[r.status]}</option>
                {r.nextStatuses.map((t) => <option key={t.to} value={t.to} disabled={!!t.blocked}>{STATUS_LABEL[t.to]}{t.blocked ? ' (blocked)' : ''}</option>)}
              </select>
            </Field>
            {isAM ? (
              <Field label="Assigned engineer" htmlFor="as">
                <select id="as" className="input" value={r.assignedEngineer?.id ?? ''} onChange={(e) => update('assign', { engineerId: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {engineers.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.active} active)</option>)}
                </select>
              </Field>
            ) : (
              <div><p className="label">Assigned engineer</p>
                {r.assignedEngineer ? <span className="flex items-center gap-2.5 text-sm"><Avatar name={r.assignedEngineer.name} />{r.assignedEngineer.name}</span> : <span className="text-sm text-slate-400">Unassigned</span>}
              </div>
            )}
          </section>

          <section className="card animate-slide-up p-6" style={{ animationDelay: '140ms' }}>
            <h2 className="mb-5 text-base font-semibold text-slate-900">Activity</h2>
            <ol className="relative ml-1.5 space-y-5 border-l border-slate-200 pl-6">
              {(r.activity ?? []).map((a) => (
                <li key={a.id} className="relative">
                  <span aria-hidden="true" className="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
                  <p className="text-sm leading-snug text-slate-700">{a.message}</p>
                  <time className="text-xs text-slate-400">{fmtDateTime(a.createdAt)}</time>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
