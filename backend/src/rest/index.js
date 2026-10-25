import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import { authenticate, handle, signToken } from '../middleware/auth.js';

import { getHeadcount, searchEmployees, getEmployee, listDepartments } from '../services/employeeService.js';
import { getAttendanceSummary, getLateComers, listAttendance } from '../services/attendanceService.js';
import {
  createLeave,
  getLeaveBalance,
  getLeaveSummary,
  listLeaves,
  setLeaveStatus,
} from '../services/leaveService.js';
import { getMyPayroll, getPayrollSummary } from '../services/payrollService.js';
import { getDashboardKpis } from '../services/dashboardService.js';

const router = Router();

// ---- auth -----------------------------------------------------------------

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM employees WHERE email = ?').get(String(email || '').toLowerCase());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  const { password_hash, ...safe } = user;
  res.json({ token: signToken(user), user: safe });
});

router.get('/auth/me', authenticate, (req, res) => res.json(req.actor));

// Everything below needs a logged-in user.
router.use(authenticate);

// ---- employees ------------------------------------------------------------

router.get('/employees', handle((req) => searchEmployees(req.actor, req.query)));
router.get('/employees/headcount', handle((req) => getHeadcount(req.actor, req.query)));
router.get('/employees/:id', handle((req) => getEmployee(req.actor, req.params.id)));
router.get('/departments', handle(() => listDepartments()));

// ---- attendance -----------------------------------------------------------

router.get('/attendance', handle((req) => listAttendance(req.actor, req.query)));
router.get('/attendance/summary', handle((req) => getAttendanceSummary(req.actor, req.query)));
router.get('/attendance/late-comers', handle((req) => getLateComers(req.actor, req.query)));

// ---- leaves ---------------------------------------------------------------

router.get('/leaves', handle((req) => listLeaves(req.actor, req.query)));
router.get('/leaves/balance', handle((req) => getLeaveBalance(req.actor, req.query)));
router.get('/leaves/summary', handle((req) => getLeaveSummary(req.actor, req.query)));
router.post('/leaves', handle((req) => createLeave(req.actor, req.body)));
router.patch('/leaves/:id', handle((req) => setLeaveStatus(req.actor, { leaveId: req.params.id, status: req.body.status })));

// ---- payroll --------------------------------------------------------------

router.get('/payroll/summary', handle((req) => getPayrollSummary(req.actor, req.query)));
router.get('/payroll/me', handle((req) => getMyPayroll(req.actor, req.query)));

// ---- dashboard ------------------------------------------------------------

router.get('/dashboard/kpis', handle((req) => getDashboardKpis(req.actor, req.query)));

export default router;
