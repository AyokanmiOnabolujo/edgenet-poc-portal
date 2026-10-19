import { Deadline, Priority, PRIORITY_LABEL, Status, STATUSES, STATUS_LABEL } from '@/lib/types';

/* ---------- icons ---------- */
const PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  board: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  plus: 'M12 5v14M5 12h14',
  users: 'M16 8a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21c0-4 3.6-6 8-6s8 2 8 6',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  logout: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  chevron: 'M15 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  circlePlus: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM8 7.5h.01M8 16.5h.01',
  flask: 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3M8 15h8',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 12.5l2.5 2.5 4.5-5',
  power: 'M12 3v8M6.4 6.6a8 8 0 1 0 11.2 0',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  minus: 'M5 12h14',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
} as const;
export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

/* ---------- status + priority styling (full class strings so Tailwind can see them) ---------- */
export const STATUS_STYLE: Record<Status, { icon: IconName; badge: string; dot: string; tint: string }> = {
  new_request: { icon: 'circlePlus', badge: 'bg-blue-50 text-blue-700 ring-blue-600/20', dot: 'bg-blue-500', tint: 'bg-blue-50 text-blue-600' },
  provisioning: { icon: 'server', badge: 'bg-amber-50 text-amber-800 ring-amber-600/25', dot: 'bg-amber-500', tint: 'bg-amber-50 text-amber-600' },
  testing: { icon: 'flask', badge: 'bg-violet-50 text-violet-700 ring-violet-600/20', dot: 'bg-violet-500', tint: 'bg-violet-50 text-violet-600' },
  completed: { icon: 'checkCircle', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', dot: 'bg-emerald-500', tint: 'bg-emerald-50 text-emerald-600' },
  decommissioned: { icon: 'power', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400', tint: 'bg-slate-100 text-slate-500' },
};
export const PRIORITY_STYLE: Record<Priority, { icon: IconName; badge: string; dot: string }> = {
  low: { icon: 'arrowDown', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20', dot: 'bg-slate-400' },
  medium: { icon: 'minus', badge: 'bg-sky-50 text-sky-700 ring-sky-600/20', dot: 'bg-sky-500' },
  high: { icon: 'arrowUp', badge: 'bg-orange-50 text-orange-700 ring-orange-600/25', dot: 'bg-orange-500' },
  critical: { icon: 'alert', badge: 'bg-rose-50 text-rose-700 ring-rose-600/25', dot: 'bg-rose-500' },
};

const pill = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset';
/** Overdue / due soon / late start, from the deadline the API attaches to each request. Renders nothing when on track. */
export function DeadlineBadge({ d }: { d?: Deadline }) {
  if (!d || d.daysLeft === null) return null;
  const n = Math.abs(d.daysLeft);
  const days = `${n} day${n === 1 ? '' : 's'}`;
  const tags: { text: string; style: string }[] = [];
  if (d.overdue) tags.push({ text: `${days} overdue`, style: 'bg-rose-50 text-rose-700 ring-rose-600/25' });
  else if (d.dueSoon) tags.push({ text: d.daysLeft === 0 ? 'Due today' : `Due in ${days}`, style: 'bg-amber-50 text-amber-800 ring-amber-600/25' });
  if (d.lateStart) tags.push({ text: 'Not started', style: 'bg-orange-50 text-orange-700 ring-orange-600/25' });
  return <>{tags.map((t) => <span key={t.text} className={`${pill} ${t.style}`}><Icon name="alert" className="h-3.5 w-3.5" />{t.text}</span>)}</>;
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLE[status];
  return <span className={`${pill} ${s.badge}`}><Icon name={s.icon} className="h-3.5 w-3.5" />{STATUS_LABEL[status]}</span>;
}
export function PriorityBadge({ priority }: { priority: Priority }) {
  const p = PRIORITY_STYLE[priority];
  return <span className={`${pill} ${p.badge}`}><Icon name={p.icon} className="h-3.5 w-3.5" />{PRIORITY_LABEL[priority]}</span>;
}

/* ---------- small building blocks ---------- */
const initials = (n: string) => n.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
export function Avatar({ name, className = 'h-8 w-8 text-xs' }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-ink-700 font-semibold text-white ${className}`}>
      {initials(name)}
    </span>
  );
}

export function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Brand({ light = false, collapsed = false }: { light?: boolean; collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-md shadow-brand-900/30">
        <Icon name="layers" className="h-5 w-5" />
      </span>
      <span className={`text-lg font-semibold tracking-tight ${light ? 'text-ink-900' : 'text-white'} ${collapsed ? 'lg:hidden' : ''}`}>EdgeNet</span>
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success'; children: React.ReactNode }) {
  const ok = kind === 'success';
  return (
    <div role={ok ? 'status' : 'alert'} className={`mb-4 flex animate-fade-in items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
      <Icon name={ok ? 'checkCircle' : 'alert'} className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </div>
  );
}

export function Field({ label, htmlFor, hint, className = '', children }: { label: string; htmlFor: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex animate-fade-in flex-col items-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Icon name={icon} className="h-6 w-6" /></span>
      <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 px-5 py-4">
          <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200/70" />
          <div className="h-4 w-1/5 animate-pulse rounded bg-slate-200/70" />
          <div className="ml-auto h-6 w-28 animate-pulse rounded-full bg-slate-200/70" />
        </div>
      ))}
    </div>
  );
}

export function StatTile({ label, value, icon, tint, delay = 0 }: { label: string; value: string | number; icon: IconName; tint: string; delay?: number }) {
  return (
    <div className="card flex animate-slide-up items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}><Icon name={icon} className="h-5 w-5" /></span>
      <div>
        <p className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-slate-900">{value}</p>
        <p className="mt-1.5 text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}

/* ---------- auth layout ---------- */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(420px,5fr)_6fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-12 text-slate-300 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(60% 50% at 15% 0%, rgba(19,143,133,.38), transparent), radial-gradient(50% 40% at 100% 100%, rgba(47,99,200,.28), transparent)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[.06]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="relative"><Brand /></div>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-semibold leading-[1.15] text-white">Every PoC, from request to teardown.</h2>
          <ol className="mt-10">
            {STATUSES.map((s, i) => (
              <li key={s} className="relative flex items-center gap-4 pb-6 last:pb-0">
                {i < STATUSES.length - 1 && <span aria-hidden="true" className="absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px bg-white/15" />}
                <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-brand-200 ring-1 ring-white/15"><Icon name={STATUS_STYLE[s].icon} className="h-4 w-4" /></span>
                <span className="text-sm font-medium text-slate-200">{STATUS_LABEL[s]}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="relative text-xs text-slate-500">Proof-of-concept request management for account and engineering teams.</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-8 lg:hidden"><Brand light /></div>
          <div className="card p-7 shadow-md sm:p-9">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
