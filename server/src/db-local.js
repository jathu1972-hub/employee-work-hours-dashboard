/** Local dev: SQLite + automatic Excel export */
import * as sqlite from './db-sqlite.js';
import { refreshExcelFiles } from './excel-export.js';

export {
  getTodayDate,
  formatTime,
  calcDuration,
  formatHoursDisplay,
  getMonthName,
  getDisplayStatus,
} from './db-utils.js';

export { useBlobStore } from './db-router.js';

async function withExcelUpdate(fn) {
  const result = await fn();
  try {
    const records = sqlite.getAllRecords();
    await refreshExcelFiles(records);
  } catch (e) {
    console.warn('Excel auto-update:', e.message);
  }
  return result;
}

export const findToday = (n) => Promise.resolve(sqlite.findToday(n));
export const getAllEmployeesStatus = (d) => Promise.resolve(sqlite.getAllEmployeesStatus(d));
export const getAllRecords = (f) => Promise.resolve(sqlite.getAllRecords(f));
export const getEmployeeSummary = (n) => Promise.resolve(sqlite.getEmployeeSummary(n));
export const checkIn = (n) => withExcelUpdate(() => Promise.resolve(sqlite.checkIn(n)));
export const checkOut = (n) => withExcelUpdate(() => Promise.resolve(sqlite.checkOut(n)));