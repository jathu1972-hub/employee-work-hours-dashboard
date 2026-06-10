import React, { useState, useEffect, useCallback } from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';
import { api } from './api.js';
import { EMPLOYEES } from './employees-data.js';
import { EmployeeTasksPanel } from './employee-tasks.js';

function BrandLogo({ large = false }) {
  return React.createElement(
    'div',
    { className: `brand-logo${large ? ' brand-logo--lg' : ''}` },
    React.createElement('div', { className: 'brand-logo__inner' }, 'Multi', React.createElement('br'), 'Kiosk')
  );
}

function parseCheckInToday(timeStr) {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const p = m[3].toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
}

function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatLastActivity(iso) {
  if (!iso) return 'No activity today';
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function useWorkingTimer(checkInTime, active) {
  const [elapsed, setElapsed] = useState('00:00:00');
  useEffect(() => {
    if (!active || !checkInTime) {
      setElapsed('00:00:00');
      return;
    }
    const start = parseCheckInToday(checkInTime);
    if (!start) return;
    const tick = () => setElapsed(formatElapsed(Date.now() - start.getTime()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [checkInTime, active]);
  return elapsed;
}

function StatusDot({ statusKey }) {
  return React.createElement('span', { className: `status-dot status-dot--${statusKey}` });
}

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [onDone]);
  return React.createElement('div', { className: `toast toast-${type}` }, message);
}

function TodayStats({ employees }) {
  const working = employees.filter((e) => e.statusKey === 'working').length;
  const completed = employees.filter((e) => e.statusKey === 'completed').length;
  const waiting = employees.filter((e) => e.statusKey === 'available').length;
  return React.createElement(
    'div',
    { className: 'today-stats glass' },
    React.createElement('div', { className: 'today-stat' },
      React.createElement('span', { className: 'today-stat-num today-stat-num--green' }, working),
      React.createElement('span', { className: 'today-stat-label' }, 'Working')),
    React.createElement('div', { className: 'today-stat' },
      React.createElement('span', { className: 'today-stat-num today-stat-num--blue' }, completed),
      React.createElement('span', { className: 'today-stat-label' }, 'Done')),
    React.createElement('div', { className: 'today-stat' },
      React.createElement('span', { className: 'today-stat-num' }, waiting),
      React.createElement('span', { className: 'today-stat-label' }, 'Ready'))
  );
}

function EmployeeCard({ employee, statusInfo, onOpen }) {
  const statusKey = statusInfo?.statusKey || 'available';
  const isWorking = statusKey === 'working';
  const timer = useWorkingTimer(statusInfo?.check_in, isWorking);

  return React.createElement(
    'button',
    {
      type: 'button',
      className: `employee-card employee-card--${statusKey}`,
      onClick: () => onOpen(employee),
    },
    React.createElement('div', {
      className: 'employee-avatar',
      style: { background: `linear-gradient(135deg, ${employee.color}, ${employee.color}88)` },
    }, employee.initials),
    React.createElement('div', { className: 'employee-card-body' },
      React.createElement('h3', { className: 'employee-card-name' }, employee.name),
      React.createElement('p', { className: 'employee-card-role' }, employee.role),
      React.createElement('div', { className: 'employee-card-status' },
        React.createElement(StatusDot, { statusKey }),
        statusInfo?.status || 'Ready For Check-In'),
      isWorking &&
        React.createElement('div', { className: 'card-timer' },
          React.createElement('span', { className: 'card-timer-label' }, 'Working Time'),
          React.createElement('span', { className: 'card-timer-value' }, timer)),
      statusKey === 'completed' &&
        statusInfo?.hours_display &&
        React.createElement('p', { className: 'card-hours-done' }, statusInfo.hours_display),
      React.createElement('p', { className: 'last-activity' }, `Last: ${formatLastActivity(statusInfo?.last_activity)}`))
  );
}

function AttendanceModal({ employee, statusInfo, record, loading, modalMsg, onClose, onCheckIn, onCheckOut, showTasks }) {
  const now = useLiveClock();
  const isCompleted = record?.status === 'Completed';
  const canCheckIn = !record?.check_in && !isCompleted;
  const canCheckOut = Boolean(record?.check_in && !record?.check_out && !isCompleted);
  const statusKey = !record?.check_in ? 'available' : record.status === 'Working' ? 'working' : 'completed';
  const liveTimer = useWorkingTimer(record?.check_in, record?.status === 'Working');

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  return React.createElement(
    'div',
    { className: 'modal-root' },
    React.createElement('div', { className: 'modal-backdrop modal-fade-in', onClick: onClose }),
    React.createElement(
      'div',
      { className: 'modal-panel glass modal-slide-up', onClick: (e) => e.stopPropagation(), role: 'dialog' },
      React.createElement('button', { type: 'button', className: 'modal-close', onClick: onClose }, '✕'),
      React.createElement('div', { className: 'modal-header' },
        React.createElement('div', {
          className: 'employee-avatar employee-avatar--large',
          style: { background: `linear-gradient(135deg, ${employee.color}, ${employee.color}88)` },
        }, employee.initials),
        React.createElement('div', null,
          React.createElement('h2', { className: 'modal-name' }, employee.name),
          React.createElement('p', { className: 'modal-role' }, employee.role),
          React.createElement('div', { className: `status-pill status-pill--${statusKey}` },
            React.createElement(StatusDot, { statusKey }),
            record?.status || statusInfo?.status || 'Ready For Check-In'))),
      React.createElement('div', { className: 'modal-datetime' },
        React.createElement('div', null,
          React.createElement('span', { className: 'modal-dt-label' }, 'Date'),
          React.createElement('strong', null, dateStr)),
        React.createElement('div', null,
          React.createElement('span', { className: 'modal-dt-label' }, 'Time'),
          React.createElement('strong', { className: 'modal-dt-time' }, timeStr))),
      modalMsg &&
        React.createElement('div', { className: `modal-alert modal-alert--${modalMsg.type}` }, modalMsg.text),
      record?.status === 'Working' &&
        React.createElement('div', { className: 'modal-timer-box' },
          React.createElement('span', null, 'Current Working Hours'),
          React.createElement('strong', { className: 'modal-timer-big' }, liveTimer)),
      record?.status === 'Completed' &&
        React.createElement('div', { className: 'modal-success-box' },
          React.createElement('p', null, React.createElement('strong', null, 'Total Hours: '), record.hours_display),
          React.createElement('p', null, React.createElement('strong', null, 'Check Out: '), record.check_out),
          React.createElement('p', { className: 'modal-saved' }, '✓ Attendance Saved Successfully')),
      React.createElement('div', { className: 'modal-actions' },
        React.createElement('button', {
          className: 'btn btn-in btn-lg',
          disabled: loading || !canCheckIn,
          onClick: onCheckIn,
        }, loading ? 'Saving…' : '✓ CHECK IN'),
        React.createElement('button', {
          className: 'btn btn-out btn-lg',
          disabled: loading || !canCheckOut,
          onClick: onCheckOut,
        }, loading ? 'Saving…' : '✕ CHECK OUT')),
      record &&
        React.createElement('div', { className: 'modal-record glass-inner' },
          React.createElement('div', { className: 'status-row' },
            React.createElement('span', { className: 'status-label' }, 'Check-In'),
            React.createElement('span', { className: 'status-value' }, record.check_in || '—')),
          React.createElement('div', { className: 'status-row' },
            React.createElement('span', { className: 'status-label' }, 'Check-Out'),
            React.createElement('span', { className: 'status-value' }, record.check_out || '—'))),
      showTasks && React.createElement(EmployeeTasksPanel, {
        employeeName: employee.name,
        checkedIn: Boolean(record?.check_in && record?.status !== 'Completed'),
      })
    )
  );
}

function EmployeeApp() {
  const now = useLiveClock();
  const todayKey = () => new Date().toLocaleDateString('en-CA');

  const [employeesStatus, setEmployeesStatus] = useState(EMPLOYEES.map((e) => ({
    ...e, statusKey: 'available', status: 'Ready For Check-In',
  })));
  const [modalEmployee, setModalEmployee] = useState(null);
  const [modalRecord, setModalRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [modalMsg, setModalMsg] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [bootError, setBootError] = useState(null);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const loadAll = useCallback(async () => {
    try {
      const data = await api('/attendance/employees');
      const list = data.employees || [];
      setEmployeesStatus(list);
      localStorage.setItem(`attendance_cache_${todayKey()}`, JSON.stringify(list));
      localStorage.setItem('attendance_cache_date', todayKey());
      setBootError(null);
      return list;
    } catch (err) {
      try {
        const cacheDate = localStorage.getItem('attendance_cache_date');
        if (cacheDate === todayKey()) {
          const cached = JSON.parse(localStorage.getItem(`attendance_cache_${todayKey()}`) || '[]');
          if (cached.length) setEmployeesStatus(cached);
        } else {
          setEmployeesStatus(EMPLOYEES.map((e) => ({
            ...e, statusKey: 'available', status: 'Ready For Check-In', record: null,
          })));
        }
      } catch { /* ignore */ }
      setBootError('Cannot reach server. Start START.bat then refresh.');
      return null;
    }
  }, []);

  const fetchEmployeeRecord = useCallback(async (name) => {
    try {
      const data = await api(`/attendance/status/${encodeURIComponent(name)}`);
      setModalRecord(data.record);
      return data.record;
    } catch {
      setModalRecord(null);
      return null;
    }
  }, []);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, [loadAll]);

  useEffect(() => {
    if (!modalEmployee) return;
    fetchEmployeeRecord(modalEmployee.name);
    const id = setInterval(() => fetchEmployeeRecord(modalEmployee.name), 5000);
    return () => clearInterval(id);
  }, [modalEmployee, fetchEmployeeRecord]);

  const getStatus = useCallback(
    (emp) => employeesStatus.find((e) => e.name === emp.name) || { statusKey: 'available', status: 'Ready For Check-In' },
    [employeesStatus]
  );

  const openModal = (emp) => {
    setModalMsg(null);
    setModalEmployee(emp);
    setModalRecord(getStatus(emp).record || null);
    fetchEmployeeRecord(emp.name);
  };

  const closeModal = () => {
    setModalEmployee(null);
    setModalRecord(null);
    setModalMsg(null);
    setLoading(false);
  };

  const notify = (msg, type = 'success') => setToast({ message: msg, type });

  const handleCheckIn = async () => {
    if (!modalEmployee) return;
    setLoading(true);
    setModalMsg(null);
    try {
      const data = await api('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ employeeName: modalEmployee.name }),
      });
      setModalRecord(data.record);
      const t = data.record?.check_in || 'now';
      setModalMsg({ type: 'success', text: `✓ ${data.message || 'Checked In'} at ${t}` });
      notify(`Checked in — ${modalEmployee.name}`, 'success');
      await loadAll();
    } catch (e) {
      setModalMsg({ type: 'error', text: e.message });
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!modalEmployee) return;
    setLoading(true);
    setModalMsg(null);
    try {
      const data = await api('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ employeeName: modalEmployee.name }),
      });
      setModalRecord(data.record);
      setModalMsg({
        type: 'success',
        text: `✓ ${data.message || 'Checked Out'} — ${data.record.hours_display}`,
      });
      notify(`Checked out — ${data.record.hours_display}`, 'success');
      await loadAll();
    } catch (e) {
      setModalMsg({ type: 'error', text: e.message });
      notify(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const headerDate = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
  const headerTime = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
  });

  return React.createElement(
    'div',
    { className: 'app-shell app-shell--kiosk' },
    bootError &&
      React.createElement('div', { className: 'boot-error' }, bootError, ' — ', React.createElement('button', {
        type: 'button', className: 'btn-icon', onClick: loadAll,
      }, 'Retry')),
    React.createElement('header', { className: 'kiosk-header glass' },
      React.createElement('div', { className: 'kiosk-brand' },
        React.createElement(BrandLogo, null),
        React.createElement('div', null,
          React.createElement('div', { className: 'brand-title' },
            'AttendanceHub',
            React.createElement('span', null, 'Workforce Automation')),
          React.createElement('p', { className: 'tagline' }, 'Tap your card — check in instantly'))),
      React.createElement('div', { className: 'kiosk-clock-block' },
        React.createElement('div', { className: 'kiosk-date' }, headerDate),
        React.createElement('div', { className: 'kiosk-time' }, headerTime)),
      React.createElement('div', { className: 'kiosk-header-right' },
        React.createElement(TodayStats, { employees: employeesStatus }),
        React.createElement('button', {
          type: 'button',
          className: 'btn-icon',
          onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
        }, theme === 'dark' ? '☀️' : '🌙'))),
    React.createElement('div', { className: 'legend-bar' },
      React.createElement('span', null, React.createElement(StatusDot, { statusKey: 'available' }), ' Ready For Check-In'),
      React.createElement('span', null, React.createElement(StatusDot, { statusKey: 'working' }), ' Working'),
      React.createElement('span', null, React.createElement(StatusDot, { statusKey: 'completed' }), ' Completed')),
    React.createElement('section', { className: 'kiosk-grid-section' },
      React.createElement('h2', { className: 'section-title' }, 'Select Your Name'),
      React.createElement('div', { className: 'employee-grid' },
        EMPLOYEES.map((emp) =>
          React.createElement(EmployeeCard, {
            key: emp.id,
            employee: emp,
            statusInfo: getStatus(emp),
            onOpen: openModal,
          })
        ))),
    React.createElement('p', { className: 'footer-link' },
      React.createElement('a', { href: '/admin', className: 'nav-link' }, 'Owner Dashboard →')),
    modalEmployee &&
      React.createElement(AttendanceModal, {
        employee: modalEmployee,
        statusInfo: getStatus(modalEmployee),
        record: modalRecord,
        loading,
        modalMsg,
        onClose: closeModal,
        onCheckIn: handleCheckIn,
        onCheckOut: handleCheckOut,
        showTasks: true,
      }),
    toast && React.createElement(Toast, { message: toast.message, type: toast.type, onDone: () => setToast(null) })
  );
}

try {
  const root = document.getElementById('root');
  if (root) {
    createRoot(root).render(React.createElement(EmployeeApp));
  }
} catch (err) {
  document.body.innerHTML = `<pre style="color:#ef4444;padding:2rem">Failed to load app: ${err.message}</pre>`;
}