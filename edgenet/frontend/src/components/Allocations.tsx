'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Field, Icon, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { Allocation, AllocationConflict, fmtDate, fmtDateTime, InventoryItem, PocRequest } from '@/lib/types';

/**
 * Resources actually reserved for this request, as opposed to the requirements listed when it was raised.
 * Free capacity and conflicts come from the API, which checks them again when you allocate.
 */
export function Allocations({ r, onChange }: { r: PocRequest; onChange: () => void }) {
  const [rows, setRows] = useState<Allocation[] | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [f, setF] = useState({ resourceId: '', quantity: 1, startDate: r.startDate, endDate: r.endDate });
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState<AllocationConflict[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => api<Allocation[]>(`/requests/${r.id}/allocations`).then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [r.id]);
  const loadInventory = () => {
    if (!r.canAllocate || !f.startDate || !f.endDate || f.endDate < f.startDate) return;
    api<InventoryItem[]>(`/resources?start=${f.startDate}&end=${f.endDate}`).then(setInventory).catch(() => {});
  };
  useEffect(loadInventory, [r.canAllocate, f.startDate, f.endDate]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(''); setConflicts([]);
    try { await action(); await load(); loadInventory(); onChange(); }
    catch (e: any) { setError(e.message); setConflicts(e.body?.conflicts ?? []); }
    setBusy(false);
  }
  function allocate(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await api(`/requests/${r.id}/allocations`, { method: 'POST', body: f });
      setF({ ...f, resourceId: '', quantity: 1 });
    });
  }
  const release = (a: Allocation) => {
    if (window.confirm(`Release ${a.quantity} ${a.resource.unit} of ${a.resource.name}? It becomes available to other PoCs.`)) {
      run(() => api(`/requests/${r.id}/allocations/${a.id}/release`, { method: 'PATCH' }));
    }
  };
  const usable = inventory.filter((i) => i.state === 'available');

  return (
    <section className="card animate-slide-up overflow-hidden" style={{ animationDelay: '80ms' }}>
      <h2 className="px-6 pb-1 pt-6 text-base font-semibold text-slate-900">Allocated resources</h2>
      <p className="px-6 pb-4 text-sm text-slate-500">Inventory reserved for this PoC. Requirements above are what was asked for; this is what has been confirmed.</p>
      {error && (
        <div className="px-6">
          <Alert>
            {error}
            {conflicts.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {conflicts.map((c, i) => <li key={i}>{c.request} {c.projectName}: {c.quantity} from {fmtDate(c.startDate)} to {fmtDate(c.endDate)}</li>)}
              </ul>
            )}
          </Alert>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-y border-slate-200 bg-slate-50/80"><tr><th className="th">Resource</th><th className="th">Qty</th><th className="th">Dates</th><th className="th">Status</th><th className="th"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows?.length === 0 && <tr><td className="td text-slate-400" colSpan={5}>Nothing allocated yet.</td></tr>}
            {rows?.map((a) => (
              <tr key={a.id} className={a.status === 'released' ? 'text-slate-400' : ''}>
                <td className="td"><span className={`block font-medium ${a.status === 'released' ? '' : 'text-slate-900'}`}>{a.resource.name}</span><span className="block text-xs text-slate-500">{a.resource.type}</span></td>
                <td className="td tabular-nums">{a.quantity} {a.resource.unit}</td>
                <td className="td whitespace-nowrap">{fmtDate(a.startDate)} to {fmtDate(a.endDate)}</td>
                <td className="td text-xs">
                  {a.status === 'active'
                    ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Active</span>
                    : <>Released{a.releasedBy ? ` by ${a.releasedBy.name}` : ''}{a.releasedAt ? `, ${fmtDateTime(a.releasedAt)}` : ''}</>}
                </td>
                <td className="td text-right">
                  {a.status === 'active' && r.canRelease && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => release(a)}>Release</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.canAllocate && (
        <form onSubmit={allocate} className="grid items-end gap-3 border-t border-slate-100 p-6 sm:grid-cols-6">
          <Field label="Resource" htmlFor="al-res" className="sm:col-span-4">
            <select id="al-res" className="input" required value={f.resourceId} onChange={(e) => setF({ ...f, resourceId: e.target.value })}>
              <option value="">{usable.length ? 'Choose from inventory' : 'No available inventory'}</option>
              {usable.map((i) => <option key={i.id} value={i.id} disabled={i.available === 0}>{i.name} · {i.available} of {i.capacity} {i.unit} free</option>)}
            </select>
          </Field>
          <Field label="Qty" htmlFor="al-q" className="sm:col-span-2"><input id="al-q" className="input" type="number" min={1} required value={f.quantity} onChange={(e) => setF({ ...f, quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
          <Field label="From" htmlFor="al-s" className="sm:col-span-2"><input id="al-s" className="input" type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label="To" htmlFor="al-e" className="sm:col-span-2"><input id="al-e" className="input" type="date" required min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
          <button className="btn btn-primary sm:col-span-2" disabled={busy || !f.resourceId}>{busy ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />}Allocate</button>
        </form>
      )}
    </section>
  );
}
