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

/* ─── Video player (placeholder state; swap src for real video) ─────── */
function VideoPlayer() {
  // TODO: drop in a real src below (local video file or YouTube embed) with a one-line change.
  const VIDEO_SRC = null; // e.g. '/videos/school-tour.mp4'  or  'https://youtu.be/XXXXX'
  const isYoutube = typeof VIDEO_SRC === 'string' && VIDEO_SRC.includes('youtu');

  if (isYoutube) {
    return (
      <div className="hp-video-player">
        <div className="hp-video-bg" />
        <iframe
          src={`https://www.youtube.com/embed/${VIDEO_SRC.split('v=')[1] || VIDEO_SRC.split('/').pop()}`}
          className="hp-video-src"
          title="School tour video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (VIDEO_SRC) {
    return (
      <div className="hp-video-player">
        <div className="hp-video-bg" />
        <video className="hp-video-src" src={VIDEO_SRC} controls autoPlay muted loop playsInline />
      </div>
    );
  }

  return (
    <div className="hp-video-player" role="button" aria-label="Play school tour video (coming soon)">
      <div className="hp-video-bg" />
      <div className="hp-video-overlay">
        <button className="hp-video-play-btn" aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z" /></svg>
        </button>
        <span className="hp-video-label">School tour video coming soon</span>
        <span className="hp-video-sub">We're preparing a walkthrough of our campus and facilities.</span>
      </div>
    </div>
  );
}

/* ─── Main homepage component ──────────────────────────────────────── */
export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);

  // Testimonials data — TODO: replace with real parent/student testimonials once collected — do not display fake names/quotes to real visitors.
  const TESTIMONIALS = [
    { id: 't1', placeholder: true },
    { id: 't2', placeholder: true },
    { id: 't3', placeholder: true },
  ];

  // Student life gallery — abstract/illustrated icons (no real or AI-generated people photos).
  const GALLERY = [
    { id: 'gl1', icon: '📖', title: 'Academics', desc: 'Structured lessons, small class sizes, and a curriculum that stretches every student.' },
    { id: 'gl2', icon: '🏆', title: 'Sports', desc: 'Inter-house competitions, athletics, and team sports that build discipline and teamwork.' },
    { id: 'gl3', icon: '🎨', title: 'Arts & Culture', desc: 'Drawing, music, drama, and creative projects that give every child a voice.' },
    { id: 'gl4', icon: '🔬', title: 'Science & Tech', desc: 'Hands-on experiments, computer literacy, and a curiosity-driven approach to discovery.' },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToAbout = useCallback(() => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Blob parallax (background moves slightly slower than foreground) ──
  const heroRef = useRef(null);
  const blobRef = useRef(null);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (heroRef.current && blobRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (-rect.top) / (rect.height + 80)));
        blobRef.current.style.transform = `translateY(${progress * 28}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="hp">
      {/* ─── MARQUEE ─── */}
      <div className="hp-marquee" aria-label="Highlights">
        <div className="hp-marquee__track">
          {[...Array(2)].map((_, ri) => (
            <span className="hp-marquee__item" key={ri}>
              <span>Government Approved</span><span className="dot" />
              <span>Excellence Through Discipline</span><span className="dot" />
              <span>Science</span><span className="dot" />
              <span>Art</span><span className="dot" />
              <span>Commercial</span><span className="dot" />
              <span>Digital Report Cards</span><span className="dot" />
              <span>AI Study Support</span>
            </span>
          ))}
        </div>
      </div>

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
      <section className="hp-hero" ref={heroRef}>
        <div className="hp-hero__bg" ref={blobRef}>
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
          </div>      </div>
    </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="hp-testimonials">
        <div className="hp-section__inner">
          <Reveal>
            <span className="hp-section__tag">What Parents Say</span>
            <h2 className="hp-section__title">Parent & Student Testimonials</h2>
            <p className="hp-section__desc">
              Hear from families who trust King James International School for their children's education.
            </p>
          </Reveal>
          {/* TODO: replace with real parent/student testimonials once collected — do not display fake names/quotes to real visitors. */}
          <div className="hp-testimonials__grid">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.id} delay={i * 110}>
                {t.placeholder ? (
                  <div className="hp-testimonial-card hp-testimonial-card--placeholder">
                    <div className="hp-testimonial-card__mark">&ldquo;&rdquo;</div>
                    <p className="hp-testimonial-card__quote">Testimonial coming soon</p>
                    <div className="hp-testimonial-card__author">
                      <div className="hp-testimonial-avatar is-placeholder">+</div>
                      <div>
                        <div className="hp-testimonial-name">Placeholder</div>
                        <div className="hp-testimonial-role">Awaiting real testimonial</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="hp-testimonial-card">
                    <div className="hp-testimonial-card__mark">&ldquo;</div>
                    <p className="hp-testimonial-card__quote">{t.quote}</p>
                    <div className="hp-testimonial-card__author">
                      <div className="hp-testimonial-avatar">{t.avatar}</div>
                      <div>
                        <div className="hp-testimonial-name">{t.name}</div>
                        <div className="hp-testimonial-role">{t.role}</div>
                      </div>
                    </div>
                  </div>
                )}
              </Reveal>
            ))}
          </div>      </div>
    </section>

      {/* ─── STUDENT LIFE / GALLERY ─── */}
      <section className="hp-gallery">
        <div className="hp-section__inner">
          <Reveal>
            <span className="hp-section__tag hp-section__tag--light">Student Life</span>
            <h2 className="hp-section__title hp-section__title--light">A Well-Rounded Education</h2>
            <p className="hp-section__desc hp-section__desc--light">
              From academics to sports and the arts — every student finds their place here.
            </p>
          </Reveal>
          <div className="hp-gallery__grid">
            {GALLERY.map((g, i) => (
              <Reveal key={g.id} delay={i * 90}>
                <div className="hp-gallery-card">
                  <span className="hp-gallery-icon" aria-hidden="true">{g.icon}</span>
                  <h4>{g.title}</h4>
                  <p>{g.desc}</p>
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

      {/* ─── VIDEO TOUR ─── */}
      <section className="hp-video">
        <div className="hp-section__inner">
          <Reveal>
            <span className="hp-section__tag">Take a Look</span>
            <h2 className="hp-section__title">School Tour Video</h2>
            <p className="hp-section__desc">
              A quick walkthrough of our campus, classrooms, and facilities.
            </p>
          </Reveal>
          <Reveal delay={120}>
            {/* TODO: drop in a real src below (local video file or YouTube embed) with a one-line change. */}
            <VideoPlayer />
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
          </div>            <div className="hp-footer__right">
            <span>© {new Date().getFullYear()} King James International School</span>
            <span className="hp-footer__gov">Government Approved Institution</span>
          </div>
          <div className="hp-footer__contact">
            <a href="tel:+2349117303462" className="hp-footer__contact-item">
              <span className="hp-footer__contact-label">Phone</span>
              <span className="hp-footer__contact-phone">+234 911 730 3462</span>
            </a>
            <a href="tel:+2347015233385" className="hp-footer__contact-item">
              <span className="hp-footer__contact-label">Phone</span>
              <span className="hp-footer__contact-phone">+234 701 523 3385</span>
            </a>
            <a href="mailto:kingjamesschools@proton.me" className="hp-footer__contact-item">
              <span className="hp-footer__contact-label">Email</span>
              <span className="hp-footer__contact-email">kingjamesschools@proton.me</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
