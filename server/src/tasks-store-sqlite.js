import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EMPLOYEES, findEmployee } from './employees.js';
import { TASK_STATUSES, TASK_PRIORITIES } from './tasks/constants.js';
import { getTodayDate } from './db-utils.js';
import { useBlobStore } from './db-router.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'attendance.db');

let db = null;
if (!useBlobStore()) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
}

if (db) db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_employee TEXT NOT NULL,
    priority TEXT DEFAULT 'Medium',
    status TEXT DEFAULT 'Pending',
    start_date TEXT NOT NULL,
    start_time TEXT,
    end_date TEXT,
    end_time TEXT,
    color TEXT,
    notes TEXT,
    attachments TEXT,
    recurring TEXT,
    created_by TEXT DEFAULT 'Admin',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    task_id INTEGER,
    type TEXT,
    message TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS task_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    employee_name TEXT NOT NULL,
    task_name TEXT NOT NULL,
    assigned_time TEXT,
    started_at TEXT,
    completed_at TEXT NOT NULL,
    duration_minutes INTEGER,
    duration_display TEXT,
    status TEXT DEFAULT 'Completed',
    completion_notes TEXT,
    completion_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    title TEXT,
    employee_name TEXT,
    event_date TEXT,
    start_time TEXT,
    end_time TEXT,
    color TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date TEXT NOT NULL,
    metric_key TEXT NOT NULL,
    metric_value TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

try { db.exec('ALTER TABLE tasks ADD COLUMN started_at TEXT'); } catch { /* exists */ }
try { db.exec('ALTER TABLE tasks ADD COLUMN completed_at TEXT'); } catch { /* exists */ }
try { db.exec('ALTER TABLE tasks ADD COLUMN completion_notes TEXT'); } catch { /* exists */ }

function formatDuration(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} Hour${h !== 1 ? 's' : ''} ${m} Minute${m !== 1 ? 's' : ''}`;
  if (h) return `${h} Hour${h !== 1 ? 's' : ''}`;
  return `${m} Minute${m !== 1 ? 's' : ''}`;
}

function empColor(name) {
  return findEmployee(name)?.color || '#1E88E5';
}

function normalizeAssignees(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (input === 'all') return EMPLOYEES.map((e) => e.name);
  return [String(input)];
}

function rowToTask(r) {
  let assignees = [];
  try {
    const parsed = JSON.parse(r.assigned_employee);
    assignees = Array.isArray(parsed) ? parsed : [r.assigned_employee];
  } catch {
    assignees = [r.assigned_employee];
  }
  return {
    ...r,
    assignees,
    recurring: r.recurring ? JSON.parse(r.recurring) : null,
    color: r.color || empColor(assignees[0]),
  };
}

function rowToCompletion(r) {
  return {
    ...r,
    task_title: r.task_name,
    duration: r.duration_display,
    notes: r.completion_notes,
  };
}

function syncCalendarEvent(task) {
  db.prepare('DELETE FROM calendar_events WHERE task_id = ?').run(task.id);
  if (task.status === 'Completed') return;
  db.prepare(`
    INSERT INTO calendar_events (task_id, title, employee_name, event_date, start_time, end_time, color)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.title, task.assignees?.[0] || task.assigned_employee,
    task.start_date, task.start_time, task.end_time, task.color
  );
}

function recordAnalytics(metricKey, metricValue) {
  const today = getTodayDate();
  db.prepare('INSERT INTO analytics (metric_date, metric_key, metric_value) VALUES (?, ?, ?)')
    .run(today, metricKey, String(metricValue));
}

export function listTasks(filters = {}) {
  let sql = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];
  if (filters.employee) {
    sql += ' AND (assigned_employee = ? OR assigned_employee LIKE ?)';
    params.push(filters.employee, `%${filters.employee}%`);
  }
  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  if (filters.start) { sql += ' AND end_date >= ?'; params.push(filters.start); }
  if (filters.end) { sql += ' AND start_date <= ?'; params.push(filters.end); }
  sql += ' ORDER BY start_date, start_time';
  let tasks = db.prepare(sql).all(...params).map(rowToTask);
  if (filters.employee) {
    const q = filters.employee.toLowerCase();
    tasks = tasks.filter((t) => t.assignees.some((a) => a.toLowerCase() === q));
  }
  return tasks;
}

