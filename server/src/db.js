import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EMPLOYEES, resolveEmployee } from './employees.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'attendance.db');
const jsonPath = path.join(__dirname, '..', 'data', 'attendance.json');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    initials TEXT,
    color TEXT,
    role TEXT,
    department TEXT
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_name TEXT NOT NULL,
    date TEXT NOT NULL,
    check_in_time TEXT,
    check_out_time TEXT,
    hours_worked REAL DEFAULT 0,
    minutes_worked INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Available',
    month TEXT,
    year TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(employee_name, date)
  );
`);

const insertEmp = db.prepare(`INSERT OR IGNORE INTO employees (id, name, initials, color, role, department) VALUES (?, ?, ?, ?, ?, ?)`);
EMPLOYEES.forEach((e) => insertEmp.run(e.id, e.name, e.initials, e.color, e.role, e.department));

if (fs.existsSync(jsonPath)) {
  try {
    const { records = [] } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const ins = db.prepare(`
      INSERT OR REPLACE INTO attendance
      (employee_name, date, check_in_time, check_out_time, hours_worked, minutes_worked, status, month, year, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of records) {
      const [y, m] = r.date.split('-');
      ins.run(r.employee_name, r.date, r.check_in, r.check_out, r.hours_worked || 0,
        Math.round((r.hours_worked || 0) * 60), r.status, m, y, r.created_at || new Date().toISOString(), r.updated_at || new Date().toISOString());
    }
    fs.renameSync(jsonPath, jsonPath + '.migrated.bak');
  } catch (e) {
    console.warn('JSON migration:', e.message);
  }
}

export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const p = match[3].toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

export function calcDuration(checkIn, checkOut) {
  let diff = parseTimeToMinutes(checkOut) - parseTimeToMinutes(checkIn);
  if (diff < 0) diff += 24 * 60;
  return { hours: Math.round((diff / 60) * 100) / 100, minutes: diff };
}

export function formatHoursDisplay(hours, minutes) {
  const totalMin = minutes ?? Math.round((hours || 0) * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h && !m) return '0 Hours';
  if (!m) return `${h} Hour${h !== 1 ? 's' : ''}`;
  return `${h} Hour${h !== 1 ? 's' : ''} ${m} Minute${m !== 1 ? 's' : ''}`;
}

export function getMonthName(m) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1] || '';
}

function rowToRecord(r) {
  if (!r) return null;
  return {
    id: r.id,
    employee_name: r.employee_name,
    date: r.date,
    display_date: r.date.split('-').reverse().join('/'),
    check_in: r.check_in_time,
    check_out: r.check_out_time,
    check_in_time: r.check_in_time,
    check_out_time: r.check_out_time,
    hours_worked: r.hours_worked,
    minutes_worked: r.minutes_worked,
    hours_display: formatHoursDisplay(r.hours_worked, r.minutes_worked),
    status: r.status,
    month: r.month,
    year: r.year,
    created_at: r.created_at,
    updated_at: r.updated_at,
    last_activity: r.updated_at,
  };
}

export function findToday(employeeName) {
  return rowToRecord(db.prepare(`SELECT * FROM attendance WHERE employee_name = ? AND date = ?`).get(employeeName, getTodayDate()));
}

export function getDisplayStatus(record) {
  if (!record?.check_in_time) return { label: 'Not Checked In', key: 'available' };
  if (record.status === 'Working') return { label: 'Currently Working', key: 'working' };
  return { label: 'Work Completed', key: 'completed' };
}

export function getAllEmployeesStatus(date = getTodayDate()) {
  return EMPLOYEES.map((emp) => {
    const row = db.prepare(`SELECT * FROM attendance WHERE employee_name = ? AND date = ?`).get(emp.name, date);
    const record = rowToRecord(row);
    const { label, key } = getDisplayStatus(record);
    return {
      ...emp,
      record,
      status: label,
      statusKey: key,
      check_in: record?.check_in_time || null,
      check_out: record?.check_out_time || null,
      hours_worked: record?.hours_worked || 0,
      minutes_worked: record?.minutes_worked || 0,
      hours_display: record?.hours_display || '0 Hours',
      last_activity: record?.updated_at || null,
    };
  });
}

