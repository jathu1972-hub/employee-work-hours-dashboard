/** Local calendar date (YYYY-MM-DD) for correct midnight reset. */
export function getTodayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][m - 1] || '';
}

export function getDisplayStatus(record) {
  if (!record?.check_in_time) return { label: 'Ready For Check-In', key: 'available' };
  if (record.status === 'Working') return { label: 'Currently Working', key: 'working' };
  if (record.status === 'Completed') return { label: 'Work Completed', key: 'completed' };
  return { label: 'Ready For Check-In', key: 'available' };
}

export function rowToRecord(r) {
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