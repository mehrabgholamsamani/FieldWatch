export const ROLES = {
  REPORTER: 'REPORTER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  status: ReportStatus;
  priority: Priority;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  managerNote: string | null;
  reporterId: string;
  reporterName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  images: ReportImage[];
  createdAt: string;
  updatedAt: string;
  idempotencyKey?: string;
}

export interface ReportImage {
  id: string;
  reportId: string;
  originalUrl: string | null;
  thumbnailUrl: string | null;
  uploadedAt: string;
}

export type ReportStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'RESOLVED'
  | 'REJECTED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface ReportStats {
  total: number;
  pendingReview: number;
  resolvedToday: number;
}

export interface ReportFilters {
  status?: ReportStatus;
  priority?: Priority;
  sortBy?: 'newest' | 'oldest' | 'priority';
  assignedTo?: string;
}

export interface AISuggestPriorityResponse {
  priority: Priority;
  confidence: number;
  reasoning: string;
}

export interface SimilarReportItem {
  id: string;
  title: string;
  status: ReportStatus;
  priority: Priority;
  created_at: string;
}
