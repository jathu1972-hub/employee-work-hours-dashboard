import { buildTaskAnalytics, categorizeEmployeeTasks } from './task-analytics.js';
import { TASK_STATUSES, TASK_PRIORITIES } from './tasks/constants.js';

export function registerTaskRoutes(app, tasksApi, adminAuth) {
  app.get('/api/tasks/meta', (_, res) => {
    res.json({ statuses: TASK_STATUSES, priorities: TASK_PRIORITIES });
  });

  app.get('/api/tasks/analytics', adminAuth, async (_, res) => {
    try {
      const tasks = await tasksApi.listTasks();
      const completions = await tasksApi.getRecentCompletions(50);
      res.json(buildTaskAnalytics(tasks, completions));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/tasks', adminAuth, async (req, res) => {
    try {
      const tasks = await tasksApi.listTasks(req.query);
      const completions = await tasksApi.getRecentCompletions(50);
      const analytics = buildTaskAnalytics(tasks, completions);
      res.json({ tasks, analytics, ...analytics.buckets });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/tasks/employee/:name', async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const tasks = await tasksApi.listTasks({ employee: name });
      const notifications = await tasksApi.getNotifications(name);
      const buckets = categorizeEmployeeTasks(tasks);
      res.json({ tasks, notifications, ...buckets });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/tasks', adminAuth, async (req, res) => {
    try {
      const result = await tasksApi.createTask(req.body, 'Admin');
      res.json({ success: true, task: result });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put('/api/tasks/:id', adminAuth, async (req, res) => {
    try {
      const task = await tasksApi.updateTask(req.params.id, req.body);
      res.json({ success: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch('/api/tasks/:id/status', async (req, res) => {
    try {
      const { status, employeeName, completionNotes } = req.body;
      const task = await tasksApi.updateTaskStatus(req.params.id, status, employeeName, completionNotes);
      res.json({ success: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/tasks/:id/complete', async (req, res) => {
    try {
      const { employeeName, completionNotes } = req.body;
      const task = await tasksApi.completeTask(req.params.id, employeeName, completionNotes || '');
      res.json({ success: true, task });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get('/api/tasks/completions/recent', adminAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
      res.json({
        completions: await tasksApi.getRecentCompletions(limit),
        today: await tasksApi.getCompletionsToday(),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/tasks/:id', adminAuth, async (req, res) => {
    try {
      await tasksApi.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/tasks/notifications/:name/read', async (req, res) => {
    try {
      await tasksApi.markNotificationsRead(decodeURIComponent(req.params.name));
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}