import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import DimensionTrendChart from '../components/analytics/DimensionTrendChart';
import PlayerRadarChart from '../components/analytics/PlayerRadarChart';
import ScoreDisplay from '../components/ScoreDisplay';
import {
  CATEGORY_CHIP_CLASSES,
  CATEGORY_LABELS,
  DIMENSIONS_BY_CATEGORY,
} from '../api/sessions';
import type { Category, Dimension, ScoreEntry } from '../api/sessions';
import { AGE_GROUP_CHIP_CLASSES } from '../api/players';
import { getParentView } from '../api/parent';
import {
  categoriesWithData,
  computeLatestRadarData,
  pivotByCategoryAndDimension,
} from '../utils/scoreAnalytics';
import { formatDate } from '../utils/format';

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      {title && <h2 className="text-sm font-semibold text-slate-900 mb-4">{title}</h2>}
      {children}
    </section>
  );
}

export default function ParentViewPage() {
  const { token } = useParams<{ token: string }>();

  const viewQ = useQuery({
    queryKey: ['parentView', token],
    queryFn: () => getParentView(token!),
    enabled: !!token,
    retry: false,
  });

  const trends = useMemo(() => viewQ.data?.trends ?? [], [viewQ.data]);
  const pivots = useMemo(() => pivotByCategoryAndDimension(trends), [trends]);
  const presentCategories = useMemo(() => categoriesWithData(pivots), [pivots]);
  const radar = useMemo(() => computeLatestRadarData(trends), [trends]);

  if (viewQ.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
          <div className="h-8 bg-slate-200 rounded w-1/2 animate-pulse" />
          <div className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <div className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          <div className="h-56 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (viewQ.isError || !viewQ.data) {
    const is404 = axios.isAxiosError(viewQ.error) && viewQ.error.response?.status === 404;
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">
            {is404 ? 'Link no longer active' : 'Something went wrong'}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {is404
              ? 'This link is no longer active. Please ask your coach for a new link.'
              : 'We could not load this page. Please try again in a moment.'}
          </p>
        </div>
      </div>
    );
  }

  const data = viewQ.data;
  const recent = data.recentObservations;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <header className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900">{data.playerName}</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${AGE_GROUP_CHIP_CLASSES[data.ageGroup]}`}
            >
              {data.ageGroup}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">Coached by {data.coachName}</p>
        </header>

        {data.weeklySummary && data.weeklySummary.trim() && (
          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
            <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">This week</p>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-800">{data.weeklySummary}</p>
          </section>
        )}

        {presentCategories.length > 0 && (
          <Card title="Progress over time">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {presentCategories.map((cat: Category) => {
                const dims = (DIMENSIONS_BY_CATEGORY[cat] as readonly Dimension[]).filter((d) =>
                  pivots[cat].some((row) => typeof row[d] === 'number'),
                );
                if (dims.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-medium text-slate-500 mb-2">{CATEGORY_LABELS[cat]}</h3>
                    <DimensionTrendChart category={cat} data={pivots[cat]} dimensions={dims} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {radar.points.length > 0 && (
          <Card title="Current form vs average">
            <PlayerRadarChart points={radar.points} missingInLatest={radar.missingInLatest} />
          </Card>
        )}

        {recent.length > 0 && (
          <Card title="Recent sessions">
            <div className="space-y-5">
              {recent.map((session) => {
                const scores: ScoreEntry[] = session.scores.map((s) => ({
                  category: s.category,
                  dimension: s.dimension,
                  score: s.score,
                  notes: null,
                }));
                return (
                  <div key={session.sessionId} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3 mb-3">
                      <span className="text-sm font-medium text-slate-900">{session.sessionTitle}</span>
                      <span className="text-xs text-slate-400">{formatDate(session.sessionDate)}</span>
                    </div>
                    <ScoreDisplay scores={scores} />
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {data.recommendations.length > 0 && (
          <Card title="Drills to work on">
            <ul className="space-y-3">
              {data.recommendations.map((rec) => (
                <li key={rec.drillId} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{rec.drillName}</span>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${CATEGORY_CHIP_CLASSES[rec.skillArea]}`}
                    >
                      {CATEGORY_LABELS[rec.skillArea]}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{rec.rationale}</p>
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">What to expect</p>
                    <p className="mt-0.5 text-sm text-slate-700 leading-relaxed">{rec.expectedOutcome}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <footer className="pt-2 pb-6 text-center">
          <p className="text-xs text-slate-400">Powered by Crick — your coach's progress logbook</p>
        </footer>
      </div>
    </div>
  );
}
