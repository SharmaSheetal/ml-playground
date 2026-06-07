import Link from 'next/link';
import { Rocket, BarChart3, Cpu, Layers, Zap } from 'lucide-react';

const LIVE_SIMULATORS = new Set(["deployment/traffic-split", "deployment/canary-release"]);

const TOPIC_AREAS = [
  {
    id:    "deployment",
    label: "Deployment",
    Icon:  Rocket,
    color: "text-blue-400",
    iconBg: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    cardHover: "hover:border-blue-500/40",
    simulators: [
      { slug: "traffic-split",     title: "Traffic Split Playground",       desc: "Live packet routing, canary weights, degradation gates" },
      { slug: "canary-release",    title: "Canary Release Stepper",         desc: "Staged promotion, automated gates, fault injection" },
      { slug: "shadow-mode",       title: "Shadow Mode Differ",             desc: "Request mirroring, output comparison" },
      { slug: "latency-optimizer", title: "Latency Optimizer",             desc: "Batching, caching, serving patterns" },
    ],
  },
  {
    id:    "monitoring",
    label: "Metrics & Monitoring",
    Icon:  BarChart3,
    color: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    cardHover: "hover:border-emerald-500/40",
    simulators: [
      { slug: "drift-injector",    title: "Drift Injector",                 desc: "PSI, KL divergence, distribution shift" },
      { slug: "metrics-dashboard", title: "Four-Layer Metrics Dashboard",   desc: "Infra, model, business, and data layers" },
      { slug: "alert-threshold",   title: "Alert Threshold Tuner",          desc: "Precision/recall trade-offs in alerting" },
      { slug: "ab-significance",   title: "A/B Significance Calculator",    desc: "Statistical power, sample sizes" },
      { slug: "feedback-loop",     title: "Feedback Loop Simulator",        desc: "Label propagation, online learning" },
    ],
  },
  {
    id:    "mlops",
    label: "MLOps",
    Icon:  Cpu,
    color: "text-purple-400",
    iconBg: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
    cardHover: "hover:border-purple-500/40",
    simulators: [
      { slug: "skew-detector",     title: "Training-Serving Skew Detector", desc: "Feature drift between train and serve" },
      { slug: "retraining-trigger", title: "Retraining Trigger Lab",        desc: "Scheduled vs. drift-triggered retraining" },
      { slug: "feature-store",     title: "Feature Store Visualizer",       desc: "Online/offline store, freshness, skew" },
      { slug: "cicd-pipeline",     title: "CI/CD Pipeline Runner",          desc: "Model validation, staging, promotion" },
    ],
  },
  {
    id:    "system-design",
    label: "System Design",
    Icon:  Layers,
    color: "text-amber-400",
    iconBg: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    cardHover: "hover:border-amber-500/40",
    simulators: [
      { slug: "recommender",       title: "Two-Stage Recommender Simulator", desc: "Retrieval, ranking, business rules" },
      { slug: "fraud-detection",   title: "Fraud Detection Flow",           desc: "Real-time scoring, threshold tuning" },
      { slug: "scalability",       title: "Scalability Stress Tester",      desc: "Throughput, latency, auto-scaling" },
      { slug: "precision-recall",  title: "Precision/Recall Explorer",      desc: "Trade-off visualization, threshold impact" },
      { slug: "build-vs-buy",      title: "Build vs Buy Calculator",        desc: "Cost modeling, make-or-buy decisions" },
    ],
  },
];

export default function LabsPage() {
  const liveCount = LIVE_SIMULATORS.size;
  const totalCount = TOPIC_AREAS.reduce((s, a) => s + a.simulators.length, 0);

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-10 space-y-3">
        <h1 className="text-3xl font-bold text-slate-100">Labs</h1>
        <p className="text-slate-400 max-w-xl">
          Interactive simulators across four MLOps domains. Each one is built to surface the
          trade-offs and failure modes that matter in real production systems.
        </p>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <Zap className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-mono text-slate-300">{liveCount} live</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-xs font-mono text-slate-400">{totalCount - liveCount} coming soon</span>
          </div>
        </div>
      </div>

      {/* Topic areas */}
      <div className="space-y-12">
        {TOPIC_AREAS.map((area) => {
          const AreaIcon = area.Icon;
          return (
            <section key={area.id}>
              <div className="flex items-center gap-2.5 mb-5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${area.iconBg}`}>
                  <AreaIcon className={`w-4 h-4 ${area.color}`} />
                </div>
                <h2 className={`text-sm font-bold uppercase tracking-widest ${area.color}`}>
                  {area.label}
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {area.simulators.map((sim) => {
                  const key  = `${area.id}/${sim.slug}`;
                  const live = LIVE_SIMULATORS.has(key);
                  return live ? (
                    <Link key={sim.slug} href={`/labs/${key}`} className="group">
                      <div className={`h-full bg-slate-900 border ${area.borderColor} rounded-xl p-4 transition-all duration-200 ${area.cardHover} hover:bg-slate-800/60 hover:-translate-y-0.5`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                            {sim.title}
                          </span>
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                            <Zap className="w-2.5 h-2.5" />
                            Live
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">{sim.desc}</p>
                      </div>
                    </Link>
                  ) : (
                    <div key={sim.slug} className="h-full bg-slate-900/30 border border-slate-800/60 rounded-xl p-4 opacity-50 cursor-not-allowed">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-slate-400">{sim.title}</span>
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-slate-800 border border-slate-700/60 text-slate-500 text-[10px] font-bold">
                          Soon
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{sim.desc}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
