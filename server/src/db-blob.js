import { getStore } from '@netlify/blobs';
import { loadJson, saveJson } from './vercel-json-store.js';
import { useVercelStore } from './db-router.js';
import { EMPLOYEES, resolveEmployee } from './employees.js';
import {
  getTodayDate,
  formatTime,
  calcDuration,
  formatHoursDisplay,
  getMonthName,
  getDisplayStatus,
  rowToRecord,
} from './db-utils.js';
import { runDailyMaintenance, getTodayRowForEmployee } from './daily-reset.js';

const STORE_NAME = 'attendance-hub';
const DATA_KEY = 'attendance-data';

function blobStore() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore(STORE_NAME);
}

const VERCEL_DATA_PATH = 'attendance-hub/attendance-data.json';

async function loadRaw() {
  try {
    let data;
    if (useVercelStore()) {
      data = await loadJson(VERCEL_DATA_PATH, { records: [], nextId: 1 });
    } else {
      const store = blobStore();
      data = await store.get(DATA_KEY, { type: 'json' });
      data = data || { records: [], nextId: 1 };
    }
    const snapshot = JSON.stringify(data.records);
    runDailyMaintenance(data);
    if (JSON.stringify(data.records) !== snapshot) await saveRaw(data);
    return data;
  } catch (e) {
    console.warn('loadRaw:', e.message);
    return { records: [], nextId: 1 };
  }
}

async function saveRaw(data) {
  if (useVercelStore()) {
    await saveJson(VERCEL_DATA_PATH, data);
    return;
  }
  const store = blobStore();
  await store.setJSON(DATA_KEY, data);
}

export async function findToday(employeeName) {
  const data = await loadRaw();
  const row = getTodayRowForEmployee(data.records, employeeName);
  return rowToRecord(row);
}

export async function getAllEmployeesStatus(date = getTodayDate()) {
  const data = await loadRaw();
  return EMPLOYEES.map((emp) => {
    const row = date === getTodayDate()
      ? getTodayRowForEmployee(data.records, emp.name, date)
      : data.records.find((r) => r.employee_name === emp.name && r.date === date);
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

export async function checkIn(employeeName) {
  const emp = resolveEmployee(employeeName);
  const data = await loadRaw();
  const date = getTodayDate();
  const time = formatTime();
  const [y, m] = date.split('-');
  const now = new Date().toISOString();

  let row = data.records.find((r) => r.employee_name === emp.name && r.date === date);
  if (row?.check_in_time && !row?.check_out_time) throw new Error('Already checked in. Please check out first.');
  if (row?.status === 'Completed') throw new Error('Attendance already completed for today.');

  if (row) {
    Object.assign(row, {
      check_in_time: time,
      check_out_time: null,
      hours_worked: 0,
      minutes_worked: 0,
      status: 'Working',
      updated_at: now,
    });
  } else {
    data.records.push({
      id: data.nextId++,
      employee_name: emp.name,
      date,
      check_in_time: time,
      check_out_time: null,
      hours_worked: 0,
      minutes_worked: 0,
      status: 'Working',
      month: m,
      year: y,
      created_at: now,
      updated_at: now,
    });
  }
  await saveRaw(data);
  return findToday(emp.name);
}

export async function checkOut(employeeName) {
  const emp = resolveEmployee(employeeName);
  const data = await loadRaw();
  const date = getTodayDate();
  const row = data.records.find((r) => r.employee_name === emp.name && r.date === date);
  if (!row?.check_in_time) throw new Error('Please check in first.');
  if (row.check_out_time) throw new Error('Already checked out today.');

  const time = formatTime();
  const { hours, minutes } = calcDuration(row.check_in_time, time);
  row.check_out_time = time;
  row.hours_worked = hours;
  row.minutes_worked = minutes;
  row.status = 'Completed';
  row.updated_at = new Date().toISOString();
  await saveRaw(data);
  return findToday(emp.name);
}

export async function getAllRecords(filters = {}) {
  const data = await loadRaw();
  let records = [...data.records];
  if (filters.name) {
    const q = filters.name.toLowerCase();
    records = records.filter((r) => r.employee_name.toLowerCase().includes(q));
  }
  if (filters.date) records = records.filter((r) => r.date === filters.date);
  if (filters.month) records = records.filter((r) => r.month === String(filters.month).padStart(2, '0'));
  if (filters.year) records = records.filter((r) => r.year === String(filters.year));
  return records
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.employee_name.localeCompare(b.employee_name)))
    .map(rowToRecord);
}

export async function getEmployeeSummary(name) {
  const emp = resolveEmployee(name);
  const records = (await getAllRecords()).filter((r) => r.employee_name === emp.name);

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStr = weekStart.toISOString().split('T')[0];

  const sum = (list) => ({
    h: list.reduce((s, r) => s + (r.hours_worked || 0), 0),
    m: list.reduce((s, r) => s + (r.minutes_worked || 0), 0),
  });
  const monthly = records.filter((r) => r.month === month && r.year === year);
  const yearly = records.filter((r) => r.year === year);
  const weekly = records.filter((r) => r.date >= weekStr);
  const y = sum(yearly), mo = sum(monthly), w = sum(weekly);

  return {
    found: true,
    employee_name: emp.name,
    employee: emp,
    history: records.map((r) => ({
      id: r.id,
      date: r.display_date,
      check_in: r.check_in_time || '—',
      check_out: r.check_out_time || '—',
      hours_worked: r.hours_display,
      minutes_worked: r.minutes_worked,
      status: r.status,
    })),
    weeklyTotalHours: formatHoursDisplay(w.h, w.m),
    monthlyTotalHours: formatHoursDisplay(mo.h, mo.m),
    yearlyTotalHours: formatHoursDisplay(y.h, y.m),
    totalWorkingDays: new Set(records.map((r) => r.date)).size,
    averageHoursPerDay: records.length ? formatHoursDisplay(y.h / records.length, 0) : '0 Hours',
  };
}