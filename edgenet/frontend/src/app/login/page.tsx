'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { LoginShell, SecureNote } from '@/components/login/LoginShell';
import { LoginField } from '@/components/login/LoginField';
import { ArrowRightIcon, EyeIcon, EyeOffIcon, LockIcon, MailIcon } from '@/components/login/LoginIcons';
import styles from '@/components/login/login.module.css';
import { Alert, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) router.replace('/dashboard'); }, [user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email, password); router.replace('/dashboard'); }
    catch (err: any) { setError(err.message); setBusy(false); }
  }
  return (
    <LoginShell title="Sign In" subtitle="Welcome back! Please sign in to your account to continue.">
      <form onSubmit={submit} className={styles.form}>
        {error && <Alert>{error}</Alert>}
        <LoginField
          id="email" label="Email Address" icon={<MailIcon />}
          type="email" required autoComplete="email" placeholder="Enter your email address"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <LoginField
          id="pw" label="Password" icon={<LockIcon />}
          type={showPw ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button type="button" className={styles.toggle} onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw}>
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          }
        />
        <button type="submit" className={styles.submit} disabled={busy}>
          {busy && <Spinner />}
          {busy ? 'Signing in…' : <>Sign In <ArrowRightIcon /></>}
        </button>
      </form>
      <SecureNote />
      <p className={styles.register}>New to EdgeNet? <Link href="/register" className={styles.registerLink}>Create an account</Link></p>
    </LoginShell>
  );
}
