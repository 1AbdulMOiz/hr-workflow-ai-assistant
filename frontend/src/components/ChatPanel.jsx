import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

const SUGGESTIONS = {
  admin: [
    'How many active employees are in Engineering?',
    'Who came late most often this month?',
    "What is this month's attendance rate?",
    'What is the total payroll this month?',
  ],
  hr: [
    'How many active employees are in Engineering?',
    'Who came late most often this month?',
    "What is this month's attendance rate?",
    'How many leave requests are pending?',
  ],
  employee: [
    'How many sick leaves do I have left this year?',
    'What is my attendance rate this month?',
    'How many days of annual leave can I still take?',
    'What is the leave policy for sick leave?',
  ],
};

export default function ChatPanel({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (open) api.aiStatus().then(setStatus).catch(() => setStatus({ enabled: false }));
  }, [open]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, busy]);

  async function send(text) {
    const question = (text ?? input).trim();
    if (!question || busy) return;

    setInput('');
    setBusy(true);
    const nextMessages = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);

    // Only plain text turns are sent back as history.
    const history = nextMessages
      .filter((m) => !m.error)
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await api.aiChat(question, history);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.answer, tools: res.toolsUsed, status: res.status },
      ]);
      api.aiStatus().then(setStatus).catch(() => {});
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: err.message, error: true }]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="chat-fab primary" onClick={() => setOpen(true)}>
        ✨ Ask HR Assistant
      </button>
    );
  }

  const suggestions = SUGGESTIONS[user.role] || SUGGESTIONS.employee;

  return (
    <aside className="chat-panel" role="dialog" aria-label="HR Assistant">
      <div className="chat-head">
        <div className="head-left">
          <div className="spark">✦</div>
          <div>
            <div className="title">HR Assistant</div>
            <div className="meta">
              {status?.enabled === false
                ? 'Not configured on the server'
                : `Answers from your data · ${status ? `${status.remaining}/${status.limit} left this hour` : '…'}`}
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close assistant">✕</button>
      </div>

      <div className="chat-body" ref={bodyRef}>
        {messages.length === 0 && (
          <>
            <div className="msg bot">
              Hi {user.name.split(' ')[0]} — ask me about attendance, leaves or company policy.
              I only answer from your HR records.
            </div>
            <div className="suggestions">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div className="msg user" key={i}>{m.content}</div>
          ) : (
            <div key={i}>
              <div className={`msg ${m.error ? 'err' : 'bot'}`}>{m.content}</div>
              {!m.error && (
                <div className="msg-meta">
                  <span className="ai-badge">AI-generated</span>
                  {m.tools?.length > 0 && m.tools.map((t, j) => (
                    <span className="tool-chip" key={j}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {busy && (
          <div className="msg bot">
            <span className="typing"><span></span><span></span><span></span></span>
          </div>
        )}
      </div>

      <form
        className="chat-foot"
        onSubmit={(e) => { e.preventDefault(); send(); }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder="Ask a question…"
          aria-label="Your question"
          disabled={busy}
        />
        <button className="primary" type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
    </aside>
  );
}
