'use client';
import { useEffect, useState } from 'react';
import ResetStudentPassword from '../../components/ResetStudentPassword';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherDashboard() {
  const [tab, setTab] = useState('attendance');
  const [roster, setRoster] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadRoster() {
    fetch('/api/students').then((r) => r.json()).then((d) => { setRoster(d.students || []); setLoading(false); });
  }
  useEffect(loadRoster, []);

  if (loading) return <div className="card empty-note">Loading your class…</div>;

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === 'attendance' ? 'active' : ''}`} onClick={() => setTab('attendance')}>Mark Attendance</button>
        <button className={`tab-btn ${tab === 'results' ? 'active' : ''}`} onClick={() => setTab('results')}>Enter Results</button>
        <button className={`tab-btn ${tab === 'fees' ? 'active' : ''}`} onClick={() => setTab('fees')}>Fee Status</button>
        <button className={`tab-btn ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>Manage</button>
      </div>
      {!roster.length && <div className="card empty-note">No students are assigned to your class yet.</div>}
      {tab === 'attendance' && !!roster.length && <AttendanceTab roster={roster} />}
      {tab === 'results' && !!roster.length && <ResultsTab roster={roster} />}
      {tab === 'fees' && !!roster.length && <FeesTab roster={roster} />}
      {tab === 'manage' && !!roster.length && <ManageTab roster={roster} />}
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

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((d) => setTerm(d.settings?.current_term || ''));
  }, []);

  useEffect(() => {
    setSaved(false);
    if (!student?.category) { setSubjects([]); return; }
    fetch('/api/subjects').then((r) => r.json()).then((d) => setSubjects((d.subjects?.[student.category] || []).map((s) => s.name)));
    fetch(`/api/results?studentId=${studentId}`).then((r) => r.json()).then((d) => {
      const m = {};
      (d.results || []).forEach((r) => { m[r.subject] = { ca: r.ca ?? '', exam: r.exam ?? '' }; });
      setScores(m);
    });
  }, [studentId, student]);

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
