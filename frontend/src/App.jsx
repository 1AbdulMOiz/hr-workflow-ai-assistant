import { useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { clearSession, getUser } from './api.js';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Attendance from './pages/Attendance.jsx';
import Leaves from './pages/Leaves.jsx';
import Employees from './pages/Employees.jsx';
import AiLogs from './pages/AiLogs.jsx';
import ChatPanel from './components/ChatPanel.jsx';

// Small inline icons keep the sidebar crisp without an icon dependency.
const icons = {
  dashboard: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
  attendance: 'M7 2v2m10-2v2M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4.5 8.5 1.8 1.8 3.2-3.3',
  leaves: 'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2ZM14 3v5h5',
  employees: 'M17 20v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75',
  logs: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 13h6m-6 4h6m-6-8h2',
};

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

export default function App() {
  const [user, setUser] = useState(getUser());

  if (!user) return <Login onLogin={setUser} />;

  return <Shell user={user} onLogout={() => { clearSession(); setUser(null); }} />;
}

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
}

function Shell({ user, onLogout }) {
  const navigate = useNavigate();
  const isStaff = user.role === 'admin' || user.role === 'hr';

  return (
    <>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="logo">◆</span>
            <span>HR Portal</span>
          </div>
          <nav>
            <NavLink to="/" end><Icon name="dashboard" /><span className="lbl">Dashboard</span></NavLink>
            <NavLink to="/attendance"><Icon name="attendance" /><span className="lbl">Attendance</span></NavLink>
            <NavLink to="/leaves"><Icon name="leaves" /><span className="lbl">Leaves</span></NavLink>
            <NavLink to="/employees"><Icon name="employees" /><span className="lbl">Employees</span></NavLink>
            {isStaff && <NavLink to="/ai-logs"><Icon name="logs" /><span className="lbl">AI Logs</span></NavLink>}
          </nav>
          <div className="who">
            <div className="idrow">
              <div className="avatar">{initials(user.name)}</div>
              <div className="meta-txt">
                <div className="name">{user.name}</div>
                <div className="role">{user.role} · {user.department || '—'}</div>
              </div>
            </div>
            <button style={{ marginTop: 12, width: '100%' }} onClick={() => { onLogout(); navigate('/'); }}>
              Sign out
            </button>
          </div>
        </aside>

        <main className="main">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/attendance" element={<Attendance user={user} />} />
            <Route path="/leaves" element={<Leaves user={user} />} />
            <Route path="/employees" element={<Employees user={user} />} />
            <Route path="/ai-logs" element={isStaff ? <AiLogs /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <ChatPanel user={user} />
    </>
  );
}
