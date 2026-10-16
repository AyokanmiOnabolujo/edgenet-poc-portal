'use client';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Alert, Field, Icon, Spinner } from '@/components/ui';
import { PageTitle } from '@/components/AppUI';
import { api } from '@/lib/api';
import { useRequireRole } from '@/lib/auth';
import { EngineerRow, PocRequest, PRIORITIES, PRIORITY_LABEL, RESOURCE_TYPES, Resource } from '@/lib/types';

const STEPS = [
  { name: 'Client', title: 'Who is this PoC for?', text: 'The client contact we will keep updated.' },
  { name: 'Project', title: 'Project details', text: 'What the PoC should prove, when it runs and who owns it.' },
  { name: 'Resources', title: 'Infrastructure needed', text: 'List every resource engineering needs to provision.' },
];

export default function NewRequest() {
  const allowed = useRequireRole('account_manager');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [engineers, setEngineers] = useState<EngineerRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ clientName: '', clientEmail: '', clientCompany: '', projectName: '', description: '', startDate: '', endDate: '', priority: 'medium', assignedEngineerId: '' });
  const [res, setRes] = useState<Resource[]>([{ type: RESOURCE_TYPES[0], quantity: 1, notes: '' }]);

  useEffect(() => { if (allowed) api<EngineerRow[]>('/users/engineers').then(setEngineers).catch(() => {}); }, [allowed]);
  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const setRow = (i: number, patch: Partial<Resource>) => setRes(res.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true); setError('');
    try {
      const body = { ...f, assignedEngineerId: f.assignedEngineerId || undefined, resources: res.map((r) => ({ ...r, notes: r.notes || undefined })) };
      const created = await api<PocRequest>('/requests', { method: 'POST', body });
      router.push(`/requests/${created.id}`);
    } catch (err: any) { setError(err.message); setBusy(false); }
  }
  if (!allowed) return null;
  const cur = STEPS[step];

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="New PoC request" subtitle="Capture the client, the project window and the infrastructure it needs." />

      <ol className="mb-8 flex items-center" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s.name} className="flex flex-1 items-center last:flex-none" aria-current={i === step ? 'step' : undefined}>
            <span className="flex items-center gap-2.5">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold transition duration-300 ${i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-ink-900 text-white ring-4 ring-ink-900/10' : 'bg-slate-200 text-slate-500'}`}>
                {i < step ? <Icon name="check" className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`hidden text-sm font-medium sm:block ${i <= step ? 'text-slate-900' : 'text-slate-400'}`}>{s.name}</span>
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className={`mx-3 h-px flex-1 transition-colors duration-300 ${i < step ? 'bg-brand-500' : 'bg-slate-200'}`} />}
          </li>
        ))}
      </ol>

      <form onSubmit={submit} className="card p-6 shadow-md sm:p-8">
        <div key={step} className="animate-fade-in">
          <h2 className="section-title">{cur.title}</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">{cur.text}</p>
          {error && <Alert>{error}</Alert>}

          {step === 0 && (
            <div className="space-y-5">
              <Field label="Client contact name" htmlFor="cn"><input id="cn" className="input" required value={f.clientName} onChange={set('clientName')} /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Client email" htmlFor="ce"><input id="ce" className="input" type="email" required value={f.clientEmail} onChange={set('clientEmail')} /></Field>
                <Field label="Client company" htmlFor="cc"><input id="cc" className="input" required value={f.clientCompany} onChange={set('clientCompany')} /></Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Field label="Project name" htmlFor="pn"><input id="pn" className="input" required value={f.projectName} onChange={set('projectName')} /></Field>
              <Field label="What should the PoC prove?" htmlFor="pd"><textarea id="pd" className="input" value={f.description} onChange={set('description')} /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Start date" htmlFor="sd"><input id="sd" className="input" type="date" required value={f.startDate} onChange={set('startDate')} /></Field>
                <Field label="End date" htmlFor="ed"><input id="ed" className="input" type="date" required min={f.startDate} value={f.endDate} onChange={set('endDate')} /></Field>
                <Field label="Priority" htmlFor="pr"><select id="pr" className="input" value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></Field>
                <Field label="Assign engineer" htmlFor="en" hint="Optional. You can assign later from the request page.">
                  <select id="en" className="input" value={f.assignedEngineerId} onChange={set('assignedEngineerId')}>
                    <option value="">Assign later</option>
                    {engineers.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.active} active)</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {res.map((r, i) => (
                <div key={i} className="grid animate-fade-in items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-[1.3fr_100px_1.6fr_auto]">
                  <Field label="Resource" htmlFor={`rt${i}`}><select id={`rt${i}`} className="input" value={r.type} onChange={(e) => setRow(i, { type: e.target.value })}>{RESOURCE_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
                  <Field label="Qty" htmlFor={`rq${i}`}><input id={`rq${i}`} className="input" type="number" min={1} required value={r.quantity} onChange={(e) => setRow(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} /></Field>
                  <Field label="Specs / notes" htmlFor={`rn${i}`}><input id={`rn${i}`} className="input" placeholder="e.g. 8 vCPU, 32 GB RAM" value={r.notes ?? ''} onChange={(e) => setRow(i, { notes: e.target.value })} /></Field>
                  <button type="button" className="btn btn-secondary h-[42px] !px-3 text-rose-600 hover:!bg-rose-50" disabled={res.length === 1} onClick={() => setRes(res.filter((_, j) => j !== i))} aria-label={`Remove resource ${i + 1}`}>
                    <Icon name="trash" className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setRes([...res, { type: RESOURCE_TYPES[0], quantity: 1, notes: '' }])}
                className="btn w-full border-2 border-dashed border-slate-300 text-slate-600 hover:border-brand-500 hover:bg-brand-50/50 hover:text-brand-700">
                <Icon name="plus" className="h-4 w-4" />Add resource
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-between border-t border-slate-100 pt-6">
          <button type="button" className="btn btn-secondary" disabled={step === 0 || busy} onClick={() => setStep(step - 1)}>Back</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />}{step < 2 ? 'Continue' : busy ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
    </div>
  );
}
