import { api } from './api';
import type { ReportImage } from '../types';

interface RawReportImage {
  id: string;
  report_id: string;
  original_url: string;
  thumbnail_url: string | null;
  uploaded_at: string;
}

function mapImage(raw: RawReportImage): ReportImage {
  return {
    id: raw.id,
    reportId: raw.report_id,
    originalUrl: raw.original_url,
    thumbnailUrl: raw.thumbnail_url,
    uploadedAt: raw.uploaded_at,
  };
}

export async function uploadImage(
  reportId: string,
  uri: string,
  name: string,
  type: string
): Promise<ReportImage> {
  const formData = new FormData();
  formData.append('file', { uri, name, type } as unknown as Blob);

  const { data } = await api.post<RawReportImage>(`/reports/${reportId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return mapImage(data);
}
