import axios from 'axios';
import { api } from './client';
import type { AgeGroup } from './players';
import type { SessionTrend } from './playerProgress';
import type { DrillRecommendation } from './recommendations';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api';

export interface ParentLink {
  id: number;
  expiresAt: string;
  createdAt: string;
}

export interface ParentLinkCreated {
  token: string;
  url: string;
  expiresAt: string;
  playerName: string;
}

export interface ParentView {
  playerName: string;
  ageGroup: AgeGroup;
  coachName: string;
  weeklySummary?: string | null;
  trends: SessionTrend[];
  recentObservations: SessionTrend[];
  recommendations: DrillRecommendation[];
}

export async function generateParentLink(playerId: number): Promise<ParentLinkCreated> {
  const res = await api.post<ParentLinkCreated>(`/players/${playerId}/parent-link`);
  return res.data;
}

export async function getParentLinks(playerId: number): Promise<ParentLink[]> {
  const res = await api.get<ParentLink[]>(`/players/${playerId}/parent-links`);
  return res.data;
}

export async function revokeParentLink(linkId: number): Promise<void> {
  await api.delete(`/parent-links/${linkId}`);
}

export async function getParentView(token: string): Promise<ParentView> {
  const res = await axios.get<ParentView>(`${baseURL}/parent/view/${token}`);
  return res.data;
}
