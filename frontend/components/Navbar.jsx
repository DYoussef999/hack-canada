"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Save, Compass } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sandbox",   label: "Financial Canvas" },
  { href: "/optimizer", label: "Optimizer" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 sticky top-0 z-20">
      <div className="max-w-[1600px] mx-auto px-6 py-3.5 flex items-center justify-between gap-6">

        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <span className="text-zinc-100 font-bold text-base tracking-tight">
            Compass <span className="text-blue-400">AI</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-0.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-px h-4 bg-zinc-800" />
          <button
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold transition-colors"
            onClick={() => alert("Scenario saved! (persistence coming soon)")}
          >
            <Save className="w-3.5 h-3.5" />
            Save Scenario
          </button>
        </div>

      </div>
    </nav>
  );
}
