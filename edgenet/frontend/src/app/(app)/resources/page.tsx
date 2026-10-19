'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, EmptyState, Field, Icon, SkeletonRows, Spinner } from '@/components/ui';
import { PageTitle } from '@/components/AppUI';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import { InventoryItem, RESOURCE_STATE_LABEL, RESOURCE_TYPES, ResourceState } from '@/lib/types';

const STATE_STYLE: Record<ResourceState, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  maintenance: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  retired: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
const blank = { name: '', type: 'Physical server', unit: '', capacity: 1, specs: '' };

export default function Inventory() {
  const allowed = useRequireRole('account_manager');
  const [rows, setRows] = useState<InventoryItem[] | null>(null);
  const [f, setF] = useState(blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api<InventoryItem[]>('/resources').then(setRows).catch((e) => setError(e.message));
  useEffect(() => { if (allowed) load(); }, [allowed]);
  if (!allowed) return null;

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/resources', { method: 'POST', body: { ...f, unit: f.unit.trim() || undefined, specs: f.specs.trim() || undefined } });
      setF(blank);
      await load();
    } catch (err: any) { setError(err.message); }
    setBusy(false);
  }
  async function setState(id: string, state: ResourceState) {
    setError('');
    try { await api(`/resources/${id}`, { method: 'PATCH', body: { state } }); await load(); }
    catch (err: any) { setError(err.message); }
  }

  return (
    <>
      <PageTitle title="Inventory" subtitle="Equipment and licences you can allocate to PoCs. Entered by hand here; not connected to live infrastructure." />
      {error && <Alert>{error}</Alert>}

      <form onSubmit={add} className="card mb-6 grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_0.8fr_0.6fr]">
        <Field label="Name" htmlFor="rn"><input id="rn" className="input" required placeholder="e.g. Dell R750 #2" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Type" htmlFor="rt">
          <select id="rt" className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{RESOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
        <Field label="Unit" htmlFor="ru" hint="What one counts: server, seat, TB…"><input id="ru" className="input" placeholder="unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
        <Field label="Capacity" htmlFor="rc" hint="Units usable at once">
          <input id="rc" className="input" type="number" min={1} required value={f.capacity} onChange={(e) => setF({ ...f, capacity: Math.max(1, parseInt(e.target.value) || 1) })} />
        </Field>
        <Field label="Specs / notes" htmlFor="rs" className="sm:col-span-2 lg:col-span-3">
          <input id="rs" className="input" placeholder="e.g. 32 cores, 256 GB RAM, rack B4" value={f.specs} onChange={(e) => setF({ ...f, specs: e.target.value })} />
        </Field>
        <div className="flex items-end"><button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : <Icon name="plus" className="h-4 w-4" />}Add to inventory</button></div>
      </form>

      <div className="card overflow-hidden">
        {rows === null && !error ? <SkeletonRows />
          : rows && rows.length === 0 ? <EmptyState icon="server" title="No inventory yet" text="Add the servers, storage, network kit and licences your team can lend to PoCs." />
          : rows && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80">
                  <tr><th className="th">Resource</th><th className="th">Type</th><th className="th">Capacity</th><th className="th">In use today</th><th className="th">State</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="td"><span className="block font-medium text-slate-900">{r.name}</span>{r.specs && <span className="block text-xs text-slate-500">{r.specs}</span>}</td>
                      <td className="td text-slate-600">{r.type}</td>
                      <td className="td tabular-nums">{r.capacity} {r.unit}</td>
                      <td className="td tabular-nums">{r.inUse} of {r.capacity}</td>
                      <td className="td">
                        <select aria-label={`State of ${r.name}`} className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATE_STYLE[r.state]}`} value={r.state} onChange={(e) => setState(r.id, e.target.value as ResourceState)}>
                          {(Object.keys(RESOURCE_STATE_LABEL) as ResourceState[]).map((s) => <option key={s} value={s}>{RESOURCE_STATE_LABEL[s]}</option>)}
                        </select>
                      </td>
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
