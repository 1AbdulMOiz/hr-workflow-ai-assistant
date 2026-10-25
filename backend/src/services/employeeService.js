import db from '../db/index.js';
import { NotFoundError } from './errors.js';
import { redactEmployee, resolveTargetEmployee } from './permissions.js';

const BASE_SELECT = `
  SELECT e.id, e.name, e.email, e.role, e.job_title, e.join_date, e.salary, e.status,
         d.name AS department
  FROM employees e
  LEFT JOIN departments d ON d.id = e.department_id
`;

/**
 * How many employees are there (optionally per department / status).
 * Aggregate and non-sensitive, so every role may ask.
 */
export function getHeadcount(actor, { department = null, status = 'active' } = {}) {
  const where = [];
  const params = [];
  if (status && status !== 'all') {
    where.push('e.status = ?');
    params.push(status);
  }
  if (department) {
    where.push('LOWER(d.name) = LOWER(?)');
    params.push(department);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM employees e LEFT JOIN departments d ON d.id = e.department_id ${clause}`
    )
    .get(...params).c;

  const byDepartment = db
    .prepare(
      `SELECT d.name AS department, COUNT(*) AS count
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
       ${clause}
       GROUP BY d.name ORDER BY count DESC`
    )
    .all(...params);

  return { total, status, department: department || 'all', byDepartment };
}

/** Find employees by name / department / job title. Employees see redacted rows. */
export function searchEmployees(actor, { query = null, department = null, status = 'active', limit = 20 } = {}) {
  const where = [];
  const params = [];
  if (query) {
    where.push('(LOWER(e.name) LIKE ? OR LOWER(e.job_title) LIKE ?)');
    const q = `%${String(query).toLowerCase()}%`;
    params.push(q, q);
  }
  if (department) {
    where.push('LOWER(d.name) = LOWER(?)');
    params.push(department);
  }
  if (status && status !== 'all') {
    where.push('e.status = ?');
    params.push(status);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db
    .prepare(`${BASE_SELECT} ${clause} ORDER BY e.name LIMIT ?`)
    .all(...params, Math.min(Number(limit) || 20, 100));

  return { count: rows.length, employees: rows.map((r) => redactEmployee(actor, r)) };
}

export function getEmployee(actor, employeeId) {
  const id = resolveTargetEmployee(actor, employeeId);
  const row = db.prepare(`${BASE_SELECT} WHERE e.id = ?`).get(id);
  if (!row) throw new NotFoundError(`No employee with id ${employeeId}.`);
  // The caller is either privileged or looking at themselves, so no redaction.
  return row;
}

export function listDepartments() {
  return db.prepare('SELECT id, name FROM departments ORDER BY name').all();
}