export function getTask(id) {
  const r = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id));
  return r ? rowToTask(r) : null;
}

function insertNotif(employeeName, taskId, type, message) {
  db.prepare('INSERT INTO task_notifications (employee_name, task_id, type, message) VALUES (?,?,?,?)')
    .run(employeeName, taskId, type, message);
}

export function createTask(payload, createdBy = 'Admin') {
  const assignees = normalizeAssignees(payload.assignees || payload.assigned_employee);
  if (!assignees.length) throw new Error('At least one employee must be assigned');
  if (!payload.title?.trim()) throw new Error('Task title is required');

  const ins = db.prepare(`
    INSERT INTO tasks (title, description, assigned_employee, priority, status, start_date, start_time, end_date, end_time, color, notes, attachments, recurring, created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const created = [];
  for (const name of assignees) {
    const info = ins.run(
      payload.title.trim(),
      payload.description || '',
      name,
      TASK_PRIORITIES.includes(payload.priority) ? payload.priority : 'Medium',
      TASK_STATUSES.includes(payload.status) ? payload.status : 'Pending',
      payload.start_date,
      payload.start_time || '09:00 AM',
      payload.end_date || payload.start_date,
      payload.end_time || '05:00 PM',
      payload.color || empColor(name),
      payload.notes || '',
      payload.attachments || '',
      payload.recurring ? JSON.stringify(payload.recurring) : null,
      createdBy
    );
    const task = getTask(info.lastInsertRowid);
    created.push(task);
    syncCalendarEvent(task);
    insertNotif(name, task.id, 'task_assigned', `New task assigned: ${task.title}`);
  }
  return created.length === 1 ? created[0] : created;
}

function applyStatusTimestamps(prev, nextStatus) {
  const now = new Date().toISOString();
  const patch = {};
  if (nextStatus === 'In Progress' && !prev.started_at) patch.started_at = now;
  if (nextStatus === 'Completed') {
    patch.completed_at = now;
    if (!prev.started_at) patch.started_at = now;
  }
  if (nextStatus !== 'Completed' && prev.status === 'Completed') {
    patch.completed_at = null;
    patch.completion_notes = null;
  }
  return patch;
}

export function updateTask(id, payload) {
  const prev = getTask(id);
  if (!prev) throw new Error('Task not found');
  const assignees = payload.assignees ? normalizeAssignees(payload.assignees) : prev.assignees;
  const name = assignees[0] || prev.assigned_employee;
  const nextStatus = payload.status ?? prev.status;
  const timestamps = payload.status ? applyStatusTimestamps(prev, nextStatus) : {};
  db.prepare(`
    UPDATE tasks SET title=?, description=?, assigned_employee=?, priority=?, status=?,
    start_date=?, start_time=?, end_date=?, end_time=?, color=?, notes=?, attachments=?, recurring=?,
    started_at=?, completed_at=?, completion_notes=?, updated_at=datetime('now')
    WHERE id=?
  `).run(
    payload.title ?? prev.title,
    payload.description ?? prev.description,
    name,
    payload.priority ?? prev.priority,
    nextStatus,
    payload.start_date ?? prev.start_date,
    payload.start_time ?? prev.start_time,
    payload.end_date ?? prev.end_date,
    payload.end_time ?? prev.end_time,
    payload.color ?? prev.color,
    payload.notes ?? prev.notes,
    payload.attachments ?? prev.attachments,
    payload.recurring ? JSON.stringify(payload.recurring) : (prev.recurring ? JSON.stringify(prev.recurring) : null),
    payload.started_at ?? timestamps.started_at ?? prev.started_at ?? null,
    payload.completed_at ?? timestamps.completed_at ?? prev.completed_at ?? null,
    payload.completion_notes ?? prev.completion_notes ?? null,
    Number(id)
  );
  const updated = getTask(id);
  syncCalendarEvent(updated);
  insertNotif(name, updated.id, 'task_updated', `Task updated: ${updated.title}`);
  if (updated.status === 'Completed' && !payload._fromCompletion) {
    insertNotif(name, updated.id, 'task_completed', `Task completed: ${updated.title}`);
  }
  return updated;
}

function insertCompletionRecord(task, employeeName, completionNotes) {
  const started = task.started_at || task.completed_at;
  const durationMinutes = started
    ? Math.max(1, Math.round((new Date(task.completed_at) - new Date(started)) / 60000))
    : null;
  const durationDisplay = formatDuration(durationMinutes);
  const completionDate = (task.completed_at || new Date().toISOString()).slice(0, 10);

  db.prepare(`
    INSERT INTO task_completions
    (task_id, employee_name, task_name, assigned_time, started_at, completed_at, duration_minutes, duration_display, status, completion_notes, completion_date)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    task.id,
    employeeName,
    task.title,
    task.start_time || '—',
    started,
    task.completed_at,
    durationMinutes,
    durationDisplay,
    'Completed',
    completionNotes || '',
    completionDate
  );

  recordAnalytics('task_completed', task.title);
  recordAnalytics('employee_completion', employeeName);
}

