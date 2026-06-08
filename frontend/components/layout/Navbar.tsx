"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AIToggle } from "@/components/ui/AIToggleModal";

const NAV_LINKS = [
  { href: "/labs",           label: "Labs"           },
  { href: "/study-guide",    label: "Study Guide"    },
  { href: "/mock-interview", label: "Mock Interview" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="h-12 bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold" style={{ fontSize: 9 }}>ML</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">MLOps Playground</span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {NAV_LINKS.map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "px-3 py-1.5 rounded text-sm font-medium transition-colors",
                    active
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <AIToggle />
      </div>
    </header>
  );
}
