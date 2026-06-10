import { getStore } from '@netlify/blobs';
import { EMPLOYEES, findEmployee } from './employees.js';
import { TASK_STATUSES, TASK_PRIORITIES } from './tasks/constants.js';

const STORE_NAME = 'attendance-hub';
const TASKS_KEY = 'tasks-data';
const NOTIF_KEY = 'task-notifications';

function blobStore() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  if (siteID && token) {
    return getStore({ name: STORE_NAME, siteID, token });
  }
  return getStore(STORE_NAME);
}

async function loadData() {
  try {
    const data = await blobStore().get(TASKS_KEY, { type: 'json' });
    return data || { tasks: [], nextId: 1 };
  } catch {
    return { tasks: [], nextId: 1 };
  }
}

async function saveData(data) {
  await blobStore().setJSON(TASKS_KEY, data);
}

async function loadNotifs() {
  try {
    const data = await blobStore().get(NOTIF_KEY, { type: 'json' });
    return data || { items: [], nextId: 1 };
  } catch {
    return { items: [], nextId: 1 };
  }
}

async function saveNotifs(data) {
  await blobStore().setJSON(NOTIF_KEY, data);
}

function normalizeAssignees(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.filter(Boolean);
  if (input === 'all') return EMPLOYEES.map((e) => e.name);
  return [String(input)];
}

function empColor(name) {
  return findEmployee(name)?.color || '#1E88E5';
}

function parseTask(raw) {
  let assignees = raw.assignees;
  if (!assignees && raw.assigned_employee) {
    try {
      assignees = JSON.parse(raw.assigned_employee);
      if (!Array.isArray(assignees)) assignees = [raw.assigned_employee];
    } catch {
      assignees = [raw.assigned_employee];
    }
  }
  return {
    ...raw,
    assignees: assignees || [],
    assigned_employee: (assignees || []).join(', '),
    color: raw.color || empColor((assignees || [])[0]),
  };
}

export async function listTasks(filters = {}) {
  const data = await loadData();
  let tasks = data.tasks.map(parseTask);
  if (filters.employee) {
    const q = filters.employee.toLowerCase();
    tasks = tasks.filter((t) => t.assignees.some((a) => a.toLowerCase() === q));
  }
  if (filters.status) tasks = tasks.filter((t) => t.status === filters.status);
  if (filters.start) tasks = tasks.filter((t) => t.end_date >= filters.start);
  if (filters.end) tasks = tasks.filter((t) => t.start_date <= filters.end);
  return tasks.sort((a, b) => (a.start_date + a.start_time).localeCompare(b.start_date + b.start_time));
}

export async function getTask(id) {
  const data = await loadData();
  const t = data.tasks.find((x) => x.id === Number(id));
  return t ? parseTask(t) : null;
}

export async function createTask(payload, createdBy = 'Admin') {
  const data = await loadData();
  const assignees = normalizeAssignees(payload.assignees || payload.assigned_employee);
  if (!assignees.length) throw new Error('At least one employee must be assigned');
  if (!payload.title?.trim()) throw new Error('Task title is required');

  const now = new Date().toISOString();
  const base = {
    title: payload.title.trim(),
    description: payload.description || '',
    assignees,
    assigned_employee: JSON.stringify(assignees),
    priority: TASK_PRIORITIES.includes(payload.priority) ? payload.priority : 'Medium',
    status: TASK_STATUSES.includes(payload.status) ? payload.status : 'Pending',
    start_date: payload.start_date,
    start_time: payload.start_time || '09:00 AM',
    end_date: payload.end_date || payload.start_date,
    end_time: payload.end_time || '05:00 PM',
    color: payload.color || empColor(assignees[0]),
    notes: payload.notes || '',
    attachments: payload.attachments || '',
    recurring: payload.recurring || null,
    created_by: createdBy,
    created_at: now,
    updated_at: now,
  };

  const created = [];
  for (const name of assignees) {
    const task = { id: data.nextId++, ...base, color: payload.color || empColor(name), assignees: [name], assigned_employee: name };
    data.tasks.push(task);
    created.push(parseTask(task));
    await addNotification(name, task.id, 'task_assigned', `New task assigned: ${task.title}`);
  }
  await saveData(data);
  return created.length === 1 ? created[0] : created;
}

function applyStatusTimestamps(prev, nextStatus) {
  const now = new Date().toISOString();
  const patch = {};
  if (nextStatus === 'In Progress' && !prev.started_at) patch.started_at = now;
  if (nextStatus === 'Completed') {
    patch.completed_at = now;
    if (!prev.started_at) patch.started_at = now;
  }
  if (nextStatus !== 'Completed' && prev.status === 'Completed') patch.completed_at = null;
  return patch;
}

export async function updateTask(id, payload) {
  const data = await loadData();
  const idx = data.tasks.findIndex((t) => t.id === Number(id));
  if (idx < 0) throw new Error('Task not found');
  const prev = data.tasks[idx];
  const assignees = payload.assignees ? normalizeAssignees(payload.assignees) : prev.assignees || [prev.assigned_employee];
  const nextStatus = payload.status ?? prev.status;
  const timestamps = payload.status ? applyStatusTimestamps(prev, nextStatus) : {};
  const updated = {
    ...prev,
    ...payload,
    ...timestamps,
    status: nextStatus,
    assignees,
    assigned_employee: assignees.length === 1 ? assignees[0] : JSON.stringify(assignees),
    updated_at: new Date().toISOString(),
  };
  if (payload.priority && !TASK_PRIORITIES.includes(payload.priority)) delete updated.priority;
  if (payload.status && !TASK_STATUSES.includes(payload.status)) delete updated.status;
  data.tasks[idx] = updated;
  await saveData(data);
  for (const name of updated.assignees || [updated.assigned_employee]) {
    await addNotification(name, updated.id, 'task_updated', `Task updated: ${updated.title}`);
    if (updated.status === 'Completed') {
      await addNotification(name, updated.id, 'task_completed', `Task completed: ${updated.title}`);
    }
  }
  return parseTask(updated);
}

export async function updateTaskStatus(id, status, employeeName) {
  if (!TASK_STATUSES.includes(status)) throw new Error('Invalid status');
  const task = await getTask(id);
  if (!task) throw new Error('Task not found');
  if (employeeName && !task.assignees.some((a) => a.toLowerCase() === employeeName.toLowerCase())) {
    throw new Error('You can only update your own tasks');
  }
  return updateTask(id, { status });
}

export async function deleteTask(id) {
  const data = await loadData();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== Number(id));
  if (data.tasks.length === before) throw new Error('Task not found');
  await saveData(data);
  return { success: true };
}

export async function addNotification(employeeName, taskId, type, message) {
  const data = await loadNotifs();
  data.items.unshift({
    id: data.nextId++,
    employee_name: employeeName,
    task_id: taskId,
    type,
    message,
    read: false,
    created_at: new Date().toISOString(),
  });
  if (data.items.length > 200) data.items = data.items.slice(0, 200);
  await saveNotifs(data);
}

export async function getNotifications(employeeName) {
  const data = await loadNotifs();
  return data.items.filter((n) => n.employee_name.toLowerCase() === employeeName.toLowerCase()).slice(0, 50);
}

export async function markNotificationsRead(employeeName) {
  const data = await loadNotifs();
  data.items.forEach((n) => {
    if (n.employee_name.toLowerCase() === employeeName.toLowerCase()) n.read = true;
  });
  await saveNotifs(data);
  return { success: true };
}