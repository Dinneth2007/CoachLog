import { api } from './client';

export type AgeGroup = 'U11' | 'U13' | 'U15' | 'U17' | 'OPEN';

export const AGE_GROUPS: AgeGroup[] = ['U11', 'U13', 'U15', 'U17', 'OPEN'];

export const AGE_GROUP_CHIP_CLASSES: Record<AgeGroup, string> = {
  U11: 'bg-sky-50 text-sky-700 ring-sky-200',
  U13: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  U15: 'bg-amber-50 text-amber-800 ring-amber-200',
  U17: 'bg-rose-50 text-rose-700 ring-rose-200',
  OPEN: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export interface Player {
  id: number;
  name: string;
  ageGroup: AgeGroup;
  notes: string | null;
  createdAt: string;
}

export interface CreatePlayerData {
  name: string;
  ageGroup: AgeGroup;
  notes?: string;
}

export interface PlayersResponse {
  content: Player[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
}

export interface PlayersQuery {
  search?: string;
  ageGroup?: AgeGroup;
  page?: number;
  size?: number;
}

export async function getPlayers(params: PlayersQuery = {}): Promise<PlayersResponse> {
  const res = await api.get<PlayersResponse>('/players', { params });
  return res.data;
}

export async function getPlayer(id: number): Promise<Player> {
  const res = await api.get<Player>(`/players/${id}`);
  return res.data;
}

export async function createPlayer(data: CreatePlayerData): Promise<Player> {
  const res = await api.post<Player>('/players', data);
  return res.data;
}

export async function updatePlayer(id: number, data: CreatePlayerData): Promise<Player> {
  const res = await api.put<Player>(`/players/${id}`, data);
  return res.data;
}

export async function deletePlayer(id: number): Promise<void> {
  await api.delete(`/players/${id}`);
}
