/** SQLite-only task storage — no cloud dependencies */
import * as sqlite from './tasks-store-sqlite.js';

export const listTasks = (f) => Promise.resolve(sqlite.listTasks(f));
export const getTask = (id) => Promise.resolve(sqlite.getTask(id));
export const createTask = (p, c) => Promise.resolve(sqlite.createTask(p, c));
export const updateTask = (id, p) => Promise.resolve(sqlite.updateTask(id, p));
export const updateTaskStatus = (id, s, e, n) => Promise.resolve(sqlite.updateTaskStatus(id, s, e, n));
export const completeTask = (id, e, n) => Promise.resolve(sqlite.completeTask(id, e, n));
export const deleteTask = (id) => Promise.resolve(sqlite.deleteTask(id));
export const getNotifications = (n) => Promise.resolve(sqlite.getNotifications(n));
export const markNotificationsRead = (n) => Promise.resolve(sqlite.markNotificationsRead(n));
export const getRecentCompletions = (limit) => Promise.resolve(sqlite.getRecentCompletions(limit));
export const getCompletionsToday = () => Promise.resolve(sqlite.getCompletionsToday());