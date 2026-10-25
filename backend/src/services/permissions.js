import { ForbiddenError } from './errors.js';

// One place that decides who may see what. The REST routes and the AI tools
// both go through here, so the assistant can never exceed the caller's scope.

export const isPrivileged = (actor) => actor.role === 'admin' || actor.role === 'hr';

/** Company-wide views (late lists, payroll totals, cross-employee leave data). */
export function assertPrivileged(actor, what = 'this information') {
  if (!isPrivileged(actor)) {
    throw new ForbiddenError(
      `Only HR and Admin can view ${what}. You can ask about your own records instead.`
    );
  }
}

/**
 * Resolve which employee a request is really about.
 * Employees are always pinned to themselves; HR/Admin may target anyone.
 */
export function resolveTargetEmployee(actor, requestedId) {
  if (requestedId == null || Number(requestedId) === actor.id) return actor.id;
  if (!isPrivileged(actor)) {
    throw new ForbiddenError(
      "You can only view your own records. Another employee's details are private."
    );
  }
  return Number(requestedId);
}

/** Fields an employee is allowed to see about a colleague. */
export const PUBLIC_EMPLOYEE_FIELDS = ['id', 'name', 'department', 'job_title', 'status'];

export function redactEmployee(actor, row) {
  if (isPrivileged(actor)) return row;
  const out = {};
  for (const f of PUBLIC_EMPLOYEE_FIELDS) out[f] = row[f];
  return out;
}

/** Current month as YYYY-MM. */
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function currentYear() {
  return new Date().getFullYear();
}
