import { useEffect, useState } from 'react';
import { api } from '../api.js';

const money = (n) => (n == null ? '—' : `PKR ${Number(n).toLocaleString()}`);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard({ user }) {
  const [kpis, setKpis] = useState(null);
  const [error, setError] = useState(null);

  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [summarizing, setSummarizing] = useState(false);

  const isStaff = user.role === 'admin' || user.role === 'hr';

  useEffect(() => {
    api.dashboard().then(setKpis).catch((e) => setError(e.message));
  }, []);

  async function summarize() {
    setSummarizing(true);
    setSummaryError(null);
    setSummary(null);
    try {
      const res = await api.aiSummarize({});
      setSummary(res.bullets);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setSummarizing(false);
    }
  }

  if (error) return <div className="error-box">{error}</div>;
  if (!kpis) return <div className="sub">Loading…</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}, {user.name.split(' ')[0]} 👋</h1>
          <div className="sub">
            {isStaff ? 'Company overview' : 'Your records'} · {kpis.month}
          </div>
        </div>
        <button className="primary" onClick={summarize} disabled={summarizing}>
          {summarizing ? 'Summarizing…' : '✨ Summarize'}
        </button>
      </div>

      {(summary || summaryError) && (
        <div className="card" style={{ marginBottom: 16 }}>
          {summaryError ? (
            <div className="error-box">{summaryError}</div>
          ) : (
            <>
              <span className="ai-badge">AI-generated</span>
              <ul className="bullets">
                {summary.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              <div className="muted-note" style={{ marginTop: 10 }}>
                Written from the figures on this page only.
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid kpis" style={{ marginBottom: 16 }}>
        {isStaff ? (
          <>
            <Kpi icon="👥" label="Active employees" value={kpis.activeEmployees} />
            <Kpi icon="📈" label="Attendance rate" value={`${kpis.attendanceRate}%`} hint={`${kpis.presentRecords} present · ${kpis.lateRecords} late · ${kpis.absentRecords} absent`} />
            <Kpi icon="📝" label="Pending leave requests" value={kpis.pendingLeaveRequests} />
            <Kpi icon="💰" label="Monthly payroll" value={money(kpis.monthlyPayrollNet)} hint={`Avg ${money(kpis.averageNetSalary)}`} />
          </>
        ) : (
          <>
            <Kpi icon="📈" label="My attendance rate" value={`${kpis.myAttendanceRate}%`} />
            <Kpi icon="✅" label="Present days" value={kpis.myPresentDays} />
            <Kpi icon="⏰" label="Late days" value={kpis.myLateDays} />
            <Kpi icon="🚫" label="Absent days" value={kpis.myAbsentDays} />
          </>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {isStaff ? (
          <>
            <div className="card">
              <h2>Most late arrivals</h2>
              <div className="sub" style={{ marginBottom: 10 }}>This month</div>
              <table>
                <thead>
                  <tr><th>Employee</th><th>Department</th><th>Late</th></tr>
                </thead>
                <tbody>
                  {kpis.topLateComers.map((r) => (
                    <tr key={r.employee_id}>
                      <td>{r.name}</td>
                      <td>{r.department}</td>
                      <td><span className="pill late">{r.late_count}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>Headcount by department</h2>
              <div className="sub" style={{ marginBottom: 10 }}>Active employees</div>
              <table>
                <thead><tr><th>Department</th><th>Employees</th></tr></thead>
                <tbody>
                  {kpis.headcountByDepartment.map((d) => (
                    <tr key={d.department}><td>{d.department}</td><td>{d.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="card">
              <h2>My leave balance</h2>
              <div className="sub" style={{ marginBottom: 10 }}>This year</div>
              <table>
                <thead><tr><th>Type</th><th>Allocated</th><th>Used</th><th>Remaining</th></tr></thead>
                <tbody>
                  {kpis.myLeaveBalances.map((b) => (
                    <tr key={b.type}>
                      <td style={{ textTransform: 'capitalize' }}>{b.type}</td>
                      <td>{b.allocated}</td>
                      <td>{b.used}</td>
                      <td><strong>{b.remaining}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <h2>My recent leaves</h2>
              <div className="sub" style={{ marginBottom: 10 }}>Latest requests</div>
              {kpis.myRecentLeaves.length === 0 ? (
                <div className="muted-note">No leave requests yet.</div>
              ) : (
                <table>
                  <thead><tr><th>Type</th><th>Dates</th><th>Status</th></tr></thead>
                  <tbody>
                    {kpis.myRecentLeaves.map((l) => (
                      <tr key={l.id}>
                        <td style={{ textTransform: 'capitalize' }}>{l.type}</td>
                        <td>{l.start_date} → {l.end_date}</td>
                        <td><span className={`pill ${l.status}`}>{l.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Kpi({ icon, label, value, hint }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className="label">{label}</div>
        {icon && <div className="icon">{icon}</div>}
      </div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
