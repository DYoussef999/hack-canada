import dynamic from 'next/dynamic';

/**
 * Dynamic import with SSR disabled — React Flow uses browser-only APIs
 * (ResizeObserver, requestAnimationFrame) that break on the server.
 */
const FinancialSandbox = dynamic(
  () => import('@/components/FinancialSandbox'),
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-zinc-950 text-zinc-500 text-sm">Loading canvas…</div> }
);

/**
 * Sandbox page — full-screen financial canvas.
 * Uses fixed positioning to break out of the root layout's max-width container
 * while keeping the sticky Navbar visible above (Navbar is z-20, canvas is z-10).
 */
export default function SandboxPage() {
  return (
    <div className="fixed inset-0 top-[57px] z-10">
      <FinancialSandbox />
    </div>
  );
}
