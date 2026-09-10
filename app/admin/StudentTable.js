'use client';
import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ResetStudentPassword from '../../components/ResetStudentPassword';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

const CHANGE_LABELS = {
  fullName: 'Name',
  classId: 'Class',
  category: 'Category',
  totalFee: 'Term fee',
  admissionNo: 'Admission No.',
  active: 'Status',
};

function formatChangeValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'active') return value === true ? 'Active' : 'Inactive';
  if (field === 'totalFee') return `₦${Number(value).toLocaleString()}`;
  return String(value);
}

function EditStudentForm({ student, classes, onDone, onCancel }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(student.full_name);
  const [classId, setClassId] = useState(student.class_id || '');
  const [category, setCategory] = useState(student.category || '');
  const [totalFee, setTotalFee] = useState(student.total_fee ?? '');
  const [admissionNo, setAdmissionNo] = useState(student.admission_no || '');
  const [edits, setEdits] = useState(null);
  const [editsLoading, setEditsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Latest first, so the admin sees the most recent changes at a glance.
  function loadEdits() {
    setEditsLoading(true);
    fetch(`/api/students/edits?studentId=${student.id}`)
      .then((r) => r.json())
      .then((d) => setEdits(d.edits || []))
      .catch(() => setEdits([]))
      .finally(() => setEditsLoading(false));
  }
  useEffect(loadEdits, [student.id]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await fetch('/api/students', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: student.id,
        fullName,
        classId: classId || null,
        category: category || null,
        totalFee: totalFee === '' ? 0 : Number(totalFee),
        admissionNo: admissionNo || null,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Could not save changes.');
      return;
    }
    onDone();
  }

  const classNameById = Object.fromEntries(classes.map((c) => [c.id, c.name]));

  return (
    <tr className="edit-row">
      <td colSpan={7}>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div className="field" style={{ margin: 0 }}>
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Admission No.</label>
            <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">No class</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">No category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Term fee (₦)</label>
            <input type="number" min="0" value={totalFee} onChange={(e) => setTotalFee(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingBottom: 1 }}>
            <button className="btn btn-navy btn-sm" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </form>
        <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>
            Recent changes
          </div>
          {editsLoading ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading…</div>
          ) : !edits?.length ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>No recorded changes yet.</div>
          ) : (
            edits.map((e) => (
              <div key={e.id} style={{ fontSize: 13, marginBottom: 5 }}>
                {new Date(e.created_at).toLocaleString()} — {e.editor_name || e.editor_role}:
                {' '}
                {Object.entries(e.changes || {}).map(([field, { from, to }], i, arr) => (
                  <span key={field}>
                    {i > 0 && '; '}
                    <strong>{CHANGE_LABELS[field] || field}</strong>
                    {' '}{formatChangeValue(field, from)} → {formatChangeValue(field, to)}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      </td>
    </tr>
  );
}

export default function StudentTable({ students, classes = [] }) {
  const router = useRouter();
  const [resetStudent, setResetStudent] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  async function toggleActive(student) {
    setError('');
    setBusyId(student.id);
    try {
      const res = await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id, active: !student.active }),
      });
      const data = await res.json();
      setBusyId(null);
      if (!res.ok) {
        setError(data.error || 'Could not update student.');
        return;
      }
      router.refresh();
    } catch {
      setBusyId(null);
      setError('Could not update student.');
    }
  }

  function classNameById(classId) {
    if (!Array.isArray(classes)) return '—';
    return (classes.find((c) => c.id === classId) || {}).name || '—';
  }

  function classOptions() {
    if (!Array.isArray(classes)) return [];
    return classes.map((c) => ({ value: c.id, label: c.name }));
  }

  return (
    <>
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Students ({students.length})</div>
        {error && <div className="error-msg">{error}</div>}
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Total Fee</th>
              <th>Paid</th>
              <th>Balance</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const inactive = s.active === false;
              return (
                <Fragment key={s.id}>
                  <tr className={inactive ? 'row-inactive' : ''} style={inactive ? { opacity: 0.45 } : undefined}>
                    <td>
                      {s.full_name}
                      {inactive && <span className="tag-inactive">Inactive</span>}
                    </td>
                    <td>{s.category || '—'}</td>
                    <td className="mono">₦{(s.total_fee || 0).toLocaleString()}</td>
                    <td className="mono">₦{(s.paid || 0).toLocaleString()}</td>
                    <td className="mono">₦{((s.total_fee || 0) - (s.paid || 0)).toLocaleString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setEditingId(editingId === s.id ? null : s.id)}
                          style={{ fontSize: 11 }}
                        >
                          {editingId === s.id ? 'Close' : 'Edit'}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => toggleActive(s)}
                          disabled={busyId === s.id}
                          style={{ fontSize: 11, color: inactive ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {busyId === s.id ? '…' : inactive ? 'Reactivate' : 'Deactivate'}
                        </button>
                        {!inactive && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setResetStudent(s)}
                            style={{ fontSize: 11 }}
                          >
                            Reset password
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {editingId === s.id && (
                    <EditStudentForm
                      student={s}
                      classes={classes}
                      onDone={() => { setEditingId(null); router.refresh(); }}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </Fragment>
              );
            })}
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
