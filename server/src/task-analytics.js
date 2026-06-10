import { EMPLOYEES } from './employees.js';
import { getTodayDate } from './db-utils.js';

function parseTimeMinutes(t) {
  if (!t) return 0;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

export function isOverdue(task, today = getTodayDate()) {
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

function completionMinutes(task) {
  if (!task.completed_at) return null;
  const start = task.started_at ? new Date(task.started_at) : null;
  if (!start) return null;
  return Math.max(1, Math.round((new Date(task.completed_at) - start) / 60000));
}

function formatDuration(minutes) {
  if (minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} Hour${h !== 1 ? 's' : ''} ${m} Minute${m !== 1 ? 's' : ''}`;
  if (h) return `${h} Hour${h !== 1 ? 's' : ''}`;
  return `${m} Minute${m !== 1 ? 's' : ''}`;
}

export function categorizeEmployeeTasks(tasks, today = getTodayDate()) {
  const todayTasks = tasks.filter((t) => t.start_date === today || (t.start_date <= today && (t.end_date || t.start_date) >= today));
  const upcoming = tasks.filter((t) => t.start_date > today && t.status !== 'Completed');
  const overdue = tasks.filter((t) => isOverdue(t, today));
  const completed = tasks.filter((t) => t.status === 'Completed');
  return { todayTasks, upcoming, overdue, completed };
}

export function categorizeAdminTasks(tasks, today = getTodayDate()) {
  return categorizeEmployeeTasks(tasks, today);
}

function formatTimeShort(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDurationShort(minutes) {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function buildTaskAnalytics(listTasks, completions = []) {
  const today = getTodayDate();
  const tasks = listTasks;
  const total = tasks.length;
  const completed = tasks.filter((t) => t.status === 'Completed').length;
  const pending = tasks.filter((t) => t.status === 'Pending').length;
  const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
  const overdue = tasks.filter((t) => isOverdue(t, today)).length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;

  const completedToday = tasks.filter((t) => {
    if (t.status !== 'Completed' || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) === today;
  }).length;

  const durations = tasks.map(completionMinutes).filter((m) => m != null);
  const avgCompletionMinutes = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStr = weekStart.toISOString().split('T')[0];
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const year = String(new Date().getFullYear());

  const weeklyTasks = tasks.filter((t) => t.start_date >= weekStr);
  const monthlyTasks = tasks.filter((t) => {
    const [y, m] = (t.start_date || '').split('-');
    return y === year && m === month;
  });

  const employeeProgress = EMPLOYEES.map((emp) => {
    const mine = tasks.filter((t) => t.assignees?.includes(emp.name));
    const done = mine.filter((t) => t.status === 'Completed').length;
    return {
      employee_name: emp.name,
      color: emp.color,
      total: mine.length,
      completed: done,
      pending: mine.filter((t) => t.status === 'Pending').length,
      inProgress: mine.filter((t) => t.status === 'In Progress').length,
      overdue: mine.filter((t) => isOverdue(t, today)).length,
      completionRate: mine.length ? Math.round((done / mine.length) * 100) : 0,
    };
  });

  const topPerformingEmployee = employeeProgress.length
    ? [...employeeProgress].sort((a, b) => b.completionRate - a.completionRate || b.completed - a.completed)[0]
    : null;

  const employeeProductivity = employeeProgress.length
    ? Math.round(employeeProgress.reduce((s, e) => s + e.completionRate, 0) / employeeProgress.length)
    : 0;

  const buckets = categorizeAdminTasks(tasks, today);

  const completedTodayList = completions.filter((c) => c.completion_date === today);
  const recentCompletions = completions.slice(0, 10).map((c) => ({
    id: c.id,
    employee_name: c.employee_name,
    task_name: c.task_name || c.task_title,
    completed_at: c.completed_at,
    completed_time: formatTimeShort(c.completed_at),
    duration_display: c.duration_display || formatDuration(c.duration_minutes),
    duration_short: formatDurationShort(c.duration_minutes),
    completion_notes: c.completion_notes || c.notes || '',
    assigned_time: c.assigned_time,
    started_at: c.started_at,
  }));

  const productivityToday = {};
  completedTodayList.forEach((c) => {
    productivityToday[c.employee_name] = (productivityToday[c.employee_name] || 0) + 1;
  });
  const mostProductiveToday = Object.entries(productivityToday)
    .sort((a, b) => b[1] - a[1])[0];
  const mostRecentCompleted = recentCompletions[0] || null;

  return {
    totalTasks: total,
    completedTasks: completed,
    pendingTasks: pending,
    inProgressTasks: inProgress,
    overdueTasks: overdue,
    needReview: tasks.filter((t) => t.status === 'Need Review').length,
    blocked: tasks.filter((t) => t.status === 'Blocked').length,
    completionRate,
    tasksCompletedToday: completedToday,
    employeeProductivity,
    avgCompletionMinutes,
    avgCompletionTime: formatDuration(avgCompletionMinutes) || '—',
    topPerformingEmployee: topPerformingEmployee?.employee_name || '—',
    topPerformingEmployeeRate: topPerformingEmployee?.completionRate ?? 0,
    weeklyPerformance: {
      total: weeklyTasks.length,
      completed: weeklyTasks.filter((t) => t.status === 'Completed').length,
      rate: weeklyTasks.length ? Math.round((weeklyTasks.filter((t) => t.status === 'Completed').length / weeklyTasks.length) * 100) : 0,
    },
    monthlyPerformance: {
      total: monthlyTasks.length,
      completed: monthlyTasks.filter((t) => t.status === 'Completed').length,
      rate: monthlyTasks.length ? Math.round((monthlyTasks.filter((t) => t.status === 'Completed').length / monthlyTasks.length) * 100) : 0,
    },
    dailyProductivity: {
      today: tasks.filter((t) => t.start_date === today).length,
      completedToday,
    },
    employeeProgress,
    buckets,
    recentCompletions,
    completedTodayList: completedTodayList.map((c) => ({
      id: c.id,
      employee_name: c.employee_name,
      task_name: c.task_name,
      completed_time: formatTimeShort(c.completed_at),
      duration_short: formatDurationShort(c.duration_minutes),
      duration_display: c.duration_display,
      completion_notes: c.completion_notes || '',
    })),
    mostRecentCompletedTask: mostRecentCompleted
      ? `${mostRecentCompleted.employee_name} — ${mostRecentCompleted.task_name}`
      : '—',
    mostProductiveEmployeeToday: mostProductiveToday
      ? `${mostProductiveToday[0]} (${mostProductiveToday[1]} tasks)`
      : '—',
  };
}