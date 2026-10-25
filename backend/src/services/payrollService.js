import db from '../db/index.js';
import { assertPrivileged, currentMonth, resolveTargetEmployee } from './permissions.js';

/**
 * Payroll totals for a month. Salary data across employees is HR/Admin only --
 * this is the check that makes the assistant refuse "what is X's salary?".
 */
export function getPayrollSummary(actor, { month = null, department = null } = {}) {
  assertPrivileged(actor, 'company payroll figures');
  const m = month || currentMonth();

  const where = ['p.month = ?'];
  const params = [m];
  if (department) {
    where.push('LOWER(d.name) = LOWER(?)');
    params.push(department);
  }

  const totals = db
    .prepare(
      `SELECT COUNT(*) AS employees,
              COALESCE(SUM(p.base), 0)       AS total_base,
              COALESCE(SUM(p.allowances), 0) AS total_allowances,
              COALESCE(SUM(p.deductions), 0) AS total_deductions,
              COALESCE(SUM(p.net), 0)        AS total_net,
              COALESCE(AVG(p.net), 0)        AS average_net
       FROM payroll p
       JOIN employees e ON e.id = p.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')}`
    )
    .get(...params);

  const byDepartment = db
    .prepare(
      `SELECT d.name AS department, COUNT(*) AS employees, COALESCE(SUM(p.net), 0) AS total_net
       FROM payroll p
       JOIN employees e ON e.id = p.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE ${where.join(' AND ')}
       GROUP BY d.name ORDER BY total_net DESC`
    )
    .all(...params);

  return {
    month: m,
    department: department || 'all',
    ...totals,
    average_net: Math.round(totals.average_net),
    byDepartment,
  };
}

/** A single employee's payslips. Employees are pinned to their own. */
export function getMyPayroll(actor, { employeeId = null, month = null } = {}) {
  const id = resolveTargetEmployee(actor, employeeId);
  const where = ['p.employee_id = ?'];
  const params = [id];
  if (month) {
    where.push('p.month = ?');
    params.push(month);
  }

  const payslips = db
    .prepare(
      `SELECT p.month, p.base, p.allowances, p.deductions, p.net
       FROM payroll p
       WHERE ${where.join(' AND ')}
       ORDER BY p.month DESC LIMIT 12`
    )
    .all(...params);

  const employee = db.prepare('SELECT name FROM employees WHERE id = ?').get(id);
  return { employee_id: id, employee_name: employee?.name, payslips };
}
