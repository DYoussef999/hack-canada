'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

function useCountUp(target, duration = 2000) {
  const [value, setValue] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const startTime = performance.now();
    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'About', href: '#about' },
];

const FEATURES = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Financial Sandbox',
    desc: 'Simulate the financial impact of opening a new location with custom revenue, cost, and rent inputs.',
    href: '/sandbox',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title: 'Expansion Map',
    desc: 'Interactive 3D map with AI-scored location pins, heatmaps, and detailed opportunity popups.',
    href: '/expansion',
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Business Dashboard',
    desc: 'View predicted revenue, profit margins, and expansion feasibility scores at a glance.',
    href: '/dashboard',
  },
];

const STEPS = [
  { num: '01', title: 'Enter your business details', desc: 'Tell us your business type, budget, and target market to get personalized insights.' },
  { num: '02', title: 'Run AI simulations', desc: 'Our engine analyzes rent, foot traffic, competition density, and demographic data.' },
  { num: '03', title: 'Explore scored locations', desc: 'See AI-ranked expansion zones on an interactive 3D map with detailed breakdowns.' },
];

export default function Home() {
  const statValue = useCountUp(2400, 2500);
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b transition-colors duration-300"
        style={{ background: 'rgba(250,248,244,0.88)', backdropFilter: 'blur(14px)', borderColor: 'var(--forest-rim)' }}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5">
            <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }} className="text-xl font-bold">
              LaunchPad
            </span>
            <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--sage)' }} className="text-xl font-bold">
              AI
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm transition-colors"
                style={{ color: 'var(--moss)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--forest)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--moss)'}
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm px-4 py-1.5 rounded-lg border transition hover:bg-black/5"
              style={{ color: 'var(--forest)', borderColor: 'var(--forest-rim)' }}
            >
              Sign in
            </Link>
            <Link
              href="/auth"
              className="text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm text-white hover:opacity-90"
              style={{ background: 'var(--forest)' }}
            >
              Get started&nbsp;&rarr;
            </Link>
          </div>

          <button
            onClick={() => setMobileNav((p) => !p)}
            className="md:hidden p-2"
            style={{ color: 'var(--forest)' }}
            aria-label="Toggle menu"
          >
            {mobileNav ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {mobileNav && (
          <div className="md:hidden px-6 pb-4 pt-1 space-y-2 border-t" style={{ borderColor: 'var(--forest-rim)', background: 'var(--cream)' }}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileNav(false)} className="block text-sm py-1.5" style={{ color: 'var(--moss)' }}>
                {l.label}
              </a>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href="/auth" className="text-sm px-4 py-1.5 rounded-lg border flex-1 text-center" style={{ color: 'var(--forest)', borderColor: 'var(--forest-rim)' }}>Sign in</Link>
              <Link href="/auth" className="text-sm font-semibold px-4 py-1.5 rounded-lg flex-1 text-center text-white" style={{ background: 'var(--forest)' }}>
                Get started
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative min-h-screen overflow-hidden pt-16"
        style={{ background: 'var(--cream)' }}
      >
        {/* Background orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div
            className="absolute rounded-full blur-3xl opacity-20"
            style={{ width: 600, height: 600, top: '10%', right: '-5%', background: 'radial-gradient(circle, #a8d98a 0%, transparent 70%)' }}
          />
          <div
            className="absolute rounded-full blur-3xl opacity-15"
            style={{ width: 500, height: 500, bottom: '5%', right: '15%', background: 'radial-gradient(circle, #8cc46a 0%, transparent 70%)' }}
          />
          <div
            className="absolute rounded-full blur-3xl opacity-10"
            style={{ width: 400, height: 400, top: '40%', left: '-8%', background: 'radial-gradient(circle, #e8c96e 0%, transparent 70%)' }}
          />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.035]"
            style={{
              backgroundImage: 'linear-gradient(var(--moss) 1px, transparent 1px), linear-gradient(90deg, var(--moss) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 flex flex-col lg:flex-row items-center min-h-[calc(100vh-4rem)]">
          {/* Left column */}
          <div className="flex-1 lg:max-w-[55%] py-20 lg:py-0">
            {/* Stat counter */}
            <div
              className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border"
              style={{ borderColor: 'var(--forest-rim)', background: 'var(--white)' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--sage)' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: 'var(--sage)' }} />
              </span>
              <span className="text-sm" style={{ color: 'var(--moss)' }}>
                Analyzing <span className="font-semibold" style={{ color: 'var(--forest)' }}>${(statValue / 100).toFixed(1)}M+</span> in expansion opportunities
              </span>
      </div>

            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.08] mb-6"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }}
            >
              Expand your<br />
              business with{' '}
              <span className="relative">
                <span style={{ color: 'var(--sage)' }}>intelligence</span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 8 C60 2, 120 2, 298 8" stroke="var(--sage)" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
                </svg>
              </span>
      </h1>

            <p className="text-lg lg:text-xl leading-relaxed mb-10 max-w-lg" style={{ color: 'var(--moss)' }}>
        LaunchPad AI helps small businesses simulate expansion decisions, estimate
              revenue and costs, and find the best locations to grow — all powered by AI.
            </p>

            <div className="flex flex-wrap gap-4 mb-16">
        <Link
          href="/sandbox"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-200 shadow-lg hover:shadow-xl hover:translate-y-[-1px]"
                style={{ background: 'var(--forest)' }}
        >
                Get started free
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
        </Link>
        <Link
                href="/expansion"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm border transition-all duration-200 hover:bg-black/[0.03]"
                style={{ borderColor: 'var(--forest-rim)', color: 'var(--forest)' }}
        >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
                Explore the map
        </Link>
      </div>

            {/* Trust indicators */}
            <div className="flex items-center gap-6">
              <div className="flex -space-x-2">
                {['#3d8b24', '#c49530', '#1a2e12', '#3e6b2a'].map((c, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: c, borderColor: 'var(--cream)' }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm" style={{ color: 'var(--moss)' }}>
                <span className="font-semibold" style={{ color: 'var(--forest)' }}>500+</span> businesses expanding smarter
              </div>
            </div>
          </div>

          {/* Right column — dashboard mockup */}
          <div className="flex-1 lg:max-w-[45%] flex items-center justify-center py-12 lg:py-0">
            <div className="relative w-full max-w-md">
              {/* Glow behind the card */}
              <div
                className="absolute inset-0 rounded-3xl blur-2xl opacity-20"
                style={{ background: 'linear-gradient(135deg, #8cc46a, #3e6b2a, #e8c96e)' }}
              />

              {/* Card */}
              <div
                className="relative rounded-2xl border p-6 space-y-5 shadow-xl"
                style={{ background: 'var(--white)', borderColor: 'var(--forest-rim)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--moss)' }}>Expansion Analysis</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium" style={{ background: 'rgba(61,139,36,0.1)', color: 'var(--sage)' }}>Live</span>
                </div>

                {/* Mock metric rows */}
                {[
                  { label: 'Projected Revenue', value: '$18,400/mo', accent: true },
                  { label: 'Estimated Costs', value: '$11,200/mo', accent: false },
                  { label: 'Net Profit Margin', value: '39.1%', accent: true },
                  { label: 'Feasibility Score', value: '84/100', accent: true },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: 'var(--forest-rim)' }}>
                    <span className="text-sm" style={{ color: 'var(--moss)' }}>{m.label}</span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: m.accent ? 'var(--sage)' : 'var(--forest)' }}
                    >
                      {m.value}
                    </span>
                  </div>
                ))}

                {/* Mini bar chart */}
                <div className="pt-2">
                  <div className="text-xs mb-3" style={{ color: 'var(--moss)', opacity: 0.7 }}>Monthly projection</div>
                  <div className="flex items-end gap-1.5 h-20">
                    {[40, 55, 45, 70, 65, 80, 75, 90, 85, 95, 88, 92].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm transition-all duration-500"
                        style={{
                          height: `${h}%`,
                          background: i >= 9
                            ? 'var(--sage)'
                            : `rgba(61,139,36,${0.12 + (i * 0.05)})`,
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Location indicator */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--sage)' }} />
                  <span className="text-xs" style={{ color: 'var(--moss)', opacity: 0.7 }}>Top location: Uptown Waterloo — Score 91</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: 'linear-gradient(transparent, var(--cream))' }} />
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative py-24 lg:py-32" style={{ background: 'var(--cream)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-medium tracking-wider uppercase" style={{ color: 'var(--sage)' }}>Platform</span>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }}
            >
              Everything you need to expand
            </h2>
            <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: 'var(--moss)' }}>
              From financial modeling to location intelligence — one platform to plan your next move.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                href={f.href}
                className="group rounded-2xl border p-7 transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl"
                style={{ background: 'var(--white)', borderColor: 'var(--forest-rim)' }}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                  style={{ background: 'rgba(61,139,36,0.1)', color: 'var(--sage)' }}
                >
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 group-hover:text-[var(--sage)] transition-colors" style={{ color: 'var(--forest)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--moss)' }}>{f.desc}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all" style={{ color: 'var(--sage)' }}>
                  Explore
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="relative py-24 lg:py-32" style={{ background: 'var(--white)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-medium tracking-wider uppercase" style={{ color: 'var(--amber)' }}>Process</span>
            <h2
              className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }}
            >
              Three steps to smarter growth
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.num} className="relative">
                <span
                  className="text-6xl font-black leading-none"
                  style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest-rim)' }}
                >
                  {s.num}
                </span>
                <h3 className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--forest)' }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--moss)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section id="about" className="relative py-24" style={{ background: 'var(--cream)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div
            className="relative overflow-hidden rounded-3xl border px-8 py-16 md:px-16 text-center"
            style={{ borderColor: 'var(--forest-rim)', background: 'var(--forest)' }}
          >
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div
                className="absolute rounded-full blur-3xl opacity-20"
                style={{ width: 400, height: 400, top: '-20%', right: '-10%', background: 'radial-gradient(circle, #8cc46a 0%, transparent 70%)' }}
              />
              <div
                className="absolute rounded-full blur-3xl opacity-15"
                style={{ width: 300, height: 300, bottom: '-15%', left: '-5%', background: 'radial-gradient(circle, #e8c96e 0%, transparent 70%)' }}
              />
            </div>

            <div className="relative z-10">
              <h2
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Ready to find your next location?
              </h2>
              <p className="text-lg mb-8 max-w-xl mx-auto text-white/60">
                Join hundreds of businesses using AI to make smarter expansion decisions.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link
                  href="/sandbox"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm shadow-lg transition-all hover:translate-y-[-1px]"
                  style={{ background: '#fff', color: 'var(--forest)' }}
                >
                  Start for free
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/expansion"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm border text-white/90 transition-all hover:bg-white/10"
                  style={{ borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  View expansion map
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-10" style={{ background: 'var(--cream)', borderColor: 'var(--forest-rim)' }}>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }} className="text-lg font-bold">LaunchPad</span>
            <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--sage)' }} className="text-lg font-bold">AI</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--moss)', opacity: 0.6 }}>
            &copy; {new Date().getFullYear()} LaunchPad AI. Built for Hack Canada.
          </p>
      </div>
      </footer>
    </div>
  );
}
