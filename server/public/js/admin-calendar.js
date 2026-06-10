import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@18.3.1';
import { EMPLOYEES } from './employees-data.js';
import {
  TASK_STATUSES, TASK_PRIORITIES, HOURS, toYMD, formatDisplayDate,
  monthMatrix, weekDates, tasksOnDate, priorityClass,
  getTaskColor, getEffectiveStatus, statusClass, formatDuration, computeTimeTaken,
  formatTimestamp, formatTimestampTime,
} from './task-utils.js';

const API = window.location.origin;
const VIEWS = ['month', 'week', 'day'];

async function taskFetch(path, password, options = {}) {
  const res = await fetch(`${API}/api${path}`, {
    headers: { 'Content-Type': 'application/json', 'x-admin-password': password, ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function TaskModal({ open, initial, password, onClose, onSaved }) {
  const [form, setForm] = useState(initial || {});
  const [saving, setSaving] = useState(false);
  const [assignMode, setAssignMode] = useState('one');

  useEffect(() => {
    if (open) {
      setForm(initial || {
        title: '', description: '', priority: 'Medium', status: 'Pending',
        start_date: toYMD(new Date()), end_date: toYMD(new Date()),
        start_time: '09:00 AM', end_time: '05:00 PM', notes: '', recurring: 'none',
        assignees: [EMPLOYEES[0].name], color: EMPLOYEES[0].color,
      });
      setAssignMode(initial?.assignees?.length > 1 ? 'multi' : 'one');
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let assignees = form.assignees;
      if (assignMode === 'all') assignees = 'all';
      else if (assignMode === 'one') assignees = [form.assignees?.[0] || EMPLOYEES[0].name];
      const payload = { ...form, assignees };
      if (form.id) {
        await taskFetch(`/tasks/${form.id}`, password, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await taskFetch('/tasks', password, { method: 'POST', body: JSON.stringify(payload) });
      }
      onSaved();
      onClose();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const emp = EMPLOYEES.find((e) => e.name === (form.assignees?.[0] || EMPLOYEES[0].name));

  return React.createElement('div', { className: 'modal-root' },
    React.createElement('div', { className: 'modal-backdrop modal-fade-in', onClick: onClose }),
    React.createElement('form', {
      className: 'modal-panel glass modal-slide-up task-modal',
      onClick: (e) => e.stopPropagation(),
      onSubmit: submit,
    },
      React.createElement('button', { type: 'button', className: 'modal-close', onClick: onClose }, '✕'),
      React.createElement('h2', { className: 'panel-title' }, form.id ? 'Edit Task' : 'Create Task'),
      React.createElement('div', { className: 'task-form-grid' },
        React.createElement('label', null, 'Task Title',
          React.createElement('input', { className: 'input-field', required: true, value: form.title || '', onChange: (e) => set('title', e.target.value) })),
        React.createElement('label', null, 'Description',
          React.createElement('textarea', { className: 'input-field', rows: 3, value: form.description || '', onChange: (e) => set('description', e.target.value) })),
        React.createElement('label', null, 'Assign To',
          React.createElement('div', { className: 'assign-tabs' },
            ['one', 'multi', 'all'].map((m) =>
              React.createElement('button', {
                key: m, type: 'button',
                className: `btn btn-icon${assignMode === m ? ' btn-primary' : ''}`,
                onClick: () => setAssignMode(m),
              }, m === 'one' ? 'One' : m === 'multi' ? 'Multiple' : 'All'))),
          assignMode === 'one' && React.createElement('select', {
            className: 'input-field', value: form.assignees?.[0] || EMPLOYEES[0].name,
            onChange: (e) => { const em = EMPLOYEES.find((x) => x.name === e.target.value); set('assignees', [e.target.value]); set('color', em?.color); },
          }, EMPLOYEES.map((e) => React.createElement('option', { key: e.id, value: e.name }, e.name))),
          assignMode === 'multi' && React.createElement('div', { className: 'multi-assign' },
            EMPLOYEES.map((e) => React.createElement('label', { key: e.id, className: 'check-chip' },
              React.createElement('input', {
                type: 'checkbox',
                checked: (form.assignees || []).includes(e.name),
                onChange: (ev) => {
                  const cur = new Set(form.assignees || []);
                  if (ev.target.checked) cur.add(e.name); else cur.delete(e.name);
                  set('assignees', [...cur]);
                },
              }), e.name)))),
        React.createElement('label', null, 'Priority',
          React.createElement('select', { className: 'input-field', value: form.priority, onChange: (e) => set('priority', e.target.value) },
            TASK_PRIORITIES.map((p) => React.createElement('option', { key: p }, p)))),
        React.createElement('label', null, 'Status',
          React.createElement('select', { className: 'input-field', value: form.status, onChange: (e) => set('status', e.target.value) },
            TASK_STATUSES.map((s) => React.createElement('option', { key: s }, s)))),
        React.createElement('label', null, 'Start Date',
          React.createElement('input', { type: 'date', className: 'input-field', value: form.start_date, onChange: (e) => set('start_date', e.target.value) })),
        React.createElement('label', null, 'Start Time',
          React.createElement('select', { className: 'input-field', value: form.start_time, onChange: (e) => set('start_time', e.target.value) },
            HOURS.map((h) => React.createElement('option', { key: h }, h)))),
        React.createElement('label', null, 'End Date',
          React.createElement('input', { type: 'date', className: 'input-field', value: form.end_date, onChange: (e) => set('end_date', e.target.value) })),
        React.createElement('label', null, 'End Time',
          React.createElement('select', { className: 'input-field', value: form.end_time, onChange: (e) => set('end_time', e.target.value) },
            HOURS.map((h) => React.createElement('option', { key: h }, h)))),
        React.createElement('label', null, 'Color',
          React.createElement('input', { type: 'color', className: 'input-color', value: form.color || emp?.color || '#1E88E5', onChange: (e) => set('color', e.target.value) })),
        React.createElement('label', null, 'Recurring',
          React.createElement('select', { className: 'input-field', value: form.recurring || 'none', onChange: (e) => set('recurring', e.target.value === 'none' ? null : { type: e.target.value }) },
            React.createElement('option', { value: 'none' }, 'None'),
            React.createElement('option', { value: 'daily' }, 'Daily'),
            React.createElement('option', { value: 'weekly' }, 'Weekly'),
            React.createElement('option', { value: 'monthly' }, 'Monthly'))),
        React.createElement('label', { className: 'span-2' }, 'Notes',
          React.createElement('textarea', { className: 'input-field', rows: 2, value: form.notes || '', onChange: (e) => set('notes', e.target.value) }))),
      React.createElement('div', { className: 'modal-actions' },
        form.id && React.createElement('button', {
          type: 'button', className: 'btn btn-out',
          onClick: async () => {
            if (!confirm('Delete this task?')) return;
            await taskFetch(`/tasks/${form.id}`, password, { method: 'DELETE' });
            onSaved(); onClose();
          },
        }, 'Delete'),
        React.createElement('button', { type: 'button', className: 'btn btn-icon', onClick: onClose }, 'Cancel'),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: saving }, saving ? 'Saving…' : 'Save Task'))));
}

function TaskDetailModal({ task, onClose, onEdit }) {
  if (!task) return null;
  const effective = getEffectiveStatus(task);
  const color = getTaskColor(task);
  const taken = computeTimeTaken(task);

  return React.createElement('div', { className: 'modal-root' },
    React.createElement('div', { className: 'modal-backdrop modal-fade-in', onClick: onClose }),
    React.createElement('div', {
      className: 'modal-panel glass modal-slide-up task-detail-modal',
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('button', { type: 'button', className: 'modal-close', onClick: onClose }, '✕'),
      React.createElement('h2', { className: 'panel-title' }, task.title),
      React.createElement('div', { className: 'task-detail-grid' },
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Employee'),
          React.createElement('strong', null, task.assignees?.[0] || '—')),
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Description'),
          React.createElement('p', null, task.description || '—')),
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Priority'),
          React.createElement('span', { className: priorityClass(task.priority) }, task.priority)),
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Task'),
          React.createElement('strong', null, task.title)),
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Assigned'),
          React.createElement('span', null, task.start_time || '—')),
        task.started_at && React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Started'),
          React.createElement('span', null, formatTimestampTime(task.started_at))),
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Deadline'),
          React.createElement('span', null, `${formatDisplayDate(task.end_date || task.start_date)} · ${task.end_time}`)),
        React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Status'),
          React.createElement('span', { className: `task-status-badge ${statusClass(effective)}`, style: { background: `${color}33`, color } }, effective)),
        task.completed_at && React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Completed'),
          React.createElement('span', null, formatTimestampTime(task.completed_at))),
        taken != null && React.createElement('div', { className: 'task-detail-row' },
          React.createElement('span', { className: 'task-detail-label' }, 'Duration'),
          React.createElement('span', null, formatDuration(taken))),
        task.completion_notes && React.createElement('div', { className: 'task-detail-row span-2' },
          React.createElement('span', { className: 'task-detail-label' }, 'Completion Notes'),
          React.createElement('p', null, task.completion_notes)),
        task.notes && React.createElement('div', { className: 'task-detail-row span-2' },
          React.createElement('span', { className: 'task-detail-label' }, 'Admin Notes'),
          React.createElement('p', null, task.notes))),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { type: 'button', className: 'btn btn-icon', onClick: onClose }, 'Close'),
        React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: () => { onClose(); onEdit(task); } }, 'Edit Task'))));
}

