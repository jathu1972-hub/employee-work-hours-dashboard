import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';
import { getStore } from '@netlify/blobs';
import { useVercelStore } from './db-router.js';
import { getTodayDate, getMonthName } from './db-utils.js';
import { EMPLOYEES } from './employees.js';

const VERCEL_EXCEL_PREFIX = 'attendance-hub/excel/';
const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;

function getExportsDir() {
  try {
    if (import.meta.url) {
      const dir = path.dirname(fileURLToPath(import.meta.url));
      return path.join(dir, '..', 'exports');
    }
  } catch { /* bundled serverless */ }
  return path.join('/tmp', 'attendance-hub-exports');
}

export const EXPORTS_DIR = getExportsDir();

export const FILES = {
  master: 'Attendance_Master.xlsx',
  daily: 'Daily_Report.xlsx',
  monthly: 'Monthly_Report.xlsx',
  employee: 'Employee_Report.xlsx',
};

const MASTER_HEADERS = [
  'Employee Name',
  'Date',
  'Check In Time',
  'Check Out Time',
  'Hours Worked',
  'Minutes Worked',
  'Status',
  'Month',
  'Year',
  'Created At',
  'Updated At',
];

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E88E5' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

let lastExcelSync = null;

function useBlobExcel() {
  return Boolean(
    process.env.USE_BLOB_DB === '1' ||
    process.env.NETLIFY === 'true' ||
    process.env.NETLIFY_DEV ||
    process.env.VERCEL === '1' ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

function useVercelExcel() {
  return useBlobExcel() && useVercelStore() && Boolean(blobToken());
}

function blobStore() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'attendance-hub', siteID, token });
  }
  return getStore('attendance-hub');
}

function normalizeRow(r) {
  const monthNum = parseInt(r.month, 10);
  return {
    employee_name: r.employee_name,
    date: r.display_date || (r.date ? r.date.split('-').reverse().join('/') : ''),
    check_in_time: r.check_in_time || '',
    check_out_time: r.check_out_time || '',
    hours_worked: Number(r.hours_worked) || 0,
    minutes_worked: Number(r.minutes_worked) || 0,
    status: r.status || '',
    month: getMonthName(monthNum) || r.month || '',
    year: String(r.year || ''),
    created_at: r.created_at || '',
    updated_at: r.updated_at || '',
    _sortDate: r.date || '',
  };
}

function rowToArray(row) {
  return [
    row.employee_name,
    row.date,
    row.check_in_time,
    row.check_out_time,
    row.hours_worked,
    row.minutes_worked,
    row.status,
    row.month,
    row.year,
    row.created_at,
    row.updated_at,
  ];
}

function styleHeaderRow(sheet) {
  const header = sheet.getRow(1);
  header.font = HEADER_FONT;
  header.fill = HEADER_FILL;
  header.alignment = { vertical: 'middle', horizontal: 'center' };
  header.height = 22;
}

function autosize(sheet, cols = 11) {
  for (let c = 1; c <= cols; c++) {
    sheet.getColumn(c).width = c === 1 ? 22 : 16;
  }
}

