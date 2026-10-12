'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar, Brand, Icon, IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const LINKS: { href: string; label: string; icon: IconName; am?: boolean }[] = [
  { href: '/dashboard', label: 'Requests', icon: 'grid' },
  { href: '/kanban', label: 'Board', icon: 'board' },
  { href: '/requests/new', label: 'New request', icon: 'plus', am: true },
  { href: '/engineers', label: 'Engineers', icon: 'users', am: true },
  { href: '/reports', label: 'Reports', icon: 'chart', am: true },
  { href: '/settings', label: 'Settings', icon: 'sliders' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { if (ready && !user) router.replace('/login'); }, [ready, user, router]);
  useEffect(() => { if (window.innerWidth >= 1024 && window.innerWidth < 1280) setCollapsed(true); }, []);
  useEffect(() => setOpen(false), [path]);

  if (!ready || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500"><span className="animate-pulse">Loading…</span></div>;
  }
  const isAM = user.role === 'account_manager';
  const active = (href: string) => path === href || (href === '/dashboard' && path.startsWith('/requests/') && path !== '/requests/new');
  const hideWhenCollapsed = collapsed ? 'lg:hidden' : '';
  const sideBtn = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400';

  return (
    <div className="min-h-screen">
      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ink-950 text-slate-300 shadow-xl transition-[width,transform] duration-300 ease-out lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'lg:w-[76px]' : ''}`}
      >
        <div className={`flex h-16 items-center px-5 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}><Brand collapsed={collapsed} /></div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main">
          {LINKS.filter((l) => !l.am || isAM).map((l) => {
            const on = active(l.href);
            return (
              <Link key={l.href} href={l.href} title={l.label} aria-current={on ? 'page' : undefined}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${on ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
                {on && <span aria-hidden="true" className="absolute -left-3 top-2 h-6 w-1 rounded-r-full bg-brand-400" />}
                <Icon name={l.icon} />
                <span className={hideWhenCollapsed}>{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-white/10 p-3">
          <div className={`mb-2 flex items-center gap-3 rounded-xl p-2 ${collapsed ? 'lg:justify-center' : ''}`}>
            <Avatar name={user.name} className="h-9 w-9 text-sm" />
            <div className={`min-w-0 ${hideWhenCollapsed}`}>
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{isAM ? 'Account Manager' : 'Engineer'} · {user.organisation}</p>
            </div>
          </div>
          <button className={`${sideBtn} hidden lg:flex ${collapsed ? 'lg:justify-center lg:px-0' : ''}`} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand' : 'Collapse'}>
            <Icon name="chevron" className={`h-5 w-5 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
            <span className={hideWhenCollapsed}>Collapse</span>
          </button>
          <button className={`${sideBtn} ${collapsed ? 'lg:justify-center lg:px-0' : ''}`} onClick={() => { logout(); router.replace('/login'); }} title="Sign out">
            <Icon name="logout" /><span className={hideWhenCollapsed}>Sign out</span>
          </button>
        </div>
      </aside>

      <div onClick={() => setOpen(false)} aria-hidden="true"
        className={`fixed inset-0 z-30 bg-ink-950/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} />

      <div className={`transition-[padding] duration-300 ${collapsed ? 'lg:pl-[76px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-1 rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
            <Icon name="menu" />
          </button>
          <Brand light />
        </header>
        <main key={path} className="mx-auto w-full max-w-7xl animate-slide-up px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
