const BASE_URL = '/api';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  // FormData 上传时不设置 Content-Type，让浏览器自动添加 multipart boundary
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  request,
};
