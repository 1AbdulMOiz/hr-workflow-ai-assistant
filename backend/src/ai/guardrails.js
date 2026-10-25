import db from '../db/index.js';
import { config } from '../config.js';

/**
 * Guardrails shared by every AI endpoint: a per-user hourly cap and an audit
 * log of every call. The log doubles as the rate-limit counter.
 */

export function checkRateLimit(userId) {
  const { c } = db
    .prepare(
      `SELECT COUNT(*) AS c FROM ai_logs
       WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`
    )
    .get(userId);

  const limit = config.ai.rateLimitPerHour;
  return { allowed: c < limit, used: c, limit, remaining: Math.max(0, limit - c) };
}

export function logAiCall({ userId, role, question, toolCalls, answer, status, latencyMs }) {
  db.prepare(
    `INSERT INTO ai_logs (user_id, role, question, tool_calls, answer, status, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    userId,
    role,
    question ? String(question).slice(0, 2000) : null,
    JSON.stringify(toolCalls || []),
    answer ? String(answer).slice(0, 4000) : null,
    status,
    latencyMs
  );
}

export function recentAiLogs(limit = 50) {
  return db
    .prepare(
      `SELECT l.id, l.user_id, e.name AS user_name, l.role, l.question, l.tool_calls,
              l.answer, l.status, l.latency_ms, l.created_at
       FROM ai_logs l LEFT JOIN employees e ON e.id = l.user_id
       ORDER BY l.id DESC LIMIT ?`
    )
    .all(Math.min(Number(limit) || 50, 200));
}

/** Friendly text shown whenever the assistant cannot answer. */
export const FALLBACK_MESSAGE =
  "I couldn't get an answer just now. Please try again in a moment, or use the dashboard screens for the same numbers.";
