import { api } from './client';
import type { Category, Dimension } from './sessions';
import type { AgeGroup } from './players';

export interface TrendScore {
  category: Category;
  dimension: Dimension;
  score: number;
}

export interface SessionTrend {
  sessionId: number;
  sessionDate: string;
  sessionTitle: string;
  scores: TrendScore[];
}

export interface PlayerProgress {
  playerId: number;
  playerName: string;
  ageGroup: AgeGroup;
  trends: SessionTrend[];
}

export interface HistoryScore {
  category: Category;
  dimension: Dimension;
  score: number;
  notes: string | null;
}

export interface ObservationHistoryItem {
  observationId: number;
  sessionId: number;
  sessionDate: string;
  sessionTitle: string;
  overallNotes: string | null;
  scores: HistoryScore[];
}

export interface ObservationsResponse {
  content: ObservationHistoryItem[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export async function getPlayerProgress(playerId: number): Promise<PlayerProgress> {
  const res = await api.get<PlayerProgress>(`/players/${playerId}/progress`);
  return res.data;
}

export async function getPlayerObservations(
  playerId: number,
  page: number,
  size: number = 10,
): Promise<ObservationsResponse> {
  const res = await api.get<ObservationsResponse>(`/players/${playerId}/observations`, {
    params: { page, size },
  });
  return res.data;
}
