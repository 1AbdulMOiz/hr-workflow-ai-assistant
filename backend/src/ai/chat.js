import OpenAI from 'openai';
import { config } from '../config.js';
import { buildSmartLeavePrompt, buildSummaryPrompt, buildSystemPrompt } from './prompt.js';
import { TOOL_DEFINITIONS, runTool } from './tools.js';

/**
 * The AI orchestrator.
 *
 * The loop is deliberately explicit: ask the model, run whatever tools it asked
 * for with the caller's own permissions, hand the results back, repeat until it
 * answers. Nothing here reads the database; only tools.js does, through services.
 *
 * Groq exposes an OpenAI-compatible Chat Completions API, so we drive it with
 * the `openai` SDK pointed at Groq's base URL (see config.js).
 */

let client = null;
function getClient() {
  if (!config.ai.apiKey) throw new Error('AI_API_KEY is not configured on the server.');
  if (!client) {
    client = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseUrl,
      timeout: config.ai.timeoutMs,
      maxRetries: 1, // a second retry would blow the 15s budget
    });
  }
  return client;
}

const MAX_TOOL_TURNS = 5;

export class AiTimeoutError extends Error {
  constructor() {
    super('The assistant took too long to respond.');
    this.name = 'AiTimeoutError';
  }
}

/** Remaining milliseconds before the hard deadline, or throw if we are past it. */
function remaining(deadline) {
  const left = deadline - Date.now();
  if (left <= 250) throw new AiTimeoutError();
  return left;
}

const textOf = (message) => (message?.content || '').trim();

/** Parse a tool call's JSON arguments; a malformed string yields no arguments. */
function parseArgs(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

/**
 * Answer a chat question for `actor`.
 * Returns { answer, toolsUsed, status }.
 */
export async function runChat(actor, userMessage, history = []) {
  const deadline = Date.now() + config.ai.timeoutMs;
  const groq = getClient();

  // The system prompt is the first message in the OpenAI/Groq format.
  const messages = [
    { role: 'system', content: buildSystemPrompt(actor) },
    ...history,
    { role: 'user', content: userMessage },
  ];
  const toolsUsed = [];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await groq.chat.completions.create(
      {
        model: config.ai.model,
        max_tokens: 2048,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        messages,
      },
      { timeout: remaining(deadline) }
    );

    const message = response.choices[0].message;

    if (message.tool_calls?.length) {
      // Keep the assistant turn (with its tool_calls) before the tool replies.
      messages.push(message);

      for (const call of message.tool_calls) {
        const args = parseArgs(call.function.arguments);
        const result = runTool(actor, call.function.name, args);
        toolsUsed.push({ name: call.function.name, input: args, error: result.isError });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result.content,
        });
      }
      continue;
    }

    const answer = textOf(message);
    const refused = toolsUsed.some((t) => t.error);
    return {
      answer: answer || "I don't have that information.",
      toolsUsed,
      status: refused ? 'refused' : 'ok',
    };
  }

  return {
    answer:
      "I couldn't finish looking that up. Please try asking it more specifically, for example naming a month or a department.",
    toolsUsed,
    status: 'error',
  };
}

/**
 * Dashboard summary: the model is handed the exact KPI JSON the screen is
 * showing and may not use any number that is not in it.
 */
export async function runDashboardSummary(actor, kpis) {
  const deadline = Date.now() + config.ai.timeoutMs;
  const groq = getClient();

  const response = await groq.chat.completions.create(
    {
      model: config.ai.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: buildSummaryPrompt(actor) },
        {
          role: 'user',
          content: `Here is the dashboard KPI JSON:\n\n${JSON.stringify(kpis, null, 2)}`,
        },
      ],
    },
    { timeout: remaining(deadline) }
  );

  const text = textOf(response.choices[0].message);
  const bullets = text
    .split('\n')
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return { bullets, status: bullets.length ? 'ok' : 'error' };
}

// --- Smart leave -----------------------------------------------------------

const LEAVE_DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['casual', 'sick', 'annual'] },
    start_date: { type: 'string', description: 'YYYY-MM-DD' },
    end_date: { type: 'string', description: 'YYYY-MM-DD' },
    reason: { type: 'string' },
    confidence: { type: 'string', enum: ['high', 'low'] },
    note: { type: 'string' },
  },
  required: ['type', 'start_date', 'end_date', 'reason', 'confidence', 'note'],
  additionalProperties: false,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validate the model's JSON before it is allowed near the form. */
export function validateLeaveDraft(draft) {
  const problems = [];
  if (!draft || typeof draft !== 'object') return ['Response was not an object.'];

  if (!['casual', 'sick', 'annual'].includes(draft.type)) problems.push('Invalid leave type.');
  for (const field of ['start_date', 'end_date']) {
    const v = draft[field];
    if (!ISO_DATE.test(v || '')) {
      problems.push(`${field} is not a YYYY-MM-DD date.`);
    } else if (Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
      problems.push(`${field} is not a real date.`);
    }
  }
  if (!problems.length && draft.end_date < draft.start_date) {
    problems.push('end_date is before start_date.');
  }
  return problems;
}

/**
 * Turn "I need Monday and Tuesday off for my sister's wedding" into form
 * fields. Validated, retried once on failure, and never submitted by the AI --
 * the employee confirms it in the form.
 */
export async function runSmartLeave(actor, userMessage) {
  const deadline = Date.now() + config.ai.timeoutMs;
  const groq = getClient();

  let lastProblems = [];

  for (let attempt = 0; attempt < 2; attempt++) {
    const retryHint = lastProblems.length
      ? `\n\nYour previous answer was rejected: ${lastProblems.join(' ')} Fix it.`
      : '';

    const response = await groq.chat.completions.create(
      {
        model: config.ai.model,
        max_tokens: 1024,
        // Groq's JSON mode guarantees syntactically valid JSON; the prompt
        // describes the exact shape and validateLeaveDraft() enforces it.
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSmartLeavePrompt(actor) },
          { role: 'user', content: userMessage + retryHint },
        ],
      },
      { timeout: remaining(deadline) }
    );

    let draft;
    try {
      draft = JSON.parse(textOf(response.choices[0].message));
    } catch {
      lastProblems = ['Output was not valid JSON.'];
      continue;
    }

    const problems = validateLeaveDraft(draft);
    if (!problems.length) {
      const days =
        Math.round(
          (Date.parse(`${draft.end_date}T00:00:00Z`) - Date.parse(`${draft.start_date}T00:00:00Z`)) /
            86400000
        ) + 1;
      return { draft: { ...draft, days }, status: 'ok' };
    }
    lastProblems = problems;
  }

  // Both attempts failed -> the UI falls back to a blank form.
  return { draft: null, status: 'error', problems: lastProblems };
}
