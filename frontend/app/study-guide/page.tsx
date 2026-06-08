import Link from 'next/link';
import { Network, GitBranch, Eye, Zap, BarChart3, Cpu, Layers, ArrowRight } from 'lucide-react';

interface Mod {
  slug: string; title: string; desc: string;
  Icon: React.ElementType; sections: number; live: boolean; category: string;
}
interface Area { id: string; label: string; Icon: React.ElementType; color: string; mods: Mod[]; }

const AREAS: Area[] = [
  {
    id: 'deployment', label: 'Deployment', Icon: Network, color: 'text-blue-600',
    mods: [
      { slug: 'traffic-split',     title: 'Traffic Split',     desc: 'Canary vs blue-green, P99, champion/challenger, rollback mechanics',      Icon: Network,   sections: 27, live: true,  category: 'deployment' },
      { slug: 'canary-release',    title: 'Canary Release',    desc: 'Staged promotion, observation windows, PSI gates, Argo Rollouts',         Icon: GitBranch, sections: 10, live: true,  category: 'deployment' },
      { slug: 'shadow-mode',       title: 'Shadow Mode',       desc: 'Request mirroring, divergence metrics, Istio/Envoy, stateful constraints', Icon: Eye,       sections: 10, live: true,  category: 'deployment' },
      { slug: 'latency-optimizer', title: 'Latency Optimizer', desc: 'Quantization, batching, TensorRT, caching, SLA design',                  Icon: Zap,       sections: 10, live: true,  category: 'deployment' },
    ],
  },
  {
    id: 'monitoring', label: 'Monitoring', Icon: BarChart3, color: 'text-emerald-600',
    mods: [
      { slug: 'drift-detection',   title: 'Drift Detection',    desc: 'PSI, KL divergence, covariate shift, alerting strategies',   Icon: BarChart3, sections: 13, live: true, category: 'monitoring' },
      { slug: 'metrics-dashboard', title: 'Four-Layer Metrics', desc: 'Infrastructure, model quality, business, data quality layers', Icon: BarChart3, sections: 11, live: true, category: 'monitoring' },
      { slug: 'alert-threshold',   title: 'Alert Threshold',    desc: 'Precision/recall tradeoffs in alerting, alert fatigue',       Icon: BarChart3, sections: 11, live: true, category: 'monitoring' },
      { slug: 'ab-significance',   title: 'A/B Significance',   desc: 'Statistical power, sample sizing, multi-armed bandits',      Icon: BarChart3, sections: 11, live: true, category: 'monitoring' },
    ],
  },
  {
    id: 'mlops', label: 'MLOps', Icon: Cpu, color: 'text-violet-600',
    mods: [
      { slug: 'retraining-trigger', title: 'Retraining Triggers', desc: 'Scheduled vs drift-triggered, data flywheel, versioning', Icon: Cpu, sections: 11, live: true, category: 'mlops' },
      { slug: 'feature-store',      title: 'Feature Store',       desc: 'Online/offline stores, training-serving skew, freshness', Icon: Cpu, sections: 11, live: true, category: 'mlops' },
      { slug: 'skew-detector',      title: 'Skew Detector',       desc: 'Distribution mismatch between training and serving',      Icon: Cpu, sections: 11, live: true, category: 'mlops' },
      { slug: 'cicd-pipeline',      title: 'CI/CD Pipeline',      desc: 'Model validation, staging gates, promotion automation',   Icon: Cpu, sections: 11, live: true, category: 'mlops' },
    ],
  },
  {
    id: 'system-design', label: 'System Design', Icon: Layers, color: 'text-amber-600',
    mods: [
      { slug: 'recommender',      title: 'Two-Stage Recommender', desc: 'Retrieval, ranking, cold-start, business rules', Icon: Layers, sections: 11, live: true, category: 'system-design' },
      { slug: 'fraud-detection',  title: 'Fraud Detection',       desc: 'Real-time scoring, threshold tuning',            Icon: Layers, sections: 11, live: true, category: 'system-design' },
      { slug: 'scalability',      title: 'Scalability',           desc: 'Throughput, fan-out latency, scaling tradeoffs', Icon: Layers, sections: 11, live: true, category: 'system-design' },
      { slug: 'precision-recall', title: 'Precision / Recall',    desc: 'ROC curves, threshold impact, cost matrices',    Icon: Layers, sections: 11, live: true, category: 'system-design' },
    ],
  },
];

function ModRow({ mod }: { mod: Mod }) {
  const { Icon } = mod;
  const row = (
    <div className={[
      'flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 last:border-0 transition-colors',
      mod.live ? 'hover:bg-gray-50 cursor-pointer' : 'opacity-40 cursor-not-allowed',
    ].join(' ')}>
      <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-50 border border-gray-200 shrink-0">
        <Icon className="w-3 h-3 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{mod.title}</span>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{mod.desc}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {mod.live ? (
          <>
            <span className="text-xs text-gray-400">{mod.sections} sections</span>
            <span className="flex items-center gap-1 text-[10px] font-medium text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Live
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
          </>
        ) : (
          <span className="text-[10px] text-gray-400">Soon</span>
        )}
      </div>
    </div>
  );
  if (!mod.live) return row;
  return <Link href={`/study-guide/${mod.category}/${mod.slug}`}>{row}</Link>;
}

const totalLive     = AREAS.flatMap(a => a.mods).filter(m => m.live).length;
const totalSections = AREAS.flatMap(a => a.mods).reduce((s, m) => s + m.sections, 0);

export default function StudyGuidePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Study Guide</h1>
          <p className="text-sm text-gray-500">
            Deep-dive study material for every simulator. AI quiz, practice interview, and ask-AI per section.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {totalLive} live modules
          </span>
          <span className="text-gray-300">·</span>
          <span>{totalSections} sections</span>
        </div>
      </div>

      <div className="space-y-8">
        {AREAS.map(area => {
          const { Icon } = area;
          const areaLive = area.mods.filter(m => m.live).length;
          return (
            <div key={area.id}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${area.color}`} />
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{area.label}</h2>
                {areaLive > 0
                  ? <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">{areaLive} live</span>
                  : <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-200">Coming soon</span>
                }
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {area.mods.map(mod => <ModRow key={mod.slug} mod={mod} />)}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
