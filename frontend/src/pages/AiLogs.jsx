import { useEffect, useState } from 'react';
import { api } from '../api.js';

/** Audit trail -- every assistant call is recorded in ai_logs. */
export default function AiLogs() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.aiLogs().then(setLogs).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error-box">{error}</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>AI Logs</h1>
          <div className="sub">Every assistant request, who asked it, and which tools ran</div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>When</th><th>User</th><th>Role</th><th>Question</th>
              <th>Tools used</th><th>Status</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={7} className="muted-note">No AI calls yet.</td></tr>}
            {logs.map((l) => {
              let tools = [];
              try { tools = JSON.parse(l.tool_calls || '[]'); } catch { /* ignore */ }
              return (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.created_at}</td>
                  <td>{l.user_name}</td>
                  <td style={{ textTransform: 'capitalize' }}>{l.role}</td>
                  <td style={{ maxWidth: 280 }}>{l.question}</td>
                  <td>
                    {tools.length === 0 ? '—' : tools.map((t, i) => (
                      <span className="tool-chip" key={i} style={{ marginRight: 4 }}>{t.name}</span>
                    ))}
                  </td>
                  <td><span className={`pill ${l.status}`}>{l.status}</span></td>
                  <td>{l.latency_ms} ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
