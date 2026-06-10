import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'https://esm.sh/recharts@2.13.3';
import { api } from './api.js';
import { EMPLOYEES } from './employees-data.js';
import { TaskCalendarPage } from './admin-calendar.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'attendance', label: 'Attendance', icon: '✓' },
  { id: 'employees', label: 'Employees', icon: '👥' },
  { id: 'reports', label: 'Reports', icon: '📁' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'calendar', label: 'Task Calendar', icon: '📅' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const API = window.location.origin;

const BRAND = {
  blue: '#1E88E5',
  green: '#43A047',
  teal: '#00ACC1',
  purple: '#8E24AA',
  orange: '#FB8C00',
  red: '#E53935',
};

function BrandLogo() {
  return React.createElement(
    'div',
    { className: 'brand-logo' },
    React.createElement('div', { className: 'brand-logo__inner' }, 'Multi', React.createElement('br'), 'Kiosk')
  );
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return React.createElement('div', { className: 'clock-bar' },
    React.createElement('span', null, now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })),
    React.createElement('strong', null, now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })));
}

function StatCard({ label, value, sub, delay = 0, accent }) {
  return React.createElement('div', {
    className: `glass stat-card${accent ? ` stat-card--${accent}` : ''}`,
    style: { animationDelay: `${delay}s` },
  }, React.createElement('div', { className: 'stat-value' }, value),
    React.createElement('div', { className: 'stat-label' }, label),
    sub && React.createElement('div', { className: 'stat-sub' }, sub));
}

function CompletedTodayWidget({ items }) {
  return React.createElement('div', { className: 'glass completed-today-widget' },
    React.createElement('h2', { className: 'panel-title' }, 'Completed Tasks Today'),
    (!items || items.length === 0)
      ? React.createElement('p', { className: 'cal-empty' }, 'No tasks completed today yet')
      : React.createElement('div', { className: 'completed-today-grid' },
        items.map((c) => React.createElement('div', { key: c.id, className: 'completed-today-card' },
          React.createElement('div', { className: 'completed-today-head' }, '✅ ', c.employee_name),
          React.createElement('strong', null, c.task_name),
          React.createElement('span', null, `Completed: ${c.completed_time}`),
          React.createElement('span', null, `Duration: ${c.duration_short || c.duration_display}`)))));
}

function RecentCompletionsFeed({ items }) {
  return React.createElement('div', { className: 'glass completion-feed' },
    React.createElement('h2', { className: 'panel-title' }, 'Recent Completed Tasks'),
    (!items || items.length === 0)
      ? React.createElement('p', { className: 'cal-empty' }, 'No completed tasks yet')
      : React.createElement('div', { className: 'completion-feed-list' },
        items.map((c) => React.createElement('div', { key: c.id || `${c.employee_name}-${c.completed_at}`, className: 'completion-feed-item' },
          React.createElement('p', { className: 'completion-feed-title' },
            '✅ ', React.createElement('strong', null, c.employee_name), ' completed ',
            React.createElement('em', null, `"${c.task_name}"`)),
          React.createElement('div', { className: 'completion-feed-meta' },
            React.createElement('div', null,
              React.createElement('span', { className: 'meta-label' }, 'Completed Time'),
              React.createElement('strong', null, c.completed_time)),
            React.createElement('div', null,
              React.createElement('span', { className: 'meta-label' }, 'Time Taken'),
              React.createElement('strong', null, c.duration_display))),
          c.completion_notes && React.createElement('div', { className: 'completion-feed-notes' },
            React.createElement('span', { className: 'meta-label' }, 'Notes'),
            React.createElement('p', null, c.completion_notes))))));
}

function StatusDot({ statusKey }) {
  return React.createElement('span', { className: `status-dot status-dot--${statusKey}` });
}

function RosterCard({ emp }) {
  return React.createElement('div', { className: `admin-roster-card admin-roster-card--${emp.statusKey}` },
    React.createElement('div', { className: 'employee-avatar', style: { width: 48, height: 48, fontSize: '0.85rem', background: `linear-gradient(135deg,${emp.color},${emp.color}88)` } }, emp.initials),
    React.createElement('h4', null, emp.name),
    React.createElement('div', { className: 'admin-roster-meta' }, React.createElement(StatusDot, { statusKey: emp.statusKey }), ' ', emp.status),
    emp.check_in && React.createElement('p', { className: 'admin-roster-meta' }, `In: ${emp.check_in}`),
    emp.check_out && React.createElement('p', { className: 'admin-roster-meta' }, `Out: ${emp.check_out}`));
}

