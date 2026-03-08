'use client';

import { usePathname } from 'next/navigation';
import Navbar from './Navbar';

export default function LayoutShell({ children }) {
  const pathname = usePathname();
  const isFullscreen = pathname === '/' || pathname === '/auth' || pathname === '/dashboard';

  if (isFullscreen) return <>{children}</>;

  return (
    <>
      <Navbar />
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </>
  );
}
