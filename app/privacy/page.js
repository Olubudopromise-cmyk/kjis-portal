import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — King James International School',
  description:
    'Privacy policy for the King James International School student, teacher, and admin portal — covering data collection, use, third parties, and your rights.',
};

const TODAY = new Date().toLocaleDateString('en-GB', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const sectionHead = {
  fontSize: '22px',
  margin: '0 0 12px',
  color: 'var(--navy)',
  fontFamily: "'Fraunces', serif",
};

const bodyText = {
  fontSize: '14.5px',
  lineHeight: '1.65',
  color: 'var(--ink)',
  margin: 0,
};

const monoText = {
  fontSize: '14px',
  color: 'var(--muted)',
  margin: 0,
  fontFamily: "'IBM Plex Mono', monospace",
};

const chip = {
  display: 'inline-block',
  fontSize: '11.5px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '1px',
  color: 'var(--gold)',
  marginBottom: '10px',
};

const title = {
  fontSize: '34px',
  lineHeight: '1.15',
  margin: '0 0 8px',
  color: 'var(--navy)',
  fontFamily: "'Fraunces', serif",
};

const intro = {
  fontSize: '15.5px',
  lineHeight: '1.7',
  color: 'var(--ink)',
  margin: '0 0 32px',
};

const listItem = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: '10px',
  padding: '14px 16px',
  marginBottom: '10px',
  fontSize: '14px',
  lineHeight: '1.65',
  color: 'var(--ink)',
};

const listItemBody = {
  display: 'block',
  marginTop: '3px',
  color: 'var(--muted)',
};

const strong = {
  color: 'var(--navy)',
  fontFamily: "'Fraunces', serif",
  fontSize: '15px',
};

const numberedItem = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: '10px',
  padding: '13px 16px',
  marginBottom: '8px',
  fontSize: '14px',
  lineHeight: '1.65',
  color: 'var(--ink)',
  display: 'flex',
  gap: '12px',
};

const numberBadge = {
  flex: 'none',
  width: '20px',
  height: '20px',
  borderRadius: '50%',
  background: 'var(--gold)',
  color: 'var(--navy)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: "'Fraunces', serif",
  marginTop: '1px',
};

const providerItem = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: '10px',
  padding: '12px 16px',
  marginBottom: '8px',
  fontSize: '14px',
  lineHeight: '1.6',
  color: 'var(--ink)',
  display: 'flex',
  gap: '10px',
};

const providerChip = {
  flex: 'none',
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--navy)',
  background: 'var(--cream-dark)',
  padding: '3px 9px',
  borderRadius: '6px',
  whiteSpace: 'nowrap',
};

const card = {
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: '10px',
  padding: '16px 20px',
  fontSize: '14px',
  lineHeight: '1.7',
  color: 'var(--ink)',
};

const contactRow = {
  display: 'flex',
  gap: '10px',
  color: 'var(--muted)',
  marginBottom: '6px',
};

const contactLabel = {
  flex: 'none',
  fontSize: '10.5px',
  textTransform: 'uppercase',
  letterSpacing: '.6px',
  color: 'var(--muted)',
  minWidth: '52px',
};

const contactValue = {
  fontFamily: "'IBM Plex Mono', monospace",
  color: 'var(--navy)',
  fontWeight: 600,
};

const endNote = {
  fontSize: '12px',
  color: 'var(--muted)',
  textAlign: 'center',
  marginTop: '40px',
  paddingTop: '20px',
  borderTop: '1px solid var(--line)',
};

