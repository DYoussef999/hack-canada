'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (user) return null;

  return (
    <main
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--cream)', fontFamily: "'DM Sans', sans-serif" }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .fade-up { animation: fadeUp 0.5s ease forwards; opacity: 0; }
        .fade-up-1 { animation-delay: 0.2s; }
        .fade-up-2 { animation-delay: 0.3s; }
        .fade-up-3 { animation-delay: 0.45s; }
      `}</style>

      {/* Left decorative panel */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden flex-col justify-between p-12 shrink-0">
        {/* Orbs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div
            className="absolute rounded-full blur-3xl opacity-20"
            style={{ width: 500, height: 500, top: '5%', right: '-10%', background: 'radial-gradient(circle, #a8d98a 0%, transparent 70%)' }}
          />
          <div
            className="absolute rounded-full blur-3xl opacity-15"
            style={{ width: 400, height: 400, bottom: '10%', left: '-5%', background: 'radial-gradient(circle, #8cc46a 0%, transparent 70%)' }}
          />
          <div
            className="absolute rounded-full blur-3xl opacity-10"
            style={{ width: 350, height: 350, top: '50%', right: '20%', background: 'radial-gradient(circle, #e8c96e 0%, transparent 70%)' }}
          />
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(var(--moss) 1px, transparent 1px), linear-gradient(90deg, var(--moss) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        {/* Logo */}
        <div className="relative z-10 fade-up fade-up-1">
          <Link href="/" className="inline-flex items-center gap-1.5">
            <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }} className="text-xl font-bold">
              LaunchPad
            </span>
            <span style={{ fontFamily: "'Playfair Display', serif", color: 'var(--sage)' }} className="text-xl font-bold">
              AI
            </span>
          </Link>
        </div>

        {/* Brand statement + stats */}
        <div className="relative z-10 fade-up fade-up-2">
          <h2
            className="font-bold leading-[1.2] mb-4"
            style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, maxWidth: 340, color: 'var(--forest)' }}
          >
            The smartest move your business will make.
          </h2>
          <p className="text-sm leading-relaxed mb-12" style={{ color: 'var(--moss)', maxWidth: 320 }}>
            Join thousands of business owners who found their perfect location with LaunchPad AI.
          </p>

          <div className="flex flex-col gap-3">
            {[
              { emoji: '🏪', text: '2,400+ locations analyzed' },
              { emoji: '📈', text: 'Avg. 31% margin improvement' },
              { emoji: '🌍', text: '47 cities covered' },
            ].map((pill, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm border self-start"
                style={{
                  background: 'var(--white)',
                  borderColor: 'var(--forest-rim)',
                  color: 'var(--forest)',
                  marginLeft: i * 16,
                  animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                <span>{pill.emoji}</span>
                {pill.text}
              </div>
            ))}
          </div>
        </div>

        <div />
      </div>

      {/* Right auth panel */}
      <div className="w-full lg:w-1/2 flex items-start justify-center p-6 sm:p-8 pt-24 overflow-y-auto shrink-0">
        <div
          className="w-full max-w-[420px] rounded-2xl border p-8 sm:p-10 shadow-xl fade-up fade-up-2"
          style={{ background: 'var(--white)', borderColor: 'var(--forest-rim)' }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1
              className="text-[30px] font-bold leading-[1.2] mb-2"
              style={{ fontFamily: "'Playfair Display', serif", color: 'var(--forest)' }}
            >
              Your next location starts here.
            </h1>
            <p className="text-sm" style={{ color: 'var(--sage)' }}>
              Sign in or create your free LaunchPad AI account.
            </p>
          </div>

          {/* Google */}
          <a
            href="/api/auth/login?connection=google-oauth2&returnTo=/dashboard"
            className="flex items-center justify-center gap-3 w-full font-semibold text-[14px] py-3.5 rounded-xl shadow-md transition hover:bg-gray-50 mb-4"
            style={{ background: 'var(--white)', color: 'var(--forest)', border: '1px solid var(--forest-rim)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'var(--forest-rim)' }} />
            <span className="text-xs" style={{ color: 'var(--moss)' }}>or use email</span>
            <div className="flex-1 h-px" style={{ background: 'var(--forest-rim)' }} />
          </div>

          {/* Sign In */}
          <a
            href="/api/auth/login?returnTo=/dashboard"
            className="block w-full text-center font-bold text-[14px] py-3.5 rounded-xl shadow-lg tracking-wide transition text-white hover:opacity-90 mb-3"
            style={{ background: 'var(--forest)' }}
          >
            Sign In &rarr;
          </a>

          {/* Create Account */}
          <a
            href="/api/auth/login?screen_hint=signup&returnTo=/dashboard"
            className="block w-full text-center font-medium text-[14px] py-3.5 rounded-xl border transition hover:border-[var(--sage)] mb-5"
            style={{ borderColor: 'var(--forest-rim)', color: 'var(--forest)' }}
          >
            Create Free Account
          </a>

          {/* Trust line */}
          <p className="text-center text-[11px] leading-relaxed" style={{ color: 'var(--moss)', opacity: 0.7 }}>
            ✓ Free to start &nbsp;&middot;&nbsp; ✓ No credit card &nbsp;&middot;&nbsp; ✓ Built for SMBs
          </p>
        </div>
      </div>
    </main>
  );
}
