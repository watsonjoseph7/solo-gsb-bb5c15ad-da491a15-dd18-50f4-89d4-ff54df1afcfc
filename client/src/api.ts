import type { DocMeta, DocPayload, MappingRow, PreviewResult } from './types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error('request failed') as Error & {
      status: number;
      payload: unknown;
    };
    err.status = res.status;
    err.payload = body;
    throw err;
  }
  return body as T;
}

export const api = {
  listDocuments: () => request<{ documents: DocMeta[] }>('/api/documents'),
  createDocument: (title: string, content: string) =>
    request<DocPayload>('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title, content }),
    }),
  getDocument: (id: number) => request<DocPayload>(`/api/documents/${id}`),
  deleteDocument: (id: number) =>
    request<{ ok: boolean }>(`/api/documents/${id}`, { method: 'DELETE' }),
  preview: (id: number, mapping: MappingRow[]) =>
    request<PreviewResult>(`/api/documents/${id}/preview`, {
      method: 'POST',
      body: JSON.stringify({ mapping }),
    }),
  apply: (id: number, mapping: MappingRow[]) =>
    request<DocPayload & { applied: number }>(`/api/documents/${id}/apply`, {
      method: 'POST',
      body: JSON.stringify({ mapping }),
    }),
  undo: (id: number) =>
    request<DocPayload & { undone: number }>(`/api/documents/${id}/undo`, {
      method: 'POST',
    }),
  exportUrl: (id: number) => `/api/documents/${id}/export`,
};

export function errorMessages(e: unknown): string[] {
  const payload = (e as { payload?: { errors?: string[] } })?.payload;
  if (payload && Array.isArray(payload.errors)) return payload.errors;
  return ['请求失败，请检查服务是否可用'];
}

export function errorConflicts(e: unknown) {
  const payload = (e as { payload?: { conflicts?: PreviewResult['conflicts'] } })?.payload;
  return payload?.conflicts ?? [];
}
