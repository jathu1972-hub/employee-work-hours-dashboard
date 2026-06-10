import { getAllRecords, getTodayDate, getMonthName } from './db-local.js';
import * as tasksStore from './tasks-store-sqlite.js';

const ATTENDANCE_HEADERS = [
  'Employee Name', 'Date', 'Check In Time', 'Check Out Time',
  'Hours Worked', 'Minutes Worked', 'Status', 'Month', 'Year', 'Created At', 'Updated At',
];

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  rows.forEach((row) => {
    lines.push(row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
  });
  return lines.join('\n');
}

function formatAttendanceRow(r) {
  const monthName = getMonthName(parseInt(r.month, 10));
  return [
    r.employee_name,
    r.display_date || r.date.split('-').reverse().join('/'),
    r.check_in_time || '—',
    r.check_out_time || '—',
    r.hours_worked || 0,
    r.minutes_worked || 0,
    r.status,
    monthName,
    r.year,
    r.created_at || '',
    r.updated_at || '',
  ];
}

export async function getCsvContent(type = 'attendance') {
  const today = getTodayDate();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const year = String(new Date().getFullYear());

  if (type === 'tasks') {
    const tasks = tasksStore.listTasks();
    return toCsv(
      ['ID', 'Title', 'Employee', 'Priority', 'Status', 'Start Date', 'Start Time', 'End Date', 'End Time', 'Started At', 'Completed At', 'Completion Notes'],
      tasks.map((t) => [
        t.id, t.title, t.assignees?.[0], t.priority, t.status,
        t.start_date, t.start_time, t.end_date, t.end_time,
        t.started_at || '', t.completed_at || '', t.completion_notes || '',
      ])
    );
  }

  if (type === 'employees') {
    const employees = tasksStore.getAllEmployeesForExport();
    return toCsv(
      ['ID', 'Name', 'Initials', 'Color', 'Role', 'Department'],
      employees.map((e) => [e.id, e.name, e.initials, e.color, e.role, e.department])
    );
  }

  if (type === 'completions') {
    const completions = tasksStore.getAllCompletionsForExport();
    return toCsv(
      ['ID', 'Employee', 'Task', 'Assigned Time', 'Started At', 'Completed At', 'Duration', 'Status', 'Notes', 'Date'],
      completions.map((c) => [
        c.id, c.employee_name, c.task_name, c.assigned_time, c.started_at,
        c.completed_at, c.duration_display, c.status, c.completion_notes, c.completion_date,
      ])
    );
  }

  const all = await getAllRecords();
  if (type === 'daily') {
    return toCsv(ATTENDANCE_HEADERS, all.filter((r) => r.date === today).map(formatAttendanceRow));
  }
  if (type === 'monthly') {
    return toCsv(ATTENDANCE_HEADERS, all.filter((r) => r.month === month && r.year === year).map(formatAttendanceRow));
  }
  return toCsv(ATTENDANCE_HEADERS, all.map(formatAttendanceRow));
}