'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, AuthShell, Field, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Role } from '@/lib/types';

const ROLES = [
  ['engineer', 'Engineer', 'Provision and test PoCs'],
  ['account_manager', 'Account Manager', 'Raise and track requests'],
] as const;

export default function Register() {
  const { user, register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: '', email: '', password: '', organisation: '', role: 'engineer' as Role });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) router.replace('/dashboard'); }, [user, router]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await register(f); router.replace('/dashboard'); }
    catch (err: any) { setError(err.message); setBusy(false); }
  }
  return (
    <AuthShell title="Create your account" subtitle="Join your organisation on EdgeNet.">
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" htmlFor="name"><input id="name" className="input" required minLength={2} autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label="Work email" htmlFor="email"><input id="email" className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field label="Password" htmlFor="pw" hint="At least 8 characters."><input id="pw" className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <Field label="Organisation" htmlFor="org"><input id="org" className="input" required minLength={2} value={f.organisation} onChange={set('organisation')} /></Field>
        <fieldset>
          <legend className="label">Role</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(([v, title, desc]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="role" value={v} checked={f.role === v} onChange={() => setF({ ...f, role: v })} className="peer sr-only" />
                <span className="block rounded-xl border border-slate-300 bg-white p-3 transition hover:border-slate-400 peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:ring-2 peer-checked:ring-brand-500/20 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500">
                  <span className="block text-sm font-medium text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-500">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="hint">One Account Manager per organisation, unlimited Engineers.</p>
        </fieldset>
        <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link href="/login" className="link">Sign in</Link></p>
    </AuthShell>
  );
}
