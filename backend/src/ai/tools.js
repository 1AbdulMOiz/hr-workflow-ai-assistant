import { getAttendanceSummary, getLateComers } from '../services/attendanceService.js';
import { getHeadcount, searchEmployees } from '../services/employeeService.js';
import { getLeaveBalance, getLeaveSummary } from '../services/leaveService.js';
import { getPayrollSummary, getMyPayroll } from '../services/payrollService.js';
import { isPrivileged } from '../services/permissions.js';

/**
 * The tool surface of the AI Assistant.
 *
 * Every handler calls the SAME service function the REST API calls, with the
 * SAME actor. The model has no other way to reach data -- it cannot query the
 * database, and it cannot widen its own scope, because the permission checks
 * live inside the services.
 */

// Groq follows the OpenAI function-calling schema. Every property is listed in
// `required` and declared nullable, so "not supplied" comes back as null and is
// stripped in `clean()` below before the service sees it.
const nullableString = (description) => ({ type: ['string', 'null'], description });
const nullableInt = (description) => ({ type: ['integer', 'null'], description });

function tool(name, description, properties) {
  return {
    type: 'function',
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      },
    },
  };
}

export const TOOL_DEFINITIONS = [
  tool(
    'get_headcount',
    'How many employees the company has, optionally filtered by department. Returns the total and a per-department breakdown. Use this for any "how many employees / people / staff" question.',
    {
      department: nullableString('Department name, e.g. "Engineering". Null for the whole company.'),
      status: nullableString('"active" (default), "inactive", or "all". Null means active.'),
    }
  ),

  tool(
    'get_attendance_summary',
    'Present, late, absent and leave day counts plus the attendance rate for a month. HR and Admin get company or department figures; an employee always gets only their own.',
    {
      month: nullableString('Month as YYYY-MM. Null means the current month.'),
      department: nullableString('Department name. Null for the whole company.'),
      employee_id: nullableInt('A specific employee id (HR/Admin only). Null for everyone in scope.'),
    }
  ),

  tool(
    'get_late_comers',
    'Ranked list of the employees with the most late arrivals in a month. HR and Admin only. Use this for "who came late most often" questions.',
    {
      month: nullableString('Month as YYYY-MM. Null means the current month.'),
      department: nullableString('Department name. Null for the whole company.'),
      limit: nullableInt('How many people to return. Null means 5.'),
    }
  ),

  tool(
    'get_leave_summary',
    'Company-wide leave statistics for a year: requests and days by type and status, plus how many requests are pending. HR and Admin only.',
    {
      year: nullableInt('Calendar year. Null means the current year.'),
      department: nullableString('Department name. Null for the whole company.'),
      status: nullableString('"pending", "approved" or "rejected". Null for all.'),
    }
  ),

  tool(
    'get_my_leave_balance',
    'Leave balance per type (allocated, used, pending, remaining) for one employee. Use this for "how many sick/casual/annual leaves do I have left". An employee always gets their own; HR and Admin may pass another employee id.',
    {
      year: nullableInt('Calendar year. Null means the current year.'),
      employee_id: nullableInt('Another employee id (HR/Admin only). Null means the person asking.'),
    }
  ),

  tool(
    'get_payroll_summary',
    'Payroll totals for a month: total net, average net salary and a per-department breakdown. HR and Admin only. An employee calling this gets their own payslips instead.',
    {
      month: nullableString('Month as YYYY-MM. Null means the current month.'),
      department: nullableString('Department name. Null for the whole company.'),
    }
  ),

  tool(
    'search_employees',
    'Find employees by name, job title or department. Returns name, department and job title; salary and contact details are included only for HR and Admin.',
    {
      query: nullableString('Part of a name or job title. Null to list everyone in scope.'),
      department: nullableString('Department name. Null for the whole company.'),
      limit: nullableInt('Maximum rows to return. Null means 20.'),
    }
  ),
];

// Null means "not supplied" -- strip it so service defaults apply.
const clean = (input) =>
  Object.fromEntries(Object.entries(input || {}).filter(([, v]) => v !== null && v !== undefined));

const HANDLERS = {
  get_headcount: (actor, a) => getHeadcount(actor, a),

  get_attendance_summary: (actor, a) =>
    getAttendanceSummary(actor, { month: a.month, department: a.department, employeeId: a.employee_id }),

  get_late_comers: (actor, a) => getLateComers(actor, a),

  get_leave_summary: (actor, a) => getLeaveSummary(actor, a),

  get_my_leave_balance: (actor, a) => getLeaveBalance(actor, { year: a.year, employeeId: a.employee_id }),

  get_payroll_summary: (actor, a) =>
    // An employee may still see their own payslips; the service refuses anyone else's.
    isPrivileged(actor) ? getPayrollSummary(actor, a) : getMyPayroll(actor, { month: a.month }),

  search_employees: (actor, a) => searchEmployees(actor, a),
};

/**
 * Run one tool call. A permission failure is returned as an error result, not
 * thrown -- the model needs to see it so it can refuse politely in its own words.
 */
export function runTool(actor, name, rawInput) {
  const handler = HANDLERS[name];
  if (!handler) {
    return { isError: true, content: `Unknown tool: ${name}` };
  }
  try {
    const result = handler(actor, clean(rawInput));
    return { isError: false, content: JSON.stringify(result) };
  } catch (err) {
    return { isError: true, content: err.message || 'Tool failed.' };
  }
}
