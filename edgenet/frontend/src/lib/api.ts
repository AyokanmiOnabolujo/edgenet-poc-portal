export const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
export const TOKEN_KEY = 'edgenet_token';

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: opts.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Check that the API is running.');
  }
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((Array.isArray(e.message) ? e.message.join(', ') : e.message) ?? 'Something went wrong. Try again.');
  }
  return res.json();
}
