import Link from 'next/link';
import { Network, GitBranch, Eye, Zap, BarChart3, Cpu, Layers, FlaskConical, BookOpen, Mic, ArrowRight } from 'lucide-react';

const MODULE_COLORS: Record<string, string> = {
  'traffic-split':     'bg-blue-50   text-blue-700   border-blue-200',
  'canary-release':    'bg-green-50  text-green-700  border-green-200',
  'shadow-mode':       'bg-violet-50 text-violet-700 border-violet-200',
  'latency-optimizer': 'bg-orange-50 text-orange-700 border-orange-200',
};

const ICON_COLORS: Record<string, string> = {
  'traffic-split':     'text-blue-600',
  'canary-release':    'text-green-600',
  'shadow-mode':       'text-violet-600',
  'latency-optimizer': 'text-orange-600',
};

interface Mod {
  slug: string; title: string; desc: string;
  Icon: React.ElementType; sections: number; questions: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced'; live: boolean;
}

const LEVEL_STYLE = {
  Beginner:     'bg-green-50  text-green-700  border-green-200',
  Intermediate: 'bg-amber-50  text-amber-700  border-amber-200',
  Advanced:     'bg-red-50    text-red-700    border-red-200',
};

function ModuleRow({ mod, href }: { mod: Mod; href: string }) {
  const iconCls = ICON_COLORS[mod.slug] ?? 'text-gray-500';
  const { Icon } = mod;

  const row = (
    <div className={[
      'flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-100 transition-colors',
      mod.live ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-50 cursor-not-allowed',
    ].join(' ')}>
      <div className="w-7 h-7 rounded flex items-center justify-center bg-gray-50 border border-gray-200 shrink-0">
        <Icon className={`w-3.5 h-3.5 ${iconCls}`} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{mod.title}</span>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{mod.desc}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${LEVEL_STYLE[mod.level]}`}>
          {mod.level}
        </span>
        <span className="text-xs text-gray-400 tabular-nums hidden md:block">{mod.sections}L · {mod.questions}Q</span>
        {mod.live ? (
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live
          </span>
        ) : (
          <span className="text-[10px] font-medium text-gray-400">Soon</span>
        )}
        {mod.live && <ArrowRight className="w-3.5 h-3.5 text-gray-300" />}
      </div>
    </div>
  );

  if (!mod.live) return row;
  return <Link href={href}>{row}</Link>;
}

const DEPLOYMENT: Mod[] = [
  { slug: 'traffic-split',     title: 'Traffic Split',     desc: 'Canary, blue-green, P99, champion/challenger, auto-rollback',   Icon: Network,   sections: 27, questions: 55, level: 'Intermediate', live: true  },
  { slug: 'canary-release',    title: 'Canary Release',    desc: 'Staged promotion, PSI gates, observation windows, Argo Rollouts', Icon: GitBranch, sections: 10, questions: 26, level: 'Intermediate', live: true  },
  { slug: 'shadow-mode',       title: 'Shadow Mode',       desc: 'Request mirroring, divergence metrics, Istio/Envoy',             Icon: Eye,       sections: 10, questions: 19, level: 'Advanced',     live: true  },
  { slug: 'latency-optimizer', title: 'Latency Optimizer', desc: 'Quantization, batching, TensorRT, caching, P50/P99 SLA design', Icon: Zap,       sections: 10, questions: 20, level: 'Advanced',     live: true  },
];

function SectionTable({ mods, basePath }: { mods: Mod[]; basePath: string }) {
  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      {mods.map(mod => (
        <ModuleRow key={mod.slug} mod={mod} href={`${basePath}/${mod.slug}`} />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">MLOps Playground</h1>
        <p className="text-sm text-gray-500">
          Hands-on simulators, structured study, and AI-evaluated interview prep for ML engineers.
        </p>
      </div>

      {/* Learning mode cards */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { href: '/labs',           Icon: FlaskConical, label: 'Labs',           badge: '4 live',   desc: 'Run simulators, inject faults, observe system behavior in real time.',          badgeCls: 'bg-green-50 text-green-700 border-green-200' },
          { href: '/study-guide',    Icon: BookOpen,     label: 'Study Guide',    badge: '57 lessons', desc: 'Concept breakdowns with AI quiz and practice mode per section.',              badgeCls: 'bg-blue-50 text-blue-700 border-blue-200'   },
          { href: '/mock-interview', Icon: Mic,          label: 'Mock Interview', badge: '120+ Q&As', desc: 'Answer real questions. AI evaluates GOT RIGHT / MISSED / FOLLOW-UP.',         badgeCls: 'bg-violet-50 text-violet-700 border-violet-200' },
        ].map(({ href, Icon, label, badge, desc, badgeCls }) => (
          <Link key={href} href={href}>
            <div className="bg-white border border-gray-200 rounded-md p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer h-full">
              <div className="flex items-start justify-between mb-2">
                <div className="w-7 h-7 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeCls}`}>{badge}</span>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Stats strip */}
      <div className="flex items-center gap-6 px-4 py-3 bg-white border border-gray-200 rounded-md mb-8">
        {[
          { value: '4',    label: 'live simulators' },
          { value: '57',   label: 'study sections'  },
          { value: '120+', label: 'interview Q&As'  },
          { value: 'AI',   label: 'eval on every answer' },
        ].map(s => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{s.value}</span>
            <span className="text-xs text-gray-400">{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">Deployment module live</span>
        </div>
      </div>

      {/* Module table */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Network className="w-3.5 h-3.5 text-blue-600" />
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Deployment</h2>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">4 live</span>
          </div>
          <SectionTable mods={DEPLOYMENT} basePath="/labs/deployment" />
        </div>

        {/* Coming soon categories */}
        {[
          { label: 'Monitoring',    Icon: BarChart3, color: 'text-emerald-600', titles: ['Drift Detection', 'Four-Layer Metrics', 'Alert Threshold', 'A/B Significance'] },
          { label: 'MLOps',         Icon: Cpu,       color: 'text-violet-600',  titles: ['Retraining Triggers', 'Feature Store', 'Skew Detector', 'CI/CD Pipeline'] },
          { label: 'System Design', Icon: Layers,    color: 'text-amber-600',   titles: ['Two-Stage Recommender', 'Fraud Detection', 'Scalability', 'Precision/Recall'] },
        ].map(({ label, Icon, color, titles }) => (
          <div key={label}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h2>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-200">Coming soon</span>
            </div>
            <div className="rounded-md border border-gray-200 overflow-hidden">
              {titles.map(title => (
                <div key={title} className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100 opacity-50 last:border-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                  <span className="text-sm text-gray-400">{title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
