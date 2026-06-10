import serverless from 'serverless-http';

process.env.USE_BLOB_DB = '1';
process.env.VERCEL = '1';

let expressHandler;

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

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

const dbIndexPromise = import('../server/src/db-index.js');
const employeesPromise = import('../server/src/employees.js');
const tasksPromise = import('../server/src/tasks-index.js');
const taskUtilsPromise = import('../server/src/task-utils.js');

async function handleFastPath(req, res) {
  const path = (req.url || '').split('?')[0];

  if (path === '/api/health') {
    const { getTodayDate } = await import('../server/src/db-utils.js');
    sendJson(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '6.0',
      tasks: true,
      dailyReset: true,
      today: getTodayDate(),
      platform: 'vercel',
      storage: 'vercel-blob',
      excel: true,
    });
    return true;
  }

  const {
    getAllEmployeesStatus,
    findToday,
    checkIn,
    checkOut,
  } = await dbIndexPromise;

  if (path === '/api/attendance/employees' && req.method === 'GET') {
    const { EMPLOYEES } = await employeesPromise;
    sendJson(res, 200, { employees: await getAllEmployeesStatus(), roster: EMPLOYEES });
    return true;
  }

  const statusMatch = path.match(/^\/api\/attendance\/status\/(.+)$/);
  if (statusMatch && req.method === 'GET') {
    sendJson(res, 200, { record: await findToday(decodeURIComponent(statusMatch[1])) });
    return true;
  }

  if (path === '/api/attendance/check-in' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.employeeName) {
      sendJson(res, 400, { error: 'Employee required' });
      return true;
    }
    const record = await checkIn(body.employeeName);
    sendJson(res, 200, {
      success: true,
      message: 'Successfully checked in — Excel files updated automatically',
      record,
    });
    return true;
  }

  if (path === '/api/attendance/check-out' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body.employeeName) {
      sendJson(res, 400, { error: 'Employee required' });
      return true;
    }
    const record = await checkOut(body.employeeName);
    sendJson(res, 200, {
      success: true,
      message: 'Successfully checked out — Excel files updated automatically',
      record,
    });
    return true;
  }

  const taskEmpMatch = path.match(/^\/api\/tasks\/employee\/(.+)$/);
  if (taskEmpMatch && req.method === 'GET') {
    const tasksApi = await tasksPromise;
    const { categorizeEmployeeTasks } = await taskUtilsPromise;
    const name = decodeURIComponent(taskEmpMatch[1]);
    const tasks = await tasksApi.listTasks({ employee: name });
    const notifications = await tasksApi.getNotifications(name);
    sendJson(res, 200, { tasks, notifications, ...categorizeEmployeeTasks(tasks) });
    return true;
  }

  const taskCompleteMatch = path.match(/^\/api\/tasks\/([^/]+)\/complete$/);
  if (taskCompleteMatch && req.method === 'POST') {
    const tasksApi = await tasksPromise;
    const body = await readBody(req);
    const task = await tasksApi.completeTask(taskCompleteMatch[1], body.employeeName, body.completionNotes || '');
    sendJson(res, 200, { success: true, task });
    return true;
  }

  const taskStatusMatch = path.match(/^\/api\/tasks\/([^/]+)\/status$/);
  if (taskStatusMatch && req.method === 'PATCH') {
    const tasksApi = await tasksPromise;
    const body = await readBody(req);
    const task = await tasksApi.updateTaskStatus(
      taskStatusMatch[1],
      body.status,
      body.employeeName,
      body.completionNotes,
    );
    sendJson(res, 200, { success: true, task });
    return true;
  }

  return false;
}

async function getExpressHandler() {
  if (!expressHandler) {
    const { createApiApp } = await import('../server/src/app-api.js');
    const app = await createApiApp();
    expressHandler = serverless(app, {
      binary: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    });
  }
  return expressHandler;
}

export default async function vercelHandler(req, res) {
  fixRequestPath(req);
  try {
    if (await handleFastPath(req, res)) return;
  } catch (e) {
    sendJson(res, 500, { error: e.message });
    return;
  }
  const handler = await getExpressHandler();
  return handler(req, res);
}