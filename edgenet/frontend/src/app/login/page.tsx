'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Alert, AuthShell, Field, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) router.replace('/dashboard'); }, [user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); router.replace('/dashboard'); }
    catch (err: any) { setError(err.message); setBusy(false); }
  }
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your PoC requests.">
      <form onSubmit={submit} className="space-y-5">
        {error && <Alert>{error}</Alert>}
        <Field label="Email" htmlFor="email"><input id="email" className="input" type="email" required autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" htmlFor="pw"><input id="pw" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <button className="btn btn-primary w-full" disabled={busy}>{busy && <Spinner />}{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">New to EdgeNet? <Link href="/register" className="link">Create an account</Link></p>
    </AuthShell>
  );
}
