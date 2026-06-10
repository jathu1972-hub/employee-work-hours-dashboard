import serverless from 'serverless-http';

process.env.USE_BLOB_DB = '1';
process.env.VERCEL = '1';

let handler;

function fixRequestPath(req) {
  const original =
    req.headers['x-vercel-original-url'] ||
    req.headers['x-forwarded-uri'] ||
    req.headers['x-invoke-path'] ||
    req.headers['x-vercel-forwarded-path'];
  if (!original) return;
  try {
    const path = original.startsWith('http')
      ? `${new URL(original).pathname}${new URL(original).search || ''}`
      : original.startsWith('/') ? original : `/${original}`;
    if (path.startsWith('/api')) req.url = path;
  } catch { /* ignore */ }
}

export default async function vercelHandler(req, res) {
  fixRequestPath(req);
  if (!handler) {
    const { createApiApp } = await import('../server/src/app-api.js');
    const app = await createApiApp();
    handler = serverless(app, {
      binary: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    });
  }
  return handler(req, res);
}