import { getTodayDate, formatTime, calcDuration } from './db-utils.js';

const TWENTY_HOURS_MS = 20 * 60 * 60 * 1000;

function recordTimestamp(row) {
  if (row.updated_at) {
    const t = new Date(row.updated_at.includes('T') ? row.updated_at : row.updated_at.replace(' ', 'T'));
    if (!Number.isNaN(t.getTime())) return t.getTime();
  }
  if (row.created_at) {
    const t = new Date(row.created_at.includes('T') ? row.created_at : row.created_at.replace(' ', 'T'));
    if (!Number.isNaN(t.getTime())) return t.getTime();
  }
  return Date.now();
}

/**
 * Closes stale Working sessions and preserves all rows (history never deleted).
 * Runs on startup and before reads.
 */
export function runDailyMaintenance(data) {
  if (!data?.records?.length) return data;
  const today = getTodayDate();
  const now = Date.now();

  for (const row of data.records) {
    if (row.status !== 'Working' || !row.check_in_time) continue;

    const isPreviousDay = row.date < today;
    const isStale = now - recordTimestamp(row) >= TWENTY_HOURS_MS;

    if (!isPreviousDay && !isStale) continue;

    if (isPreviousDay && !row.check_out_time) {
      row.status = 'Incomplete';
      row.updated_at = new Date().toISOString();
      continue;
    }

    if (!row.check_out_time) {
      const end = new Date(recordTimestamp(row) + TWENTY_HOURS_MS);
      row.check_out_time = formatTime(end);
      const { hours, minutes } = calcDuration(row.check_in_time, row.check_out_time);
      row.hours_worked = hours;
      row.minutes_worked = minutes;
    }
    row.status = 'Completed';
    row.updated_at = new Date().toISOString();
  }

  return data;
}

/** Today's row for kiosk display — only active calendar day. */
export function getTodayRowForEmployee(records, employeeName, date = getTodayDate()) {
  return records.find((r) => r.employee_name === employeeName && r.date === date) || null;
}

export function isReadyForCheckIn(record) {
  return !record || !record.check_in_time;
}