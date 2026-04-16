import { api } from './api';
import type { AISuggestPriorityResponse, SimilarReportItem } from '../types';

export async function suggestPriority(
  title: string,
  description: string
): Promise<AISuggestPriorityResponse> {
  const { data } = await api.post<AISuggestPriorityResponse>('/ai/suggest-priority', {
    title,
    description,
  });
  return data;
}

export async function enhanceDescription(
  title: string,
  description: string
): Promise<string> {
  const { data } = await api.post<{ enhanced_description: string }>('/ai/enhance-description', {
    title,
    description,
  });
  return data.enhanced_description;
}

export async function getSimilarReports(reportId: string): Promise<SimilarReportItem[]> {
  const { data } = await api.get<{ items: SimilarReportItem[] }>(`/reports/${reportId}/similar`);
  return data.items;
}

export async function suggestNote(reportId: string): Promise<string> {
  const { data } = await api.post<{ suggestion: string }>(`/reports/${reportId}/suggest-note`);
  return data.suggestion;
}
