'use client';
import { useEffect, useState } from 'react';

function gradeFor(total) {
  if (total >= 70) return 'A';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 45) return 'D';
  return 'F';
}

export default function StudentDashboard({ student }) {
  const [tab, setTab] = useState('overview');
  const balance = (student.total_fee || 0) - (student.paid || 0);

  return (
    <div>
      <div className="tabs">
        {[
          ['overview', 'Overview'], ['attendance', 'Attendance'], ['fees', 'Fees & Payments'],
          ['results', 'Report Card'], ['subjects', 'My Subjects'], ['timetable', 'Timetable'],
          ['ai', 'Ask AI Tutor'], ['notices', 'Notices'],
        ].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid g3">
          <div className="card stat-card"><div className="label">Category</div><div className="value" style={{ fontSize: 18 }}>{student.category || '—'}</div></div>
          <div className="card stat-card"><div className="label">Fee balance</div><div className="value">₦{balance.toLocaleString()}</div></div>
          <div className="card stat-card"><div className="label">Admission No.</div><div className="value" style={{ fontSize: 18 }}>{student.admission_no || '—'}</div></div>
        </div>
      )}
      {tab === 'attendance' && <AttendanceView studentId={student.id} />}
      {tab === 'fees' && <FeesView student={student} balance={balance} />}
      {tab === 'results' && <ReportCardView studentId={student.id} category={student.category} />}
      {tab === 'subjects' && <SubjectsView category={student.category} />}
      {tab === 'timetable' && <TimetableView />}
      {tab === 'ai' && <AiTutorView />}
      {tab === 'notices' && <NoticesView />}
    </div>
  );
}

