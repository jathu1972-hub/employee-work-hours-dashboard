export const TASK_STATUSES = ['Pending', 'In Progress', 'Completed', 'Need Review', 'Blocked'];
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const HOURS = ['08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'];

export const STATUS_COLORS = {
  Pending: '#FB8C00',
  'In Progress': '#1E88E5',
  Completed: '#43A047',
  Overdue: '#E53935',
  'Need Review': '#8E24AA',
  Blocked: '#757575',
};

export function pad(n) { return String(n).padStart(2, '0'); }

export function toYMD(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDisplayDate(ymd) {
  const d = fromYMD(ymd);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function parseTimeMinutes(t) {
  if (!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

export function isTaskOverdue(task, today = toYMD(new Date())) {
  if (task.status === 'Completed') return false;
  const end = task.end_date || task.start_date;
  if (end < today) return true;
  if (end === today) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    return parseTimeMinutes(task.end_time) < nowMin;
  }
  return false;
}

export function getEffectiveStatus(task, today = toYMD(new Date())) {
  if (isTaskOverdue(task, today)) return 'Overdue';
  return task.status;
}

export function statusClass(status) {
  return `task-status--${(status || 'pending').toLowerCase().replace(/\s+/g, '-')}`;
}

export function getTaskColor(task, today = toYMD(new Date())) {
  const effective = getEffectiveStatus(task, today);
  return STATUS_COLORS[effective] || STATUS_COLORS[task.status] || '#1E88E5';
}

export function formatDurationShort(minutes) {
  if (minutes == null || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function formatDuration(minutes) {
  if (minutes == null || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} Hour${h !== 1 ? 's' : ''} ${m} Minute${m !== 1 ? 's' : ''}`;
  if (h) return `${h} Hour${h !== 1 ? 's' : ''}`;
  return `${m} Minute${m !== 1 ? 's' : ''}`;
}

export function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimestampTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function computeTimeTaken(task) {
  if (!task.completed_at) return null;
  const start = task.started_at ? new Date(task.started_at) : null;
  if (!start) return null;
  return Math.max(1, Math.round((new Date(task.completed_at) - start) / 60000));
}

export function taskProgressPercent(task) {
  if (task.status === 'Completed') return 100;
  if (task.status === 'In Progress') return 55;
  if (task.status === 'Need Review') return 85;
  if (task.status === 'Blocked') return 25;
  return 10;
}

export function monthMatrix(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const weeks = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
    if (cur.getMonth() !== month && cur.getDay() === 0 && w >= 4) break;
  }
  return weeks;
}

export function weekDates(anchor) {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

export function tasksOnDate(tasks, ymd) {
  return tasks.filter((t) => {
    const end = t.end_date || t.start_date;
    return t.start_date <= ymd && end >= ymd;
  });
}

export function priorityClass(p) {
  return `priority-${(p || 'medium').toLowerCase().replace(/\s+/g, '-')}`;
}