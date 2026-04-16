import { create } from 'zustand';
import * as authService from '../services/auth';
import { api } from '../services/api';
import { registerForPushNotifications } from '../services/notifications';
import { ROLES } from '../types';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  register: (data: { email: string; password: string; fullName: string; role?: typeof ROLES.REPORTER | typeof ROLES.MANAGER }) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async ({ email, password }) => {
    set({ isLoading: true, error: null });
    try {
      await authService.login(email, password);
      const { data } = await api.get<RawUser>('/users/me');
      const user = mapUser(data);
      set({ user, isAuthenticated: true, isLoading: false });
      registerForPushNotifications().catch(() => {});
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  register: async ({ email, password, fullName, role = ROLES.REPORTER }) => {
    set({ isLoading: true, error: null });
    try {
      await authService.register(email, password, fullName, role);
      set({ isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    await authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const { accessToken } = await authService.getStoredTokens();
      if (!accessToken) return;
      const { data } = await api.get<RawUser>('/users/me');
      set({ user: mapUser(data), isAuthenticated: true });
    } catch {
      await authService.logout();
    } finally {
      set({ isLoading: false });
    }
  },
}));

interface RawUser {
  id: string;
  email: string;
  full_name: string;
  role: User['role'];
  created_at: string;
}

function mapUser(raw: RawUser): User {
  return {
    id: raw.id,
    email: raw.email,
    fullName: raw.full_name,
    role: raw.role,
    createdAt: raw.created_at,
  };
}
