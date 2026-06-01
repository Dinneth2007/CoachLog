import {
  CATEGORIES,
  CATEGORY_LABELS,
  DIMENSIONS_BY_CATEGORY,
  DIMENSION_LABELS,
  DIMENSION_TO_CATEGORY,
} from '../api/sessions';
import type { Category, Dimension, ScoreEntry } from '../api/sessions';

interface Props {
  scores: ScoreEntry[];
  overallNotes?: string | null;
  emptyLabel?: string;
}

export default function ScoreDisplay({ scores, overallNotes, emptyLabel = 'No observations' }: Props) {
  const trimmedOverall = overallNotes?.trim() ?? '';

  if (scores.length === 0 && trimmedOverall === '') {
    return <p className="text-sm text-slate-400 italic">{emptyLabel}</p>;
  }

  const grouped = new Map<Category, ScoreEntry[]>();
  for (const s of scores) {
    const cat = DIMENSION_TO_CATEGORY[s.dimension];
    const list = grouped.get(cat) ?? [];
    list.push(s);
    grouped.set(cat, list);
  }

  const orderIndex = (dim: Dimension, cat: Category): number =>
    (DIMENSIONS_BY_CATEGORY[cat] as readonly string[]).indexOf(dim);

  return (
    <div className="space-y-4">
      {trimmedOverall && (
        <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Overall notes</p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{trimmedOverall}</p>
        </div>
      )}
      {CATEGORIES.filter((c) => grouped.has(c)).map((cat) => {
        const list = (grouped.get(cat) ?? []).slice().sort(
          (a, b) => orderIndex(a.dimension, cat) - orderIndex(b.dimension, cat),
        );
        return (
          <div key={cat}>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {CATEGORY_LABELS[cat]}
            </h4>
            <ul className="space-y-1.5">
              {list.map((s) => (
                <li key={s.dimension} className="text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-700">{DIMENSION_LABELS[s.dimension]}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 tabular-nums">
                      {s.score} / 5
                    </span>
                  </div>
                  {s.notes && s.notes.trim() && (
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed whitespace-pre-wrap">{s.notes}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
