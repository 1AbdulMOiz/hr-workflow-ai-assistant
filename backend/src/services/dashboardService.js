import { getAttendanceSummary, getLateComers } from './attendanceService.js';
import { getHeadcount } from './employeeService.js';
import { getLeaveBalance, getLeaveSummary, listLeaves } from './leaveService.js';
import { getPayrollSummary } from './payrollService.js';
import { currentMonth, isPrivileged } from './permissions.js';

/**
 * The KPI block the dashboard renders. The AI "Summarize" button is handed
 * exactly this object and may not introduce any number that is not in it --
 * that is how the assistant and the dashboard stay in sync.
 */
export function getDashboardKpis(actor, { month = null, department = null } = {}) {
  const m = month || currentMonth();
  const attendance = getAttendanceSummary(actor, { month: m, department });

  if (!isPrivileged(actor)) {
    // Employee dashboard: own attendance + own leave balance.
    const balance = getLeaveBalance(actor, {});
    const myLeaves = listLeaves(actor, { limit: 5 });
    return {
      role: actor.role,
      month: m,
      department: department || 'all',
      myAttendanceRate: attendance.attendanceRate,
      myPresentDays: attendance.present,
      myLateDays: attendance.late,
      myAbsentDays: attendance.absent,
      myLeaveBalances: balance.balances,
      myRecentLeaves: myLeaves,
    };
  }

  const headcount = getHeadcount(actor, { department, status: 'active' });
  const leaves = getLeaveSummary(actor, { department });
  const payroll = getPayrollSummary(actor, { month: m, department });
  const late = getLateComers(actor, { month: m, department, limit: 3 });

  return {
    role: actor.role,
    month: m,
    department: department || 'all',
    activeEmployees: headcount.total,
    headcountByDepartment: headcount.byDepartment,
    attendanceRate: attendance.attendanceRate,
    presentRecords: attendance.present,
    lateRecords: attendance.late,
    absentRecords: attendance.absent,
    pendingLeaveRequests: leaves.pendingRequests,
    leaveDaysTakenThisYear: leaves.totals.days,
    monthlyPayrollNet: payroll.total_net,
    averageNetSalary: payroll.average_net,
    topLateComers: late.lateComers,
  };
}