function TaskChip({ task, onClick, draggable, onDragStart }) {
  const color = getTaskColor(task);
  const effective = getEffectiveStatus(task);
  return React.createElement('div', {
    className: `cal-task-chip ${statusClass(effective)}`,
    style: { borderLeftColor: color, background: `${color}33`, color: '#fff' },
    onClick: (e) => { e.stopPropagation(); onClick(task); },
    draggable: draggable,
    onDragStart: onDragStart,
    title: `${task.title} — ${task.assignees?.[0] || ''} (${effective})`,
  }, task.title);
}

function ProductivityRow({ analytics }) {
  const a = analytics || {};
  const cards = [
    { label: 'Total Assigned', value: a.totalTasks ?? 0 },
    { label: 'Completed Today', value: a.tasksCompletedToday ?? 0, accent: 'success' },
    { label: 'In Progress', value: a.inProgressTasks ?? 0, accent: 'primary' },
    { label: 'Overdue', value: a.overdueTasks ?? 0, accent: 'warning' },
    { label: 'Completion Rate', value: `${a.completionRate ?? 0}%`, accent: 'accent' },
    { label: 'Employee Productivity', value: `${a.employeeProductivity ?? 0}%` },
    { label: 'Avg Completion Time', value: a.avgCompletionTime || '—' },
    { label: 'Top Performer', value: a.topPerformingEmployee || '—', sub: a.topPerformingEmployeeRate ? `${a.topPerformingEmployeeRate}%` : null },
  ];
  return React.createElement('div', { className: 'productivity-row' },
    cards.map((c, i) =>
      React.createElement('div', { key: c.label, className: `glass productivity-card${c.accent ? ` stat-card--${c.accent}` : ''}` },
        React.createElement('div', { className: 'productivity-value' }, c.value),
        React.createElement('div', { className: 'productivity-label' }, c.label),
        c.sub && React.createElement('div', { className: 'productivity-sub' }, c.sub))));
}

