import Link from 'next/link';
import { Network, GitBranch, Eye, Zap, BarChart3, Cpu, Layers, ArrowRight } from 'lucide-react';

const LIVE = new Set([
  'deployment/traffic-split',
  'deployment/canary-release',
  'deployment/shadow-mode',
  'deployment/latency-optimizer',
  'monitoring/drift-detection',
  'monitoring/metrics-dashboard',
  'monitoring/alert-threshold',
  'monitoring/ab-significance',
  'mlops/retraining-trigger',
  'mlops/feature-store',
  'mlops/skew-detector',
  'mlops/cicd-pipeline',
  'system-design/recommender',
  'system-design/fraud-detection',
  'system-design/scalability',
  'system-design/precision-recall',
]);

const LEVEL_STYLE: Record<string, string> = {
  Beginner:     'bg-green-50 text-green-700 border-green-200',
  Intermediate: 'bg-amber-50 text-amber-700 border-amber-200',
  Advanced:     'bg-red-50   text-red-700   border-red-200',
};

interface Sim {
  slug:      string;
  title:     string;
  desc:      string;
  Icon:      React.ElementType;
  level:     string;
  tags:      string[];
  modes?:    string[];   // injectable fault/config modes — only on live sims
  duration?: string;
  gates?:    number;
}

interface Area {
  id: string; label: string; Icon: React.ElementType; color: string; sims: Sim[];
}

const AREAS: Area[] = [
  {
    id: 'deployment', label: 'Deployment', Icon: Network, color: 'text-blue-600',
    sims: [
      {
        slug: 'traffic-split', title: 'Traffic Split', level: 'Intermediate',
        desc: 'Live routing, degradation modes, auto-rollback, champion/challenger',
        Icon: Network, tags: ['canary', 'P99', 'gates'],
        modes: ['v1-degrade', 'v2-degrade', 'auto-rollback'], duration: '~45 min', gates: 4,
      },
      {
        slug: 'canary-release', title: 'Canary Release', level: 'Intermediate',
        desc: 'Staged promotion with automated PSI gates and observation windows',
        Icon: GitBranch, tags: ['PSI', 'staged', 'Argo'],
        modes: ['latency-fault', 'error-fault', 'abort'], duration: '~30 min', gates: 3,
      },
      {
        slug: 'shadow-mode', title: 'Shadow Mode Differ', level: 'Advanced',
        desc: 'Mirror traffic, compare predictions, measure divergence with NDCG',
        Icon: Eye, tags: ['Istio', 'NDCG', 'mirror'],
        modes: ['latency-fault', 'error-fault', 'diverge'], duration: '~35 min', gates: 4,
      },
      {
        slug: 'latency-optimizer', title: 'Latency Optimizer', level: 'Advanced',
        desc: 'Quantization, TensorRT, batching, caching — observe P50/P99 impact',
        Icon: Zap, tags: ['TensorRT', 'INT8', 'P99'],
        modes: ['fp16', 'int8', 'tensorrt', 'cache', 'async'], duration: '~40 min', gates: 5,
      },
    ],
  },
  {
    id: 'monitoring', label: 'Monitoring', Icon: BarChart3, color: 'text-emerald-600',
    sims: [
      { slug: 'drift-detection',   title: 'Drift Detection',       desc: 'PSI, KL divergence, covariate shift detection, alerting',             Icon: BarChart3, level: 'Intermediate', tags: ['PSI', 'KL', 'shift'],    modes: ['inject-drift', 'clear-drift', 'threshold'],      duration: '~30 min', gates: 3 },
      { slug: 'metrics-dashboard', title: 'Four-Layer Metrics',    desc: 'Infrastructure, model quality, business, and data metric layers',      Icon: BarChart3, level: 'Intermediate', tags: ['SLA', 'layers'],         modes: ['infra-fault', 'model-fault', 'cascade'],          duration: '~25 min', gates: 4 },
      { slug: 'alert-threshold',   title: 'Alert Threshold Tuner', desc: 'Precision/recall tradeoffs in alerting, alert fatigue modeling',       Icon: BarChart3, level: 'Beginner',     tags: ['precision', 'recall'],   modes: ['fp-cost', 'fn-cost', 'prevalence'],               duration: '~20 min', gates: 2 },
      { slug: 'ab-significance',   title: 'A/B Significance',      desc: 'Statistical power, sample sizing, peeking problem, bandits',          Icon: BarChart3, level: 'Intermediate', tags: ['p-value', 'power'],      modes: ['advance-day', 'rate-adjust', 'alpha'],            duration: '~25 min', gates: 3 },
    ],
  },
  {
    id: 'mlops', label: 'MLOps', Icon: Cpu, color: 'text-violet-600',
    sims: [
      { slug: 'retraining-trigger', title: 'Retraining Triggers', desc: 'Scheduled vs drift-triggered retraining, data flywheel, versioning', Icon: Cpu, level: 'Intermediate', tags: ['drift', 'flywheel'],    modes: ['perf-trigger', 'drift-trigger', 'scheduled'],    duration: '~30 min', gates: 3 },
      { slug: 'feature-store',      title: 'Feature Store',       desc: 'Online vs offline stores, training-serving skew, feature freshness', Icon: Cpu, level: 'Intermediate', tags: ['skew', 'freshness'],    modes: ['online', 'offline', 'pit-correct'],               duration: '~25 min', gates: 2 },
      { slug: 'skew-detector',      title: 'Skew Detector',       desc: 'Detect distribution mismatch between training and serving features',  Icon: Cpu, level: 'Advanced',     tags: ['skew', 'distribution'], modes: ['preprocessing', 'feature-compute', 'serving'],    duration: '~25 min', gates: 3 },
      { slug: 'cicd-pipeline',      title: 'CI/CD Pipeline',      desc: 'Model validation, staging gates, promotion automation',              Icon: Cpu, level: 'Intermediate', tags: ['CI/CD', 'validation'],  modes: ['run-pipeline', 'inject-failure', 'rollback'],     duration: '~20 min', gates: 6 },
    ],
  },
  {
    id: 'system-design', label: 'System Design', Icon: Layers, color: 'text-amber-600',
    sims: [
      { slug: 'recommender',      title: 'Two-Stage Recommender', desc: 'Retrieval, ranking, cold-start strategies, business rule injection', Icon: Layers, level: 'Advanced',      tags: ['ANN', 'ranking'],        modes: ['retrieval', 'ranking-model', 'diversity'],        duration: '~35 min', gates: 3 },
      { slug: 'fraud-detection',  title: 'Fraud Detection',       desc: 'Real-time scoring, threshold tuning, reject inference',              Icon: Layers, level: 'Advanced',      tags: ['real-time', 'threshold'], modes: ['threshold', 'sampling', 'reject-inf'],            duration: '~30 min', gates: 4 },
      { slug: 'scalability',      title: 'Scalability Tester',    desc: 'Throughput, fan-out latency, horizontal vs vertical scaling',        Icon: Layers, level: 'Advanced',      tags: ['throughput', 'fan-out'],  modes: ['horizontal', 'batching', 'gpu'],                  duration: '~30 min', gates: 3 },
      { slug: 'precision-recall', title: 'Precision / Recall',    desc: 'Threshold impact, ROC curves, business cost matrices',              Icon: Layers, level: 'Beginner',      tags: ['ROC', 'F1', 'threshold'], modes: ['task-type', 'threshold', 'imbalance'],            duration: '~20 min', gates: 2 },
    ],
  },
];

