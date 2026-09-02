'use client';
import { useState } from 'react';
import ResetStudentPassword from '../../components/ResetStudentPassword';

export default function StudentTable({ students }) {
  const [resetStudent, setResetStudent] = useState(null);

  return (
    <>
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Students ({students.length})</div>
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
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                <td>{s.category || '—'}</td>
                <td className="mono">₦{(s.total_fee || 0).toLocaleString()}</td>
                <td className="mono">₦{(s.paid || 0).toLocaleString()}</td>
                <td className="mono">₦{((s.total_fee || 0) - (s.paid || 0)).toLocaleString()}</td>
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
