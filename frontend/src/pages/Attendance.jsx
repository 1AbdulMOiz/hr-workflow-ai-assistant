import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Attendance({ user }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [late, setLate] = useState(null);
  const [error, setError] = useState(null);

  const isStaff = user.role === 'admin' || user.role === 'hr';

  useEffect(() => {
    Promise.all([api.attendanceSummary(), api.attendance()])
      .then(([s, r]) => { setSummary(s); setRows(r); })
      .catch((e) => setError(e.message));

    if (isStaff) api.lateComers({ limit: 10 }).then(setLate).catch(() => {});
  }, [isStaff]);

  if (error) return <div className="error-box">{error}</div>;
  if (!summary) return <div className="sub">Loading…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Attendance</h1>
          <div className="sub">{summary.month} · {isStaff ? 'all employees' : 'your record'}</div>
        </div>
      </div>

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Attendance rate" value={`${summary.attendanceRate}%`} />
        <Kpi label="Present" value={summary.present} />
        <Kpi label="Late" value={summary.late} />
        <Kpi label="Absent" value={summary.absent} />
      </div>

      {isStaff && late && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Late arrivals this month</h2>
          <table style={{ marginTop: 8 }}>
            <thead><tr><th>Employee</th><th>Department</th><th>Times late</th></tr></thead>
            <tbody>
              {late.lateComers.map((r) => (
                <tr key={r.employee_id}>
                  <td>{r.name}</td>
                  <td>{r.department}</td>
                  <td><span className="pill late">{r.late_count}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <h2>Daily records</h2>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Date</th>
              {isStaff && <th>Employee</th>}
              <th>Check in</th>
              <th>Check out</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 60).map((r) => (
              <tr key={r.id}>
                <td>{r.date}</td>
                {isStaff && <td>{r.name}</td>}
                <td>{r.check_in || '—'}</td>
                <td>{r.check_out || '—'}</td>
                <td><span className={`pill ${r.status}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kpi({ label, value }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
