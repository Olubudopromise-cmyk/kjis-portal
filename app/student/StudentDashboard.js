'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import TimetableGrid from '../../components/TimetableGrid';
import { NoticesIcon } from '../../components/icons';

function gradeFor(total) {
  if (total >= 70) return 'A';
  if (total >= 60) return 'B';
  if (total >= 50) return 'C';
  if (total >= 45) return 'D';
  return 'F';
}

// Timetable rows are Mon–Fri and period_label is a time range like
// "8:00 - 8:40". Pull the start minute out so we can tell what is genuinely
// next instead of relying on the order the API happens to return.
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function parsePeriodStart(label) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(label || '');
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = (m[3] || '').toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Returns today's index in WEEK_DAYS (0=Mon…4=Fri), or 5/6 for the weekend.
function weekdayIndex(date = new Date()) {
  const jsDay = date.getDay(); // 0=Sun…6=Sat
  return jsDay === 0 ? 6 : jsDay - 1;
}

function pickNextClass(entries, now = new Date()) {
  const todayIdx = weekdayIndex(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const decorated = entries
    .map((entry) => ({ entry, dayIdx: WEEK_DAYS.indexOf(entry.day_of_week), start: parsePeriodStart(entry.period_label) }))
    .filter((d) => d.dayIdx >= 0);

  if (!decorated.length) return entries[0] || null;

  const byDayThenTime = (a, b) =>
    a.dayIdx - b.dayIdx || (a.start ?? 0) - (b.start ?? 0) || String(a.entry.period_label).localeCompare(String(b.entry.period_label));

  // Classes still to come: later this week, or later today (unknown start time
  // counts as still upcoming). If the week is over, wrap to the earliest slot.
  const upcoming = decorated.filter(
    (d) => d.dayIdx > todayIdx || (d.dayIdx === todayIdx && (d.start === null || d.start >= nowMinutes))
  );
  const chosen = (upcoming.length ? upcoming : decorated).slice().sort(byDayThenTime)[0];
  return chosen ? chosen.entry : null;
}

function relativeDay(dayName) {
  const idx = WEEK_DAYS.indexOf(dayName);
  if (idx < 0) return dayName;
  const delta = (idx - weekdayIndex() + 7) % 7;
  if (delta === 0) return 'Today';
  if (delta === 1) return 'Tomorrow';
  return dayName;
}

export default function StudentDashboard({ student }) {
  const [tab, setTab] = useState('overview');
  const [recentNotices, setRecentNotices] = useState([]);
  const [attSummary, setAttSummary] = useState(null);
  const [nextClass, setNextClass] = useState(null);
  const [sowData, setSowData] = useState(null);
  const safeStudent = student || {};
  const balance = (safeStudent.total_fee || 0) - (safeStudent.paid || 0);

  useEffect(() => {
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => setRecentNotices((d.announcements || []).slice(0, 3)))
      .catch(() => setRecentNotices([]));
  }, []);

  // Fetch scheme of work for the "This Week's Focus" card
  useEffect(() => {
    fetch('/api/scheme-of-work')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setSowData(d); })
      .catch(() => {});
  }, []);

  // Fetch attendance summary for overview
  useEffect(() => {
    if (!student?.id) return;
    fetch(`/api/attendance?studentId=${student.id}`)
      .then((r) => r.json())
      .then((d) => {
        const records = d.records || [];
        const present = records.filter((r) => r.status === 'present').length;
        const total = records.length;
        const pct = total ? Math.round((present / total) * 100) : 0;
        setAttSummary({ present, total, pct });
      })
      .catch(() => setAttSummary(null));
  }, [student?.id]);

  // Fetch timetable and find next upcoming class
  useEffect(() => {
    fetch('/api/timetable')
      .then((r) => r.json())
      .then((d) => setNextClass(pickNextClass(d.entries || [])))
      .catch(() => setNextClass(null));
  }, []);

  if (!student) {
    return (
      <div className="portal-content">
        <div className="card empty-note">Loading student data…</div>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        items={[
          { icon: '🏠', label: 'Overview', key: 'overview' },
          { icon: '📋', label: 'Attendance', key: 'attendance' },
          { icon: '💳', label: 'Fees & Payments', key: 'fees' },
          { icon: '📊', label: 'Report Card', key: 'results' },
          { icon: '📚', label: 'My Subjects', key: 'subjects' },
          { icon: '📖', label: 'Scheme of Work', key: 'scheme' },
          { icon: '📅', label: 'Timetable', key: 'timetable' },
          { icon: '🤖', label: 'Ask AI Tutor', key: 'ai' },
          { icon: <NoticesIcon />, label: 'Notices', key: 'notices' },
          { icon: '🚪', label: 'Sign out', key: 'signout', section: 'user' },
        ]}
        activeKey={tab}
        onNavigate={(key) => {
          if (key === 'signout') {
            window.location.href = '/api/auth/logout';
          } else {
            setTab(key);
          }
        }}
      />

      <div className="portal-content">
        {tab === 'overview' && (
          <div>
            {/* Quick stats row */}
            <div className="grid g3" style={{ marginBottom: 20 }}>
              <div className="card stat-card"><div className="label">Category</div><div className="value" style={{ fontSize: 18 }}>{safeStudent.category || '—'}</div></div>
              <div className="card stat-card"><div className="label">Fee balance</div><div className="value">₦{balance.toLocaleString()}</div></div>
              <div className="card stat-card"><div className="label">Admission No.</div><div className="value" style={{ fontSize: 18 }}>{safeStudent.admission_no || '—'}</div></div>
            </div>

            {/* Quick links — a 2x2 grid on mobile, one row on desktop */}
            <div className="quick-links">
              <button className="btn btn-navy btn-sm" onClick={() => setTab('fees')}>💳 Fees</button>
              <button className="btn btn-navy btn-sm" onClick={() => setTab('results')}>📊 Report Card</button>
              <button className="btn btn-navy btn-sm" onClick={() => setTab('timetable')}>📅 Timetable</button>
              <button className="btn btn-navy btn-sm" onClick={() => setTab('attendance')}>📋 Attendance</button>
            </div>

            {sowData && <ThisWeeksFocusCard sowData={sowData} />}

            <div className="grid g3" style={{ marginBottom: 20 }}>
              {/* Attendance summary */}
              <div className="card stat-card">
                <div className="label">Attendance</div>
                {attSummary === null ? (
                  <div className="value" style={{ fontSize: 14, color: 'var(--muted)' }}>Loading…</div>
                ) : attSummary.total === 0 ? (
                  <div className="value" style={{ fontSize: 14, color: 'var(--muted)' }}>No records yet</div>
                ) : (
                  <>
                    <div className="value" style={{ color: attSummary.pct >= 75 ? 'var(--success)' : attSummary.pct >= 50 ? 'var(--gold)' : 'var(--danger)' }}>{attSummary.pct}%</div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{attSummary.present}/{attSummary.total} days present</div>
                  </>
                )}
              </div>

              {/* Next class */}
              <div className="card stat-card" style={{ gridColumn: 'span 2' }}>
                <div className="label">Next Class</div>
                {nextClass ? (
                  <>
                    <div className="value" style={{ fontSize: 18 }}>{nextClass.subject || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      {relativeDay(nextClass.day_of_week)} · {nextClass.period_label || ''}{nextClass.teacher_name ? ` · ${nextClass.teacher_name}` : ''}
                    </div>
                  </>
                ) : (
                  <div className="value" style={{ fontSize: 14, color: 'var(--muted)' }}>No timetable set</div>
                )}
              </div>
            </div>

            {/* Recent notices */}
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 12, color: 'var(--navy)' }}>
                <NoticesIcon size={16} />
                Recent Notices
              </div>
              {!recentNotices.length ? <div className="empty-note">No notices posted yet.</div> : recentNotices.map((a) => (
                <div className="notice" key={a.id}><div>{a.text}</div><div className="meta">{new Date(a.created_at).toLocaleDateString()} · {a.author}</div></div>
              ))}
              {recentNotices.length > 0 && (
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTab('notices')} style={{ fontSize: 12 }}>View all notices →</button>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'attendance' && <AttendanceView studentId={student.id} />}
        {tab === 'fees' && <FeesView student={student} balance={balance} />}
        {tab === 'results' && <ReportCardView studentId={student.id} />}
        {tab === 'subjects' && <SubjectsView />}
        {tab === 'scheme' && <SchemeOfWorkView />}
        {tab === 'timetable' && <TimetableView />}
        {tab === 'ai' && <AiTutorView />}
        {tab === 'notices' && <NoticesView />}
      </div>
    </>
  );
}

// Picks the week row covering the given week number for a subject.
function weekFor(subject, weekNum) {
  if (!subject.weeks.length) return null;
  if (!weekNum) return subject.weeks[0];
  return (
    subject.weeks.find((w) => weekNum >= w.weekStart && weekNum <= w.weekEnd) ||
    subject.weeks[0]
  );
}

function ThisWeeksFocusCard({ sowData }) {
  const [showAll, setShowAll] = useState(false);
  const subjects = sowData.subjects || [];
  if (!subjects.length) return null;

  // English and Mathematics first, then the rest in curriculum order.
  const CORE = ['ENGLISH STUDIES', 'MATHEMATICS'];
  const ordered = subjects.slice().sort((a, b) => {
    const ca = CORE.indexOf(a.subjectKey);
    const cb = CORE.indexOf(b.subjectKey);
    if (ca !== -1 && cb !== -1) return ca - cb;
    if (ca !== -1) return -1;
    if (cb !== -1) return 1;
    return 0;
  });

  const visible = showAll ? ordered : ordered.slice(0, 6);
  const weekNum = sowData.currentWeek;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>This Week's Focus</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {weekNum ? `Week ${weekNum}` : 'Week 1'}{sowData.term ? ` · ${sowData.term}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        {sowData.classLevel ? sowData.classLevel.replace('SSS', 'SS').replace(/^(JSS|SS)(\d)$/, '$1 $2') : ''}
      </div>
      <div className="grid g3">
        {visible.map((s) => {
          const w = weekFor(s, weekNum);
          const topic = w && !w.isBreak ? (w.topics.Topic || '') : '';
          return (
            <div key={s.subjectKey || s.subject} className="card stat-card" style={{ marginBottom: 0 }}>
              <div className="label" style={{ fontSize: 11.5, marginBottom: 4 }}>{s.subject}</div>
              {w?.isBreak ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Break week</div>
              ) : topic ? (
                <div style={{ fontSize: 13.5 }}>{topic}</div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>—</div>
              )}
            </div>
          );
        })}
      </div>
      {ordered.length > 6 && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAll(!showAll)} style={{ fontSize: 12 }}>
            {showAll ? 'Show fewer subjects' : `Show all ${ordered.length} subjects`}
          </button>
        </div>
      )}
    </div>
  );
}

