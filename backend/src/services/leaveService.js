import db from '../db/index.js';
import { ValidationError } from './errors.js';
import {
  assertPrivileged,
  currentYear,
  isPrivileged,
  resolveTargetEmployee,
} from './permissions.js';

export const LEAVE_TYPES = ['casual', 'sick', 'annual'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetweenInclusive(start, end) {
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  return Math.round((b - a) / 86400000) + 1;
}

/**
 * Remaining leave per type for one employee.
 * Employees always get their own balance; HR/Admin may look up anyone.
 */
export function getLeaveBalance(actor, { employeeId = null, year = null } = {}) {
  const id = resolveTargetEmployee(actor, employeeId);
  const y = Number(year) || currentYear();

  const allocations = db
    .prepare('SELECT type, allocated FROM leave_balances WHERE employee_id = ? AND year = ?')
    .all(id, y);

  const used = db
    .prepare(
      `SELECT type, COALESCE(SUM(days), 0) AS used
       FROM leaves
       WHERE employee_id = ? AND status = 'approved' AND start_date LIKE ?
       GROUP BY type`
    )
    .all(id, `${y}-%`);
  const usedBy = Object.fromEntries(used.map((u) => [u.type, u.used]));

  const pending = db
    .prepare(
      `SELECT type, COALESCE(SUM(days), 0) AS pending
       FROM leaves
       WHERE employee_id = ? AND status = 'pending' AND start_date LIKE ?
       GROUP BY type`
    )
    .all(id, `${y}-%`);
  const pendingBy = Object.fromEntries(pending.map((p) => [p.type, p.pending]));

  const employee = db.prepare('SELECT name FROM employees WHERE id = ?').get(id);

  const balances = allocations.map((a) => ({
    type: a.type,
    allocated: a.allocated,
    used: usedBy[a.type] || 0,
    pending: pendingBy[a.type] || 0,
    remaining: a.allocated - (usedBy[a.type] || 0),
  }));

  return { employee_id: id, employee_name: employee?.name, year: y, balances };
}

/** Company-wide leave picture for a year. HR/Admin only. */
export function getLeaveSummary(actor, { year = null, department = null, status = null } = {}) {
  assertPrivileged(actor, 'leave data for other employees');
  const y = Number(year) || currentYear();

  const where = ['l.start_date LIKE ?'];
  const params = [`${y}-%`];
  if (department) {
    where.push('LOWER(d.name) = LOWER(?)');
    params.push(department);
  }
  if (status) {
    where.push('l.status = ?');
    params.push(status);
  }

  const byType = db
    .prepare(
      `SELECT l.type, l.status, COUNT(*) AS requests, COALESCE(SUM(l.days), 0) AS days
       FROM leaves l
       JOIN employees e ON e.id = l.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')}
       GROUP BY l.type, l.status`
    )
    .all(...params);

  const totals = byType.reduce(
    (acc, r) => {
      acc.requests += r.requests;
      acc.days += r.days;
      return acc;
    },
    { requests: 0, days: 0 }
  );

  const pendingCount = byType
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + r.requests, 0);

  return { year: y, department: department || 'all', totals, pendingRequests: pendingCount, breakdown: byType };
}

/** Leave requests list. Employees only ever see their own. */
export function listLeaves(actor, { employeeId = null, status = null, limit = 100 } = {}) {
  const where = [];
  const params = [];

  if (!isPrivileged(actor)) {
    where.push('l.employee_id = ?');
    params.push(actor.id);
  } else if (employeeId) {
    where.push('l.employee_id = ?');
    params.push(resolveTargetEmployee(actor, employeeId));
  }
  if (status) {
    where.push('l.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  return db
    .prepare(
      `SELECT l.id, l.employee_id, e.name AS employee_name, l.type, l.start_date, l.end_date,
              l.days, l.reason, l.status, l.created_at
       FROM leaves l
       JOIN employees e ON e.id = l.employee_id
       ${clause}
       ORDER BY l.start_date DESC
       LIMIT ?`
    )
    .all(...params, Math.min(Number(limit) || 100, 500));
}

/**
 * Create a leave request. This is what the Smart-Leave form submits AFTER the
 * user confirms the AI-prefilled values -- the AI itself never writes here.
 */
export function createLeave(actor, { employeeId = null, type, startDate, endDate, reason = null }) {
  const id = resolveTargetEmployee(actor, employeeId);

  if (!LEAVE_TYPES.includes(type)) {
    throw new ValidationError(`Leave type must be one of: ${LEAVE_TYPES.join(', ')}.`);
  }
  if (!ISO_DATE.test(startDate || '') || !ISO_DATE.test(endDate || '')) {
    throw new ValidationError('Dates must be in YYYY-MM-DD format.');
  }
  const days = daysBetweenInclusive(startDate, endDate);
  if (days < 1) throw new ValidationError('End date cannot be before start date.');

  const info = db
    .prepare(
      `INSERT INTO leaves (employee_id, type, start_date, end_date, days, reason, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(id, type, startDate, endDate, days, reason);

  return db.prepare('SELECT * FROM leaves WHERE id = ?').get(info.lastInsertRowid);
}

/** Approve / reject. HR and Admin only. */
export function setLeaveStatus(actor, { leaveId, status }) {
  assertPrivileged(actor, 'leave approvals');
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    throw new ValidationError('Status must be approved, rejected or pending.');
  }
  db.prepare('UPDATE leaves SET status = ? WHERE id = ?').run(status, leaveId);
  return db.prepare('SELECT * FROM leaves WHERE id = ?').get(leaveId);
}

export { daysBetweenInclusive };