function StatusSummaryCards({ analytics }) {
  const a = analytics || {};
  const items = [
    { key: 'Pending', count: a.pendingTasks ?? 0, color: '#FB8C00' },
    { key: 'In Progress', count: a.inProgressTasks ?? 0, color: '#1E88E5' },
    { key: 'Completed', count: a.completedTasks ?? 0, color: '#43A047' },
    { key: 'Overdue', count: a.overdueTasks ?? 0, color: '#E53935' },
  ];
  return React.createElement('div', { className: 'status-summary-row' },
    items.map((item) =>
      React.createElement('div', {
        key: item.key,
        className: `glass status-summary-card ${statusClass(item.key)}`,
        style: { borderTopColor: item.color },
      },
        React.createElement('span', { className: 'status-summary-count', style: { color: item.color } }, item.count),
        React.createElement('span', { className: 'status-summary-label' }, item.key))));
}

function TaskListSection({ title, tasks, onTaskClick, empty }) {
  return React.createElement('div', { className: 'glass task-list-section' },
    React.createElement('h3', { className: 'panel-title' }, title, ' (', tasks.length, ')'),
    tasks.length === 0
      ? React.createElement('p', { className: 'cal-empty' }, empty || 'None')
      : React.createElement('div', { className: 'task-list-compact' },
        tasks.slice(0, 8).map((t) => {
          const color = getTaskColor(t);
          const effective = getEffectiveStatus(t);
          return React.createElement('div', {
            key: t.id, className: 'task-list-item', onClick: () => onTaskClick(t),
            style: { borderLeftColor: color },
          },
            React.createElement('strong', null, t.title),
            React.createElement('span', null, t.assignees?.[0]),
            React.createElement('span', { className: `task-status-badge ${statusClass(effective)}`, style: { color } }, effective));
        })));
}

