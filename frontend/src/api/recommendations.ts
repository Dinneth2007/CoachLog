import { api } from './client';
import type { Category } from './sessions';

export interface DrillRecommendation {
  drillId: number;
  drillName: string;
  skillArea: Category;
  rationale: string;
  expectedOutcome: string;
  similarityScore: number | null;
}

export interface RecommendationsResponse {
  playerId: number;
  generatedAt: string | null;
  recommendations: DrillRecommendation[];
}

export async function getRecommendations(playerId: number): Promise<RecommendationsResponse> {
  const res = await api.get<RecommendationsResponse>(`/players/${playerId}/recommendations`);
  return res.data;
}

export async function generateRecommendations(
  playerId: number,
  force = false,
): Promise<RecommendationsResponse> {
  const res = await api.post<RecommendationsResponse>(
    `/players/${playerId}/recommendations/generate`,
    null,
    { params: { force } },
  );
  return res.data;
}
