'use client';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, TOKEN_KEY } from './api';
import { Role, User } from './types';

interface AuthState {
  user: User | null; ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Resolves to a message when the account must wait for approval (engineers), or null when signed in. */
  register: (data: { name: string; email: string; password: string; role: Role; organisation: string }) => Promise<string | null>;
  logout: () => void; setUser: (u: User) => void;
}
const Ctx = createContext<AuthState>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) { setReady(true); return; }
    api<User>('/auth/me').then(setUser).catch(() => localStorage.removeItem(TOKEN_KEY)).finally(() => setReady(true));
  }, []);

  const finish = (r: { token: string; user: User }) => { localStorage.setItem(TOKEN_KEY, r.token); setUser(r.user); };
  const value: AuthState = {
    user, ready, setUser,
    login: async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (data) => {
      const r = await api<{ token: string; user: User } | { pending: true; message: string }>('/auth/register', { method: 'POST', body: data });
      if ('pending' in r) return r.message;
      finish(r);
      return null;
    },
    logout: () => { localStorage.removeItem(TOKEN_KEY); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Sends the user to the dashboard if their role cannot see the current page. */
export function useRequireRole(role: Role) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => { if (user && user.role !== role) router.replace('/dashboard'); }, [user, role, router]);
  return user?.role === role;
}