function AttendanceView({ studentId }) {
  const [records, setRecords] = useState(null);
  useEffect(() => { fetch(`/api/attendance?studentId=${studentId}`).then((r) => r.json()).then((d) => setRecords(d.records || [])); }, [studentId]);
  if (records === null) return <div className="card empty-note">Loading…</div>;
  const present = records.filter((r) => r.status === 'present').length;
  const pct = records.length ? Math.round((present / records.length) * 100) : 0;
  return (
    <div>
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card stat-card"><div className="label">Days present</div><div className="value">{present}</div></div>
        <div className="card stat-card"><div className="label">Days recorded</div><div className="value">{records.length}</div></div>
        <div className="card stat-card"><div className="label">Attendance rate</div><div className="value">{pct}%</div></div>
      </div>
      <div className="card">
        {!records.length ? <div className="empty-note">No attendance recorded yet.</div> : (
          <table>
            <thead><tr><th>Date</th><th>Status</th></tr></thead>
            <tbody>{records.map((r, i) => <tr key={i}><td>{r.date}</td><td><span className={`tag ${r.status === 'present' ? 'tag-success' : 'tag-danger'}`}>{r.status}</span></td></tr>)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FeesView({ student, balance }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function pay(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await fetch('/api/payments/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount) }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || 'Could not start payment.'); return; }
    window.location.href = data.authorization_url; // hands off to Paystack's real checkout
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Make a payment</div>
        {balance <= 0 ? <div className="notice">You have no outstanding balance. 🎉</div> : (
          <form onSubmit={pay}>
            {error && <div className="error-msg">{error}</div>}
            <div className="field">
              <label>Amount (₦, up to ₦{balance.toLocaleString()})</label>
              <input type="number" min="1" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <button className="btn btn-gold" style={{ width: '100%', padding: 11 }} disabled={loading}>
              {loading ? 'Starting payment…' : 'Pay with Paystack'}
            </button>
          </form>
        )}
        <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 12 }}>
          You'll be taken to Paystack's secure checkout. Your balance updates once Paystack confirms the payment.
        </p>
      </div>
      <div className="card stat-card">
        <div className="label">Current balance</div>
        <div className="value" style={{ color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>₦{balance.toLocaleString()}</div>
      </div>
    </div>
  );
}

function ReportCardView({ studentId, category }) {
  const [subjects, setSubjects] = useState(null);
  const [results, setResults] = useState({});
  useEffect(() => {
    if (!category) { setSubjects([]); return; }
    fetch('/api/subjects').then((r) => r.json()).then((d) => setSubjects((d.subjects?.[category] || []).map((s) => s.name)));
    fetch(`/api/results?studentId=${studentId}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.results || []).forEach((r) => { m[r.subject] = r; });
      setResults(m);
    });
  }, [studentId, category]);

  if (subjects === null) return <div className="card empty-note">Loading…</div>;
  if (!subjects.length) return <div className="card empty-note">{category ? 'No subjects set up for your category yet.' : 'No study category assigned yet.'}</div>;

  const rows = subjects.map((s) => {
    const r = results[s];
    const hasScore = r && r.ca != null && r.exam != null;
    const total = hasScore ? Number(r.ca) + Number(r.exam) : null;
    return { subject: s, ca: r?.ca, exam: r?.exam, total, grade: hasScore ? gradeFor(total) : null };
  });
  const scored = rows.filter((r) => r.total != null);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + r.total, 0) / scored.length) : null;

  return (
    <div className="card">
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>Termly Report Card</div>
        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print / Save as PDF</button>
      </div>
      <table>
        <thead><tr><th>Subject</th><th>CA (/40)</th><th>Exam (/60)</th><th>Total</th><th>Grade</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.subject}>
              <td>{r.subject}</td><td className="mono">{r.ca ?? '—'}</td><td className="mono">{r.exam ?? '—'}</td>
              <td className="mono">{r.total ?? '—'}</td>
              <td>{r.grade ? <span className={`grade-badge grade-${r.grade}`}>{r.grade}</span> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid g3" style={{ marginTop: 16 }}>
        <div className="card stat-card"><div className="label">Subjects scored</div><div className="value">{scored.length}/{rows.length}</div></div>
        <div className="card stat-card"><div className="label">Average</div><div className="value">{avg != null ? avg + '%' : '—'}</div></div>
        <div className="card stat-card"><div className="label">Overall grade</div><div className="value">{avg != null ? gradeFor(avg) : '—'}</div></div>
      </div>
    </div>
  );
}

function SubjectsView({ category }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!category) { setList([]); return; }
    fetch('/api/subjects').then((r) => r.json()).then((d) => setList(d.subjects?.[category] || []));
  }, [category]);
  if (list === null) return <div className="card empty-note">Loading…</div>;
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>Subjects — {category || 'No category set'}</div>
      {!list.length ? <div className="empty-note">No subjects added yet.</div> : (
        <table><thead><tr><th>#</th><th>Subject</th></tr></thead>
          <tbody>{list.map((s, i) => <tr key={s.id}><td className="mono">{i + 1}</td><td>{s.name}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function TimetableView() {
  const [entries, setEntries] = useState(null);
  useEffect(() => { fetch('/api/timetable').then((r) => r.json()).then((d) => setEntries(d.entries || [])); }, []);
  if (entries === null) return <div className="card empty-note">Loading…</div>;
  if (!entries.length) return <div className="card empty-note">No timetable has been set up for your class yet.</div>;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  return (
    <div className="card">
      {days.map((day) => {
        const dayEntries = entries.filter((e) => e.day_of_week === day);
        if (!dayEntries.length) return null;
        return (
          <div key={day} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{day}</div>
            <table><thead><tr><th>Period</th><th>Subject</th><th>Teacher</th></tr></thead>
              <tbody>{dayEntries.map((e) => <tr key={e.id}><td className="mono">{e.period_label}</td><td>{e.subject}</td><td>{e.teacher_name || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function AiTutorView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const newMessages = [...messages, { role: 'user', content: input }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    const res = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessages[newMessages.length - 1].content, history: messages }),
    });
    const data = await res.json();
    setLoading(false);
    setMessages([...newMessages, { role: 'assistant', content: data.reply || data.error || 'Something went wrong.' }]);
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 10 }}>🤖 AI Study Assistant</div>
      <div className="chat-log">
        {!messages.length && <div className="empty-note">Ask me anything about your subjects.</div>}
        {messages.map((m, i) => <div key={i} className={`msg ${m.role === 'user' ? 'msg-user' : 'msg-ai'}`} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start' }}>{m.content}</div>)}
        {loading && <div className="msg msg-ai">Thinking…</div>}
      </div>
      <form className="chat-input-row" onSubmit={send}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={loading} />
        <button className="btn btn-gold" disabled={loading}>Send</button>
      </form>
    </div>
  );
}

function NoticesView() {
  const [list, setList] = useState(null);
  useEffect(() => { fetch('/api/announcements').then((r) => r.json()).then((d) => setList(d.announcements || [])); }, []);
  if (list === null) return <div className="card empty-note">Loading…</div>;
  return (
    <div className="card">
      {!list.length ? <div className="empty-note">No notices yet.</div> : list.map((a) => (
        <div className="notice" key={a.id}><div>{a.text}</div><div className="meta">{new Date(a.created_at).toLocaleDateString()} · {a.author}</div></div>
      ))}
    </div>
  );
}
