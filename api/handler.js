import serverless from 'serverless-http';

process.env.USE_BLOB_DB = '1';
process.env.VERCEL = '1';

let handler;

export default async function vercelHandler(req, res) {
  if (!handler) {
    const { createApiApp } = await import('../server/src/app-api.js');
    const app = await createApiApp();
    handler = serverless(app, {
      binary: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    });
  }
  return handler(req, res);
}