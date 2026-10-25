import { useState } from 'react';
import { api, setSession } from '../api.js';

const DEMO = [
  { role: 'admin', email: 'admin@demo.com' },
  { role: 'hr', email: 'hr@demo.com' },
  { role: 'employee', email: 'danish@demo.com' },
];

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('hr@demo.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, user } = await api.login(email, password);
      setSession(token, user);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="hero-top">
          <span className="logo">◆</span>
          <span>HR Portal</span>
        </div>

        <div className="hero-mid">
          <h2>Your HR data,<br />answered by AI.</h2>
          <p>
            A complete HR management portal with an assistant that answers
            questions strictly from your company's own records — grounded,
            permission-aware, and never guessing.
          </p>
        </div>

        <div className="feat">
          <div><span className="tick">✓</span> Role-based access: admin, HR &amp; employee</div>
          <div><span className="tick">✓</span> AI answers from live data via secure tools</div>
          <div><span className="tick">✓</span> Smart leave requests &amp; dashboard insights</div>
        </div>
      </section>

      <div className="login-form-wrap">
        <div className="card login-card">
          <h1>Welcome back</h1>
          <div className="sub">Sign in to continue to your portal</div>

          <form onSubmit={submit}>
            {error && <div className="error-box">{error}</div>}
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="demo-accounts">
            <div className="lead">Try a demo account (password <code>password123</code>):</div>
            <div className="demo-chips">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => { setEmail(d.email); setPassword('password123'); }}
                >
                  <span className="tag">{d.role}</span>{d.email}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
