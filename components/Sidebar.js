'use client';

import { useState, useEffect, useRef } from 'react';

export default function Sidebar({ items, activeKey, onNavigate, userSection = 'Overview' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef(null);
  const prevOpenRef = useRef(mobileOpen);

  // close drawer when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    }
    if (mobileOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [mobileOpen]);

  // body scroll lock when drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  function close() {
    setMobileOpen(false);
  }

  // separate the user/role section from nav items
  const navItems = items.filter((it) => it.section !== 'user');
  const userItems = items.filter((it) => it.section === 'user');

  return (
    <>
      {/* ── mobile hamburger ── */}
      <button
        type="button"
        className={`sidebar-hamburger ${mobileOpen ? 'sidebar-hamburger--hidden' : ''}`}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        aria-controls="portal-sidebar"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {/* ── mobile overlay ── */}
      {mobileOpen && (
        <div className="sidebar-overlay" onClick={close} aria-hidden="true" />
      )}

      {/* ── sidebar panel ── */}
      <aside
        id="portal-sidebar"
        ref={drawerRef}
        className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}
        aria-label="Main navigation"
      >
        {/* header inside drawer */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="crest">KJ</div>
            <div>
              <div className="sidebar-school">King James International School</div>
            </div>
          </div>
          {/* close button only on mobile */}
          <button
            className="sidebar-close"
            onClick={close}
            aria-label="Close navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* nav sections */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              activeKey={activeKey}
              onClick={() => {
                onNavigate?.(item.key);
                close();
              }}
            />
          ))}
        </nav>

        {/* user section at bottom */}
        {userItems.length > 0 && (
          <div className="sidebar-user">
            {userItems.map((item) => (
              <SidebarItem
                key={item.key}
                item={item}
                activeKey={activeKey}
                onClick={() => {
                  onNavigate?.(item.key);
                  close();
                }}
              />
            ))}
          </div>
        )}
      </aside>
    </>
  );
}

function SidebarItem({ item, activeKey, onClick }) {
  const active = activeKey === item.key;
  return (
    <button
      className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
      onClick={onClick}
      type="button"
      title={item.label}
    >
      <span className="sidebar-icon">{item.icon}</span>
      <span className="sidebar-label">{item.label}</span>
      {active && <span className="sidebar-active-mark" aria-hidden="true" />}
    </button>
  );
}
