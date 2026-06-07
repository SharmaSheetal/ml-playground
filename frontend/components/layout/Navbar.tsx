"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { AIToggle } from "@/components/ui/AIToggleModal";

const NAV_LINKS = [
  { href: "/study-guide", label: "Study Guide" },
  { href: "/mock-interview", label: "Mock Interview" },
  { href: "/labs", label: "Labs" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-slate-100 font-bold text-sm tracking-tight"
          >
            ML Ops Playground
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith(link.href)
                    ? "bg-slate-800 text-slate-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <AIToggle />
      </div>
    </header>
  );
}
