import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import DimensionTrendChart from '../components/analytics/DimensionTrendChart';
import PlayerRadarChart from '../components/analytics/PlayerRadarChart';
import CategoryAveragesChart from '../components/analytics/CategoryAveragesChart';
import ScoreHeatmap from '../components/analytics/ScoreHeatmap';
import StrengthWeaknessCards from '../components/analytics/StrengthWeaknessCards';
import ObservationHistory from '../components/analytics/ObservationHistory';
import { AGE_GROUP_CHIP_CLASSES, getPlayer } from '../api/players';
import {
  CATEGORY_LABELS,
  DIMENSIONS_BY_CATEGORY,
} from '../api/sessions';
import type { Category } from '../api/sessions';
import { getPlayerProgress } from '../api/playerProgress';
import {
  buildHeatmap,
  categoriesWithData,
  computeCategoryAverages,
  computeLatestRadarData,
  computeOverallAverage,
  computeStrengthsWeaknesses,
  computeTrendDirection,
  countSessionsThisMonth,
  meanOfSessionScores,
  pivotByCategoryAndDimension,
} from '../utils/scoreAnalytics';
import type { TrendDirection } from '../utils/scoreAnalytics';
import { formatDate } from '../utils/format';

function TrendLabel({ trend }: { trend: TrendDirection }) {
  if (trend === 'improving') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 16V4M4 10l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        improving
      </span>
    );
  }
  if (trend === 'declining') {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-medium text-red-700">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M10 4v12M4 10l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        declining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-slate-500">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
        <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      stable
    </span>
  );
}

function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      {title && (
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export default function PlayerProfilePage() {
  const params = useParams<{ id: string }>();
  const idNum = Number(params.id);
  const isValidId = Number.isFinite(idNum) && idNum > 0 && /^\d+$/.test(params.id ?? '');

  const playerQ = useQuery({
    queryKey: ['player', idNum],
    queryFn: () => getPlayer(idNum),
    enabled: isValidId,
  });
  const progressQ = useQuery({
    queryKey: ['playerProgress', idNum],
    queryFn: () => getPlayerProgress(idNum),
    enabled: isValidId,
  });

  const trends = useMemo(() => progressQ.data?.trends ?? [], [progressQ.data]);

  const pivots = useMemo(() => pivotByCategoryAndDimension(trends), [trends]);
  const presentCategories: Category[] = useMemo(() => categoriesWithData(pivots), [pivots]);
  const categoryAvgs = useMemo(() => computeCategoryAverages(trends), [trends]);
  const categoriesPresentInAverages = useMemo(
    () => presentCategories,
    [presentCategories],
  );
  const radarData = useMemo(() => computeLatestRadarData(trends), [trends]);
  const heatmap = useMemo(() => buildHeatmap(trends), [trends]);
  const sw = useMemo(() => computeStrengthsWeaknesses(trends, 3), [trends]);
  const overallAvg = useMemo(() => computeOverallAverage(trends), [trends]);
  const sessionsThisMonth = useMemo(() => countSessionsThisMonth(trends), [trends]);
  const headerTrend: TrendDirection = useMemo(() => {
    const perSession = trends.map(meanOfSessionScores).filter((v): v is number => v !== null);
    return computeTrendDirection(perSession);
  }, [trends]);
  const latestSessionDate = trends.length > 0 ? trends[trends.length - 1].sessionDate : null;

  if (!isValidId) return <Navigate to="/players" replace />;

  if (playerQ.isLoading || progressQ.isLoading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="h-4 bg-slate-200 rounded w-24 animate-pulse" />
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="h-7 bg-slate-200 rounded w-1/3 animate-pulse" />
          <div className="mt-3 h-4 bg-slate-100 rounded w-1/4 animate-pulse" />
        </div>
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-56 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (playerQ.isError || progressQ.isError) {
    const err = playerQ.error ?? progressQ.error;
    const is404 = axios.isAxiosError(err) && err.response?.status === 404;
    return (
      <div className="max-w-5xl mx-auto">
        <Link to="/players" className="text-sm text-slate-500 hover:text-slate-900">
          ← Players
        </Link>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-slate-900">
            {is404 ? 'Player not found' : 'Could not load this player'}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {is404 ? 'They may have been removed.' : 'Please try refreshing the page.'}
          </p>
        </div>
      </div>
    );
  }

  const player = playerQ.data;
  const progress = progressQ.data;
  if (!player || !progress) return null;

  const noSessions = trends.length === 0;
  const singleSession = trends.length === 1;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Link to="/players" className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900">
        ← Players
      </Link>

      <header className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h1 className="text-3xl font-semibold text-slate-900 truncate">{player.name}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${AGE_GROUP_CHIP_CLASSES[player.ageGroup]}`}
          >
            {player.ageGroup}
          </span>
        </div>
        {player.notes && (
          <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-2xl whitespace-pre-wrap">
            {player.notes}
          </p>
        )}

        <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total sessions" value={trends.length.toString()} />
          <Stat label="This month" value={sessionsThisMonth.toString()} />
          <Stat
            label="Avg score"
            value={trends.length === 0 ? '—' : overallAvg.toFixed(1)}
            extra={trends.length >= 2 ? <TrendLabel trend={headerTrend} /> : undefined}
          />
          <Stat label="Latest session" value={latestSessionDate ? formatDate(latestSessionDate) : '—'} />
        </div>
      </header>

      {noSessions ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h3 className="text-base font-medium text-slate-900">No sessions recorded yet</h3>
          <p className="mt-1 text-sm text-slate-500">Log a session and start observing this player.</p>
          <Link
            to="/sessions/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Start a session
          </Link>
        </div>
      ) : (
        <>
          {!singleSession && presentCategories.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {presentCategories.map((cat) => {
                const dimsScoredInCat = (DIMENSIONS_BY_CATEGORY[cat] as readonly string[]).filter(
                  (d) => pivots[cat].some((row) => typeof row[d] === 'number'),
                );
                if (dimsScoredInCat.length === 0) return null;
                return (
                  <Card key={cat} title={`${CATEGORY_LABELS[cat]} — trends`} subtitle="Score per dimension across sessions">
                    <DimensionTrendChart
                      category={cat}
                      data={pivots[cat]}
                      dimensions={dimsScoredInCat as readonly import('../api/sessions').Dimension[]}
                    />
                  </Card>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card title="Current form vs historical" subtitle="Solid = latest session · dashed = career average">
              <PlayerRadarChart points={radarData.points} missingInLatest={radarData.missingInLatest} />
            </Card>
            {!singleSession && (
              <Card title="Category averages over time" subtitle="Mean score within each category per session">
                <CategoryAveragesChart data={categoryAvgs} categoriesPresent={categoriesPresentInAverages} />
              </Card>
            )}
          </div>

          <Card title="Score matrix" subtitle="Darker cell = higher score. Empty cells mean the dimension wasn't observed.">
            <ScoreHeatmap sessions={heatmap.sessions} dimensions={heatmap.dimensions} cell={heatmap.cell} />
          </Card>

          <Card title="Strengths and focus areas" subtitle="Based on the last 3 sessions">
            <StrengthWeaknessCards strengths={sw.strengths} weaknesses={sw.weaknesses} />
          </Card>

          <Card title="Observation history" subtitle="Session-by-session log of scores and notes">
            <ObservationHistory playerId={idNum} />
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
        <p className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
        {extra}
      </div>
    </div>
  );
}
