import { api } from './client';
import type { Category, Dimension } from './sessions';
import type { AgeGroup } from './players';

export type Difficulty = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

export const DIFFICULTIES: Difficulty[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
};

export const DIFFICULTY_CHIP_CLASSES: Record<Difficulty, string> = {
  BEGINNER: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  INTERMEDIATE: 'bg-amber-50 text-amber-800 ring-amber-200',
  ADVANCED: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export interface DrillSummary {
  id: number;
  name: string;
  skillArea: Category;
  targetIssue: Dimension;
  difficulty: Difficulty;
  durationMinutes: number | null;
}

export interface DrillDetail {
  id: number;
  name: string;
  description: string;
  skillArea: Category;
  targetIssue: Dimension;
  difficulty: Difficulty;
  equipment: string[];
  ageMin: number | null;
  ageMax: number | null;
  durationMinutes: number | null;
  videoUrl: string | null;
  variations: string | null;
}

export interface DrillsResponse {
  content: DrillSummary[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface DrillsQuery {
  skillArea?: Category;
  difficulty?: Difficulty;
  ageGroup?: AgeGroup;
  search?: string;
  page?: number;
  size?: number;
}

export async function getDrills(params: DrillsQuery = {}): Promise<DrillsResponse> {
  const res = await api.get<DrillsResponse>('/drills', { params });
  return res.data;
}

export async function getDrill(id: number): Promise<DrillDetail> {
  const res = await api.get<DrillDetail>(`/drills/${id}`);
  return res.data;
}
