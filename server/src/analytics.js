import {
  getTodayDate,
  getAllEmployeesStatus,
  getAllRecords,
  getMonthName,
  formatHoursDisplay,
} from './db-index.js';
import { EMPLOYEES as ROSTER } from './employees.js';

export async function getDashboardAnalytics(date = getTodayDate()) {
  const allEmployees = await getAllEmployeesStatus(date);
  const notStarted = allEmployees.filter((e) => e.statusKey === 'available').length;
  const working = allEmployees.filter((e) => e.statusKey === 'working').length;
  const completed = allEmployees.filter((e) => e.statusKey === 'completed').length;
  const presentToday = working + completed;

  const todayRecords = await getAllRecords({ date });
  const totalHours = todayRecords.reduce((s, r) => s + (r.hours_worked || 0), 0);
  const totalMinutes = todayRecords.reduce((s, r) => s + (r.minutes_worked || 0), 0);
  const avgHours = completed > 0 ? totalHours / completed : 0;

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = String(now.getFullYear());
  const monthlyRecords = await getAllRecords({ month, year });

  const monthlyHours = monthlyRecords.reduce((s, r) => s + (r.hours_worked || 0), 0);
  const monthlyDays = new Set(monthlyRecords.map((r) => `${r.employee_name}-${r.date}`)).size;

  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const allRecords = await getAllRecords();
  const weekRecords = allRecords.filter((r) => r.date >= weekStart.toISOString().split('T')[0]);

  const byEmployee = {};
  monthlyRecords.forEach((r) => {
    if (!byEmployee[r.employee_name]) {
      byEmployee[r.employee_name] = { employee_name: r.employee_name, total_days: new Set(), total_hours: 0, total_minutes: 0 };
    }
    byEmployee[r.employee_name].total_days.add(r.date);
    byEmployee[r.employee_name].total_hours += r.hours_worked || 0;
    byEmployee[r.employee_name].total_minutes += r.minutes_worked || 0;
  });

  const employeeRanking = Object.values(byEmployee)
    .map((e) => ({
      employee_name: e.employee_name,
      total_days: e.total_days.size,
      total_hours: Math.round(e.total_hours * 100) / 100,
      total_minutes: e.total_minutes,
      hours_display: formatHoursDisplay(e.total_hours, e.total_minutes),
    }))
    .sort((a, b) => b.total_hours - a.total_hours)
    .map((e, i) => ({ rank: i + 1, ...e }));

  const attendancePct = ROSTER.length ? Math.round((presentToday / ROSTER.length) * 100) : 0;

  const dailyChart = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    const dayRecs = await getAllRecords({ date: ds });
    dailyChart.push({
      date: ds,
      label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      present: dayRecs.filter((r) => r.check_in_time).length,
      hours: Math.round(dayRecs.reduce((s, r) => s + (r.hours_worked || 0), 0) * 10) / 10,
      completed: dayRecs.filter((r) => r.status === 'Completed').length,
    });
  }

  const monthlyChart = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = String(d.getFullYear());
    const recs = await getAllRecords({ month: m, year: y });
    monthlyChart.push({
      month: getMonthName(parseInt(m, 10)),
      label: getMonthName(parseInt(m, 10)).slice(0, 3),
      hours: Math.round(recs.reduce((s, r) => s + (r.hours_worked || 0), 0) * 10) / 10,
      records: recs.length,
    });
  }

  return {
    date,
    totalEmployees: ROSTER.length,
    employeesPresentToday: presentToday,
    notStartedToday: notStarted,
    currentlyWorking: working,
    completedToday: completed,
    totalHoursToday: Math.round(totalHours * 100) / 100,
    totalMinutesToday: totalMinutes,
    totalHoursTodayDisplay: formatHoursDisplay(totalHours, totalMinutes),
    averageWorkingHours: Math.round(avgHours * 100) / 100,
    attendancePercentage: attendancePct,
    monthlyAttendance: {
      month: getMonthName(parseInt(month, 10)),
      year: parseInt(year, 10),
      totalHours: Math.round(monthlyHours * 100) / 100,
      totalDays: monthlyDays,
      records: monthlyRecords.length,
    },
    weeklyRecords: weekRecords.length,
    allEmployees,
    employeeRanking,
    topEmployees: employeeRanking.slice(0, 5),
    dailyChart,
    monthlyChart,
    heatmap: allEmployees.map((e) => ({ name: e.name.split(' ')[0], status: e.statusKey, hours: e.hours_worked })),
    liveStatus: todayRecords.map((r) => ({
      employee_name: r.employee_name,
      check_in: r.check_in_time,
      check_out: r.check_out_time,
      status: r.status,
      hours_worked: r.hours_worked,
      minutes_worked: r.minutes_worked,
      hours_display: r.hours_display,
    })),
  };
}