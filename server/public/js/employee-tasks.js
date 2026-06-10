import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@18.3.1';
import { api } from './api.js';
import {
  TASK_STATUSES, toYMD, formatDisplayDate, priorityClass, getTaskColor,
  getEffectiveStatus, statusClass, taskProgressPercent, formatDuration, computeTimeTaken,
  formatTimestampTime,
} from './task-utils.js';

function CompletionModal({ task, employeeName, onClose, onSubmit, submitting }) {
  const [notes, setNotes] = useState('');
  if (!task) return null;
  return React.createElement('div', { className: 'modal-root' },
    React.createElement('div', { className: 'modal-backdrop modal-fade-in', onClick: onClose }),
    React.createElement('form', {
      className: 'modal-panel glass modal-slide-up completion-modal',
      onClick: (e) => e.stopPropagation(),
      onSubmit: (e) => { e.preventDefault(); onSubmit(notes); },
    },
      React.createElement('button', { type: 'button', className: 'modal-close', onClick: onClose }, '✕'),
      React.createElement('h2', { className: 'panel-title' }, '✅ Task Completed'),
      React.createElement('p', { className: 'completion-task-name' }, task.title),
      React.createElement('label', { className: 'completion-notes-label' }, 'Completion Notes (Optional)',
        React.createElement('textarea', {
          className: 'input-field',
          rows: 4,
          placeholder: 'Finished the report and uploaded it.',
          value: notes,
          onChange: (e) => setNotes(e.target.value),
        })),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', { type: 'button', className: 'btn btn-icon', onClick: onClose }, 'Cancel'),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary', disabled: submitting },
          submitting ? 'Submitting…' : 'Submit Completion'))));
}

function TaskCard({ task, onStatus, onStart, onComplete }) {
  const effective = getEffectiveStatus(task);
  const color = getTaskColor(task);
  const progress = taskProgressPercent(task);
  const taken = computeTimeTaken(task);

  return React.createElement('div', {
    className: `employee-task-card glass ${priorityClass(task.priority)} ${statusClass(effective)}`,
    style: { borderLeftColor: color },
  },
    React.createElement('div', { className: 'task-card-head' },
      React.createElement('h4', null, task.title),
      React.createElement('span', { className: `task-status-badge ${statusClass(effective)}`, style: { background: `${color}33`, color } }, effective)),
    task.description && React.createElement('p', { className: 'task-desc' }, task.description),
    React.createElement('div', { className: 'task-meta' },
      React.createElement('span', null, `${task.start_time} – ${task.end_time}`),
      React.createElement('span', { className: 'task-priority' }, task.priority)),
    React.createElement('div', { className: 'task-meta' },
      React.createElement('span', null, `Assigned by: ${task.created_by || 'Admin'}`),
      React.createElement('span', null, formatDisplayDate(task.start_date))),
    task.status === 'Completed' && React.createElement('div', { className: 'task-completed-info' },
      React.createElement('span', null, `Completed: ${formatTimestampTime(task.completed_at)}`),
      React.createElement('span', null, `Time taken: ${formatDuration(taken)}`),
      task.completion_notes && React.createElement('p', { className: 'task-completion-notes' }, `"${task.completion_notes}"`)),
    React.createElement('div', { className: 'task-progress' },
      React.createElement('div', { className: 'task-progress-bar', style: { width: `${progress}%`, background: color } }),
      React.createElement('span', { className: 'task-progress-label' }, `${progress}%`)),
    task.status !== 'Completed' && React.createElement('div', { className: 'task-actions' },
      task.status === 'Pending' && React.createElement('button', {
        type: 'button', className: 'btn btn-in btn-sm', onClick: () => onStart(task.id),
      }, '▶ Start Task'),
      (task.status === 'In Progress' || task.status === 'Pending') && React.createElement('button', {
        type: 'button', className: 'btn btn-primary btn-sm', onClick: () => onComplete(task),
      }, '✅ Mark as Completed'),
      React.createElement('select', {
        className: 'input-field task-status-select',
        value: task.status,
        onChange: (e) => onStatus(task.id, e.target.value),
      }, TASK_STATUSES.filter((s) => s !== 'Completed').map((s) => React.createElement('option', { key: s, value: s }, s)))));
}

