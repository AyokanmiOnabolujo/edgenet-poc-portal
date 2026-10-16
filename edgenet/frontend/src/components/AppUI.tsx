import { Icon, IconName } from '@/components/ui';

/** Page heading for the signed-in app: serif display title, subtitle and optional actions. */
export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-base text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Summary tile: round icon, label, big number and an optional note. Used by Dashboard and Reports. */
export function SummaryCard({ label, value, note, icon, tint, noteColor = 'text-slate-500', delay = 0 }: {
  label: string; value: string | number; note?: string; icon: IconName; tint: string; noteColor?: string; delay?: number;
}) {
  return (
    <div className="card flex animate-slide-up items-center gap-4 p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-full ${tint}`}><Icon name={icon} className="h-6 w-6" /></span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-0.5 text-3xl font-semibold leading-none tracking-tight tabular-nums text-ink-900">{value}</p>
        {note !== undefined && <p className={`mt-2 min-h-[1rem] text-xs font-medium ${noteColor}`}>{note}</p>}
      </div>
    </div>
  );
}
