'use client';
import { useState } from 'react';
import { Alert, Icon } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime, PocRequest } from '@/lib/types';

/**
 * Decommissioning checklist. The API refuses Decommissioned (including a cancellation) until every required task is
 * done; this panel only shows and ticks them. Open by default once a PoC is Completed or closed.
 */
export function Checklist({ r, onChange }: { r: PocRequest; onChange: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const items = r.checklist ?? [];
  const required = items.filter((i) => i.mandatory);
  const doneRequired = required.filter((i) => i.done).length;

  async function toggle(key: string, done: boolean) {
    setBusy(key); setError('');
    try { await api(`/requests/${r.id}/checklist/${key}`, { method: 'PATCH', body: { done } }); onChange(); }
    catch (e: any) { setError(e.message); }
    setBusy(null);
  }

  return (
    <details className="card group animate-slide-up p-6" open={r.status === 'completed' || r.status === 'decommissioned'}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <h2 className="text-base font-semibold text-slate-900">Decommissioning checklist</h2>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${doneRequired === required.length ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {doneRequired} of {required.length} required
        </span>
        <Icon name="chevron" className="h-4 w-4 -rotate-90 text-slate-400 transition-transform group-open:rotate-90" />
      </summary>
      <div className="mt-4">
        {error && <Alert>{error}</Alert>}
        <ul className="space-y-3">
          {items.map((i) => {
            const editable = r.canEditChecklist && !i.auto && busy !== i.key;
            return (
              <li key={i.key} className="flex items-start gap-3">
                <input id={`ck-${i.key}`} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  checked={i.done} disabled={!editable} onChange={(e) => toggle(i.key, e.target.checked)} />
                <label htmlFor={`ck-${i.key}`} className="text-sm leading-snug text-slate-700">
                  {i.label}
                  {!i.mandatory && <span className="ml-1.5 text-xs text-slate-400">(optional)</span>}
                  {i.auto && <span className="block text-xs text-slate-400">{i.done ? 'Nothing is still allocated.' : 'Ticks itself when every allocation is released.'}</span>}
                  {i.done && i.completedBy && <span className="block text-xs text-slate-400">{i.completedBy.name}, {fmtDateTime(i.completedAt!)}{i.notes ? ` · ${i.notes}` : ''}</span>}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
