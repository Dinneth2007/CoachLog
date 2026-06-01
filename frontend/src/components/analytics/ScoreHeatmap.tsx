import { DIMENSION_LABELS } from '../../api/sessions';
import type { Dimension } from '../../api/sessions';

interface Props {
  sessions: { id: number; date: string; label: string; title: string }[];
  dimensions: Dimension[];
  cell: (dim: Dimension, sessionId: number) => number | undefined;
}

function scoreClass(score: number | undefined): string {
  if (score === undefined) return 'bg-slate-50 text-slate-300';
  switch (score) {
    case 1: return 'bg-emerald-100 text-emerald-900';
    case 2: return 'bg-emerald-200 text-emerald-900';
    case 3: return 'bg-emerald-400 text-emerald-900';
    case 4: return 'bg-emerald-600 text-white';
    case 5: return 'bg-emerald-800 text-white';
    default: return 'bg-slate-50 text-slate-300';
  }
}

export default function ScoreHeatmap({ sessions, dimensions, cell }: Props) {
  if (dimensions.length === 0 || sessions.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 min-w-fit"
        style={{
          gridTemplateColumns: `11rem repeat(${sessions.length}, minmax(3rem, 1fr))`,
        }}
      >
        <div />
        {sessions.map((s) => (
          <div
            key={s.id}
            className="text-xs font-medium text-slate-500 text-center px-1 py-2 tabular-nums truncate"
            title={`${s.title} · ${s.label}`}
          >
            {s.label}
          </div>
        ))}

        {dimensions.map((dim) => (
          <div key={dim} className="contents">
            <div className="text-xs text-slate-700 py-2 pr-3 truncate" title={DIMENSION_LABELS[dim]}>
              {DIMENSION_LABELS[dim]}
            </div>
            {sessions.map((s) => {
              const v = cell(dim, s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-center rounded text-xs font-semibold tabular-nums h-9 ${scoreClass(v)}`}
                  title={
                    v === undefined
                      ? `${DIMENSION_LABELS[dim]} · ${s.title} · ${s.label}: not scored`
                      : `${DIMENSION_LABELS[dim]} · ${s.title} · ${s.label}: ${v}/5`
                  }
                >
                  {v === undefined ? '—' : v}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