function MiniCalendar({ tasks, employeeName }) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const weeks = [];
  const start = new Date(y, m, 1);
  start.setDate(start.getDate() - start.getDay());
  const cur = new Date(start);
  for (let w = 0; w < 5; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    weeks.push(row);
  }
  const mine = tasks.filter((t) => t.assignees?.includes(employeeName));
  return React.createElement('div', { className: 'emp-mini-cal glass' },
    React.createElement('h4', null, 'My Calendar — ', now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })),
    React.createElement('div', { className: 'cal-dow' }, ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) =>
      React.createElement('div', { key: i, className: 'cal-dow-cell' }, d))),
    weeks.map((week, wi) =>
      React.createElement('div', { key: wi, className: 'cal-week-row cal-week-row--mini' },
        week.map((day) => {
          const ymd = toYMD(day);
          const count = mine.filter((t) => t.start_date <= ymd && (t.end_date || t.start_date) >= ymd).length;
          return React.createElement('div', {
            key: ymd,
            className: `cal-day-cell cal-day-cell--mini${day.getMonth() !== m ? ' cal-day-cell--muted' : ''}${count ? ' cal-day-cell--has-task' : ''}`,
          }, day.getDate(), count > 0 && React.createElement('span', { className: 'cal-dot' }));
        }))));
}

export function EmployeeTasksPanel({ employeeName, checkedIn }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('today');
  const [notifs, setNotifs] = useState([]);
  const [completing, setCompleting] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!employeeName) return;
    try {
      const d = await api(`/tasks/employee/${encodeURIComponent(employeeName)}`);
      setData(d);
      setNotifs((d.notifications || []).filter((n) => !n.read).slice(0, 5));
    } catch { setData(null); }
  }, [employeeName]);

  useEffect(() => { load(); const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  if (!checkedIn) return null;

  const updateStatus = async (id, status) => {
    try {
      await api(`/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, employeeName }) });
      load();
    } catch (e) { alert(e.message); }
  };

  const startTask = (id) => updateStatus(id, 'In Progress');

  const submitCompletion = async (notes) => {
    if (!completing) return;
    setSubmitting(true);
    try {
      await api(`/tasks/${completing.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ employeeName, completionNotes: notes }),
      });
      setCompleting(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setSubmitting(false); }
  };

  const buckets = {
    today: data?.todayTasks || [],
    upcoming: data?.upcoming || [],
    overdue: data?.overdue || [],
    completed: data?.completed || [],
  };
  const list = buckets[tab] || [];
  const totalActive = (buckets.today.length + buckets.upcoming.length + buckets.overdue.length);
  const doneCount = buckets.completed.length;
  const overallProgress = totalActive + doneCount
    ? Math.round((doneCount / (totalActive + doneCount)) * 100) : 0;

  return React.createElement('div', { className: 'employee-tasks-panel' },
    React.createElement(CompletionModal, {
      task: completing, employeeName, onClose: () => setCompleting(null),
      onSubmit: submitCompletion, submitting,
    }),
    notifs.length > 0 && React.createElement('div', { className: 'task-notif-bar glass' },
      notifs.map((n) => React.createElement('div', { key: n.id, className: 'task-notif-item' }, '🔔 ', n.message))),
    React.createElement('h3', { className: 'section-title' }, 'My Tasks'),
    React.createElement('div', { className: 'task-overall-progress glass' },
      React.createElement('span', null, 'Task Progress'),
      React.createElement('div', { className: 'task-progress' },
        React.createElement('div', { className: 'task-progress-bar', style: { width: `${overallProgress}%` } }),
        React.createElement('span', { className: 'task-progress-label' }, `${doneCount} done · ${overallProgress}%`))),
    React.createElement('div', { className: 'task-tabs' },
      [['today', 'Today'], ['upcoming', 'Upcoming'], ['overdue', 'Overdue'], ['completed', 'Completed']].map(([k, l]) =>
        React.createElement('button', {
          key: k, type: 'button',
          className: `btn btn-icon${tab === k ? ' btn-primary' : ''}`,
          onClick: () => setTab(k),
        }, l, ' (', (buckets[k] || []).length, ')'))),
    list.length === 0
      ? React.createElement('p', { className: 'cal-empty' }, 'No tasks in this category')
      : React.createElement('div', { className: 'employee-task-list' },
        list.map((t) => React.createElement(TaskCard, {
          key: t.id, task: t, onStatus: updateStatus, onStart: startTask, onComplete: setCompleting,
        }))),
    data?.tasks && React.createElement(MiniCalendar, { tasks: data.tasks, employeeName }));
}