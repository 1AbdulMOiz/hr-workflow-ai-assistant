import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import db, { __dirname } from './index.js';

// ---- helpers --------------------------------------------------------------

// Small deterministic RNG so re-seeding gives stable, realistic data.
let _seed = 42;
function rand() {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function pad(n) {
  return String(n).padStart(2, '0');
}

// "Today" for the demo. Everything (attendance, payroll) is anchored to this.
const TODAY = new Date('2026-10-24');
const YEAR = TODAY.getFullYear();
const MONTH = TODAY.getMonth(); // 0-based
const MONTH_STR = `${YEAR}-${pad(MONTH + 1)}`;

function isoDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---- run schema -----------------------------------------------------------

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);
console.log('✔ schema applied');

// ---- departments ----------------------------------------------------------

const deptNames = ['Engineering', 'Sales', 'Marketing', 'Finance', 'HR', 'IT'];
const insertDept = db.prepare('INSERT INTO departments (name) VALUES (?)');
const deptId = {};
for (const name of deptNames) {
  const info = insertDept.run(name);
  deptId[name] = info.lastInsertRowid;
}
console.log('✔ departments');

// ---- employees ------------------------------------------------------------

const PASSWORD = 'password123'; // same demo password for everyone
const hash = bcrypt.hashSync(PASSWORD, 8);

// lateProne: higher = comes late more often (drives the "late comers" answer).
const employees = [
  { name: 'Ayesha Khan',   email: 'admin@demo.com',    role: 'admin',    dept: 'IT',          title: 'System Admin',       salary: 320000, lateProne: 0.05 },
  { name: 'Bilal Ahmed',   email: 'hr@demo.com',       role: 'hr',       dept: 'HR',          title: 'HR Manager',         salary: 260000, lateProne: 0.05 },
  { name: 'Danish Raza',   email: 'danish@demo.com',   role: 'employee', dept: 'Engineering', title: 'Backend Engineer',   salary: 220000, lateProne: 0.55 },
  { name: 'Sana Malik',    email: 'sana@demo.com',     role: 'employee', dept: 'Engineering', title: 'Frontend Engineer',  salary: 210000, lateProne: 0.10 },
  { name: 'Hamza Sheikh',  email: 'hamza@demo.com',    role: 'employee', dept: 'Engineering', title: 'DevOps Engineer',    salary: 230000, lateProne: 0.30 },
  { name: 'Fatima Noor',   email: 'fatima@demo.com',   role: 'employee', dept: 'Sales',       title: 'Sales Executive',    salary: 150000, lateProne: 0.20 },
  { name: 'Usman Tariq',   email: 'usman@demo.com',    role: 'employee', dept: 'Sales',       title: 'Sales Lead',         salary: 180000, lateProne: 0.40 },
  { name: 'Zara Iqbal',    email: 'zara@demo.com',     role: 'employee', dept: 'Marketing',   title: 'Marketing Manager',  salary: 190000, lateProne: 0.10 },
  { name: 'Ahmed Qureshi', email: 'ahmed@demo.com',    role: 'employee', dept: 'Marketing',   title: 'Content Strategist', salary: 140000, lateProne: 0.15 },
  { name: 'Nida Aslam',    email: 'nida@demo.com',     role: 'employee', dept: 'Finance',     title: 'Accountant',         salary: 170000, lateProne: 0.08 },
  { name: 'Kamran Shah',   email: 'kamran@demo.com',   role: 'employee', dept: 'Finance',     title: 'Finance Analyst',    salary: 185000, lateProne: 0.12 },
  { name: 'Hira Javed',    email: 'hira@demo.com',     role: 'employee', dept: 'Engineering', title: 'QA Engineer',        salary: 160000, lateProne: 0.25, status: 'inactive' },
];

const insertEmp = db.prepare(`
  INSERT INTO employees (name, email, password_hash, role, department_id, job_title, join_date, salary, status)
  VALUES (@name, @email, @hash, @role, @dept_id, @title, @join_date, @salary, @status)
`);

const empRecords = [];
employees.forEach((e, i) => {
  const joinYear = 2021 + (i % 4);
  const rec = {
    name: e.name,
    email: e.email,
    hash,
    role: e.role,
    dept_id: deptId[e.dept],
    title: e.title,
    join_date: `${joinYear}-0${(i % 9) + 1}-15`,
    salary: e.salary,
    status: e.status || 'active',
  };
  const info = insertEmp.run(rec);
  empRecords.push({ id: info.lastInsertRowid, ...e, status: rec.status });
});
console.log(`✔ ${empRecords.length} employees`);

// ---- attendance for the current month -------------------------------------

const insertAtt = db.prepare(`
  INSERT INTO attendance (employee_id, date, check_in, check_out, status)
  VALUES (?, ?, ?, ?, ?)
`);

