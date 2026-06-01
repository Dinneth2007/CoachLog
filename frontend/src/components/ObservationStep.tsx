import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import {
  ALL_DIMENSIONS,
  CATEGORIES,
  CATEGORY_LABELS,
  DIMENSIONS_BY_CATEGORY,
  DIMENSION_LABELS,
  DIMENSION_TO_CATEGORY,
  submitObservations,
} from '../api/sessions';
import type { Category, Dimension, Observation, ScoreEntry } from '../api/sessions';
import { AGE_GROUP_CHIP_CLASSES } from '../api/players';
import type { AgeGroup } from '../api/players';

interface Attendee {
  id: number;
  name: string;
  ageGroup: AgeGroup;
}

interface DimensionDraft {
  score: number;
  notes: string;
}

interface PlayerDraft {
  overallNotes: string;
  scores: Partial<Record<Dimension, DimensionDraft>>;
}

interface Props {
  sessionId: number;
  attendees: Attendee[];
  onSubmitSuccess: () => void;
}

const NOTES_MAX = 500;

function isScored(draft: PlayerDraft | undefined): boolean {
  if (!draft) return false;
  if (draft.overallNotes.trim().length > 0) return true;
  return Object.keys(draft.scores).length > 0;
}

export default function ObservationStep({ sessionId, attendees, onSubmitSuccess }: Props) {
  const qc = useQueryClient();
  const sortedAttendees = useMemo(
    () => [...attendees].sort((a, b) => a.name.localeCompare(b.name)),
    [attendees],
  );
  const [currentPlayerId, setCurrentPlayerId] = useState<number>(sortedAttendees[0]?.id ?? 0);
  const [drafts, setDrafts] = useState<Record<number, PlayerDraft>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<Category>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentPlayer = sortedAttendees.find((a) => a.id === currentPlayerId) ?? sortedAttendees[0];
  const currentDraft: PlayerDraft = drafts[currentPlayerId] ?? { overallNotes: '', scores: {} };

  const setPlayerDraft = (pid: number, updater: (prev: PlayerDraft) => PlayerDraft) => {
    setDrafts((prev) => {
      const existing = prev[pid] ?? { overallNotes: '', scores: {} };
      return { ...prev, [pid]: updater(existing) };
    });
  };

  const onTapScore = (dim: Dimension, n: number) => {
    setPlayerDraft(currentPlayerId, (prev) => {
      const existing = prev.scores[dim];
      if (existing && existing.score === n) {
        const nextScores = { ...prev.scores };
        delete nextScores[dim];
        return { ...prev, scores: nextScores };
      }
      return {
        ...prev,
        scores: { ...prev.scores, [dim]: { score: n, notes: existing?.notes ?? '' } },
      };
    });
  };

  const onChangeDimNotes = (dim: Dimension, notes: string) => {
    setPlayerDraft(currentPlayerId, (prev) => {
      const existing = prev.scores[dim];
      if (!existing) return prev;
      return { ...prev, scores: { ...prev.scores, [dim]: { ...existing, notes } } };
    });
  };

  const onChangeOverall = (notes: string) => {
    setPlayerDraft(currentPlayerId, (prev) => ({ ...prev, overallNotes: notes }));
  };

  const toggleExpand = (dim: Dimension) => {
    const key = `${currentPlayerId}:${dim}`;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (cat: Category) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const submitMut = useMutation({
    mutationFn: (observations: Observation[]) => submitObservations(sessionId, observations),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['sessions', sessionId] });
      onSubmitSuccess();
    },
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setSubmitError(String(err.response.data.error));
      } else {
        setSubmitError('Could not submit observations. Please try again.');
      }
    },
  });

  const onSubmitAll = () => {
    setSubmitError(null);
    const observations: Observation[] = [];
    for (const a of sortedAttendees) {
      const d = drafts[a.id];
      if (!d) continue;
      const trimmedOverall = d.overallNotes.trim();
      const dims = Object.keys(d.scores) as Dimension[];
      if (dims.length === 0 && trimmedOverall === '') continue;

      const scoreList: ScoreEntry[] = ALL_DIMENSIONS
        .filter((dim) => d.scores[dim] !== undefined)
        .map((dim) => {
          const entry = d.scores[dim]!;
          return {
            category: DIMENSION_TO_CATEGORY[dim],
            dimension: dim,
            score: entry.score,
            notes: entry.notes.trim() || null,
          };
        });

      observations.push({
        playerId: a.id,
        overallNotes: trimmedOverall || null,
        scores: scoreList,
      });
    }
    submitMut.mutate(observations);
  };

  if (!currentPlayer) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">No attendees to log.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[14rem_1fr] gap-6">
      <aside>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Attendees</h3>
        <ul className="space-y-1 bg-white border border-slate-200 rounded-xl p-1.5">
          {sortedAttendees.map((a) => {
            const scored = isScored(drafts[a.id]);
            const active = a.id === currentPlayerId;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setCurrentPlayerId(a.id)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span
                    className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                      scored ? 'bg-emerald-500' : active ? 'bg-white/30' : 'bg-slate-200'
                    }`}
                    aria-hidden
                  />
                  <span className="truncate flex-1">{a.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="min-w-0">
        <div className="flex items-center gap-3 mb-5">
          <h3 className="text-lg font-semibold text-slate-900 truncate">{currentPlayer.name}</h3>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${AGE_GROUP_CHIP_CLASSES[currentPlayer.ageGroup]}`}
          >
            {currentPlayer.ageGroup}
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="overall-notes" className="block text-sm font-medium text-slate-700">
              Overall notes
            </label>
            <span className="text-xs text-slate-400">
              {currentDraft.overallNotes.length}/{NOTES_MAX}
            </span>
          </div>
          <textarea
            id="overall-notes"
            value={currentDraft.overallNotes}
            onChange={(e) => onChangeOverall(e.target.value)}
            maxLength={NOTES_MAX}
            rows={2}
            placeholder="How did they go overall?"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
          />
        </div>

        <div className="space-y-4">
          {CATEGORIES.map((cat) => {
            const dims = DIMENSIONS_BY_CATEGORY[cat] as readonly Dimension[];
            const collapsed = collapsedCategories.has(cat);
            return (
              <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-50 focus:outline-none focus:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{CATEGORY_LABELS[cat]}</span>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden
                    className={`text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}
                  >
                    <path d="M5 7l5 6 5-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {!collapsed && (
                  <ul className="border-t border-slate-100 divide-y divide-slate-50">
                    {dims.map((dim) => {
                      const entry = currentDraft.scores[dim];
                      const key = `${currentPlayerId}:${dim}`;
                      const isExpanded = expanded.has(key);
                      return (
                        <li key={dim} className="px-5 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-700">{DIMENSION_LABELS[dim]}</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((n) => {
                                const active = entry?.score === n;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => onTapScore(dim, n)}
                                    aria-label={`Score ${n} for ${DIMENSION_LABELS[dim]}`}
                                    aria-pressed={active}
                                    className={`w-9 h-9 rounded-md text-sm font-medium tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ${
                                      active
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    {n}
                                  </button>
                                );
                              })}
                              <button
                                type="button"
                                onClick={() => toggleExpand(dim)}
                                aria-label={`Toggle notes for ${DIMENSION_LABELS[dim]}`}
                                aria-pressed={isExpanded}
                                className={`ml-1 w-9 h-9 rounded-md flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 ${
                                  isExpanded
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                                  <path
                                    d="M4 5h12M4 10h12M4 15h8"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-2">
                              <textarea
                                value={entry?.notes ?? ''}
                                onChange={(e) => onChangeDimNotes(dim, e.target.value)}
                                disabled={!entry}
                                maxLength={NOTES_MAX}
                                rows={2}
                                placeholder={entry ? 'Notes…' : 'Pick a score first to add notes'}
                                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {submitError && (
          <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end">
          <button
            type="button"
            onClick={onSubmitAll}
            disabled={submitMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
          >
            {submitMut.isPending ? 'Submitting…' : 'Submit all'}
          </button>
        </div>
      </section>
    </div>
  );
}
