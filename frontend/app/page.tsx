import Link from 'next/link';
import { Network, GitBranch, Eye, Zap, BarChart3, Cpu, Layers, FlaskConical, BookOpen, Mic, ArrowRight } from 'lucide-react';

const ICON_COLORS: Record<string, string> = {
  'traffic-split':     'text-blue-600',
  'canary-release':    'text-green-600',
  'shadow-mode':       'text-violet-600',
  'latency-optimizer': 'text-orange-600',
  'drift-detection':   'text-emerald-600',
  'metrics-dashboard': 'text-emerald-600',
  'alert-threshold':   'text-emerald-600',
  'ab-significance':   'text-emerald-600',
  'retraining-trigger':'text-violet-600',
  'feature-store':     'text-violet-600',
  'skew-detector':     'text-violet-600',
  'cicd-pipeline':     'text-violet-600',
  'recommender':       'text-amber-600',
  'fraud-detection':   'text-amber-600',
  'scalability':       'text-amber-600',
  'precision-recall':  'text-amber-600',
};

interface Mod {
  slug: string; title: string; desc: string;
  Icon: React.ElementType; sections: number; questions: number;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
}

const LEVEL_STYLE = {
  Beginner:     'bg-green-50  text-green-700  border-green-200',
  Intermediate: 'bg-amber-50  text-amber-700  border-amber-200',
  Advanced:     'bg-red-50    text-red-700    border-red-200',
};

function ModuleRow({ mod, basePath }: { mod: Mod; basePath: string }) {
  const iconCls = ICON_COLORS[mod.slug] ?? 'text-gray-500';
  const { Icon } = mod;
  return (
    <Link href={`${basePath}/${mod.slug}`}>
      <div className="flex items-center gap-4 px-4 py-3 bg-white border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors last:border-0">
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
          <span className="flex items-center gap-1 text-[10px] font-medium text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
        </div>
      </div>
    </Link>
  );
}

function SectionTable({ mods, basePath }: { mods: Mod[]; basePath: string }) {
  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      {mods.map(mod => <ModuleRow key={mod.slug} mod={mod} basePath={basePath} />)}
    </div>
  );
}

const DEPLOYMENT: Mod[] = [
  { slug: 'traffic-split',     title: 'Traffic Split',     desc: 'Canary, blue-green, P99, champion/challenger, auto-rollback',    Icon: Network,   sections: 27, questions: 55, level: 'Intermediate' },
  { slug: 'canary-release',    title: 'Canary Release',    desc: 'Staged promotion, PSI gates, observation windows, Argo Rollouts', Icon: GitBranch, sections: 10, questions: 26, level: 'Intermediate' },
  { slug: 'shadow-mode',       title: 'Shadow Mode',       desc: 'Request mirroring, divergence metrics, Istio/Envoy',             Icon: Eye,       sections: 10, questions: 19, level: 'Advanced'     },
  { slug: 'latency-optimizer', title: 'Latency Optimizer', desc: 'Quantization, batching, TensorRT, caching, P99 SLA design',     Icon: Zap,       sections: 10, questions: 20, level: 'Advanced'     },
];

const MONITORING: Mod[] = [
  { slug: 'drift-detection',   title: 'Drift Detection',    desc: 'PSI, KL divergence, covariate shift, threshold calibration',    Icon: BarChart3, sections: 13, questions: 26, level: 'Intermediate' },
  { slug: 'metrics-dashboard', title: 'Four-Layer Metrics', desc: 'Infrastructure, model quality, business, data quality layers',  Icon: BarChart3, sections: 11, questions: 21, level: 'Intermediate' },
  { slug: 'alert-threshold',   title: 'Alert Threshold',    desc: 'Precision/recall tradeoffs in alerting, alert fatigue design',  Icon: BarChart3, sections: 11, questions: 20, level: 'Beginner'     },
  { slug: 'ab-significance',   title: 'A/B Significance',   desc: 'Statistical power, sample sizing, peeking problem, CUPED',     Icon: BarChart3, sections: 11, questions: 20, level: 'Intermediate' },
];

