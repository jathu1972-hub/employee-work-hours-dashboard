import { useBlobStore } from './db-router.js';

let localDbPromise = null;

export async function getAttendanceStore() {
  if (useBlobStore()) return import('./db-index.js');
  if (!localDbPromise) localDbPromise = import('./db-local.js');
  return localDbPromise;
}

let localTasksPromise = null;

export async function getTasksSqliteStore() {
  if (useBlobStore()) return null;
  if (!localTasksPromise) localTasksPromise = import('./tasks-store-sqlite.js');
  return localTasksPromise;
}