const API = window.location.origin;

export async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API}/api${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (err) {
    const msg = err?.message || 'Network error';
    throw new Error(msg === 'Failed to fetch' ? 'Cannot reach server' : msg);
  }
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