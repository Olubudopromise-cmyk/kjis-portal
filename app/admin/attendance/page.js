'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AttendanceOverviewPage() {
  const today = new Date();
  const defaultDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const [date, setDate] = useState(defaultDate);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance/overview?date=${encodeURIComponent(date)}`);
      const data = await res.json();
      if (res.ok) setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(load, [date]);

  return (
    <main>
      <div className="page-head"><h2>Attendance Overview</h2></div>
      <Link href="/admin" style={{ fontSize: 13, color: 'var(--navy)' }}>← Back to Admin Desk</Link>

      <div className="card" style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: '9px 12px', border: '1.5px solid var(--line)', borderRadius: 7, maxWidth: 180 }}
          />
        </div>
        <button className="btn btn-navy btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {rows.length === 0 && !loading ? (
          <div className="empty-note">No classes yet.</div>
        ) : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Class</th>
                <th className="mono">Total</th>
                <th className="mono">Present</th>
                <th className="mono">Absent</th>
                <th className="mono">Unmarked</th>
                <th className="mono">Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.classId}>
                  <td>{r.className}</td>
                  <td className="mono">{r.total}</td>
                  <td className="mono">{r.present}</td>
                  <td className="mono">{r.absent}</td>
                  <td className="mono">{r.unmarked}</td>
                  <td className="mono">{r.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
