'use client';
import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import ResetStudentPassword from '../../components/ResetStudentPassword';

const CATEGORIES = ['Science', 'Art', 'Commercial'];

function EditStudentForm({ student, classes, onDone, onCancel }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(student.full_name);
  const [classId, setClassId] = useState(student.class_id || '');
  const [category, setCategory] = useState(student.category || '');
  const [totalFee, setTotalFee] = useState(student.total_fee ?? '');
  const [admissionNo, setAdmissionNo] = useState(student.admission_no || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
