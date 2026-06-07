import { api } from './client';
import type { AgeGroup } from './players';
import type { Category, Dimension } from './sessions';

export type Trend = 'IMPROVING' | 'DECLINING' | 'STABLE';

export interface DashboardStats {
  totalPlayers: number;
  totalSessions: number;
  sessionsThisMonth: number;
  daysSinceLastSession: number | null;
}

export interface RecentSession {
  id: number;
  date: string;
  title: string;
  playerCount: number;
}

export interface AttentionPlayer {
  playerId: number;
  playerName: string;
  ageGroup: AgeGroup;
  issue: string;
  category: Category;
  dimension: Dimension;
  avgScore: number;
  trend: Trend;
}

export interface Dashboard {
  coachName: string;
  stats: DashboardStats;
  recentSessions: RecentSession[];
  playersNeedingAttention: AttentionPlayer[];
}

export async function getDashboard(): Promise<Dashboard> {
  const res = await api.get<Dashboard>('/dashboard');
  return res.data;
}