function AttendanceView({ studentId }) {
  const [records, setRecords] = useState(null);
  useEffect(() => {
    fetch(`/api/attendance?studentId=${studentId}`)
      .then((r) => r.json())
      .then((d) => setRecords(d.records || []))
      .catch(() => setRecords([]));
  }, [studentId]);
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
  const [paidBanner, setPaidBanner] = useState(null);
  const [latestPaid, setLatestPaid] = useState(student.paid || 0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paid') !== '1') return;

    let attempts = 0;
    const maxAttempts = 5;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch('/api/students/me');
        const data = await res.json();
        if (data.paid != null && data.paid > latestPaid) {
          clearInterval(interval);
          setLatestPaid(data.paid);
          setPaidBanner('confirmed');
          const next = window.location.pathname + window.location.search.replace(/[?&]*paid=1[^&]*/g, '').replace(/[?]$/, '');
          window.history.replaceState({}, '', next);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaidBanner('timeout');
        }
      } catch {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setPaidBanner('timeout');
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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

  let balanceDisplay = balance;
  if (latestPaid !== student.paid) {
    balanceDisplay = (student.total_fee || 0) - latestPaid;
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {paidBanner === 'confirmed' && (
        <div className="card notice" style={{ border: '1.5px solid var(--success)', background: 'rgba(46, 160, 67, 0.06)', color: 'var(--success)' }}>
          Payment confirmed! Your balance has been updated.
        </div>
      )}
      {paidBanner === 'timeout' && (
        <div className="card notice" style={{ border: '1.5px solid var(--gold)', background: 'rgba(184, 143, 20, 0.06)' }}>
          Still confirming — refresh in a moment if this doesn't update.
        </div>
      )}
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Make a payment</div>
        {balanceDisplay <= 0 ? <div className="notice">You have no outstanding balance. 🎉</div> : (
          <form onSubmit={pay}>
            {error && <div className="error-msg">{error}</div>}
            <div className="field">
              <label>Amount (₦, up to ₦{balanceDisplay.toLocaleString()})</label>
              <input type="number" min="1" max={balanceDisplay} value={amount} onChange={(e) => setAmount(e.target.value)} required />
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
        <div className="value" style={{ color: balanceDisplay > 0 ? 'var(--danger)' : 'var(--success)' }}>₦{balanceDisplay.toLocaleString()}</div>
      </div>
    </div>
  );
}

function ReportCardView({ studentId }) {
  const [subjects, setSubjects] = useState(null);
  // The list the API resolved for this student ('Junior' or a senior stream).
  // This must not come from the `category` prop: that is NULL for junior
  // students, which is exactly what made them see "No study category assigned".
  const [resolvedCategory, setResolvedCategory] = useState(null);
  // Guards against flashing the "no study category" message before the server
  // has had a chance to say a junior student actually does have a list.
  const [categoryResolved, setCategoryResolved] = useState(false);
  const [results, setResults] = useState({});
  const [terms, setTerms] = useState([]);
  const [term, setTerm] = useState('');
  const [rank, setRank] = useState(null);
  const [outOf, setOutOf] = useState(null);
  const [assessments, setAssessments] = useState({});

  useEffect(() => {
    fetch(`/api/results?studentId=${studentId}&listTerms=true`).then((r) => r.json()).then((d) => {
      setTerms(d.terms || []);
      setTerm(d.currentTerm || (d.terms || [])[0] || '');
    }).catch(() => setTerms([]));
  }, [studentId]);

  // Ask the API which subject list applies to this student. The server resolves
  // JSS -> 'Junior' and senior -> their stream, so a junior student (whose
  // users.category is NULL) gets the junior list instead of nothing.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/subjects?studentId=${studentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setResolvedCategory(d.category || null);
        setSubjects(d.subjects || []);
      })
      .catch(() => { if (!cancelled) { setResolvedCategory(null); setSubjects([]); } })
      .finally(() => { if (!cancelled) setCategoryResolved(true); });
    return () => { cancelled = true; };
  }, [studentId]);

  useEffect(() => {
    if (!term) return;
    fetch(`/api/results?studentId=${studentId}&term=${encodeURIComponent(term)}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.results || []).forEach((r) => { m[r.subject] = r; });
      setResults(m);
      setRank(d.rank ?? null);
      setOutOf(d.outOf ?? null);
    });
    fetch(`/api/assessments?studentId=${studentId}&term=${encodeURIComponent(term)}`).then(async (r) => {
      const d = await r.json();
      const m = {};
      (d.assessments || []).forEach((a) => { (m[a.subject] = m[a.subject] || []).push(a); });
      setAssessments(m);
    }).catch(() => setAssessments({}));
  }, [studentId, term]);

  if (subjects === null) return <div className="card empty-note">Loading…</div>;
  if (!categoryResolved) return <div className="card empty-note">Loading…</div>;
  if (!subjects.length) {
    return (
      <div className="card empty-note">
        {resolvedCategory
          ? `No subjects set up yet for ${resolvedCategory === 'Junior' ? 'junior classes' : resolvedCategory}. Ask the school office to add them.`
          : 'No study category assigned yet.'}
      </div>
    );
  }

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
        <div style={{ display: 'flex', gap: 8 }}>
          {terms.length > 1 && (
            <select value={term} onChange={(e) => setTerm(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 7 }}>
              {terms.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print / Save as PDF</button>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>{term}</div>
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
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Test &amp; Exam History</div>
        {subjects.map((s) => {
          const hist = (assessments[s] || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
          if (!hist.length) return null;
          return (
            <div key={s} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: 'var(--muted)' }}>{s}</div>
              <table>
                <thead><tr><th>Label</th><th>Score</th><th>Recorded</th></tr></thead>
                <tbody>
                  {hist.map((a) => (
                    <tr key={a.id}>
                      <td>{a.label}</td>
                      <td className="mono">{Number(a.score)} / {Number(a.max_score)}</td>
                      <td className="mono">{new Date(a.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {!Object.values(assessments).flat().length && (
          <div className="empty-note">No tests or exams recorded yet for your subjects.</div>
        )}
      </div>
      {rank != null && outOf != null && (
        <div className="card notice" style={{ marginTop: 12, background: 'rgba(184, 143, 20, 0.06)', border: '1.5px solid var(--gold)' }}>
          Class Position: {rank}th out of {outOf}
        </div>
      )}
    </div>
  );
}

function SubjectsView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/scheme-of-work')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setData({ subjects: [] }); return; }
        setData(d);
      })
      .catch(() => { setError('Could not load your subjects.'); setData({ subjects: [] }); });
  }, []);
  if (!data) return <div className="card empty-note">Loading…</div>;
  const subjects = data.subjects || [];
  return (
    <div className="card">
      <div style={{ fontWeight: 700, marginBottom: 4 }}>My Subjects</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
        {data.classLevel ? `${data.classLevel.replace('SSS', 'SS').replace(/^(JSS|SS)(\d)$/, '$1 $2')} · ${data.term} · ${subjects.length} subjects` : ''}
      </div>
      {error && <div className="empty-note">{error}</div>}
      {!error && !subjects.length && <div className="empty-note">No subjects published for your class yet.</div>}
      {!!subjects.length && (
        <table><thead><tr><th>#</th><th>Subject</th></tr></thead>
          <tbody>{subjects.map((s, i) => <tr key={s.subjectKey || s.subject}><td className="mono">{i + 1}</td><td>{s.subject}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

function SchemeOfWorkView() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/scheme-of-work')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); setLoaded(true); return; }
        setData(d);
        setLoaded(true);
      })
      .catch(() => { setError('Could not load the scheme of work.'); setLoaded(true); });
  }, []);

  if (!loaded) return <div className="card empty-note">Loading…</div>;
  if (error) return <div className="card empty-note">{error}</div>;
  if (!data.subjects.length) return <div className="card empty-note">No scheme of work has been published for your class yet.</div>;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Scheme of Work</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {data.classLevel.replace('SSS', 'SS').replace(/^(JSS|SS)(\d)$/, '$1 $2')} · {data.term} · NERDC 2025
        </div>
      </div>
      {data.subjects.map((s) => (
        <div className="card" key={s.subject} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--navy)' }}>{s.subject}</div>
          <table>
            <thead><tr><th>Week</th><th>Topic</th><th>Content</th></tr></thead>
            <tbody>
              {s.weeks.map((w) => (
                <tr key={w.weekStart} style={w.isBreak ? { opacity: 0.55 } : undefined}>
                  <td className="mono">Week {w.weekStart}{w.weekEnd > w.weekStart ? `–${w.weekEnd}` : ''}</td>
                  <td>{w.isBreak ? <em>Break</em> : (w.topics.Topic || '—')}</td>
                  <td>{w.isBreak ? '—' : (w.topics.Content || '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function TimetableView() {
  return <TimetableGrid emptyNote="No timetable has been set up for your class yet." />;
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
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    fetch('/api/announcements')
      .then((r) => r.json())
      .then((d) => {
        setList(d.announcements || []);
        setLoaded(true);
      })
      .catch(() => { setList([]); setLoaded(true); }); // never spin forever on a failed fetch
  }, []);
  if (!loaded) return <div className="card empty-note">Loading…</div>;
  return (
    <div className="card">
      {!list.length ? <div className="empty-note">No notices yet.</div> : list.map((a) => (
        <div className="notice" key={a.id}><div>{a.text}</div><div className="meta">{new Date(a.created_at).toLocaleDateString()} · {a.author}</div></div>
      ))}
    </div>
  );
}