export function completeTask(id, employeeName, completionNotes = '') {
  const task = getTask(id);
  if (!task) throw new Error('Task not found');
  if (!task.assignees.some((a) => a.toLowerCase() === employeeName.toLowerCase())) {
    throw new Error('You can only complete your own tasks');
  }
  const now = new Date().toISOString();
  const started = task.started_at || now;
  const updated = updateTask(id, {
    status: 'Completed',
    started_at: started,
    completed_at: now,
    completion_notes: completionNotes,
    _fromCompletion: true,
  });
  insertCompletionRecord(updated, employeeName, completionNotes);
  insertNotif(employeeName, updated.id, 'task_completed', `${employeeName} completed: ${updated.title}`);
  db.prepare('DELETE FROM calendar_events WHERE task_id = ?').run(updated.id);
  return updated;
}

export function updateTaskStatus(id, status, employeeName, completionNotes) {
  if (!TASK_STATUSES.includes(status)) throw new Error('Invalid status');
  const task = getTask(id);
  if (!task) throw new Error('Task not found');
  if (employeeName && !task.assignees.some((a) => a.toLowerCase() === employeeName.toLowerCase())) {
    throw new Error('You can only update your own tasks');
  }
  if (status === 'Completed') {
    return completeTask(id, employeeName, completionNotes || '');
  }
  return updateTask(id, { status });
}

export function deleteTask(id) {
  const r = db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(id));
  if (!r.changes) throw new Error('Task not found');
  db.prepare('DELETE FROM calendar_events WHERE task_id = ?').run(Number(id));
  return { success: true };
}

export function getRecentCompletions(limit = 20) {
  return db.prepare('SELECT * FROM task_completions ORDER BY completed_at DESC LIMIT ?')
    .all(limit)
    .map(rowToCompletion);
}

export function getCompletionsToday() {
  const today = getTodayDate();
  return db.prepare('SELECT * FROM task_completions WHERE completion_date = ? ORDER BY completed_at DESC')
    .all(today)
    .map(rowToCompletion);
}

export function getNotifications(employeeName) {
  return db.prepare('SELECT * FROM task_notifications WHERE employee_name = ? ORDER BY id DESC LIMIT 50')
    .all(employeeName)
    .map((n) => ({ ...n, read: Boolean(n.read) }));
}

export function markNotificationsRead(employeeName) {
  db.prepare('UPDATE task_notifications SET read = 1 WHERE employee_name = ?').run(employeeName);
  return { success: true };
}

export function getAllCompletionsForExport() {
  return db.prepare('SELECT * FROM task_completions ORDER BY completed_at DESC').all();
}

export function getAllEmployeesForExport() {
  return db.prepare('SELECT * FROM employees ORDER BY id').all();
}