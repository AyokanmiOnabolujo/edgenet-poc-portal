'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Avatar, PageHeader, PriorityBadge, STATUS_STYLE } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PocRequest, ref, Status, STATUSES, STATUS_LABEL } from '@/lib/types';

export default function Board() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PocRequest[] | null>(null);
  const [over, setOver] = useState<Status | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { api<PocRequest[]>('/requests').then(setRows).catch((e) => setError(e.message)); }, []);
  const movable = (r: PocRequest) => user?.role === 'account_manager' || r.assignedEngineer?.id === user?.id;

  async function move(id: string, status: Status) {
    const r = rows?.find((x) => x.id === id);
    if (!rows || !r || r.status === status || !movable(r)) return;
    const prev = rows; setError('');
    setRows(rows.map((x) => (x.id === id ? { ...x, status } : x)));
    try { await api(`/requests/${id}/status`, { method: 'PATCH', body: { status } }); }
    catch (e: any) { setRows(prev); setError(e.message); }
  }

  return (
    <>
      <PageHeader title="Board" subtitle={user?.role === 'engineer' ? 'Drag your assigned requests to the next stage.' : 'Drag a request to move it between stages.'} />
      {error && <Alert>{error}</Alert>}
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {STATUSES.map((s, i) => {
          const items = (rows ?? []).filter((r) => r.status === s);
          return (
            <section key={s} aria-label={STATUS_LABEL[s]}
              className={`min-h-[260px] min-w-[270px] flex-1 animate-slide-up rounded-2xl p-3 ring-2 transition duration-150 ${over === s ? 'bg-brand-50 ring-brand-500/60' : 'bg-slate-100/80 ring-transparent'}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onDragOver={(e) => { e.preventDefault(); setOver(s); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/plain'), s); }}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLE[s].dot}`} />
                <h2 className="text-sm font-semibold text-slate-800">{STATUS_LABEL[s]}</h2>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500 shadow-sm">{items.length}</span>
              </div>
              <div className="space-y-2.5">
                {rows === null && !error && <div className="h-24 animate-pulse rounded-xl bg-white/70" />}
                {items.map((r) => (
                  <article key={r.id} draggable={movable(r)}
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', r.id); setDragId(r.id); }}
                    onDragEnd={() => setDragId(null)}
                    className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${movable(r) ? 'cursor-grab active:cursor-grabbing' : ''} ${dragId === r.id ? 'opacity-40' : ''}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs tabular-nums text-slate-400">{ref(r.number)}</span>
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <h3 className="mt-2 text-sm font-semibold leading-snug text-slate-900">
                      <Link href={`/requests/${r.id}`} className="rounded transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{r.projectName}</Link>
                    </h3>
                    <p className="text-xs text-slate-500">{r.clientCompany}</p>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                      {r.assignedEngineer ? <><Avatar name={r.assignedEngineer.name} className="h-6 w-6 text-[10px]" />{r.assignedEngineer.name}</> : <span className="text-slate-400">Unassigned</span>}
                    </div>
                    {movable(r) && (
                      <select aria-label={`Move ${r.projectName} to stage`} className="input mt-3 !py-1.5 text-xs" value={r.status} onChange={(e) => move(r.id, e.target.value as Status)}>
                        {STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
                      </select>
                    )}
                  </article>
                ))}
                {rows && items.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-xs text-slate-400">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
