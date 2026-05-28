import { api } from './client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function loginRequest(email: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function registerRequest(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', { email, password, name });
  return res.data;
}
