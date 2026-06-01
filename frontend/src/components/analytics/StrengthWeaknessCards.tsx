import { CATEGORY_LABELS } from '../../api/sessions';
import type { DimensionSummary, TrendDirection } from '../../utils/scoreAnalytics';

interface Props {
  strengths: DimensionSummary[];
  weaknesses: DimensionSummary[];
}

function TrendArrow({ trend }: { trend: TrendDirection }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        improving
      </span>
    );
  }
  if (trend === 'declining') {
    return (
      <span className="inline-flex items-center gap-1 text-red-700 text-xs font-medium">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 4v12M4 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        declining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium">
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      stable
    </span>
  );
}

function Card({ item, kind }: { item: DimensionSummary; kind: 'strength' | 'weakness' }) {
  const palette =
    kind === 'strength'
      ? 'border-emerald-200 bg-emerald-50/40'
      : 'border-rose-200 bg-rose-50/40';
  return (
    <div className={`rounded-lg border ${palette} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
          <p className="text-xs text-slate-500 truncate">{CATEGORY_LABELS[item.category]}</p>
        </div>
        <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white text-slate-700 ring-1 ring-inset ring-slate-200 tabular-nums">
          {item.avgScore.toFixed(1)} / 5
        </span>
      </div>
      <div className="mt-2">
        <TrendArrow trend={item.trend} />
      </div>
    </div>
  );
}

function Column({ title, items, kind }: { title: string; items: DimensionSummary[]; kind: 'strength' | 'weakness' }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 italic">Need more sessions for a clearer picture.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <Card key={it.dimension} item={it} kind={kind} />
          ))}
          {items.length < 3 && (
            <p className="text-xs text-slate-400 italic">More sessions will sharpen this view.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function StrengthWeaknessCards({ strengths, weaknesses }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Column title="Strengths" items={strengths} kind="strength" />
      <Column title="Areas to focus on" items={weaknesses} kind="weakness" />
    </div>
  );
}
