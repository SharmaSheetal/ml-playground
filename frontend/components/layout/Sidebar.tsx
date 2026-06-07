"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export interface SidebarItem {
  href: string;
  label: string;
  color?: string;
}

interface SidebarProps {
  items: SidebarItem[];
  className?: string;
}

export function Sidebar({ items, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <nav className={clsx("flex flex-col gap-1 py-4 w-56 shrink-0", className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={clsx(
            "px-3 py-2 rounded-md text-sm font-medium transition-colors",
            pathname === item.href
              ? "bg-slate-800 text-slate-100"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
