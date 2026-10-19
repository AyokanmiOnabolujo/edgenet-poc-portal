'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Role } from '@/lib/types';
import {LoginShell} from '@/components/login/LoginShell';
import {LoginField} from '@/components/login/LoginField';
import styles from '@/components/login/login.module.css';

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
  const [pending, setPending] = useState('');
  useEffect(() => { if (user) router.replace('/dashboard'); }, [user, router]);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const wait = await register(f);
      if (wait) { setPending(wait); setBusy(false); } else router.replace('/dashboard');
    } catch (err: any) { setError(err.message); setBusy(false); }
  }

  return (
    <LoginShell title="Create your account" subtitle="Join your organisation on EdgeNet.">
      {pending ? (
        <Alert kind="success">Account created. {pending} You can sign in once they have approved it.</Alert>
      ) : (
      <form onSubmit={submit} className={styles.form}>
        {error && <Alert>{error}</Alert>}
        
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">Full name</label>
          <input id="name" className={styles.input} required minLength={2} autoComplete="name" value={f.name} onChange={set('name')} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Work email</label>
          <input id="email" className={styles.input} type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="pw">Password</label>
          <input id="pw" className={styles.input} type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set('password')} />
          <span className="block mt-1 text-xs text-slate-500">At least 8 characters.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="org">Organisation</label>
          <input id="org" className={styles.input} required minLength={2} value={f.organisation} onChange={set('organisation')} />
        </div>

        <fieldset className="mb-4">
          <legend className={styles.label}>Role</legend>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(([v, title, desc]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="role" value={v} checked={f.role === v} onChange={() => setF({ ...f, role: v })} className="peer sr-only" />
                <span className="block rounded-xl border border-slate-300 bg-white p-3 transition hover:border-slate-400 peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:ring-2 peer-checked:ring-blue-600/20">
                  <span className="block text-sm font-medium text-slate-900">{title}</span>
                  <span className="block text-xs text-slate-500">{desc}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">One Account Manager per organisation. Engineers can sign in once the Account Manager approves them.</p>
        </fieldset>

        <button className={styles.submit} disabled={busy}>
          {busy && <Spinner />}
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      )}
      
      <p className={styles.register}>
        Already registered? <Link href="/login" className={styles.registerLink}>Sign in</Link>
      </p>
    </LoginShell>
  );
}