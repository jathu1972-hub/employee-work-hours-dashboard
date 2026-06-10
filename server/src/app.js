import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  checkIn,
  checkOut,
  findToday,
  getAllEmployeesStatus,
  getEmployeeSummary,
  getAllRecords,
} from './db-local.js';
import { EMPLOYEES } from './employees.js';
import { useBlobStore } from './db-router.js';
import { getDashboardAnalytics } from './analytics.js';
import { getCsvContent } from './csv-export.js';
import { getExcelStatus, readExcelFile, FILES } from './excel-export.js';
import * as tasksApi from './tasks-local.js';
import { registerTaskRoutes } from './task-routes.js';
import { buildTaskAnalytics } from './task-analytics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const EXCEL_KEYS = { master: 'master', daily: 'daily', monthly: 'monthly', employee: 'employee' };

export function createApp() {
  const app = express();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

  app.use(cors());
  app.use(express.json());
  app.use(express.static(publicDir));

  app.get('/api/health', (_, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '6.0',
      tasks: true,
      storage: 'sqlite',
      excel: true,
      excelStatus: getExcelStatus(),
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
      const analytics = await getDashboardAnalytics(req.query.date);
      try {
        const tasks = await tasksApi.listTasks();
        const completions = await tasksApi.getRecentCompletions(50);
        analytics.taskStats = buildTaskAnalytics(tasks, completions);
      } catch { analytics.taskStats = null; }
      res.json(analytics);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
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

  const adminAuth = (req, res, next) => {
    const pass = req.headers['x-admin-password'];
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
    next();
  };

  registerTaskRoutes(app, tasksApi, adminAuth);

  app.post('/api/admin/login', (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
      return res.json({ success: true });
    }
    res.status(401).json({ error: 'Invalid password' });
  });

  app.get('/api/admin/excel/status', adminAuth, (_, res) => {
    res.json(getExcelStatus());
  });

  app.get('/api/admin/export-excel/:type', adminAuth, async (req, res) => {
    try {
      const key = EXCEL_KEYS[req.params.type];
      if (!key) return res.status(400).json({ error: 'Invalid export type' });
      const buffer = await readExcelFile(key);
      if (!buffer) return res.status(404).json({ error: 'Excel file not generated yet. Record attendance first.' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${FILES[key]}"`);
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
    res.send(await getCsvContent(type));
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const file = req.path.startsWith('/admin')
      ? path.join(publicDir, 'admin.html')
      : path.join(publicDir, 'index.html');
    res.sendFile(file);
  });

  return app;
}