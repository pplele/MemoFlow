export function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function sanitizeError(errorText: string): string {
  if (!errorText) return '未知错误';
  try {
    const parsed = JSON.parse(errorText);
    if (parsed.error) {
      if (typeof parsed.error === 'string') {
        return parsed.error;
      }
      if (parsed.error.message) {
        return parsed.error.message;
      }
    }
  } catch {}
  return errorText.length > 200 ? errorText.substring(0, 200) + '...' : errorText;
}
