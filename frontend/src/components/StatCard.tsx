import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  value: string;
  to?: string;
  valueClass?: string;
  hint?: string;
}

export default function StatCard({ icon, label, value, to, valueClass, hint }: Props) {
  const body = (
    <div className="h-full bg-white border border-slate-200 rounded-2xl p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`mt-3 text-3xl font-semibold tabular-nums ${valueClass ?? 'text-slate-900'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );

  if (!to) return body;
  return (
    <Link
      to={to}
      className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
    >
      {body}
    </Link>
  );
}