export function checkIn(employeeName) {
  const emp = resolveEmployee(employeeName);
  const existing = findToday(emp.name);
  if (existing?.check_in_time && !existing?.check_out_time) throw new Error('Already checked in. Please check out first.');
  if (existing?.status === 'Completed') throw new Error('Attendance already completed for today.');

  const date = getTodayDate();
  const time = formatTime();
  const [y, m] = date.split('-');

  if (existing) {
    db.prepare(`UPDATE attendance SET check_in_time=?, check_out_time=NULL, hours_worked=0, minutes_worked=0, status='Working', updated_at=datetime('now') WHERE id=?`).run(time, existing.id);
  } else {
    db.prepare(`INSERT INTO attendance (employee_name, date, check_in_time, status, month, year) VALUES (?, ?, ?, 'Working', ?, ?)`).run(emp.name, date, time, m, y);
  }
  return findToday(emp.name);
}

export function checkOut(employeeName) {
  const emp = resolveEmployee(employeeName);
  const record = findToday(emp.name);
  if (!record?.check_in_time) throw new Error('Please check in first.');
  if (record.check_out_time) throw new Error('Already checked out today.');

  const time = formatTime();
  const { hours, minutes } = calcDuration(record.check_in_time, time);
  db.prepare(`UPDATE attendance SET check_out_time=?, hours_worked=?, minutes_worked=?, status='Completed', updated_at=datetime('now') WHERE id=?`).run(time, hours, minutes, record.id);
  return findToday(emp.name);
}

export function getAllRecords(filters = {}) {
  let sql = 'SELECT * FROM attendance WHERE 1=1';
  const params = [];
  if (filters.name) { sql += ' AND employee_name LIKE ?'; params.push(`%${filters.name}%`); }
  if (filters.date) { sql += ' AND date = ?'; params.push(filters.date); }
  if (filters.month) { sql += ' AND month = ?'; params.push(String(filters.month).padStart(2, '0')); }
  if (filters.year) { sql += ' AND year = ?'; params.push(String(filters.year)); }
  sql += ' ORDER BY date DESC, employee_name ASC';
  return db.prepare(sql).all(...params).map(rowToRecord);
}

export function getEmployeeSummary(name) {
  const emp = resolveEmployee(name);
  const records = db.prepare(`SELECT * FROM attendance WHERE employee_name = ? ORDER BY date DESC`).all(emp.name).map(rowToRecord);

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStr = weekStart.toISOString().split('T')[0];

  const sum = (list) => ({ h: list.reduce((s, r) => s + (r.hours_worked || 0), 0), m: list.reduce((s, r) => s + (r.minutes_worked || 0), 0) });
  const monthly = records.filter((r) => r.month === month && r.year === year);
  const yearly = records.filter((r) => r.year === year);
  const weekly = records.filter((r) => r.date >= weekStr);
  const y = sum(yearly), mo = sum(monthly), w = sum(weekly);

  return {
    found: true,
    employee_name: emp.name,
    employee: emp,
    history: records.map((r) => ({
      id: r.id, date: r.display_date, check_in: r.check_in_time || '—', check_out: r.check_out_time || '—',
      hours_worked: r.hours_display, minutes_worked: r.minutes_worked, status: r.status,
    })),
    weeklyTotalHours: formatHoursDisplay(w.h, w.m),
    monthlyTotalHours: formatHoursDisplay(mo.h, mo.m),
    yearlyTotalHours: formatHoursDisplay(y.h, y.m),
    totalWorkingDays: new Set(records.map((r) => r.date)).size,
    averageHoursPerDay: records.length ? formatHoursDisplay(y.h / records.length, 0) : '0 Hours',
  };
}

export default db;