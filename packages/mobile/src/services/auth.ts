import { api } from './api';
import { getToken, setToken, deleteToken } from './tokenStorage';
import { STORAGE_KEYS } from '../utils/constants';
import { ROLES } from '../types';
import type { TokenResponse, User } from '../types';

export async function login(email: string, password: string): Promise<TokenResponse> {
  const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
  await setToken(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
  await setToken(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
  return data;
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  role: typeof ROLES.REPORTER | typeof ROLES.MANAGER = ROLES.REPORTER,
): Promise<User> {
  const { data } = await api.post<User>('/auth/register', {
    email,
    password,
    full_name: fullName,
    role,
  });
  return data;
}

export async function logout(): Promise<void> {
  await deleteToken(STORAGE_KEYS.ACCESS_TOKEN);
  await deleteToken(STORAGE_KEYS.REFRESH_TOKEN);
}

export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    getToken(STORAGE_KEYS.ACCESS_TOKEN),
    getToken(STORAGE_KEYS.REFRESH_TOKEN),
  ]);
  return { accessToken, refreshToken };
}
