import express from 'express';
import cors from 'cors';
import { EMPLOYEES } from './employees.js';
import {
  checkIn,
  checkOut,
  findToday,
  getAllEmployeesStatus,
  getEmployeeSummary,
  getAllRecords,
} from './db-index.js';
import { useBlobStore } from './db-router.js';
import { getTodayDate } from './db-utils.js';
import { buildTaskAnalytics } from './task-analytics.js';

let tasksApiPromise = null;
function getTasksApi() {
  if (!tasksApiPromise) tasksApiPromise = import('./tasks-index.js');
  return tasksApiPromise;
}

const EXCEL_KEYS = {
  master: 'master',
  daily: 'daily',
  monthly: 'monthly',
  employee: 'employee',
};

export async function createApiApp() {
  const app = express();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    const original =
      req.headers['x-vercel-original-url'] ||
      req.headers['x-forwarded-uri'] ||
      req.headers['x-invoke-path'] ||
      req.headers['x-vercel-forwarded-path'];
    if (original) {
      try {
        const path = original.startsWith('http')
          ? `${new URL(original).pathname}${new URL(original).search || ''}`
          : original.startsWith('/') ? original : `/${original}`;
        if (path.startsWith('/api')) req.url = path;
      } catch { /* ignore */ }
    } else if (process.env.VERCEL && req.url === '/') {
      req.url = '/api/health';
    }
    next();
  });

  const adminAuth = (req, res, next) => {
    if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  };

  app.get('/api/health', (_, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '6.0',
      tasks: true,
      dailyReset: true,
      today: getTodayDate(),
      platform: process.env.VERCEL ? 'vercel' : process.env.NETLIFY ? 'netlify' : 'node',
      storage: useBlobStore() ? (process.env.VERCEL ? 'vercel-blob' : 'netlify-blob') : 'sqlite',
      excel: true,
    });
  });

  app.get('/api/attendance/employees', async (_, res) => {
    try {
      res.json({ employees: await getAllEmployeesStatus(), roster: EMPLOYEES });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/attendance/status/:name', async (req, res) => {
    try {
      const record = await findToday(decodeURIComponent(req.params.name));
      res.json({ record });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/attendance/check-in', async (req, res) => {
    try {
      const { employeeName } = req.body;
      if (!employeeName) return res.status(400).json({ error: 'Employee required' });
      const record = await checkIn(employeeName);
      res.json({
        success: true,
        message: 'Successfully checked in — Excel files updated automatically',
        record,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/attendance/check-out', async (req, res) => {
    try {
      const { employeeName } = req.body;
      if (!employeeName) return res.status(400).json({ error: 'Employee required' });
      const record = await checkOut(employeeName);
      res.json({
        success: true,
        message: 'Successfully checked out — Excel files updated automatically',
        record,
      });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/attendance/dashboard', async (req, res) => {
    try {
      const { getDashboardAnalytics } = await import('./analytics.js');
      const analytics = await getDashboardAnalytics(req.query.date);
      try {
        const tasksApi = await getTasksApi();
        const tasks = await tasksApi.listTasks();
        const completions = await tasksApi.getRecentCompletions(50);
        analytics.taskStats = buildTaskAnalytics(tasks, completions);
      } catch { analytics.taskStats = null; }
      res.json(analytics);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const taskRoutesReady = getTasksApi().then(async (tasksApi) => {
    const { registerTaskRoutes } = await import('./task-routes.js');
    registerTaskRoutes(app, tasksApi, adminAuth);
    return tasksApi;
  });
  app.use('/api/tasks', async (req, res, next) => {
    await taskRoutesReady;
    next();
  });

  app.get('/api/attendance/search', async (req, res) => {
    try {
      const name = req.query.name;
      if (!name) return res.status(400).json({ error: 'Name required' });
      res.json(await getEmployeeSummary(name));
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/attendance/records', async (req, res) => {
    try {
      res.json({ records: await getAllRecords(req.query) });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) return res.json({ success: true });
    res.status(401).json({ error: 'Invalid password' });
  });

  app.get('/api/admin/excel/status', adminAuth, async (_, res) => {
    const { getExcelStatus } = await import('./excel-export.js');
    res.json(getExcelStatus());
  });

  app.get('/api/admin/export-excel/:type', adminAuth, async (req, res) => {
    try {
      const { readExcelFile, FILES } = await import('./excel-export.js');
      const key = EXCEL_KEYS[req.params.type];
      if (!key) return res.status(400).json({ error: 'Invalid export type' });
      const buffer = await readExcelFile(key);
      if (!buffer) return res.status(404).json({ error: 'Excel file not generated yet. Record attendance first.' });
      const filename = FILES[key];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/admin/export-csv/:type?', adminAuth, async (req, res) => {
    const type = req.params.type || 'attendance';
    const names = {
      attendance: 'attendance.csv', all: 'attendance.csv', daily: 'attendance_daily.csv',
      monthly: 'attendance_monthly.csv', tasks: 'tasks.csv', employees: 'employees.csv',
      completions: 'task_completions.csv',
    };
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${names[type] || 'export.csv'}"`);
    const { getCsvContent } = await import('./csv-export.js');
    res.send(await getCsvContent(type));
  });

  return app;
}