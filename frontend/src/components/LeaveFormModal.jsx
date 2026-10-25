import { useState } from 'react';
import { api } from '../api.js';

/**
 * The leave form. When the AI pre-filled it, `aiFilled` is true and the values
 * are shown with an "AI-generated" badge -- the employee still has to review
 * and press Submit. The AI never writes the request itself.
 */
export default function LeaveFormModal({ initial, aiFilled, aiNote, onClose, onSaved }) {
  const [type, setType] = useState(initial?.type || 'casual');
  const [startDate, setStartDate] = useState(initial?.start_date || '');
  const [endDate, setEndDate] = useState(initial?.end_date || '');
  const [reason, setReason] = useState(initial?.reason || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createLeave({ type, startDate, endDate, reason });
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Request leave</h2>
        {aiFilled ? (
          <div className="sub">
            <span className="ai-badge">AI-generated</span>{' '}
            Pre-filled from your message. Check it and submit.
          </div>
        ) : (
          <div className="sub">Fill in the details below.</div>
        )}

        {aiNote && <div className="muted-note" style={{ marginTop: 8 }}>⚠ {aiNote}</div>}

        <form onSubmit={submit}>
          <div className="fields">
            {error && <div className="error-box">{error}</div>}
            <div>
              <label htmlFor="lv-type">Leave type</label>
              <select id="lv-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="casual">Casual</option>
                <option value="sick">Sick</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div className="row">
              <div>
                <label htmlFor="lv-start">Start date</label>
                <input id="lv-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div>
                <label htmlFor="lv-end">End date</label>
                <input id="lv-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
              </div>
            </div>
            <div>
              <label htmlFor="lv-reason">Reason</label>
              <input id="lv-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Short reason" />
            </div>
          </div>

          <div className="actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
