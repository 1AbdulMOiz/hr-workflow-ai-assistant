import { Router } from 'express';
import OpenAI from 'openai';
import { aiEnabled, config } from '../config.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getDashboardKpis } from '../services/dashboardService.js';
import { AiTimeoutError, runChat, runDashboardSummary, runSmartLeave } from './chat.js';
import { FALLBACK_MESSAGE, checkRateLimit, logAiCall, recentAiLogs } from './guardrails.js';

const router = Router();
router.use(authenticate);

/** Is the assistant usable, and how many calls has this user got left? */
router.get('/status', (req, res) => {
  const rate = checkRateLimit(req.actor.id);
  res.json({ enabled: aiEnabled(), model: aiEnabled() ? config.ai.model : null, ...rate });
});

/**
 * Wraps an AI handler with the guardrails every endpoint shares:
 * availability, hourly rate limit, timeout fallback, and an ai_logs entry.
 */
function guarded(kind, run) {
  return async (req, res) => {
    const actor = req.actor;
    const question = req.body?.message || `[${kind}]`;
    const started = Date.now();

    if (!aiEnabled()) {
      return res.status(503).json({
        error: 'The AI assistant is not configured on this server.',
        aiGenerated: false,
      });
    }

    const rate = checkRateLimit(actor.id);
    if (!rate.allowed) {
      logAiCall({
        userId: actor.id,
        role: actor.role,
        question,
        toolCalls: [],
        answer: null,
        status: 'rate_limited',
        latencyMs: 0,
      });
      return res.status(429).json({
        error: `You have reached the limit of ${rate.limit} assistant requests per hour. Please try again later.`,
        aiGenerated: false,
      });
    }

    try {
      const { payload, logFields } = await run(req, actor);
      logAiCall({
        userId: actor.id,
        role: actor.role,
        question,
        latencyMs: Date.now() - started,
        ...logFields,
      });
      res.json({ ...payload, aiGenerated: true });
    } catch (err) {
      const timedOut = err instanceof AiTimeoutError || err instanceof OpenAI.APIConnectionTimeoutError;
      if (!timedOut) console.error(`[ai:${kind}]`, err);

      logAiCall({
        userId: actor.id,
        role: actor.role,
        question,
        toolCalls: [],
        answer: null,
        status: timedOut ? 'timeout' : 'error',
        latencyMs: Date.now() - started,
      });

      res.status(timedOut ? 504 : 502).json({
        error: FALLBACK_MESSAGE,
        aiGenerated: false,
      });
    }
  };
}

/** Ask the assistant a question. */
router.post(
  '/chat',
  guarded('chat', async (req, actor) => {
    const message = String(req.body?.message || '').trim();
    if (!message) throw Object.assign(new Error('Message is required.'), { status: 400 });

    // Only plain user/assistant text turns are accepted back from the client.
    const history = Array.isArray(req.body?.history)
      ? req.body.history
          .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m?.content === 'string')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const result = await runChat(actor, message, history);
    return {
      payload: { answer: result.answer, toolsUsed: result.toolsUsed.map((t) => t.name), status: result.status },
      logFields: { toolCalls: result.toolsUsed, answer: result.answer, status: result.status },
    };
  })
);

/** Summarize the dashboard the user is currently looking at. */
router.post(
  '/summarize',
  guarded('summarize', async (req, actor) => {
    // The KPIs are recomputed server-side from the services, so the summary can
    // never be based on numbers the client made up.
    const kpis = getDashboardKpis(actor, {
      month: req.body?.month || null,
      department: req.body?.department || null,
    });
    const result = await runDashboardSummary(actor, kpis);
    return {
      payload: { bullets: result.bullets, kpis, status: result.status },
      logFields: { toolCalls: [{ name: 'get_dashboard_kpis' }], answer: result.bullets.join(' | '), status: result.status },
    };
  })
);

/** Natural language -> pre-filled leave form. Nothing is saved here. */
router.post(
  '/smart-leave',
  guarded('smart-leave', async (req, actor) => {
    const message = String(req.body?.message || '').trim();
    if (!message) throw Object.assign(new Error('Message is required.'), { status: 400 });

    const result = await runSmartLeave(actor, message);
    return {
      payload: {
        draft: result.draft,
        status: result.status,
        problems: result.problems || [],
        // The client must still POST /api/leaves itself after the user confirms.
        requiresConfirmation: true,
      },
      logFields: {
        toolCalls: [{ name: 'smart_leave_draft' }],
        answer: result.draft ? JSON.stringify(result.draft) : null,
        status: result.status,
      },
    };
  })
);

/** Audit trail of every AI call. */
router.get('/logs', requireRole('admin', 'hr'), (req, res) => {
  res.json(recentAiLogs(req.query.limit));
});

export default router;
