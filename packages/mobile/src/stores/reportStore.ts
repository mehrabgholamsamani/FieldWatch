import { create } from 'zustand';
import * as reportsService from '../services/reports';
import type { Report } from '../types';

interface ReportState {
  reports: Report[];
  total: number;
  nextCursor: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMoreError: boolean;
  error: string | null;
  currentReport: Report | null;
  fetchReports: () => Promise<void>;
  fetchMoreReports: () => Promise<void>;
  fetchReport: (id: string) => Promise<void>;
  createReport: (payload: reportsService.CreateReportPayload) => Promise<Report>;
  updateReport: (id: string, payload: reportsService.UpdateReportPayload) => Promise<void>;
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  total: 0,
  nextCursor: null,
  isLoading: false,
  isLoadingMore: false,
  loadMoreError: false,
  error: null,
  currentReport: null,

  fetchReports: async () => {
    set({ isLoading: true, error: null, loadMoreError: false });
    try {
      const result = await reportsService.fetchReports();
      set({
        reports: result.items,
        total: result.total,
        nextCursor: result.nextCursor,
        isLoading: false,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load reports', isLoading: false });
    }
  },

  fetchMoreReports: async () => {
    const { nextCursor, isLoadingMore } = get();
    if (!nextCursor || isLoadingMore) return;
    set({ isLoadingMore: true, loadMoreError: false });
    try {
      const result = await reportsService.fetchReports(nextCursor);
      set((state) => ({
        reports: [...state.reports, ...result.items],
        nextCursor: result.nextCursor,
        isLoadingMore: false,
      }));
    } catch {
      set({ isLoadingMore: false, loadMoreError: true });
    }
  },

  fetchReport: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const report = await reportsService.fetchReport(id);
      set({ currentReport: report, isLoading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load report', isLoading: false });
    }
  },

  createReport: async (payload) => {
    const report = await reportsService.createReport(payload);
    set((state) => ({
      reports: [report, ...state.reports],
      total: state.total + 1,
    }));
    return report;
  },

  updateReport: async (id, payload) => {
    const updated = await reportsService.updateReport(id, payload);
    set((state) => ({
      reports: state.reports.map((r) => (r.id === id ? updated : r)),
      currentReport: state.currentReport?.id === id ? updated : state.currentReport,
    }));
  },
}));
