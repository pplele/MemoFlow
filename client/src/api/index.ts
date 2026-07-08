const BASE_URL = '/api';

let apiToken: string | null = null;

export function setApiToken(token: string): void {
  apiToken = token;
}

export function getApiToken(): string | null {
  return apiToken;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = { ...((options.headers as Record<string, string>) || {}) };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  
  if (apiToken) {
    headers['Authorization'] = `Bearer ${apiToken}`;
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
