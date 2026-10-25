import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Employees({ user }) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState(null);

  const isStaff = user.role === 'admin' || user.role === 'hr';

  useEffect(() => {
    api.departments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.employees({ query, department, limit: 100 })
        .then((r) => setRows(r.employees))
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [query, department]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Employees</h1>
          <div className="sub">
            {isStaff ? 'Full directory' : 'Names, departments and job titles only'}
          </div>
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <div>
            <label htmlFor="emp-q">Search</label>
            <input id="emp-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or job title" />
          </div>
          <div>
            <label htmlFor="emp-dept">Department</label>
            <select id="emp-dept" value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Job title</th>
              {isStaff && <th>Email</th>}
              {isStaff && <th>Salary</th>}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="muted-note">No employees found.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id}>
                <td>{e.name}</td>
                <td>{e.department}</td>
                <td>{e.job_title}</td>
                {isStaff && <td>{e.email}</td>}
                {isStaff && <td>PKR {Number(e.salary).toLocaleString()}</td>}
                <td><span className={`pill ${e.status === 'active' ? 'ok' : ''}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isStaff && (
          <div className="muted-note" style={{ marginTop: 12 }}>
            Salary and contact details are confidential and visible to HR and Admin only.
          </div>
        )}
      </div>
    </>
  );
}
