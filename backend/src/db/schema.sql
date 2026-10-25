-- HR System schema (SQLite). Database is the single source of truth.
-- Both the REST API and the AI Assistant read ONLY through the service layer,
-- which runs these tables. The AI never touches the DB directly.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS ai_logs;
DROP TABLE IF EXISTS payroll;
DROP TABLE IF EXISTS leaves;
DROP TABLE IF EXISTS leave_balances;
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;

CREATE TABLE departments (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE employees (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'hr', 'employee')),
  department_id INTEGER REFERENCES departments(id),
  job_title     TEXT,
  join_date     TEXT NOT NULL,            -- ISO date YYYY-MM-DD
  salary        INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- One row per employee per day.
CREATE TABLE attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  date        TEXT NOT NULL,              -- YYYY-MM-DD
  check_in    TEXT,                       -- HH:MM (null if absent)
  check_out   TEXT,
  status      TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'leave')),
  UNIQUE (employee_id, date)
);

-- Yearly leave allocation per employee per type.
CREATE TABLE leave_balances (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  year        INTEGER NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('casual', 'sick', 'annual')),
  allocated   INTEGER NOT NULL DEFAULT 0,
  UNIQUE (employee_id, year, type)
);

CREATE TABLE leaves (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  type        TEXT NOT NULL CHECK (type IN ('casual', 'sick', 'annual')),
  start_date  TEXT NOT NULL,             -- YYYY-MM-DD
  end_date    TEXT NOT NULL,
  days        INTEGER NOT NULL,
  reason      TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE payroll (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  month       TEXT NOT NULL,             -- YYYY-MM
  base        INTEGER NOT NULL,
  allowances  INTEGER NOT NULL DEFAULT 0,
  deductions  INTEGER NOT NULL DEFAULT 0,
  net         INTEGER NOT NULL,
  UNIQUE (employee_id, month)
);

-- Every AI call is logged here (guardrail requirement).
CREATE TABLE ai_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES employees(id),
  role        TEXT,
  question    TEXT,
  tool_calls  TEXT,                       -- JSON array of tools the model used
  answer      TEXT,
  status      TEXT,                       -- ok | refused | error | rate_limited | timeout
  latency_ms  INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_emp  ON attendance(employee_id);
CREATE INDEX idx_leaves_emp      ON leaves(employee_id);
CREATE INDEX idx_payroll_emp     ON payroll(employee_id);