// Working days 1..today, skip weekends (Sat=6, Sun=0).
const lateCount = {};
for (const e of empRecords) lateCount[e.id] = 0;

for (let day = 1; day <= TODAY.getDate(); day++) {
  const d = new Date(YEAR, MONTH, day);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) continue; // weekend
  const dateStr = isoDate(d);

  for (const e of empRecords) {
    if (e.status === 'inactive') continue;
    const r = rand();
    let status, checkIn, checkOut;
    if (r < 0.05) {
      status = 'absent';
      checkIn = null;
      checkOut = null;
    } else if (r < 0.05 + e.lateProne) {
      status = 'late';
      checkIn = `${pick(['09', '10'])}:${pad(Math.floor(rand() * 59))}`;
      checkOut = '18:00';
      lateCount[e.id]++;
    } else {
      status = 'present';
      checkIn = `0${pick([8, 9])}:${pad(Math.floor(rand() * 29))}`;
      checkOut = '18:00';
    }
    insertAtt.run(e.id, dateStr, checkIn, checkOut, status);
  }
}
console.log('✔ attendance for', MONTH_STR);

// ---- leave balances + leaves ----------------------------------------------

const insertBal = db.prepare(`
  INSERT INTO leave_balances (employee_id, year, type, allocated) VALUES (?, ?, ?, ?)
`);
const allocation = { casual: 10, sick: 8, annual: 14 };
for (const e of empRecords) {
  for (const [type, allocated] of Object.entries(allocation)) {
    insertBal.run(e.id, YEAR, type, allocated);
  }
}

const insertLeave = db.prepare(`
  INSERT INTO leaves (employee_id, type, start_date, end_date, days, reason, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
// A spread of approved + pending leaves across the year.
const sampleLeaves = [
  { emp: 'danish@demo.com', type: 'sick',   start: '2026-03-10', end: '2026-03-11', days: 2, reason: 'Flu',             status: 'approved' },
  { emp: 'danish@demo.com', type: 'casual', start: '2026-07-01', end: '2026-07-02', days: 2, reason: 'Family event',    status: 'approved' },
  { emp: 'sana@demo.com',   type: 'sick',   start: '2026-05-04', end: '2026-05-04', days: 1, reason: 'Fever',           status: 'approved' },
  { emp: 'sana@demo.com',   type: 'annual', start: '2026-08-10', end: '2026-08-14', days: 5, reason: 'Vacation',        status: 'approved' },
  { emp: 'fatima@demo.com', type: 'sick',   start: '2026-02-18', end: '2026-02-20', days: 3, reason: 'Migraine',        status: 'approved' },
  { emp: 'usman@demo.com',  type: 'casual', start: '2026-09-05', end: '2026-09-05', days: 1, reason: 'Personal',        status: 'approved' },
  { emp: 'zara@demo.com',   type: 'annual', start: '2026-10-28', end: '2026-10-30', days: 3, reason: 'Trip',            status: 'pending' },
  { emp: 'hamza@demo.com',  type: 'sick',   start: '2026-06-01', end: '2026-06-02', days: 2, reason: 'Dental',          status: 'approved' },
  { emp: 'nida@demo.com',   type: 'casual', start: '2026-11-02', end: '2026-11-03', days: 2, reason: 'Wedding',         status: 'pending' },
];
const byEmail = Object.fromEntries(empRecords.map((e) => [e.email, e.id]));
for (const l of sampleLeaves) {
  insertLeave.run(byEmail[l.emp], l.type, l.start, l.end, l.days, l.reason, l.status);
}
console.log('✔ leave balances + leaves');

// ---- payroll (last 3 months) ----------------------------------------------

const insertPay = db.prepare(`
  INSERT INTO payroll (employee_id, month, base, allowances, deductions, net)
  VALUES (?, ?, ?, ?, ?, ?)
`);
for (let back = 2; back >= 0; back--) {
  const d = new Date(YEAR, MONTH - back, 1);
  const m = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  for (const e of empRecords) {
    const base = e.salary;
    const allowances = Math.round(base * 0.1);
    const deductions = Math.round(base * 0.05);
    const net = base + allowances - deductions;
    insertPay.run(e.id, m, base, allowances, deductions, net);
  }
}
console.log('✔ payroll (last 3 months)');

// ---- summary --------------------------------------------------------------

console.log('\n=== SEED COMPLETE ===');
console.log('Login password for EVERY account:', PASSWORD);
console.log('Admin : admin@demo.com');
console.log('HR    : hr@demo.com');
console.log('Staff : danish@demo.com, sana@demo.com, ... (see list)');
const topLate = Object.entries(lateCount).sort((a, b) => b[1] - a[1])[0];
const topLateEmp = empRecords.find((e) => e.id === Number(topLate[0]));
console.log(`Most late this month (for testing): ${topLateEmp.name} (${topLate[1]} times)`);
db.close();
