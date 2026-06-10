import { put, list } from '@vercel/blob';

const token = () => process.env.BLOB_READ_WRITE_TOKEN;

export async function loadJson(pathname, fallback) {
  try {
    if (!token()) return structuredClone(fallback);
    const { blobs } = await list({ prefix: pathname, limit: 1, token: token() });
    if (!blobs.length) return structuredClone(fallback);
    const res = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${token()}` } });
    if (!res.ok) return structuredClone(fallback);
    return await res.json();
  } catch (e) {
    console.warn(`loadJson ${pathname}:`, e.message);
    return structuredClone(fallback);
  }
}

export async function saveJson(pathname, data) {
  if (!token()) throw new Error('BLOB_READ_WRITE_TOKEN is required on Vercel. Create a Blob store in Vercel Dashboard → Storage.');
  await put(pathname, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    token: token(),
  });
}