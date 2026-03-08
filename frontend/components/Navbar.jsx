'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';

const navLinks = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Financial Sandbox', href: '/sandbox' },
  { label: 'Expansion Map', href: '/expansion' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isLoading } = useUser();

  function isActive(href) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      height: '64px',
      background: 'rgba(250, 248, 244, 0.88)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--forest-rim)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '0 24px', height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
          {/* Logo */}
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', flexShrink: 0 }}>
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '20px', fontWeight: '700',
              color: 'var(--forest)', letterSpacing: '-0.02em',
            }}>
              Ploutos
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: '4px' }}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: isActive(link.href) ? '600' : '500',
                  color: isActive(link.href) ? 'var(--forest)' : 'var(--moss)',
                  background: isActive(link.href) ? 'var(--white)' : 'transparent',
                  border: isActive(link.href) ? '1px solid var(--forest-rim)' : '1px solid transparent',
                  boxShadow: isActive(link.href) ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth buttons (desktop) */}
          {!isLoading && (
            <div className="hidden md:flex" style={{ alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
              {user ? (
                <>
                  <span style={{ color: 'var(--moss)', fontSize: '14px', fontWeight: '500', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name || user.email}
                  </span>
                  <a
                    href="/api/auth/logout"
                    style={{
                      fontSize: '14px', color: 'var(--forest)',
                      border: '1px solid var(--forest-rim)',
                      padding: '6px 16px', borderRadius: '8px',
                      textDecoration: 'none', transition: 'all 0.2s',
                    }}
                  >
                    Sign out
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="/api/auth/login?returnTo=/dashboard"
                    style={{
                      fontSize: '14px', color: 'var(--forest)',
                      border: '1px solid var(--forest-rim)',
                      padding: '6px 16px', borderRadius: '8px',
                      textDecoration: 'none', transition: 'all 0.2s',
                    }}
                  >
                    Sign in
                  </a>
                  <a
                    href="/api/auth/login?screen_hint=signup&returnTo=/dashboard"
                    style={{
                      fontSize: '14px', fontWeight: '600',
                      color: '#FFFFFF', background: 'var(--forest)',
                      padding: '6px 16px', borderRadius: '8px',
                      textDecoration: 'none', transition: 'all 0.2s',
                    }}
                  >
                    Get started &rarr;
                  </a>
                </>
              )}
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden"
            style={{ padding: '8px', borderRadius: '8px', color: 'var(--forest)', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
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
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden" style={{ borderTop: '1px solid var(--forest-rim)', background: 'var(--cream)', padding: '8px 24px 16px' }}>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                display: 'block', padding: '8px 12px', borderRadius: '8px',
                fontSize: '14px', fontWeight: isActive(link.href) ? '600' : '500',
                color: isActive(link.href) ? 'var(--forest)' : 'var(--moss)',
                background: isActive(link.href) ? 'var(--white)' : 'transparent',
                textDecoration: 'none', marginBottom: '4px',
              }}
            >
              {link.label}
            </Link>
          ))}
          {!isLoading && (
            <div style={{ paddingTop: '12px', marginTop: '8px', borderTop: '1px solid var(--forest-rim)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {user ? (
                <>
                  <span style={{ color: 'var(--moss)', fontSize: '14px', fontWeight: '500', padding: '0 12px' }}>{user.name || user.email}</span>
                  <a href="/api/auth/logout" style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', color: 'var(--forest)', textDecoration: 'none' }}>
                    Sign out
                  </a>
                </>
              ) : (
                <>
                  <a href="/api/auth/login?returnTo=/dashboard" style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', color: 'var(--forest)', textDecoration: 'none' }}>
                    Sign in
                  </a>
                  <a href="/api/auth/login?screen_hint=signup&returnTo=/dashboard" style={{ display: 'block', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', color: '#FFFFFF', background: 'var(--forest)', textAlign: 'center', textDecoration: 'none' }}>
                    Get started &rarr;
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
