import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import LeaveFormModal from '../components/LeaveFormModal.jsx';

export default function Leaves({ user }) {
  const [balance, setBalance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [error, setError] = useState(null);

  // Smart leave
  const [smartText, setSmartText] = useState('');
  const [smartBusy, setSmartBusy] = useState(false);
  const [smartError, setSmartError] = useState(null);

  // Modal state
  const [modal, setModal] = useState(null); // { initial, aiFilled, aiNote }

  const isStaff = user.role === 'admin' || user.role === 'hr';

  const load = useCallback(() => {
    api.leaves().then(setLeaves).catch((e) => setError(e.message));
    api.leaveBalance().then(setBalance).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function smartFill(e) {
    e.preventDefault();
    if (!smartText.trim()) return;
    setSmartBusy(true);
    setSmartError(null);
    try {
      const res = await api.aiSmartLeave(smartText.trim());
      if (res.draft) {
        setModal({ initial: res.draft, aiFilled: true, aiNote: res.draft.note || null });
      } else {
        // Validation failed twice -> fall back to the normal blank form.
        setModal({ initial: null, aiFilled: false, aiNote: "I couldn't read the dates from that. Please fill the form in yourself." });
      }
    } catch (err) {
      setSmartError(err.message);
    } finally {
      setSmartBusy(false);
    }
  }

  async function decide(id, status) {
    try {
      await api.setLeaveStatus(id, status);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Leaves</h1>
          <div className="sub">{isStaff ? 'All requests' : 'Your requests and balance'}</div>
        </div>
        <button className="primary" onClick={() => setModal({ initial: null, aiFilled: false })}>
          Request leave
        </button>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      {/* --- Smart leave (M8) --- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Smart leave request</h2>
        <div className="sub">
          Describe it in your own words — the assistant fills the form, you confirm it.
        </div>
        <form className="row" style={{ marginTop: 12 }} onSubmit={smartFill}>
          <input
            value={smartText}
            onChange={(e) => setSmartText(e.target.value)}
            placeholder="e.g. I need next Monday and Tuesday off for my sister's wedding"
            aria-label="Describe your leave"
          />
          <button className="primary" type="submit" disabled={smartBusy || !smartText.trim()}>
            {smartBusy ? 'Reading…' : '✨ Pre-fill form'}
          </button>
        </form>
        {smartError && <div className="error-box" style={{ marginTop: 10 }}>{smartError}</div>}
      </div>

      {balance && (
        <div className="grid kpis" style={{ marginBottom: 16 }}>
          {balance.balances.map((b) => (
            <div className="card kpi" key={b.type}>
              <div className="label" style={{ textTransform: 'capitalize' }}>{b.type} leave left</div>
              <div className="value">{b.remaining}</div>
              <div className="hint">{b.used} used of {b.allocated}{b.pending ? ` · ${b.pending} pending` : ''}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Requests</h2>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              {isStaff && <th>Employee</th>}
              <th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th>
              {isStaff && <th></th>}
            </tr>
          </thead>
          <tbody>
            {leaves.length === 0 && (
              <tr><td colSpan={7} className="muted-note">No leave requests.</td></tr>
            )}
            {leaves.map((l) => (
              <tr key={l.id}>
                {isStaff && <td>{l.employee_name}</td>}
                <td style={{ textTransform: 'capitalize' }}>{l.type}</td>
                <td>{l.start_date} → {l.end_date}</td>
                <td>{l.days}</td>
                <td>{l.reason || '—'}</td>
                <td><span className={`pill ${l.status}`}>{l.status}</span></td>
                {isStaff && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {l.status === 'pending' && (
                      <>
                        <button onClick={() => decide(l.id, 'approved')} style={{ padding: '4px 10px', fontSize: 13 }}>Approve</button>{' '}
                        <button onClick={() => decide(l.id, 'rejected')} style={{ padding: '4px 10px', fontSize: 13 }}>Reject</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <LeaveFormModal
          initial={modal.initial}
          aiFilled={modal.aiFilled}
          aiNote={modal.aiNote}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setSmartText(''); load(); }}
        />
      )}
    </>
  );
}
