import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'data', 'attendance.db');
const backupDir = path.join(__dirname, '..', 'backup');
const backupPath = path.join(backupDir, 'attendance_backup.db');

let lastBackupDate = null;

export function runDailyBackup() {
  const today = new Date().toISOString().slice(0, 10);
  if (lastBackupDate === today) return { skipped: true, date: today };
  if (!fs.existsSync(dbPath)) return { skipped: true, reason: 'no database' };

  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(dbPath, backupPath);
  lastBackupDate = today;
  return { success: true, path: backupPath, date: today };
}