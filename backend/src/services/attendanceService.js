import db from '../db/index.js';
import { assertPrivileged, currentMonth, isPrivileged, resolveTargetEmployee } from './permissions.js';

function monthFilter(month) {
  return `${month}-%`;
}

/**
 * Present / late / absent counts and the attendance rate for a month.
 * HR and Admin may ask company-wide or per department; an employee always
 * gets their own numbers only.
 */
export function getAttendanceSummary(actor, { month = null, department = null, employeeId = null } = {}) {
  const m = month || currentMonth();
  const where = ['a.date LIKE ?'];
  const params = [monthFilter(m)];

  let scope;
  if (!isPrivileged(actor)) {
    // Employees are pinned to their own records, whatever they asked for.
    where.push('a.employee_id = ?');
    params.push(actor.id);
    scope = 'self';
  } else if (employeeId) {
    where.push('a.employee_id = ?');
    params.push(resolveTargetEmployee(actor, employeeId));
    scope = `employee:${employeeId}`;
  } else if (department) {
    where.push('LOWER(d.name) = LOWER(?)');
    params.push(department);
    scope = `department:${department}`;
  } else {
    scope = 'company';
  }

  const rows = db
    .prepare(
      `SELECT a.status, COUNT(*) AS c
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')}
       GROUP BY a.status`
    )
    .all(...params);

  const counts = { present: 0, late: 0, absent: 0, leave: 0 };
  for (const r of rows) counts[r.status] = r.c;

  const totalRecords = counts.present + counts.late + counts.absent;
  const attended = counts.present + counts.late;
  const attendanceRate = totalRecords ? Number(((attended / totalRecords) * 100).toFixed(1)) : 0;

  return { month: m, scope, ...counts, totalRecords, attendanceRate };
}

/**
 * Who was late most often in a month. Company-wide view -> HR/Admin only.
 */
export function getLateComers(actor, { month = null, department = null, limit = 5 } = {}) {
  assertPrivileged(actor, 'the late-arrival list for other employees');
  const m = month || currentMonth();

  const where = ["a.date LIKE ?", "a.status = 'late'"];
  const params = [monthFilter(m)];
  if (department) {
    where.push('LOWER(d.name) = LOWER(?)');
    params.push(department);
  }

  const rows = db
    .prepare(
      `SELECT e.id AS employee_id, e.name, d.name AS department, COUNT(*) AS late_count
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')}
       GROUP BY e.id
       ORDER BY late_count DESC, e.name
       LIMIT ?`
    )
    .all(...params, Math.min(Number(limit) || 5, 50));

  return { month: m, department: department || 'all', lateComers: rows };
}

/** Day-by-day attendance rows, used by the Attendance screen. */
export function listAttendance(actor, { month = null, employeeId = null } = {}) {
  const m = month || currentMonth();
  const where = ['a.date LIKE ?'];
  const params = [monthFilter(m)];

  if (!isPrivileged(actor)) {
    where.push('a.employee_id = ?');
    params.push(actor.id);
  } else if (employeeId) {
    where.push('a.employee_id = ?');
    params.push(resolveTargetEmployee(actor, employeeId));
  }

  return db
    .prepare(
      `SELECT a.id, a.date, a.check_in, a.check_out, a.status, e.id AS employee_id, e.name
       FROM attendance a
       JOIN employees e ON e.id = a.employee_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.date DESC, e.name
       LIMIT 500`
    )
    .all(...params);
}
