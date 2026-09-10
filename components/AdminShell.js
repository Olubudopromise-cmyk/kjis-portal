'use client';

import { useSelectedLayoutSegment, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';

export default function AdminShell({ children, session }) {
  const segment = useSelectedLayoutSegment();
  const activeKey = segment || 'overview';
  const router = useRouter();

  const sidebarItems = [
    { icon: '🏠', label: 'Overview', key: 'overview' },
    { icon: '👥', label: 'Classes', key: 'classes' },
    { icon: '📚', label: 'Categories & Subjects', key: 'subjects' },
    { icon: '👨‍🏫', label: 'Teachers', key: 'teachers' },
    { icon: '📅', label: 'Timetable', key: 'timetable' },
    { icon: '📋', label: 'Attendance', key: 'attendance' },
    { icon: '📢', label: 'Notices', key: 'announcements' },
    { icon: null, label: 'Sign out', key: 'signout', section: 'user' },
  ];

  function handleNavigate(key) {
    if (key === 'signout') {
      window.location.href = '/api/auth/logout';
    } else {
      router.push(key === 'overview' ? '/admin' : `/admin/${key}`);
    }
  }

  return (
    <div className="portal-shell">
      {/* top bar */}
      <div className="portal-topbar">
        <div className="brand">
          <div className="crest">KJ</div>
          <div className="brand-text"><div className="name">King James International School</div></div>
        </div>
        <div className="top-right">
          <span>{session?.name || 'Admin'}</span>
          <Link href="/api/auth/logout" className="btn btn-ghost btn-sm">Sign out</Link>
        </div>
      </div>

      {/* sidebar + content */}
      <div className="portal-body">
        <Sidebar
          items={sidebarItems}
          activeKey={activeKey}
          onNavigate={handleNavigate}
        />
        <div className="portal-content">
          {/* overview header stats only shown on the overview page (segment === null) */}
          {children}
        </div>
      </div>
    </div>
  );
}
