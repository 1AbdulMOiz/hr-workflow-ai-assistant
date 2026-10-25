import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { config } from '../config.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '12h' });
}

/**
 * Verifies the JWT and attaches req.actor -- the identity every service call
 * is scoped by. The AI assistant reuses the very same req.actor.
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authentication token.' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db
      .prepare(
        `SELECT e.id, e.name, e.email, e.role, e.status, d.name AS department
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id
         WHERE e.id = ?`
      )
      .get(payload.sub);

    if (!user) return res.status(401).json({ error: 'User no longer exists.' });
    req.actor = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.actor.role)) {
      return res.status(403).json({ error: 'Your role cannot perform this action.' });
    }
    next();
  };
}

/** Turns service-layer errors into HTTP responses. */
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong.' });
}

/** Wraps a sync route handler so thrown service errors reach errorHandler. */
export const handle = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res);
    if (result !== undefined) res.json(result);
  } catch (err) {
    next(err);
  }
};
