import axios from 'axios';
import { router } from 'expo-router';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';
import { getToken, setToken, deleteToken } from './tokenStorage';
import { triggerForceLogout } from '../utils/authEvents';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await getToken(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        await setToken(STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        await setToken(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return api(originalRequest);
      } catch {
        await deleteToken(STORAGE_KEYS.ACCESS_TOKEN);
        await deleteToken(STORAGE_KEYS.REFRESH_TOKEN);
        triggerForceLogout();
        router.replace('/(auth)/login');
      }
    }
    return Promise.reject(error);
  }
);
