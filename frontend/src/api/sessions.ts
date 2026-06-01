import { api } from './client';
import type { AgeGroup } from './players';

export type Category = 'BATTING' | 'BOWLING' | 'FIELDING' | 'MATCH_AWARENESS';

export const CATEGORIES = ['BATTING', 'BOWLING', 'FIELDING', 'MATCH_AWARENESS'] as const satisfies readonly Category[];

export const DIMENSIONS_BY_CATEGORY = {
  BATTING: ['stance', 'footwork', 'bat_path', 'timing', 'shot_selection'],
  BOWLING: ['action', 'line', 'length', 'variations', 'control'],
  FIELDING: ['catching', 'throwing', 'positioning', 'agility'],
  MATCH_AWARENESS: ['decision_making', 'communication', 'pressure_response'],
} as const;

export type Dimension = (typeof DIMENSIONS_BY_CATEGORY)[Category][number];

export const ALL_DIMENSIONS: readonly Dimension[] = CATEGORIES.flatMap(
  (c) => DIMENSIONS_BY_CATEGORY[c] as readonly Dimension[],
);

export const DIMENSION_TO_CATEGORY: Record<Dimension, Category> = (() => {
  const out = {} as Record<Dimension, Category>;
  for (const cat of CATEGORIES) {
    for (const dim of DIMENSIONS_BY_CATEGORY[cat]) {
      out[dim as Dimension] = cat;
    }
  }
  return out;
})();

export const CATEGORY_LABELS: Record<Category, string> = {
  BATTING: 'Batting',
  BOWLING: 'Bowling',
  FIELDING: 'Fielding',
  MATCH_AWARENESS: 'Match Awareness',
};

function toLabel(dim: string): string {
  const spaced = dim.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const DIMENSION_LABELS: Record<Dimension, string> = (() => {
  const out = {} as Record<Dimension, string>;
  for (const dim of ALL_DIMENSIONS) {
    out[dim] = toLabel(dim);
  }
  return out;
})();

export interface SessionSummary {
  id: number;
  date: string;
  title: string;
  playerCount: number;
  createdAt: string;
}

export interface Session {
  id: number;
  date: string;
  title: string;
  notes: string | null;
  createdAt: string;
}

export interface ScoreEntry {
  category: Category;
  dimension: Dimension;
  score: number;
  notes: string | null;
}

export interface ObservationView {
  playerId: number;
  playerName: string;
  overallNotes: string | null;
  scores: ScoreEntry[];
}

export interface SessionDetail extends Session {
  players: ObservationView[];
}

export interface Observation {
  playerId: number;
  overallNotes?: string | null;
  scores: ScoreEntry[];
}

export interface SessionsResponse {
  content: SessionSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface CreateSessionData {
  date: string;
  title: string;
  notes?: string;
}

export interface SessionsQuery {
  page?: number;
  size?: number;
}

export interface AttendanceResponse {
  players: { id: number; name: string; ageGroup: AgeGroup }[];
}

export async function getSessions(params: SessionsQuery = {}): Promise<SessionsResponse> {
  const res = await api.get<SessionsResponse>('/sessions', { params });
  return res.data;
}

export async function getSession(id: number): Promise<SessionDetail> {
  const res = await api.get<SessionDetail>(`/sessions/${id}`);
  return res.data;
}

export async function createSession(data: CreateSessionData): Promise<Session> {
  const res = await api.post<Session>('/sessions', data);
  return res.data;
}

export async function setAttendance(sessionId: number, playerIds: number[]): Promise<AttendanceResponse> {
  const res = await api.put<AttendanceResponse>(`/sessions/${sessionId}/attendance`, { playerIds });
  return res.data;
}

export async function submitObservations(
  sessionId: number,
  observations: Observation[],
): Promise<{ observationsSaved: number }> {
  const res = await api.post<{ observationsSaved: number }>(
    `/sessions/${sessionId}/observations`,
    { observations },
  );
  return res.data;
}

export async function deleteSession(id: number): Promise<void> {
  await api.delete(`/sessions/${id}`);
}
