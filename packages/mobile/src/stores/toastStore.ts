import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  subtitle?: string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  show: (toast: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (toast) => {
    const id = Math.random().toString(36).slice(2, 10);
    set((state) => ({
      // Newest at top, max 3 visible
      toasts: [
        { ...toast, id, duration: toast.duration ?? 3500 },
        ...state.toasts,
      ].slice(0, 3),
    }));
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helper — call outside of React components
export function showToast(toast: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) {
  useToastStore.getState().show(toast);
}
