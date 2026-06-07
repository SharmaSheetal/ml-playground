import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const SECTIONS = [
  {
    href: "/study-guide",
    title: "Study Guide",
    description:
      "Curated theory and concepts — one section per simulator, built incrementally.",
    badge: "Coming soon",
    badgeColor: "slate" as const,
    icon: "📖",
  },
  {
    href: "/mock-interview",
    title: "Mock Interview",
    description:
      "Practice with real MLOps interview questions across all four domains.",
    badge: "Coming soon",
    badgeColor: "slate" as const,
    icon: "🎯",
  },
  {
    href: "/labs",
    title: "Labs",
    description:
      "Interactive simulators for deployment, monitoring, MLOps, and system design.",
    badge: "Active",
    badgeColor: "emerald" as const,
    icon: "⚗️",
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <div className="mb-14">
        <h1 className="text-4xl font-bold text-slate-100 mb-3">
          ML Ops Playground
        </h1>
        <p className="text-slate-400 text-lg max-w-xl">
          Learn MLOps by doing — interactive simulators, structured theory, and
          interview prep in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group block">
            <Card className="h-full hover:border-slate-500 transition-colors cursor-pointer">
              <div className="text-3xl mb-4">{s.icon}</div>
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-lg font-semibold text-slate-100">
                  {s.title}
                </h2>
                <Badge color={s.badgeColor}>{s.badge}</Badge>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                {s.description}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
