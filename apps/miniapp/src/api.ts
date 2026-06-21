import Taro from '@tarojs/taro';
const BASE_URL = 'http://localhost:3000/api';
export async function api<T>(path: string, options: { method?: 'GET' | 'POST' | 'PATCH'; data?: unknown; organizationId?: string } = {}): Promise<T> {
  const token = Taro.getStorageSync<string>('accessToken');
  const response = await Taro.request<T>({ url: `${BASE_URL}${path}`, method: options.method ?? 'GET', data: options.data, header: { Authorization: token ? `Bearer ${token}` : '', ...(options.organizationId ? { 'X-Organization-Id': options.organizationId } : {}) } });
  if (response.statusCode >= 400) throw new Error((response.data as { message?: string }).message ?? '请求失败');
  return response.data;
}

