import { api } from './api';
import type { PaginatedResponse, Priority, Report, ReportFilters, ReportStats, ReportStatus } from '../types';

export interface CreateReportPayload {
  title: string;
  description: string;
  priority: Report['priority'];
  latitude?: number;
  longitude?: number;
  idempotency_key?: string;
}

export interface UpdateReportPayload {
  title?: string;
  description?: string;
  status?: Report['status'];
  priority?: Report['priority'];
  assignedToId?: string;
  managerNote?: string;
}

export async function fetchReports(
  cursor?: string,
  pageSize = 20,
  filters?: ReportFilters,
): Promise<PaginatedResponse<Report>> {
  const params: Record<string, string | number> = { page_size: pageSize };
  if (cursor) params.cursor = cursor;
  if (filters?.status) params.status = filters.status;
  if (filters?.priority) params.priority = filters.priority;
  if (filters?.sortBy) params.sort_by = filters.sortBy;
  if (filters?.assignedTo) params.assigned_to = filters.assignedTo;

  const { data } = await api.get<{
    items: RawReport[];
    next_cursor: string | null;
    total: number;
  }>('/reports', { params });
  return {
    items: data.items.map(mapReport),
    nextCursor: data.next_cursor,
    total: data.total,
  };
}

export async function fetchReport(id: string): Promise<Report> {
  const { data } = await api.get<RawReport>(`/reports/${id}`);
  return mapReport(data);
}

export async function createReport(payload: CreateReportPayload): Promise<Report> {
  const { data } = await api.post<RawReport>('/reports', {
    title: payload.title,
    description: payload.description,
    priority: payload.priority,
    latitude: payload.latitude,
    longitude: payload.longitude,
    idempotency_key: payload.idempotency_key,
  });
  return mapReport(data);
}

export async function updateReport(id: string, payload: UpdateReportPayload): Promise<Report> {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.priority !== undefined) body.priority = payload.priority;
  if (payload.assignedToId !== undefined) body.assigned_to_id = payload.assignedToId;
  if (payload.managerNote !== undefined) body.manager_note = payload.managerNote;
  const { data } = await api.patch<RawReport>(`/reports/${id}`, body);
  return mapReport(data);
}

export async function fetchStats(): Promise<ReportStats> {
  const { data } = await api.get<{
    total: number;
    pending_review: number;
    resolved_today: number;
  }>('/reports/stats');
  return {
    total: data.total,
    pendingReview: data.pending_review,
    resolvedToday: data.resolved_today,
  };
}

export async function fetchManagers(): Promise<{ id: string; fullName: string; email: string }[]> {
  const { data } = await api.get<Array<{ id: string; full_name: string; email: string }>>(
    '/users/managers',
  );
  return data.map((u) => ({ id: u.id, fullName: u.full_name, email: u.email }));
}

export async function fetchAllUsers(): Promise<{ id: string; fullName: string; email: string; role: string }[]> {
  const { data } = await api.get<Array<{ id: string; full_name: string; email: string; role: string }>>(
    '/users',
  );
  return data.map((u) => ({ id: u.id, fullName: u.full_name, email: u.email, role: u.role }));
}

// Map snake_case API response to camelCase TypeScript types
interface RawReport {
  id: string;
  title: string;
  description: string;
  status: ReportStatus;
  priority: Priority;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  manager_note: string | null;
  reporter_id: string;
  reporter_name: string | null;
  assigned_to_id: string | null;
  assignee_name: string | null;
  images: Array<{
    id: string;
    report_id: string;
    original_url: string;
    thumbnail_url: string | null;
    uploaded_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

function mapReport(raw: RawReport): Report {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    priority: raw.priority,
    latitude: raw.latitude,
    longitude: raw.longitude,
    address: raw.address,
    managerNote: raw.manager_note,
    reporterId: raw.reporter_id,
    reporterName: raw.reporter_name ?? null,
    assignedTo: raw.assigned_to_id,
    assigneeName: raw.assignee_name ?? null,
    images: raw.images.map((img) => ({
      id: img.id,
      reportId: img.report_id,
      originalUrl: img.original_url,
      thumbnailUrl: img.thumbnail_url,
      uploadedAt: img.uploaded_at,
    })),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
