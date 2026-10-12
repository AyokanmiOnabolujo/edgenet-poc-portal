'use client';
import { FormEvent, useState } from 'react';
import { Alert, Avatar, Field, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { User } from '@/lib/types';

type Msg = { ok: boolean; text: string } | null;

export default function Settings() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pMsg, setPMsg] = useState<Msg>(null);
  const [wMsg, setWMsg] = useState<Msg>(null);

  async function saveProfile(e: FormEvent) {
    e.preventDefault(); setPMsg(null);
    try { setUser(await api<User>('/users/me', { method: 'PATCH', body: { name, email } })); setPMsg({ ok: true, text: 'Profile saved.' }); }
    catch (err: any) { setPMsg({ ok: false, text: err.message }); }
  }
  async function savePassword(e: FormEvent) {
    e.preventDefault(); setWMsg(null);
    if (pw.newPassword !== pw.confirm) { setWMsg({ ok: false, text: 'New passwords do not match.' }); return; }
    try {
      await api('/users/me/password', { method: 'PATCH', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: '', newPassword: '', confirm: '' }); setWMsg({ ok: true, text: 'Password changed.' });
    } catch (err: any) { setWMsg({ ok: false, text: err.message }); }
  }
  const show = (m: Msg) => m && <Alert kind={m.ok ? 'success' : 'error'}>{m.text}</Alert>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Manage your profile and sign-in details." />
      <div className="card mb-6 flex animate-slide-up items-center gap-4 p-6">
        <Avatar name={user?.name ?? ''} className="h-14 w-14 text-lg" />
        <div>
          <p className="text-base font-semibold text-slate-900">{user?.name}</p>
          <p className="text-sm text-slate-500">{user?.role === 'account_manager' ? 'Account Manager' : 'Engineer'} at {user?.organisation}</p>
        </div>
      </div>
      <form onSubmit={saveProfile} className="card mb-6 animate-slide-up p-6" style={{ animationDelay: '60ms' }}>
        <h2 className="mb-5 text-base font-semibold text-slate-900">Profile</h2>
        {show(pMsg)}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="n"><input id="n" className="input" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" htmlFor="e"><input id="e" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div className="mt-6 flex justify-end"><button className="btn btn-primary">Save profile</button></div>
      </form>
      <form onSubmit={savePassword} className="card animate-slide-up p-6" style={{ animationDelay: '120ms' }}>
        <h2 className="mb-5 text-base font-semibold text-slate-900">Change password</h2>
        {show(wMsg)}
        <div className="space-y-5">
          <Field label="Current password" htmlFor="cp"><input id="cp" className="input" type="password" required autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New password" htmlFor="np" hint="At least 8 characters."><input id="np" className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
            <Field label="Confirm new password" htmlFor="cf"><input id="cf" className="input" type="password" required minLength={8} autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          </div>
        </div>
        <div className="mt-6 flex justify-end"><button className="btn btn-primary">Change password</button></div>
      </form>
    </div>
  );
}