async function workbookToBuffer(workbook) {
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function saveFile(filename, buffer) {
  if (useVercelExcel()) {
    try {
      await put(`${VERCEL_EXCEL_PREFIX}${filename}`, buffer, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        token: blobToken(),
      });
      return;
    } catch (e) {
      console.warn('Excel vercel blob save:', e.message);
    }
  }
  if (useBlobExcel() && !useVercelStore()) {
    try {
      await blobStore().set(`excel/${filename}`, buffer, {
        metadata: { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      });
      return;
    } catch (e) {
      console.warn('Excel blob save:', e.message);
    }
  }
  const dir = getExportsDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
}

async function buildMaster(rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AttendanceHub';
  const sheet = wb.addWorksheet('Attendance Records');
  sheet.addRow(MASTER_HEADERS);
  styleHeaderRow(sheet);
  const sorted = [...rows].sort((a, b) => {
    if (a._sortDate !== b._sortDate) return a._sortDate < b._sortDate ? 1 : -1;
    return a.employee_name.localeCompare(b.employee_name);
  });
  sorted.forEach((r) => sheet.addRow(rowToArray(r)));
  autosize(sheet);
  return workbookToBuffer(wb);
}

async function buildDaily(rows) {
  const today = getTodayDate();
  const todayRows = rows.filter((r) => r._sortDate === today);
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Daily Report');
  sheet.addRow(['AttendanceHub — Daily Report', today.split('-').reverse().join('/')]);
  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.addRow([]);
  sheet.addRow(MASTER_HEADERS);
  const headerRowNum = 3;
  const hdr = sheet.getRow(headerRowNum);
  hdr.font = HEADER_FONT;
  hdr.fill = HEADER_FILL;
  hdr.alignment = { vertical: 'middle', horizontal: 'center' };
  todayRows.forEach((r) => sheet.addRow(rowToArray(r)));
  const present = todayRows.filter((r) => r.check_in_time).length;
  const working = todayRows.filter((r) => r.status === 'Working').length;
  const completed = todayRows.filter((r) => r.status === 'Completed').length;
  const totalMin = todayRows.reduce((s, r) => s + (r.minutes_worked || 0), 0);
  sheet.addRow([]);
  sheet.addRow(['Summary', `Present: ${present}`, `Working: ${working}`, `Completed: ${completed}`, `Total Minutes: ${totalMin}`]);
  autosize(sheet);
  return workbookToBuffer(wb);
}

async function buildMonthly(rows) {
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const year = String(new Date().getFullYear());
  const monthRows = rows.filter((r) => {
    const parts = r._sortDate?.split('-');
    return parts && parts[0] === year && parts[1] === month;
  });
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Monthly Report');
  sheet.addRow(['AttendanceHub — Monthly Report', `${getMonthName(parseInt(month, 10))} ${year}`]);
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.addRow([]);
  sheet.addRow(['Employee Name', 'Days Worked', 'Total Hours', 'Total Minutes', 'Completed Days', 'Status Summary']);
  styleHeaderRow(sheet);
  const byEmp = new Map();
  monthRows.forEach((r) => {
    if (!byEmp.has(r.employee_name)) byEmp.set(r.employee_name, []);
    byEmp.get(r.employee_name).push(r);
  });
  EMPLOYEES.forEach((emp) => {
    const list = byEmp.get(emp.name) || [];
    const days = new Set(list.map((r) => r._sortDate)).size;
    const totalMin = list.reduce((s, r) => s + (r.minutes_worked || 0), 0);
    const totalH = Math.round((totalMin / 60) * 100) / 100;
    const completed = list.filter((r) => r.status === 'Completed').length;
    sheet.addRow([emp.name, days, totalH, totalMin, completed, list.length ? list[list.length - 1].status : '—']);
  });
  sheet.addRow([]);
  sheet.addRow(['Detail — All Records This Month']);
  sheet.addRow(MASTER_HEADERS);
  const detailStart = sheet.lastRow.number;
  const hdr = sheet.getRow(detailStart);
  hdr.font = HEADER_FONT;
  hdr.fill = HEADER_FILL;
  monthRows.forEach((r) => sheet.addRow(rowToArray(r)));
  autosize(sheet);
  return workbookToBuffer(wb);
}

async function buildEmployee(rows) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Employee Report');
  sheet.addRow(['AttendanceHub — Employee Report', `Generated ${new Date().toLocaleString()}`]);
  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').font = { bold: true, size: 14 };
  let rowPtr = 2;
  EMPLOYEES.forEach((emp) => {
    const list = rows.filter((r) => r.employee_name === emp.name);
    const totalMin = list.reduce((s, r) => s + (r.minutes_worked || 0), 0);
    const totalH = Math.round((totalMin / 60) * 100) / 100;
    sheet.addRow([]);
    rowPtr++;
    sheet.addRow([emp.name, emp.role, `Days: ${new Set(list.map((r) => r._sortDate)).size}`, `Total Hours: ${totalH}`]);
    sheet.getRow(rowPtr + 1).font = { bold: true };
    rowPtr += 2;
    sheet.addRow(MASTER_HEADERS);
    rowPtr++;
    const hdr = sheet.getRow(rowPtr);
    hdr.font = HEADER_FONT;
    hdr.fill = HEADER_FILL;
    list
      .sort((a, b) => (a._sortDate < b._sortDate ? 1 : -1))
      .forEach((r) => {
        sheet.addRow(rowToArray(r));
        rowPtr++;
      });
  });
  autosize(sheet);
  return workbookToBuffer(wb);
}

/** Regenerate all Excel files from attendance records (auto-called on check-in/out). */
export async function refreshExcelFiles(records) {
  const rows = (records || []).map((r) => normalizeRow(r));
  const buffers = {
    [FILES.master]: await buildMaster(rows),
    [FILES.daily]: await buildDaily(rows),
    [FILES.monthly]: await buildMonthly(rows),
    [FILES.employee]: await buildEmployee(rows),
  };
  for (const [name, buf] of Object.entries(buffers)) {
    await saveFile(name, buf);
  }
  lastExcelSync = new Date().toISOString();
  return { files: Object.keys(buffers), recordCount: rows.length, updatedAt: lastExcelSync };
}

export function getExcelStatus() {
  const storage = useVercelExcel()
    ? 'vercel-blob'
    : useBlobExcel()
      ? 'netlify-blob'
      : 'local-disk';
  return {
    enabled: true,
    autoSync: true,
    storage,
    exportPath: storage === 'vercel-blob'
      ? 'Vercel Blob (attendance-hub/excel/*)'
      : storage === 'netlify-blob'
        ? 'Netlify Blobs (excel/*)'
        : getExportsDir(),
    files: Object.values(FILES),
    lastUpdated: lastExcelSync,
  };
}

export async function readExcelFile(key) {
  const filename = FILES[key] || FILES.master;
  if (useVercelExcel()) {
    try {
      const pathname = `${VERCEL_EXCEL_PREFIX}${filename}`;
      const { blobs } = await list({ prefix: pathname, limit: 1, token: blobToken() });
      if (blobs.length) {
        const res = await fetch(blobs[0].url, { headers: { Authorization: `Bearer ${blobToken()}` } });
        if (res.ok) return Buffer.from(await res.arrayBuffer());
      }
    } catch (e) {
      console.warn('Excel vercel blob read:', e.message);
    }
  }
  if (useBlobExcel() && !useVercelStore()) {
    try {
      const data = await blobStore().get(`excel/${filename}`, { type: 'arrayBuffer' });
      if (data) return Buffer.from(data);
    } catch (e) {
      console.warn('Excel blob read:', e.message);
    }
  }
  const filePath = path.join(getExportsDir(), filename);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
  return null;
}

export async function ensureExcelFiles(records = []) {
  const masterPath = path.join(getExportsDir(), FILES.master);
  if (!useBlobExcel() && fs.existsSync(masterPath)) return;
  if (useVercelExcel()) {
    try {
      const { blobs } = await list({
        prefix: `${VERCEL_EXCEL_PREFIX}${FILES.master}`,
        limit: 1,
        token: blobToken(),
      });
      if (blobs.length) return;
    } catch { /* create */ }
  }
  if (useBlobExcel() && !useVercelStore()) {
    try {
      const existing = await blobStore().get(`excel/${FILES.master}`);
      if (existing) return;
    } catch { /* create */ }
  }
  await refreshExcelFiles(records);
}