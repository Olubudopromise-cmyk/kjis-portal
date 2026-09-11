'use client';
import { useEffect, useState } from 'react';
import Sidebar from '../../components/Sidebar';
import ResetStudentPassword from '../../components/ResetStudentPassword';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherDashboard() {
  const [tab, setTab] = useState('overview');
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadRoster() {
    fetch('/api/students')
      .then((r) => r.json())
      .then((d) => { setRoster(d.students || []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(loadRoster, []);

  if (loading) return <div className="card empty-note">Loading your class…</div>;

  // Overview data
  const classId = roster[0]?.class_id;
  const classNames = [...new Set(roster.map((s) => s.class_id))];
  const classLabel = classNames.length === 1 ? classNames[0] : 'Multiple classes';

  return (
    <>
      <Sidebar
        items={[
          { icon: '🏠', label: 'Overview', key: 'overview' },
          { icon: '📋', label: 'Mark Attendance', key: 'attendance' },
          { icon: '📝', label: 'Enter Results', key: 'results' },
          { icon: '💳', label: 'Fee Status', key: 'fees' },
          { icon: '🔧', label: 'Manage', key: 'manage' },
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
        {tab === 'overview' && <OverviewSection roster={roster} classLabel={classLabel} />}
        {tab === 'attendance' && !!roster.length && <AttendanceTab roster={roster} />}
        {tab === 'results' && !!roster.length && <ResultsTab roster={roster} />}
        {tab === 'fees' && !!roster.length && <FeesTab roster={roster} />}
        {tab === 'manage' && !!roster.length && <ManageTab roster={roster} />}
      </div>
    </>
  );
}

function OverviewSection({ roster, classLabel }) {
  const [todayMarked, setTodayMarked] = useState(null);
  const [todayDate] = useState(todayStr());

  useEffect(() => {
    if (!roster.length) return;
    const cid = roster[0].class_id;
    fetch(`/api/attendance?classId=${cid}&date=${todayDate}`)
      .then((r) => r.json())
      .then((d) => {
        const records = d.records || [];
        setTodayMarked({
          total: records.length,
          present: records.filter((r) => r.status === 'present').length,
          absent: records.filter((r) => r.status === 'absent').length,
          unmarked: roster.length - records.length,
        });
      })
      .catch(() => setTodayMarked(null));
  }, [roster, todayDate]);

  const present = todayMarked?.present ?? 0;
  const absent = todayMarked?.absent ?? 0;
  const unmarked = todayMarked?.unmarked ?? 0;
  const total = roster.length;
  const pct = total ? Math.round(((present + absent) / total) * 100) : 0;

  return (
    <div>
      <div className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card stat-card">
          <div className="label">Class</div>
          <div className="value" style={{ fontSize: 18 }}>{classLabel}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Students</div>
          <div className="value">{total}</div>
        </div>
        <div className="card stat-card">
          <div className="label">Today marked</div>
          <div className="value">{present + absent} / {total}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 16 }}>Today's attendance summary</div>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>{todayDate}</div>

        {todayMarked === null ? (
          <div className="empty-note">Loading attendance data…</div>
        ) : !total ? (
          <div className="empty-note">No students in your class yet.</div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="label" style={{ marginBottom: 6 }}>Present</div>
              <div className="value" style={{ color: 'var(--success)' }}>{present}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="label" style={{ marginBottom: 6 }}>Absent</div>
              <div className="value" style={{ color: 'var(--danger)' }}>{absent}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="label" style={{ marginBottom: 6 }}>Unmarked</div>
              <div className="value" style={{ color: 'var(--muted)' }}>{unmarked}</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div className="label" style={{ marginBottom: 6 }}>Rate</div>
              <div className="value">{pct}%</div>
            </div>
          </div>
        )}
      </div>

      {unmarked > 0 && (
        <div className="card notice" style={{ marginTop: 16, border: '1.5px solid var(--gold)', background: 'rgba(184, 143, 20, 0.06)' }}>
          <b>{unmarked} student(s)</b> still need attendance marked for today. Go to <b>Mark Attendance</b> to finish.
        </div>
      )}
    </div>
  );
}

function AttendanceTab({ roster }) {
  const [date, setDate] = useState(todayStr());
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
    fetch(`/api/attendance?classId=${roster[0]?.class_id}&date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        const m = {};
        (d.records || []).forEach((r) => { m[r.student_id] = r.status; });
        setMarks(m);
      });
  }, [date, roster]);

  async function save() {
    setSaving(true);
    await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records: marks }),
    });
    setSaving(false);
    setSaved(true);
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>Mark attendance</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 7 }} />
      </div>
      {roster.map((s) => (
        <div className="att-row" key={s.id}>
          <div style={{ fontWeight: 600 }}>{s.full_name}</div>
          <div>
            <button className={`att-btn ${marks[s.id] === 'present' ? 'on-present' : ''}`} onClick={() => setMarks({ ...marks, [s.id]: 'present' })}>Present</button>
            <button className={`att-btn ${marks[s.id] === 'absent' ? 'on-absent' : ''}`} onClick={() => setMarks({ ...marks, [s.id]: 'absent' })}>Absent</button>
          </div>
        </div>
      ))}
      <button className="btn btn-navy" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : saved ? 'Saved ✓' : `Save attendance for ${date}`}
      </button>
    </div>
  );
}

function ResultsTab({ roster }) {
  const [studentId, setStudentId] = useState(roster[0].id);
  const student = roster.find((s) => s.id === studentId);
  const [subjects, setSubjects] = useState([]);
  const [scores, setScores] = useState({});
  const [term, setTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [assessments, setAssessments] = useState({});
  const [newLabel, setNewLabel] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newMaxScore, setNewMaxScore] = useState('100');
  const [adding, setAdding] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState('');

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => setTerm(d.settings?.current_term || ''));
  }, []);

  useEffect(() => {
    setSaved(false);
    if (!student?.category) { setSubjects([]); setSelectedSubject(''); return; }
    fetch('/api/subjects').then((r) => r.json()).then((d) => {
      const names = (d.subjects?.[student.category] || []).map((s) => s.name);
      setSubjects(names);
      setSelectedSubject((current) => (names.includes(current) ? current : names[0] || ''));
    });
    fetch(`/api/results?studentId=${studentId}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.results || []).forEach((r) => { m[r.subject] = { ca: r.ca ?? '', exam: r.exam ?? '' }; });
      setScores(m);
    });
    fetch(`/api/assessments?studentId=${studentId}&term=${encodeURIComponent(term)}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.assessments || []).forEach((a) => { (m[a.subject] = m[a.subject] || []).push(a); });
      setAssessments(m);
    }).catch(() => setAssessments({}));
  }, [studentId, student, term]);

  async function save() {
    setSaving(true);
    await Promise.all(
      subjects.map((subject) =>
        fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId,
            subject,
            ca: scores[subject]?.ca === '' ? null : Number(scores[subject]?.ca),
            exam: scores[subject]?.exam === '' ? null : Number(scores[subject]?.exam),
          }),
        })
      )
    );
    setSaving(false);
    setSaved(true);
  }

  async function addAssessment(e) {
    e.preventDefault();
    if (!newLabel.trim() || newScore === '' || newMaxScore === '') return;
    setAdding(true);
    await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId,
        subject: selectedSubject,
        term,
        label: newLabel.trim(),
        score: Number(newScore),
        maxScore: Number(newMaxScore),
      }),
    });
    setAdding(false);
    setNewLabel('');
    setNewScore('');
    setNewMaxScore('100');
    fetch(`/api/assessments?studentId=${studentId}&term=${encodeURIComponent(term)}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.assessments || []).forEach((a) => { (m[a.subject] = m[a.subject] || []).push(a); });
      setAssessments(m);
    });
  }

  async function removeAssessment(id) {
    await fetch('/api/assessments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, studentId }),
    });
    fetch(`/api/assessments?studentId=${studentId}&term=${encodeURIComponent(term)}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.assessments || []).forEach((a) => { (m[a.subject] = m[a.subject] || []).push(a); });
      setAssessments(m);
    });
  }

  return (
    <div className="card">
      <div className="toolbar">
        <div style={{ fontWeight: 700 }}>Enter results</div>
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 7 }}>
          {roster.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>
      {term && <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>Scoring for: <b>{term}</b> — set by admin</div>}
      {!student?.category ? (
        <div className="empty-note">{student.full_name} has no study category assigned yet — ask the administrator to set one first.</div>
      ) : !subjects.length ? (
        <div className="empty-note">No subjects set up yet for {student.category}. Add some from Admin → Subjects.</div>
      ) : (
        <>
          <table>
            <thead><tr><th>Subject</th><th>CA (/40)</th><th>Exam (/60)</th></tr></thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject}>
                  <td>{subject}</td>
                  <td><input className="score-input" type="number" min="0" max="40" value={scores[subject]?.ca ?? ''} onChange={(e) => setScores({ ...scores, [subject]: { ...scores[subject], ca: e.target.value } })} /></td>
                  <td><input className="score-input" type="number" min="0" max="60" value={scores[subject]?.exam ?? ''} onChange={(e) => setScores({ ...scores, [subject]: { ...scores[subject], exam: e.target.value } })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-navy" style={{ marginTop: 12 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : `Save results for ${student.full_name.split(' ')[0]}`}
          </button>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Recorded Tests &amp; Exams</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <select
                value={selectedSubject}
                onChange={(e) => { setSelectedSubject(e.target.value); setNewLabel(''); setNewScore(''); setNewMaxScore('100'); }}
                style={{ padding: '7px 10px', border: '1.5px solid var(--line)', borderRadius: 7 }}
              >
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                className="score-input"
                type="text"
                placeholder="Label e.g. Test 1"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                style={{ maxWidth: 140 }}
              />
              <input
                className="score-input"
                type="number"
                placeholder="Score"
                value={newScore}
                onChange={(e) => setNewScore(e.target.value)}
                min="0"
                style={{ maxWidth: 90 }}
              />
              <input
                className="score-input"
                type="number"
                placeholder="Max"
                value={newMaxScore}
                onChange={(e) => setNewMaxScore(e.target.value)}
                min="1"
                style={{ maxWidth: 80 }}
              />
              <button className="btn btn-gold btn-sm" onClick={addAssessment} disabled={adding}>
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>

            {subjects.map((subject) => {
              const list = (assessments[subject] || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
              if (!list.length) return null;
              return (
                <div key={subject} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6, color: 'var(--muted)' }}>{subject}</div>
                  <table>
                    <thead><tr><th>Label</th><th>Score</th><th>Recorded</th><th></th></tr></thead>
                    <tbody>
                      {list.map((a) => (
                        <tr key={a.id}>
                          <td>{a.label}</td>
                          <td className="mono">{Number(a.score)} / {Number(a.max_score)}</td>
                          <td className="mono">{new Date(a.created_at).toLocaleDateString()}</td>
                          <td><button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', fontSize: 11 }} onClick={() => removeAssessment(a.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            {!Object.values(assessments).flat().length && (
              <div className="empty-note">No tests or exams recorded yet for this student.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FeesTab({ roster }) {
  return (
    <div className="card">
      <table>
        <thead><tr><th>Student</th><th>Total Fee</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
          {roster.map((s) => {
            const bal = (s.total_fee || 0) - (s.paid || 0);
            return (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td className="mono">₦{(s.total_fee || 0).toLocaleString()}</td>
                <td className="mono">₦{(s.paid || 0).toLocaleString()}</td>
                <td className="mono">₦{bal.toLocaleString()}</td>
                <td>{bal <= 0 ? <span className="tag tag-success">Paid</span> : <span className="tag tag-danger">Owing</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ManageTab({ roster }) {
  const [resetStudent, setResetStudent] = useState(null);

  return (
    <>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Manage students</div>
        <table>
          <thead><tr><th>Student</th><th>Category</th><th>Actions</th></tr></thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td>{s.category || '—'}</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setResetStudent(s)}
                    style={{ fontSize: 11 }}
                  >
                    Reset password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {resetStudent && (
        <ResetStudentPassword
          studentId={resetStudent.id}
          studentName={resetStudent.full_name}
          onClose={() => setResetStudent(null)}
        />
      )}
    </>
  );
}
