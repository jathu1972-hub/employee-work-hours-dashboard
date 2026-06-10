/** Production / Netlify: Netlify Blobs + automatic Excel export */
export * from './db-utils.js';
export { useBlobStore } from './db-router.js';

import * as blob from './db-blob.js';

async function withExcelUpdate(fn) {
  const result = await fn();
  try {
    const records = await blob.getAllRecords();
    const { refreshExcelFiles } = await import('./excel-export.js');
    await refreshExcelFiles(records);
  } catch (e) {
    console.warn('Excel auto-update:', e.message);
  }
  return result;
}

export const findToday = blob.findToday;
export const getAllEmployeesStatus = blob.getAllEmployeesStatus;
export const getAllRecords = blob.getAllRecords;
export const getEmployeeSummary = blob.getEmployeeSummary;
export const checkIn = (n) => withExcelUpdate(() => blob.checkIn(n));
export const checkOut = (n) => withExcelUpdate(() => blob.checkOut(n));