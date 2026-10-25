// Thin fetch wrapper. The JWT goes on every request; the AI key never touches
// the browser -- all AI calls go to our own backend.

const TOKEN_KEY = 'hr_token';
const USER_KEY = 'hr_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
};

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const qs = (params = {}) => {
  const clean = Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== '');
  return clean.length ? `?${new URLSearchParams(clean)}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),

  dashboard: (params) => request(`/dashboard/kpis${qs(params)}`),
  departments: () => request('/departments'),

  employees: (params) => request(`/employees${qs(params)}`),
  headcount: (params) => request(`/employees/headcount${qs(params)}`),

  attendance: (params) => request(`/attendance${qs(params)}`),
  attendanceSummary: (params) => request(`/attendance/summary${qs(params)}`),
  lateComers: (params) => request(`/attendance/late-comers${qs(params)}`),

  leaves: (params) => request(`/leaves${qs(params)}`),
  leaveBalance: (params) => request(`/leaves/balance${qs(params)}`),
  createLeave: (body) => request('/leaves', { method: 'POST', body }),
  setLeaveStatus: (id, status) => request(`/leaves/${id}`, { method: 'PATCH', body: { status } }),

  payrollSummary: (params) => request(`/payroll/summary${qs(params)}`),
  myPayroll: (params) => request(`/payroll/me${qs(params)}`),

  // --- AI assistant (M8) ---
  aiStatus: () => request('/ai/status'),
  aiChat: (message, history) => request('/ai/chat', { method: 'POST', body: { message, history } }),
  aiSummarize: (params) => request('/ai/summarize', { method: 'POST', body: params || {} }),
  aiSmartLeave: (message) => request('/ai/smart-leave', { method: 'POST', body: { message } }),
  aiLogs: () => request('/ai/logs'),
};