function SimpleChart({ data, dataKey, labelKey, color, height = 220 }) {
  if (!data?.length) return React.createElement('p', { style: { color: 'var(--text-muted)', padding: '2rem' } }, 'No chart data yet');
  return React.createElement(ResponsiveContainer, { width: '100%', height },
    React.createElement(BarChart, { data },
      React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' }),
      React.createElement(XAxis, { dataKey: labelKey, tick: { fill: '#94a3b8', fontSize: 11 } }),
      React.createElement(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 } }),
      React.createElement(Tooltip, { contentStyle: { background: 'rgba(12, 18, 34, 0.95)', border: '1px solid rgba(30, 136, 229, 0.25)', borderRadius: 12 } }),
      React.createElement(Bar, { dataKey, fill: color, radius: [8, 8, 0, 0] })));
}

function LineTrendChart({ data }) {
  if (!data?.length) return null;
  return React.createElement(ResponsiveContainer, { width: '100%', height: 220 },
    React.createElement(LineChart, { data },
      React.createElement(CartesianGrid, { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.08)' }),
      React.createElement(XAxis, { dataKey: 'label', tick: { fill: '#94a3b8', fontSize: 11 } }),
      React.createElement(YAxis, { tick: { fill: '#94a3b8', fontSize: 11 } }),
      React.createElement(Tooltip, { contentStyle: { background: 'rgba(12, 18, 34, 0.95)', border: '1px solid rgba(30, 136, 229, 0.25)', borderRadius: 12 } }),
      React.createElement(Line, { type: 'monotone', dataKey: 'hours', stroke: BRAND.blue, strokeWidth: 3, dot: { fill: BRAND.teal } })));
}

function LoginPanel({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await api('/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      sessionStorage.setItem('adminPassword', password);
      onLogin(password);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };
  return React.createElement('div', { className: 'app-shell' },
    React.createElement('form', { className: 'glass login-panel', onSubmit: submit },
      React.createElement('h1', null, 'AttendanceHub Admin'),
      React.createElement('p', { style: { color: 'var(--text-muted)', marginBottom: '1.5rem' } }, 'Secure admin access'),
      React.createElement('input', { className: 'input-field', type: 'password', placeholder: 'Admin password', value: password, onChange: (e) => setPassword(e.target.value), style: { marginBottom: '1rem' } }),
      error && React.createElement('p', { style: { color: 'var(--danger)', marginBottom: '1rem' } }, error),
      React.createElement('button', { type: 'submit', className: 'btn btn-primary', style: { width: '100%' }, disabled: loading }, loading ? '…' : 'Sign In'),
      React.createElement('p', { style: { textAlign: 'center', marginTop: '1.5rem' } }, React.createElement('a', { href: '/', className: 'nav-link' }, '← Employee Portal'))));
}

function downloadFile(url, filename, password) {
  fetch(url, { headers: { 'x-admin-password': password } })
    .then((r) => {
      if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Download failed'); });
      return r.blob();
    })
    .then((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = filename;
      a.click();
    })
    .catch((e) => alert(e.message));
}

function downloadCsv(type, password) {
  const names = {
    attendance: 'attendance.csv', daily: 'attendance_daily.csv', monthly: 'attendance_monthly.csv',
    tasks: 'tasks.csv', employees: 'employees.csv', completions: 'task_completions.csv',
  };
  downloadFile(`${API}/api/admin/export-csv/${type}`, names[type] || `${type}.csv`, password);
}

function downloadExcel(type, password) {
  const names = {
    master: 'Attendance_Master.xlsx',
    daily: 'Daily_Report.xlsx',
    monthly: 'Monthly_Report.xlsx',
    employee: 'Employee_Report.xlsx',
  };
  downloadFile(`${API}/api/admin/export-excel/${type}`, names[type] || 'attendance.xlsx', password);
}

function AdminNav({ page, onChange }) {
  return React.createElement('nav', { className: 'admin-nav glass' },
    NAV_ITEMS.map((item) =>
      React.createElement('button', {
        key: item.id,
        type: 'button',
        className: `admin-nav-item${page === item.id ? ' admin-nav-item--active' : ''}`,
        onClick: () => onChange(item.id),
      }, React.createElement('span', { className: 'admin-nav-icon' }, item.icon), item.label)));
}

function AdminDashboard({ password, onLogout }) {
  const [page, setPage] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [excelStatus, setExcelStatus] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);
  const load = useCallback(async () => {
    setStats(await api('/attendance/dashboard'));
    try {
      const r = await fetch(`${API}/api/admin/excel/status`, { headers: { 'x-admin-password': password } });
      if (r.ok) setExcelStatus(await r.json());
    } catch { setExcelStatus(null); }
  }, [password]);
  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const handleSearch = async (e) => {
    e.preventDefault(); if (!search) return;
    try { setSearchResult(await api(`/attendance/search?name=${encodeURIComponent(search)}`)); }
    catch (err) { alert(err.message); }
  };

  if (!stats) return React.createElement('div', { className: 'app-shell loading-screen' }, 'Loading analytics…');

  const ts = stats.taskStats || {};
  const showDash = page === 'dashboard';
  const showAtt = page === 'attendance' || page === 'employees' || showDash;
  const showCharts = page === 'analytics' || showDash;
  const showReports = page === 'reports' || showDash;
  const showSearch = page === 'dashboard';
  const showLog = page === 'attendance' || showDash;

  const rosterPanel = React.createElement('div', { className: 'glass', style: { padding: '1.5rem', marginBottom: '1.5rem' } },
    React.createElement('h2', { className: 'panel-title' }, 'All Employees — Live Status'),
    React.createElement('div', { className: 'admin-roster-grid' },
      (stats.allEmployees || []).map((e) => React.createElement(RosterCard, { key: e.id, emp: e }))));

  const chartsRow = React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'charts-row' },
      React.createElement('div', { className: 'glass chart-panel' },
        React.createElement('h3', null, 'Daily Attendance (7 days)'),
        React.createElement(SimpleChart, { data: stats.dailyChart, dataKey: 'present', labelKey: 'label', color: BRAND.green })),
      React.createElement('div', { className: 'glass chart-panel' },
        React.createElement('h3', null, 'Work Hours Trend'),
        React.createElement(LineTrendChart, { data: stats.dailyChart }))),
    React.createElement('div', { className: 'glass chart-panel', style: { marginBottom: '1.5rem' } },
      React.createElement('h3', null, 'Monthly Hours'),
      React.createElement(SimpleChart, { data: stats.monthlyChart, dataKey: 'hours', labelKey: 'label', color: BRAND.purple })));

  const excelPanel = React.createElement('div', { className: 'glass', style: { padding: '1.5rem', marginBottom: '1.5rem' } },
    React.createElement('h2', { className: 'panel-title' }, 'Excel Reports (Auto-Sync)'),
    React.createElement('p', { style: { color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' } },
      'Excel files update automatically on every check-in and check-out.'),
    excelStatus?.lastUpdated && React.createElement('p', { style: { color: 'var(--success)', fontSize: '0.85rem', marginBottom: '1rem' } },
      `Last Excel update: ${new Date(excelStatus.lastUpdated).toLocaleString()}`),
    React.createElement('div', { className: 'export-btns' },
      React.createElement('button', { className: 'btn btn-primary', onClick: () => downloadExcel('master', password) }, 'Download Master Excel'),
      React.createElement('button', { className: 'btn btn-in', onClick: () => downloadExcel('daily', password) }, 'Daily Report'),
      React.createElement('button', { className: 'btn btn-in', onClick: () => downloadExcel('monthly', password) }, 'Monthly Report'),
      React.createElement('button', { className: 'btn btn-in', onClick: () => downloadExcel('employee', password) }, 'Employee Report'),
      ['attendance', 'daily', 'monthly', 'tasks', 'employees', 'completions'].map((t) =>
        React.createElement('button', { key: t, className: 'btn btn-icon', onClick: () => downloadCsv(t, password) }, `CSV ${t}`))));

  const settingsPanel = React.createElement('div', { className: 'glass', style: { padding: '2rem' } },
    React.createElement('h2', { className: 'panel-title' }, 'Settings'),
    React.createElement('p', { style: { color: 'var(--text-muted)', marginBottom: '1rem' } }, 'Appearance and preferences'),
    React.createElement('button', { className: 'btn btn-primary', onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
      theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'));

  return React.createElement('div', { className: 'app-shell app-shell--admin' },
    React.createElement('header', { className: 'header header--brand glass', style: { padding: '1.25rem 1.5rem', marginBottom: '1rem', borderRadius: 'var(--radius-lg)' } },
      React.createElement('div', { className: 'kiosk-brand' },
        React.createElement(BrandLogo, null),
        React.createElement('div', { className: 'brand-title' },
          'Owner Dashboard',
          React.createElement('span', null, 'AttendanceHub + Task Calendar'))),
      React.createElement('div', { className: 'header-actions' },
        React.createElement(LiveClock),
        React.createElement('button', { className: 'btn-icon', onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark') }, theme === 'dark' ? '☀️' : '🌙'),
        React.createElement('button', { className: 'btn-icon', onClick: onLogout }, 'Logout'),
        React.createElement('a', { href: '/', className: 'nav-link' }, 'Employee'))),

    React.createElement(AdminNav, { page, onChange: setPage }),

    page === 'calendar' && React.createElement(TaskCalendarPage, { password }),

    page === 'settings' && settingsPanel,

    (showDash || page === 'dashboard') && page !== 'calendar' && page !== 'settings' && React.createElement('div', { className: 'stats-grid stats-grid--wide' },
      React.createElement(StatCard, { label: 'Total Employees', value: stats.totalEmployees, delay: 0 }),
      React.createElement(StatCard, { label: 'Present Today', value: stats.employeesPresentToday, accent: 'primary', delay: 0.05 }),
      React.createElement(StatCard, { label: 'Working Now', value: stats.currentlyWorking, accent: 'success', delay: 0.1 }),
      React.createElement(StatCard, { label: 'Completed', value: stats.completedToday, accent: 'accent', delay: 0.15 }),
      React.createElement(StatCard, { label: 'Not Checked In', value: stats.notStartedToday, delay: 0.2 }),
      React.createElement(StatCard, { label: 'Hours Today', value: stats.totalHoursTodayDisplay, sub: `${stats.totalMinutesToday || 0} minutes`, delay: 0.25 }),
      React.createElement(StatCard, { label: 'Attendance %', value: `${stats.attendancePercentage}%`, accent: 'warning', delay: 0.3 }),
      React.createElement(StatCard, { label: 'Avg Hours', value: `${stats.averageWorkingHours}h`, delay: 0.35 }),
      React.createElement(StatCard, { label: 'Total Tasks', value: ts.totalTasks ?? 0, accent: 'primary', delay: 0.4 }),
      React.createElement(StatCard, { label: 'Completed Today', value: ts.tasksCompletedToday ?? 0, accent: 'success', delay: 0.45 }),
      React.createElement(StatCard, { label: 'In Progress', value: ts.inProgressTasks ?? 0, accent: 'primary', delay: 0.5 }),
      React.createElement(StatCard, { label: 'Overdue Tasks', value: ts.overdueTasks ?? 0, accent: 'warning', delay: 0.55 }),
      React.createElement(StatCard, { label: 'Completion %', value: `${ts.completionRate ?? 0}%`, accent: 'accent', delay: 0.6 }),
      React.createElement(StatCard, { label: 'Employee Productivity', value: `${ts.employeeProductivity ?? 0}%`, delay: 0.65 }),
      React.createElement(StatCard, { label: 'Avg Completion', value: ts.avgCompletionTime || '—', delay: 0.7 }),
      React.createElement(StatCard, { label: 'Top Performer', value: ts.topPerformingEmployee || '—', sub: ts.topPerformingEmployeeRate ? `${ts.topPerformingEmployeeRate}%` : null, accent: 'success', delay: 0.75 }),
      React.createElement(StatCard, { label: 'Most Recent Completed', value: ts.mostRecentCompletedTask || '—', accent: 'accent', delay: 0.8 }),
      React.createElement(StatCard, { label: 'Most Productive Today', value: ts.mostProductiveEmployeeToday || '—', accent: 'success', delay: 0.85 })),

    showDash && page !== 'calendar' && page !== 'settings' && React.createElement('div', { className: 'dashboard-completion-row' },
      React.createElement(CompletedTodayWidget, { items: ts.completedTodayList }),
      React.createElement(RecentCompletionsFeed, { items: ts.recentCompletions })),

    showCharts && page !== 'calendar' && page !== 'settings' && chartsRow,
    showAtt && page !== 'calendar' && page !== 'settings' && rosterPanel,
    showReports && page !== 'calendar' && page !== 'settings' && excelPanel,

    showSearch && page !== 'calendar' && page !== 'settings' && React.createElement('div', { className: 'glass', style: { padding: '1.5rem', marginBottom: '1.5rem' } },
      React.createElement('h2', { className: 'panel-title' }, 'Search Employee'),
      React.createElement('form', { className: 'search-box', onSubmit: handleSearch },
        React.createElement('select', { className: 'search-select', value: search, onChange: (e) => setSearch(e.target.value) },
          React.createElement('option', { value: '' }, 'Select employee…'),
          EMPLOYEES.map((e) => React.createElement('option', { key: e.id, value: e.name }, e.name))),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: !search }, 'View Report')),
      searchResult && React.createElement('div', { className: 'search-result fade-in' },
        React.createElement('p', { className: 'search-summary' },
          React.createElement('strong', null, searchResult.employee_name),
          ` · Days: ${searchResult.totalWorkingDays} · Weekly: ${searchResult.weeklyTotalHours} · Monthly: ${searchResult.monthlyTotalHours} · Yearly: ${searchResult.yearlyTotalHours}`),
        React.createElement('div', { className: 'table-wrap' },
          React.createElement('table', null,
            React.createElement('thead', null, React.createElement('tr', null, ['Date', 'Check In', 'Check Out', 'Hours', 'Status'].map((h) => React.createElement('th', { key: h }, h)))),
            React.createElement('tbody', null,
              (searchResult.history || []).map((row) => React.createElement('tr', { key: row.id || row.date },
                React.createElement('td', null, row.date), React.createElement('td', null, row.check_in),
                React.createElement('td', null, row.check_out), React.createElement('td', null, row.hours_worked),
                React.createElement('td', null, row.status)))
            ))))),

    showDash && page !== 'calendar' && page !== 'settings' && React.createElement('div', { className: 'glass', style: { padding: '1.5rem', marginBottom: '1.5rem' } },
      React.createElement('h2', { className: 'panel-title' }, 'Top Employees (This Month)'),
      React.createElement('div', { className: 'table-wrap' },
        React.createElement('table', null,
          React.createElement('thead', null, React.createElement('tr', null, ['#', 'Employee', 'Days', 'Hours'].map((h) => React.createElement('th', { key: h }, h)))),
          React.createElement('tbody', null,
            (stats.topEmployees || []).map((r) => React.createElement('tr', { key: r.employee_name },
              React.createElement('td', null, r.rank), React.createElement('td', null, r.employee_name),
              React.createElement('td', null, r.total_days), React.createElement('td', null, r.hours_display))))))),

    showLog && page !== 'calendar' && page !== 'settings' && React.createElement('div', { className: 'glass', style: { padding: '1.5rem' } },
      React.createElement('h2', { className: 'panel-title' }, "Today's Log"),
      React.createElement('div', { className: 'table-wrap' },
        React.createElement('table', null,
          React.createElement('thead', null,
            React.createElement('tr', null,
              ['Employee', 'In', 'Out', 'Hours', 'Status'].map((h) =>
                React.createElement('th', { key: h }, h)
              )
            )
          ),
          React.createElement('tbody', null,
            (stats.allEmployees || []).map((r) =>
              React.createElement('tr', { key: r.id },
                React.createElement('td', null, r.name),
                React.createElement('td', null, r.check_in || '—'),
                React.createElement('td', null, r.check_out || '—'),
                React.createElement('td', null, r.hours_display || '—'),
                React.createElement('td', null,
                  React.createElement('span', {
                    className: `badge badge-${r.statusKey === 'working' ? 'working' : r.statusKey === 'completed' ? 'completed' : 'available'}`,
                  }, r.status)
                )
              )
            )
          )
        )
      )
    )
  );
}

function AdminRoot() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('adminPassword') || '');
  if (!authed) return React.createElement(LoginPanel, { onLogin: setAuthed });
  return React.createElement(AdminDashboard, {
    password: authed,
    onLogout: () => { sessionStorage.removeItem('adminPassword'); setAuthed(''); },
  });
}

try {
  const rootEl = document.getElementById('root');
  if (rootEl) createRoot(rootEl).render(React.createElement(AdminRoot));
} catch (err) {
  document.body.innerHTML = `<pre style="color:#ef4444;padding:2rem">Failed to load admin: ${err.message}</pre>`;
}