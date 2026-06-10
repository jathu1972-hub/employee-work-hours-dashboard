const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed');
  return data as T;
}