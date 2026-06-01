import {
  ALL_DIMENSIONS,
  CATEGORIES,
  DIMENSION_LABELS,
  DIMENSION_TO_CATEGORY,
  DIMENSIONS_BY_CATEGORY,
} from '../api/sessions';
import type { Category, Dimension } from '../api/sessions';
import type { SessionTrend, TrendScore } from '../api/playerProgress';
import { formatDate } from './format';

export type TrendDirection = 'improving' | 'declining' | 'stable';

const TREND_THRESHOLD = 0.25;

export function computeTrendDirection(values: number[]): TrendDirection {
  const window = Math.min(3, Math.floor(values.length / 2));
  if (window < 1 || values.length < 2) return 'stable';
  const last = values.slice(-window);
  const prev = values.slice(-2 * window, -window);
  if (prev.length === 0) return 'stable';
  const lastMean = mean(last);
  const prevMean = mean(prev);
  const delta = lastMean - prevMean;
  if (delta >= TREND_THRESHOLD) return 'improving';
  if (delta <= -TREND_THRESHOLD) return 'declining';
  return 'stable';
}

export function computeOverallAverage(trends: SessionTrend[]): number {
  let sum = 0;
  let count = 0;
  for (const t of trends) {
    for (const s of t.scores) {
      sum += s.score;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function countSessionsThisMonth(trends: SessionTrend[], now: Date = new Date()): number {
  const month = now.getMonth();
  const year = now.getFullYear();
  return trends.filter((t) => {
    const d = new Date(t.sessionDate);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;
}

export interface CategorySessionRow {
  sessionId: number;
  date: string;
  dateLabel: string;
  sessionTitle: string;
  [dim: string]: number | string;
}

export type DimensionPivot = Record<Category, CategorySessionRow[]>;

export function pivotByCategoryAndDimension(trends: SessionTrend[]): DimensionPivot {
  const out = {} as DimensionPivot;
  for (const cat of CATEGORIES) {
    out[cat] = trends.map((t) => {
      const row: CategorySessionRow = {
        sessionId: t.sessionId,
        date: t.sessionDate,
        dateLabel: formatDate(t.sessionDate),
        sessionTitle: t.sessionTitle,
      };
      for (const s of t.scores) {
        if (s.category === cat) {
          row[s.dimension] = s.score;
        }
      }
      return row;
    });
  }
  return out;
}

export function categoriesWithData(pivot: DimensionPivot): Category[] {
  return CATEGORIES.filter((cat) => {
    const rows = pivot[cat];
    return rows.some((r) =>
      (DIMENSIONS_BY_CATEGORY[cat] as readonly Dimension[]).some((d) => typeof r[d] === 'number'),
    );
  });
}

export interface CategoryAverageRow {
  sessionId: number;
  date: string;
  dateLabel: string;
  sessionTitle: string;
  BATTING?: number;
  BOWLING?: number;
  FIELDING?: number;
  MATCH_AWARENESS?: number;
}

export function computeCategoryAverages(trends: SessionTrend[]): CategoryAverageRow[] {
  return trends.map((t) => {
    const row: CategoryAverageRow = {
      sessionId: t.sessionId,
      date: t.sessionDate,
      dateLabel: formatDate(t.sessionDate),
      sessionTitle: t.sessionTitle,
    };
    for (const cat of CATEGORIES) {
      const scoresInCat = t.scores.filter((s) => s.category === cat).map((s) => s.score);
      if (scoresInCat.length > 0) {
        row[cat] = mean(scoresInCat);
      }
    }
    return row;
  });
}

export interface RadarPoint {
  dimension: Dimension;
  label: string;
  current: number;
  average: number;
}

export interface RadarData {
  points: RadarPoint[];
  missingInLatest: Dimension[];
}

export function computeLatestRadarData(trends: SessionTrend[]): RadarData {
  if (trends.length === 0) return { points: [], missingInLatest: [] };

  const allScoresPerDim = new Map<Dimension, number[]>();
  for (const t of trends) {
    for (const s of t.scores) {
      const arr = allScoresPerDim.get(s.dimension) ?? [];
      arr.push(s.score);
      allScoresPerDim.set(s.dimension, arr);
    }
  }

  const scoredDimensions = ALL_DIMENSIONS.filter((d) => allScoresPerDim.has(d));
  const latest = trends[trends.length - 1];
  const latestMap = new Map<Dimension, number>();
  for (const s of latest.scores) {
    latestMap.set(s.dimension, s.score);
  }

  const points: RadarPoint[] = scoredDimensions.map((d) => ({
    dimension: d,
    label: DIMENSION_LABELS[d],
    current: latestMap.get(d) ?? 0,
    average: mean(allScoresPerDim.get(d) ?? [0]),
  }));

  const missingInLatest = scoredDimensions.filter((d) => !latestMap.has(d));
  return { points, missingInLatest };
}

export interface HeatmapData {
  sessions: { id: number; date: string; label: string; title: string }[];
  dimensions: Dimension[];
  cell: (dim: Dimension, sessionId: number) => number | undefined;
}

export function buildHeatmap(trends: SessionTrend[]): HeatmapData {
  const map = new Map<Dimension, Map<number, number>>();
  for (const t of trends) {
    for (const s of t.scores) {
      const inner = map.get(s.dimension) ?? new Map<number, number>();
      inner.set(t.sessionId, s.score);
      map.set(s.dimension, inner);
    }
  }
  const dimensions = ALL_DIMENSIONS.filter((d) => map.has(d));
  const sessions = trends.map((t) => ({
    id: t.sessionId,
    date: t.sessionDate,
    label: formatDate(t.sessionDate),
    title: t.sessionTitle,
  }));
  return {
    sessions,
    dimensions,
    cell: (dim, sessionId) => map.get(dim)?.get(sessionId),
  };
}

export interface DimensionSummary {
  dimension: Dimension;
  label: string;
  category: Category;
  avgScore: number;
  trend: TrendDirection;
}

export interface StrengthsWeaknesses {
  strengths: DimensionSummary[];
  weaknesses: DimensionSummary[];
}

export function computeStrengthsWeaknesses(
  trends: SessionTrend[],
  lastN: number = 3,
): StrengthsWeaknesses {
  if (trends.length === 0) return { strengths: [], weaknesses: [] };

  const recent = trends.slice(-lastN);
  const recentScoresByDim = new Map<Dimension, number[]>();
  for (const t of recent) {
    for (const s of t.scores) {
      const arr = recentScoresByDim.get(s.dimension) ?? [];
      arr.push(s.score);
      recentScoresByDim.set(s.dimension, arr);
    }
  }

  const fullSeriesByDim = new Map<Dimension, number[]>();
  for (const t of trends) {
    for (const s of t.scores) {
      const arr = fullSeriesByDim.get(s.dimension) ?? [];
      arr.push(s.score);
      fullSeriesByDim.set(s.dimension, arr);
    }
  }

  const items: DimensionSummary[] = [];
  for (const [dim, scores] of recentScoresByDim.entries()) {
    items.push({
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      category: DIMENSION_TO_CATEGORY[dim],
      avgScore: mean(scores),
      trend: computeTrendDirection(fullSeriesByDim.get(dim) ?? []),
    });
  }

  const sortedDesc = [...items].sort((a, b) => b.avgScore - a.avgScore);
  const sortedAsc = [...items].sort((a, b) => a.avgScore - b.avgScore);

  return {
    strengths: sortedDesc.slice(0, 3),
    weaknesses: sortedAsc.slice(0, 3),
  };
}

export function meanOfSessionScores(t: SessionTrend): number | null {
  if (t.scores.length === 0) return null;
  return t.scores.reduce((sum: number, s: TrendScore) => sum + s.score, 0) / t.scores.length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
