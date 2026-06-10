const API = window.location.origin;

export async function api(path, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function adminFetch(path, password, options = {}) {
  return fetch(`${API}/api${path}`, {
    headers: { 'x-admin-password': password, ...(options.headers || {}) },
    ...options,
  });
}