const MLOPS: Mod[] = [
  { slug: 'retraining-trigger', title: 'Retraining Triggers', desc: 'Scheduled vs drift-triggered, data flywheel, versioning',    Icon: Cpu, sections: 11, questions: 23, level: 'Intermediate' },
  { slug: 'feature-store',      title: 'Feature Store',       desc: 'Online/offline stores, training-serving skew, freshness',   Icon: Cpu, sections: 11, questions: 20, level: 'Intermediate' },
  { slug: 'skew-detector',       title: 'Skew Detector',       desc: 'Pipeline divergence, data source skew, detection methods',  Icon: Cpu, sections: 11, questions: 19, level: 'Advanced'     },
  { slug: 'cicd-pipeline',      title: 'CI/CD Pipeline',      desc: 'Model validation gates, staging, promotion automation',     Icon: Cpu, sections: 11, questions: 19, level: 'Intermediate' },
];

const SYSTEM_DESIGN: Mod[] = [
  { slug: 'recommender',      title: 'Two-Stage Recommender', desc: 'Retrieval, ranking, cold-start, feedback loop bias',         Icon: Layers, sections: 11, questions: 23, level: 'Advanced' },
  { slug: 'fraud-detection',  title: 'Fraud Detection',       desc: 'Real-time scoring, cost matrix, reject inference, skew',    Icon: Layers, sections: 11, questions: 19, level: 'Advanced' },
  { slug: 'scalability',      title: 'Scalability',           desc: 'Throughput, fan-out latency, horizontal scaling, GPU cost', Icon: Layers, sections: 11, questions: 18, level: 'Advanced' },
  { slug: 'precision-recall', title: 'Precision / Recall',    desc: 'ROC vs PR curve, calibration, class imbalance, thresholds', Icon: Layers, sections: 11, questions: 19, level: 'Beginner' },
];

const AREAS = [
  { label: 'Deployment',    Icon: Network,   color: 'text-blue-600',    mods: DEPLOYMENT,    basePath: '/labs/deployment'    },
  { label: 'Monitoring',    Icon: BarChart3, color: 'text-emerald-600', mods: MONITORING,    basePath: '/labs/monitoring'    },
  { label: 'MLOps',         Icon: Cpu,       color: 'text-violet-600',  mods: MLOPS,         basePath: '/labs/mlops'         },
  { label: 'System Design', Icon: Layers,    color: 'text-amber-600',   mods: SYSTEM_DESIGN, basePath: '/labs/system-design' },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">MLOps Playground</h1>
        <p className="text-sm text-gray-500">
          Hands-on simulators, structured study, and AI-evaluated interview prep for ML engineers.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { href: '/labs',           Icon: FlaskConical, label: 'Labs',           badge: '16 live',    desc: 'Run simulators, inject faults, observe system behavior in real time.',       badgeCls: 'bg-green-50 text-green-700 border-green-200'   },
          { href: '/study-guide',    Icon: BookOpen,     label: 'Study Guide',    badge: '180+ lessons', desc: 'Concept breakdowns with AI quiz and practice mode per section.',            badgeCls: 'bg-blue-50 text-blue-700 border-blue-200'      },
          { href: '/mock-interview', Icon: Mic,          label: 'Mock Interview', badge: '360+ Q&As', desc: 'Answer real questions. AI evaluates GOT RIGHT / MISSED / FOLLOW-UP.',        badgeCls: 'bg-violet-50 text-violet-700 border-violet-200' },
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

      <div className="flex items-center gap-6 px-4 py-3 bg-white border border-gray-200 rounded-md mb-8">
        {[
          { value: '16',   label: 'live simulators'   },
          { value: '180+', label: 'study sections'    },
          { value: '360+', label: 'interview Q&As'    },
          { value: 'AI',   label: 'eval on every answer' },
        ].map(s => (
          <div key={s.label} className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-gray-900 tabular-nums">{s.value}</span>
            <span className="text-xs text-gray-400">{s.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-xs text-gray-500">All 16 modules live</span>
        </div>
      </div>

      <div className="space-y-6">
        {AREAS.map(({ label, Icon, color, mods, basePath }) => (
          <div key={label}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h2>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">4 live</span>
            </div>
            <SectionTable mods={mods} basePath={basePath} />
          </div>
        ))}
      </div>

    </div>
  );
}