export default function PrivacyPage() {
  return (
    <div className="privacy">
      {/* ── Top bar ── */}
      <div className="topbar">
        <div className="brand">
          <div className="crest">KJ</div>
          <div className="brand-text">
            <div className="name">King James International School</div>
          </div>
        </div>
        <div className="top-right">
          <Link href="/login" className="btn btn-outline btn-sm">
            Student Login
          </Link>
        </div>
      </div>

      {/* ── Page shell ── */}
      <main>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 0 60px' }}>
          {/* ── Page heading ── */}
          <div style={{ marginBottom: 36 }}>
            <span style={chip}>Legal</span>
            <h1 style={title}>Privacy Policy</h1>
            <p style={monoText}>Last updated: {TODAY}</p>
          </div>

          {/* ── Intro ── */}
          <p style={intro}>
            This policy explains what information the King James International School
            student/teacher/admin portal collects, why, and how it is protected.
          </p>

          {/* ── Information We Collect ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>Information We Collect</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px' }}>
              <li style={listItem}>
                <strong style={strong}>Students</strong>
                <span style={listItemBody}>
                  Full name, class, academic category, admission number, fee and payment
                  records, attendance records, subject scores and results.
                </span>
              </li>
              <li style={listItem}>
                <strong style={strong}>Staff (teachers and admin)</strong>
                <span style={listItemBody}>
                  Full name, username, email address.
                </span>
              </li>
              <li style={listItem}>
                <strong style={strong}>Optional</strong>
                <span style={listItemBody}>
                  A reference photo, used only if a parent/guardian has given explicit
                  consent, to enable face verification at student login.
                </span>
              </li>
            </ul>
          </section>

          {/* ── How We Use This Information ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>How We Use This Information</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                'To manage attendance, academic records, and report cards.',
                'To process school fee payments.',
                'To verify a student\u2019s identity at login, only where a parent/guardian has opted in to face verification.',
                'To send password-reset emails to staff accounts.',
                'To share school-wide notices within the portal.',
              ].map((item, i) => (
                <li key={i} style={numberedItem}>
                  <span style={numberBadge}>{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* ── Third Parties We Share Data With ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>Third Parties We Share Data With</h2>
            <p style={bodyText}>
              We use the following service providers to run the portal. Each only
              receives the specific data needed for their function:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { provider: 'Supabase', note: 'database hosting and storage' },
                { provider: 'Paystack', note: 'payment processing for school fees' },
                { provider: 'Resend', note: 'delivery of password-reset emails' },
                {
                  provider: 'Amazon Web Services / Rekognition',
                  note:
                    'only for students with face verification enabled, to compare a login photo against the stored reference photo',
                },
              ].map((p) => (
                <li key={p.provider} style={providerItem}>
                  <span style={providerChip}>{p.provider}</span>
                  <span style={{ color: 'var(--muted)' }}>{p.note}</span>
                </li>
              ))}
            </ul>
            <p
              style={{
                fontSize: '14px',
                lineHeight: '1.6',
                color: 'var(--muted)',
                margin: '14px 0 0',
              }}
            >
              None of these providers use school data for their own purposes beyond
              providing their service to us.
            </p>
          </section>

          {/* ── Children's Data and Parental Consent ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>Children\u2019s Data and Parental Consent</h2>
            <p
              style={{
                ...bodyText,
                maxWidth: 680,
              }}
            >
              Face verification is optional and requires explicit parental or guardian
              consent before a student\u2019s reference photo is stored. A parent or
              guardian may request details of what information is stored about their
              child, or request that a student\u2019s reference photo be deleted, by
              contacting the school using the details below.
            </p>
          </section>

          {/* ── Data Security ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>Data Security</h2>
            <div style={card}>
              <p style={{ margin: '0 0 10px' }}>
                Passwords are never stored in readable form — only a securely hashed
                version.
              </p>
              <p style={{ margin: '0 0 10px' }}>
                Reference photos, where collected, are stored privately and are never
                made publicly accessible.
              </p>
              <p style={{ margin: 0 }}>
                Access to student and staff records is restricted by role (a teacher can
                only see their own class; only school administrators can see all
                records).
              </p>
            </div>
          </section>

          {/* ── Your Rights ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>Your Rights</h2>
            <p
              style={{
                ...bodyText,
                maxWidth: 680,
              }}
            >
              In line with Nigeria\u2019s Data Protection Act, you may request access to,
              correction of, or deletion of personal data held about you or your child,
              by contacting the school directly.
            </p>
          </section>

          {/* ── Contact ── */}
          <section style={{ marginBottom: 28 }}>
            <h2 style={sectionHead}>Contact</h2>
            <p style={bodyText}>
              For any privacy questions or requests, contact the school at:
            </p>
            <div style={card}>
              <div style={contactRow}>
                <span style={contactLabel}>Phone</span>
                <span style={contactValue}>09117303462, 07015233385</span>
              </div>
              <div style={contactRow}>
                <span style={contactLabel}>Email</span>
                <span style={contactValue}>kingjamesschools@proton.me</span>
              </div>
            </div>
          </section>

          {/* ── End note ── */}
          <p style={endNote}>
            This policy may be updated from time to time. The latest version is always
            available on this page.
          </p>
        </div>
      </main>
    </div>
  );
}
