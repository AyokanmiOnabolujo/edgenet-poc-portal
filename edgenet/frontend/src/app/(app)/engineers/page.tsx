'use client';
import { useEffect, useState } from 'react';
import { Alert, Avatar, EmptyState, SkeletonRows } from '@/components/ui';
import { PageTitle } from '@/components/AppUI';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import { EngineerRow, fmtDateTime, User } from '@/lib/types';

export default function Engineers() {
  const allowed = useRequireRole('account_manager');
  const [rows, setRows] = useState<EngineerRow[] | null>(null);
  const [pending, setPending] = useState<(User & { createdAt: string })[]>([]);
  const [error, setError] = useState('');
  const load = () => Promise.all([
    api<EngineerRow[]>('/users/engineers').then(setRows),
    api<(User & { createdAt: string })[]>('/users/pending').then(setPending),
  ]).catch((e) => setError(e.message));
  useEffect(() => { if (allowed) load(); }, [allowed]);
  async function decide(u: User, approve: boolean) {
    if (!approve && !window.confirm(`Reject ${u.name}'s registration? They will not get access, and can register again.`)) return;
    setError('');
    try { await api(approve ? `/users/${u.id}/approve` : `/users/pending/${u.id}`, { method: approve ? 'PATCH' : 'DELETE' }); await load(); }
    catch (e: any) { setError(e.message); }
  }
  if (!allowed) return null;
  const max = Math.max(1, ...(rows ?? []).map((e) => e.active));

  return (
    <>
      <PageTitle title="Engineers" subtitle="Your engineering team and how much each person is carrying right now." />
      {error && <Alert>{error}</Alert>}
      {pending.length > 0 && (
        <section className="card mb-6 overflow-hidden border-amber-200" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="section-title px-6 pb-1 pt-5">Waiting for approval</h2>
          <p className="px-6 pb-4 text-sm text-slate-500">These people registered as engineers in your organisation. They cannot sign in or see anything until you approve them.</p>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {pending.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                <Avatar name={u.name} className="h-9 w-9 text-sm" />
                <span className="min-w-0"><span className="block font-medium text-slate-900">{u.name}</span><span className="block text-xs text-slate-500">{u.email} · registered {fmtDateTime(u.createdAt)}</span></span>
                <span className="ml-auto flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(u, true)}>Approve</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide(u, false)}>Reject</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="card overflow-hidden">
        {rows === null && !error ? <SkeletonRows />
          : rows && rows.length === 0 ? <EmptyState icon="users" title="No engineers yet" text="Engineers register with your organisation name, then appear above for you to approve." />
          : rows && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80"><tr><th className="th">Engineer</th><th className="th">Active workload</th><th className="th">Completed</th><th className="th">Total assigned</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="td"><span className="flex items-center gap-3"><Avatar name={e.name} className="h-9 w-9 text-sm" /><span><span className="block font-medium text-slate-900">{e.name}</span><span className="block text-xs text-slate-500">{e.email}</span></span></span></td>
                      <td className="td"><span className="flex items-center gap-3"><span className="h-2 w-36 overflow-hidden rounded-full bg-slate-100"><span className="block h-full origin-left animate-grow-x rounded-full bg-brand-500" style={{ width: `${(e.active / max) * 100}%` }} /></span><span className="font-medium tabular-nums">{e.active}</span></span></td>
                      <td className="td tabular-nums">{e.completed}</td>
                      <td className="td tabular-nums">{e.total}</td>
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
