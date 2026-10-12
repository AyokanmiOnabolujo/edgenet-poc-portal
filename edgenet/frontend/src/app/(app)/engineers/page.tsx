'use client';
import { useEffect, useState } from 'react';
import { Alert, Avatar, EmptyState, PageHeader, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import { EngineerRow } from '@/lib/types';

export default function Engineers() {
  const allowed = useRequireRole('account_manager');
  const [rows, setRows] = useState<EngineerRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (allowed) api<EngineerRow[]>('/users/engineers').then(setRows).catch((e) => setError(e.message)); }, [allowed]);
  if (!allowed) return null;
  const max = Math.max(1, ...(rows ?? []).map((e) => e.active));

  return (
    <>
      <PageHeader title="Engineers" subtitle="Your engineering team and how much each person is carrying right now." />
      {error && <Alert>{error}</Alert>}
      <div className="card overflow-hidden">
        {rows === null && !error ? <SkeletonRows />
          : rows && rows.length === 0 ? <EmptyState icon="users" title="No engineers yet" text="Engineers join by registering with your organisation name." />
          : rows && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80"><tr><th className="th">Engineer</th><th className="th">Active workload</th><th className="th">Completed</th><th className="th">Total assigned</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="td"><span className="flex items-center gap-3"><Avatar name={e.name} className="h-9 w-9 text-sm" /><span><span className="block font-medium text-slate-900">{e.name}</span><span className="block text-xs text-slate-500">{e.email}</span></span></span></td>
                      <td className="td"><span className="flex items-center gap-3"><span className="h-2 w-36 overflow-hidden rounded-full bg-slate-100"><span className="block h-full origin-left animate-grow-x rounded-full bg-amber-500" style={{ width: `${(e.active / max) * 100}%` }} /></span><span className="font-medium tabular-nums">{e.active}</span></span></td>
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
