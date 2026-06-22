const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
export async function api<T>(path: string, options: { method?: string; body?: unknown; organizationId?: string } = {}): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { method: options.method ?? 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`, ...(options.organizationId ? { 'X-Organization-Id': options.organizationId } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? data.code ?? '请求失败');
  return data as T;
}