function CompletedTasksSection({ tasks, onTaskClick }) {
  const sorted = [...tasks].sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
  return React.createElement('div', { className: 'glass completed-tasks-section' },
    React.createElement('h2', { className: 'panel-title' }, 'Completed Tasks'),
    sorted.length === 0
      ? React.createElement('p', { className: 'cal-empty' }, 'No completed tasks yet')
      : React.createElement('div', { className: 'completed-tasks-grid' },
        sorted.map((t) => {
          const taken = computeTimeTaken(t);
          return React.createElement('div', {
            key: t.id, className: 'completed-task-card', onClick: () => onTaskClick(t),
          },
            React.createElement('div', { className: 'completed-task-head' },
              React.createElement('strong', null, t.assignees?.[0] || '—'),
              React.createElement('span', { className: 'task-status-badge task-status--completed' }, 'Completed')),
            React.createElement('h4', null, t.title),
            React.createElement('div', { className: 'completed-task-times' },
              React.createElement('div', null,
                React.createElement('span', { className: 'time-label' }, 'Assigned'),
                React.createElement('span', null, formatDisplayDate(t.start_date)),
                React.createElement('strong', null, t.start_time)),
              React.createElement('div', null,
                React.createElement('span', { className: 'time-label' }, 'Completed'),
                React.createElement('span', null, t.completed_at ? formatTimestamp(t.completed_at) : '—'),
                React.createElement('strong', null, t.completed_at ? formatTimestampTime(t.completed_at) : '—')),
              taken != null && React.createElement('div', null,
                React.createElement('span', { className: 'time-label' }, 'Time Taken'),
                React.createElement('strong', null, formatDuration(taken)))),
            t.completion_notes && React.createElement('p', { className: 'completion-feed-notes' },
              React.createElement('span', { className: 'meta-label' }, 'Notes'),
              t.completion_notes))));
        })));
}

function TaskTable({ tasks, onTaskClick, onEdit, password, onRefresh }) {
  const sorted = [...tasks].sort((a, b) => (a.start_date + a.start_time).localeCompare(b.start_date + b.start_time));
  return React.createElement('div', { className: 'glass task-table-section' },
    React.createElement('h2', { className: 'panel-title' }, 'All Tasks'),
    React.createElement('div', { className: 'table-wrap' },
      React.createElement('table', { className: 'task-table' },
        React.createElement('thead', null,
          React.createElement('tr', null,
            ['Employee', 'Task', 'Priority', 'Deadline', 'Status', 'Completion Time', 'Actions'].map((h) =>
              React.createElement('th', { key: h }, h)))),
        React.createElement('tbody', null,
          sorted.map((t) => {
            const effective = getEffectiveStatus(t);
            const color = getTaskColor(t);
            return React.createElement('tr', { key: t.id },
              React.createElement('td', null, t.assignees?.[0] || '—'),
              React.createElement('td', null, React.createElement('button', {
                type: 'button', className: 'link-btn', onClick: () => onTaskClick(t),
              }, t.title)),
              React.createElement('td', null, React.createElement('span', { className: priorityClass(t.priority) }, t.priority)),
              React.createElement('td', null, `${formatDisplayDate(t.end_date || t.start_date)} ${t.end_time}`),
              React.createElement('td', null,
                React.createElement('span', { className: `task-status-badge ${statusClass(effective)}`, style: { color } }, effective)),
              React.createElement('td', null, t.completed_at ? formatTimestampTime(t.completed_at) : '—'),
              React.createElement('td', { className: 'task-table-actions' },
                React.createElement('button', { type: 'button', className: 'btn btn-icon btn-sm', onClick: () => onTaskClick(t) }, 'View'),
                React.createElement('button', { type: 'button', className: 'btn btn-icon btn-sm', onClick: () => onEdit(t) }, 'Edit')));
          })))));
}