function SimRow({ sim, category }: { sim: Sim; category: string }) {
  const key  = `${category}/${sim.slug}`;
  const live = LIVE.has(key);
  const { Icon } = sim;

  const row = (
    <div className={[
      'flex items-start gap-3 px-4 bg-white border-b border-gray-100 last:border-0 transition-colors',
      live ? 'py-3.5 hover:bg-gray-50 cursor-pointer' : 'py-3 opacity-40 cursor-not-allowed',
    ].join(' ')}>

      {/* Icon */}
      <div className="w-6 h-6 rounded flex items-center justify-center bg-gray-50 border border-gray-200 shrink-0 mt-0.5">
        <Icon className="w-3 h-3 text-gray-500" />
      </div>

      {/* Title + desc + mode chips */}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">{sim.title}</span>
        <p className="text-xs text-gray-400 mt-0.5">{sim.desc}</p>
        {live && sim.modes && (
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            {sim.modes.map(m => (
              <span key={m} className="px-1.5 py-0.5 rounded text-[10px] font-mono text-gray-500 bg-gray-50 border border-gray-200">
                {m}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right metadata */}
      <div className="flex items-center gap-3 shrink-0 self-center">
        {live && sim.duration && (
          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-gray-400 tabular-nums">
            <span>{sim.duration}</span>
            <span className="text-gray-200">·</span>
            <span>{sim.gates} gates</span>
          </div>
        )}
        <span className={`hidden lg:inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${LEVEL_STYLE[sim.level] ?? ''}`}>
          {sim.level}
        </span>
        {live ? (
          <>
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

  if (!live) return row;
  return <Link href={`/labs/${key}`}>{row}</Link>;
}

export default function LabsPage() {
  const live  = LIVE.size;
  const total = AREAS.reduce((s, a) => s + a.sims.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Labs</h1>
          <p className="text-sm text-gray-500">
            Interactive simulators. Inject faults, watch automated gates respond, observe metrics live.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            {live} live
          </span>
          <span className="text-gray-300">·</span>
          <span>{total - live} coming soon</span>
        </div>
      </div>

      <div className="space-y-8">
        {AREAS.map(area => {
          const { Icon } = area;
          const areaLive = area.sims.filter(s => LIVE.has(`${area.id}/${s.slug}`)).length;
          return (
            <div key={area.id}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-3.5 h-3.5 ${area.color}`} />
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{area.label}</h2>
                {areaLive > 0 ? (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">{areaLive} live</span>
                ) : (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-gray-50 text-gray-400 border-gray-200">Coming soon</span>
                )}
              </div>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                {area.sims.map(sim => (
                  <SimRow key={sim.slug} sim={sim} category={area.id} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
