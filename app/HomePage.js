'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─── Reveal wrapper — fades/slides children in on scroll ───────────── */
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? 'reveal--visible' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Animated counter ─────────────────────────────────────────────── */
function CountUp({ end, suffix = '', duration = 1800 }) {
  const ref = useRef(null);
  const [value, setValue] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    let start = null;
    let raf;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);          // ease-out cubic
      setValue(Math.round(eased * end));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [started, end, duration]);

  return <span className="mono" ref={ref}>{value}{suffix}</span>;
}

/* ─── Main homepage component ──────────────────────────────────────── */
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToAbout = useCallback(() => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div className="hp">
      {/* ─── NAV ─── */}
      <nav className={`hp-nav ${scrolled ? 'hp-nav--scrolled' : ''}`}>
        <div className="hp-nav__inner">
          <div className="hp-nav__brand">
            <div className="crest">KJ</div>
            <span className="hp-nav__name">King James International School</span>
          </div>
          <a href="/login" className="btn btn-gold hp-nav__login">Portal Login</a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hp-hero">
        <div className="hp-hero__bg">
          <div className="blob blob--1" />
          <div className="blob blob--2" />
          <div className="blob blob--3" />
          <div className="blob blob--4" />
        </div>
        <div className="hp-hero__content">
          <span className="hp-badge">✓ Government Approved</span>
          <h1 className="hp-hero__title">
            King James<br />International School
          </h1>
          <p className="hp-hero__motto">&ldquo;Excellence through discipline&rdquo;</p>
          <p className="hp-hero__sub">
            A modern, fully digital school platform — from attendance tracking to AI-powered study support, everything your child needs to excel.
          </p>
          <div className="hp-hero__actions">
            <a href="/login" className="btn btn-gold btn-lg">Access Student Portal</a>
            <button className="btn btn-outline btn-lg" onClick={scrollToAbout}>Learn More</button>
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="hp-stats">
        <div className="hp-stats__inner">
          <Reveal>
            <div className="hp-stat">
              <div className="hp-stat__number"><CountUp end={3} /></div>
              <div className="hp-stat__label">Academic Streams</div>
              <div className="hp-stat__sub">Science · Art · Commercial</div>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="hp-stat">
              <div className="hp-stat__number"><CountUp end={100} suffix="%" /></div>
              <div className="hp-stat__label">Digital Records</div>
              <div className="hp-stat__sub">Fully paperless administration</div>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="hp-stat">
              <div className="hp-stat__number">24/7</div>
              <div className="hp-stat__label">AI Study Support</div>
              <div className="hp-stat__sub">Always-on learning assistant</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── ABOUT ─── */}
      <section id="about" className="hp-about">
        <div className="hp-section__inner">
          <Reveal>
            <span className="hp-section__tag">Why King James?</span>
            <h2 className="hp-section__title">Built for the future of education</h2>
            <p className="hp-section__desc">
              Our digital platform gives students, parents, and teachers the tools they need — real-time, secure, and always accessible.
            </p>
          </Reveal>
          <div className="hp-features">
            {[
              { icon: '📋', title: 'Real-Time Attendance', desc: 'Live tracking for every class — parents see attendance as it happens, teachers mark with a tap.' },
              { icon: '💳', title: 'Secure Online Payments', desc: 'Pay school fees securely from anywhere. Instant receipts, zero queues.' },
              { icon: '🤖', title: 'AI Study Assistant', desc: 'A built-in tutor that helps students understand concepts, prepares quizzes, and answers questions 24/7.' },
              { icon: '📊', title: 'Digital Report Cards', desc: 'Termly results published instantly — with trend charts, grades, and teacher comments.' },
            ].map((f, i) => (
              <Reveal key={f.title} delay={i * 100}>
                <div className="hp-feature-card">
                  <div className="hp-feature-card__icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ACADEMIC CATEGORIES ─── */}
      <section className="hp-categories">
        <div className="hp-section__inner">
          <Reveal>
            <span className="hp-section__tag hp-section__tag--light">Academic Programmes</span>
            <h2 className="hp-section__title hp-section__title--light">Choose Your Stream</h2>
            <p className="hp-section__desc hp-section__desc--light">
              Three dedicated academic paths designed to prepare students for success in university and beyond.
            </p>
          </Reveal>
          <div className="hp-cat-grid">
            {[
              { emoji: '🔬', name: 'Science', desc: 'Physics, Chemistry, Biology, Mathematics — the foundation for careers in medicine, engineering, and technology.' },
              { emoji: '📚', name: 'Art', desc: 'Literature, History, Government, CRS — critical thinking and creativity for the humanities and social sciences.' },
              { emoji: '💼', name: 'Commercial', desc: 'Economics, Accounting, Commerce, Business Studies — the building blocks of entrepreneurship and finance.' },
            ].map((c, i) => (
              <Reveal key={c.name} delay={i * 120}>
                <div className="hp-cat-card">
                  <div className="hp-cat-card__emoji">{c.emoji}</div>
                  <h3>{c.name}</h3>
                  <p>{c.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VISIT / CAMPUS ─── */}
      <section className="hp-campus">
        <div className="hp-section__inner hp-campus__inner">
          <Reveal>
            <span className="hp-section__tag">Our Campus</span>
            <h2 className="hp-section__title">Visit Us Today</h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="hp-address-card">
              <div className="hp-address-card__icon">📍</div>
              <p className="hp-address-card__text">
                No. 10/12 Anuoluwapo Street,<br />
                Off Ajegunle Road,<br />
                Atan/Ota, Ogun State, Nigeria
              </p>
              <span className="hp-badge">✓ Government Approved</span>
            </div>
          </Reveal>
          <Reveal delay={200}>
            <div className="hp-campus__actions">
              <a href="/login" className="btn btn-gold btn-lg">Access Student Portal</a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="hp-footer">
        <div className="hp-footer__inner">
          <div className="hp-footer__left">
            <div className="crest crest--sm">KJ</div>
            <div>
              <div className="hp-footer__name">King James International School</div>
              <div className="hp-footer__addr">
                No. 10/12 Anuoluwapo Street, Off Ajegunle Road, Atan/Ota, Ogun State, Nigeria
              </div>
            </div>
          </div>
          <div className="hp-footer__right">
            <span>© {new Date().getFullYear()} King James International School</span>
            <span className="hp-footer__gov">Government Approved Institution</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