export function TaskCalendarPage({ password }) {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [buckets, setBuckets] = useState({ todayTasks: [], upcoming: [], overdue: [], completed: [] });
  const [detail, setDetail] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [dragTask, setDragTask] = useState(null);

  const load = useCallback(async () => {
    const data = await taskFetch('/tasks', password);
    setTasks(data.tasks || []);
    setAnalytics(data.analytics || null);
    setBuckets({
      todayTasks: data.todayTasks || [],
      upcoming: data.upcoming || [],
      overdue: data.overdue || [],
      completed: data.completed || [],
    });
  }, [password]);

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  const openCreate = (date, time) => {
    const ymd = typeof date === 'string' ? date : toYMD(date);
    setEditModal({
      start_date: ymd, end_date: ymd,
      start_time: time || '09:00 AM', end_time: time ? time.replace(/AM/, 'PM') : '05:00 PM',
      assignees: [EMPLOYEES[0].name], color: EMPLOYEES[0].color,
      priority: 'Medium', status: 'Pending', title: '', description: '',
    });
  };

  const onDropDate = async (ymd) => {
    if (!dragTask) return;
    try {
      await taskFetch(`/tasks/${dragTask.id}`, password, {
        method: 'PUT',
        body: JSON.stringify({ ...dragTask, start_date: ymd, end_date: ymd }),
      });
      setDragTask(null);
      load();
    } catch (e) { alert(e.message); }
  };

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const toolbar = React.createElement('div', { className: 'cal-toolbar glass' },
    React.createElement('div', { className: 'cal-nav' },
      React.createElement('button', { type: 'button', className: 'btn btn-icon', onClick: () => {
        const d = new Date(cursor);
        if (view === 'month') d.setMonth(d.getMonth() - 1);
        else d.setDate(d.getDate() - (view === 'week' ? 7 : 1));
        setCursor(d);
      } }, '‹'),
      React.createElement('strong', { className: 'cal-title' }, view === 'day' ? formatDisplayDate(toYMD(cursor)) : monthLabel),
      React.createElement('button', { type: 'button', className: 'btn btn-icon', onClick: () => {
        const d = new Date(cursor);
        if (view === 'month') d.setMonth(d.getMonth() + 1);
        else d.setDate(d.getDate() + (view === 'week' ? 7 : 1));
        setCursor(d);
      } }, '›'),
      React.createElement('button', { type: 'button', className: 'btn btn-icon', onClick: () => setCursor(new Date()) }, 'Today')),
    React.createElement('div', { className: 'cal-view-tabs' },
      VIEWS.map((v) => React.createElement('button', {
        key: v, type: 'button',
        className: `btn btn-icon${view === v ? ' btn-primary' : ''}`,
        onClick: () => setView(v),
      }, v.charAt(0).toUpperCase() + v.slice(1)))),
    React.createElement('button', { type: 'button', className: 'btn btn-primary', onClick: () => openCreate(cursor) }, '+ New Task'));

  let body = null;

  if (view === 'month') {
    const weeks = monthMatrix(y, m);
    body = React.createElement('div', { className: 'cal-month glass' },
      React.createElement('div', { className: 'cal-dow' }, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) =>
        React.createElement('div', { key: d, className: 'cal-dow-cell' }, d))),
      weeks.map((week, wi) =>
        React.createElement('div', { key: wi, className: 'cal-week-row' },
          week.map((day) => {
            const ymd = toYMD(day);
            const dayTasks = tasksOnDate(tasks, ymd);
            const muted = day.getMonth() !== m;
            return React.createElement('div', {
              key: ymd,
              className: `cal-day-cell${muted ? ' cal-day-cell--muted' : ''}${toYMD(new Date()) === ymd ? ' cal-day-cell--today' : ''}`,
              onClick: () => openCreate(ymd),
              onDragOver: (e) => e.preventDefault(),
              onDrop: () => onDropDate(ymd),
            },
              React.createElement('span', { className: 'cal-day-num' }, day.getDate()),
              dayTasks.slice(0, 3).map((t) => React.createElement(TaskChip, {
                key: t.id, task: t, onClick: setDetail,
                draggable: true,
                onDragStart: () => setDragTask(t),
              })),
              dayTasks.length > 3 && React.createElement('span', { className: 'cal-more' }, `+${dayTasks.length - 3} more`));
          }))));
  }

  if (view === 'week') {
    const days = weekDates(cursor);
    body = React.createElement('div', { className: 'cal-week glass' },
      days.map((day) => {
        const ymd = toYMD(day);
        const dayTasks = tasksOnDate(tasks, ymd);
        return React.createElement('div', { key: ymd, className: 'cal-week-col' },
          React.createElement('div', { className: 'cal-week-head', onClick: () => openCreate(ymd) },
            day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })),
          React.createElement('div', {
            className: 'cal-week-body',
            onDragOver: (e) => e.preventDefault(),
            onDrop: () => onDropDate(ymd),
          }, dayTasks.map((t) => React.createElement(TaskChip, {
            key: t.id, task: t, onClick: setDetail, draggable: true, onDragStart: () => setDragTask(t),
          }))));
      }));
  }

  if (view === 'day') {
    const ymd = toYMD(cursor);
    const dayTasks = tasksOnDate(tasks, ymd);
    body = React.createElement('div', { className: 'cal-day glass' },
      HOURS.map((hour) => {
        const slotTasks = dayTasks.filter((t) => t.start_time === hour);
        return React.createElement('div', {
          key: hour, className: 'cal-hour-row',
          onClick: () => openCreate(ymd, hour),
          onDragOver: (e) => e.preventDefault(),
          onDrop: () => onDropDate(ymd),
        },
          React.createElement('span', { className: 'cal-hour-label' }, hour),
          React.createElement('div', { className: 'cal-hour-slot' },
            slotTasks.map((t) => React.createElement(TaskChip, {
              key: t.id, task: t, onClick: setDetail, draggable: true, onDragStart: () => setDragTask(t),
            }))));
      }));
  }

  const bucketSections = React.createElement('div', { className: 'task-buckets-grid' },
    React.createElement(TaskListSection, { title: "Today's Tasks", tasks: buckets.todayTasks, onTaskClick: setDetail, empty: 'No tasks today' }),
    React.createElement(TaskListSection, { title: 'Upcoming Tasks', tasks: buckets.upcoming, onTaskClick: setDetail, empty: 'No upcoming tasks' }),
    React.createElement(TaskListSection, { title: 'Overdue Tasks', tasks: buckets.overdue, onTaskClick: setDetail, empty: 'No overdue tasks' }));

  const workload = React.createElement('div', { className: 'glass cal-workload' },
    React.createElement('h3', { className: 'panel-title' }, 'Employee Productivity'),
    React.createElement('div', { className: 'workload-grid' },
      (analytics?.employeeProgress || EMPLOYEES.map((e) => ({ employee_name: e.name, color: e.color, completionRate: 0, completed: 0, total: 0 }))).map((e) =>
        React.createElement('div', { key: e.employee_name, className: 'workload-card', style: { borderColor: e.color || '#1E88E5' } },
          React.createElement('span', { className: 'workload-name' }, e.employee_name),
          React.createElement('strong', null, `${e.completionRate ?? 0}%`),
          React.createElement('span', { className: 'workload-sub' }, `${e.completed ?? 0}/${e.total ?? 0} done`)))));

  return React.createElement('div', { className: 'task-calendar-page' },
    React.createElement(ProductivityRow, { analytics }),
    toolbar,
    body,
    React.createElement(StatusSummaryCards, { analytics }),
    bucketSections,
    React.createElement(CompletedTasksSection, { tasks: buckets.completed, onTaskClick: setDetail }),
    workload,
    React.createElement(TaskTable, {
      tasks, onTaskClick: setDetail, onEdit: setEditModal, password, onRefresh: load,
    }),
    React.createElement(TaskDetailModal, {
      task: detail, onClose: () => setDetail(null), onEdit: setEditModal,
    }),
    React.createElement(TaskModal, {
      open: Boolean(editModal), initial: editModal, password,
      onClose: () => setEditModal(null), onSaved: load,
    }));
}