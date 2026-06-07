import Link from 'next/link';
import { Rocket, BarChart3, Cpu, Layers } from 'lucide-react';

const CATEGORIES = [
  {
    id:    'deployment',
    label: 'Deployment',
    color: 'blue',
    Icon:  Rocket,
    modules: [
      {
        slug:        'deployment/traffic-split',
        title:       'Traffic Split',
        description: 'Canary, blue/green, shadow mode, rollback, P99, champion/challenger, serving patterns.',
        sections:    27,
        live:        true,
      },
      {
        slug:        'deployment/canary-release',
        title:       'Canary Release',
        description: 'Staged traffic promotion, observation windows, automated gates, PSI, Argo Rollouts.',
        sections:    10,
        live:        true,
      },
      {
        slug:        'deployment/shadow-mode',
        title:       'Shadow Mode',
        description: 'Request mirroring, output comparison, risk-free validation.',
        sections:    0,
        live:        false,
      },
    ],
  },
  {
    id:    'monitoring',
    label: 'Monitoring',
    color: 'emerald',
    Icon:  BarChart3,
    modules: [
      {
        slug:        'monitoring/drift-detection',
        title:       'Drift Detection',
        description: 'Feature drift, concept drift, PSI, KL divergence, alerting strategies.',
        sections:    0,
        live:        false,
      },
      {
        slug:        'monitoring/metrics-layers',
        title:       'Four-Layer Metrics',
        description: 'Infrastructure, model quality, business, and data quality metric layers.',
        sections:    0,
        live:        false,
      },
    ],
  },
  {
    id:    'mlops',
    label: 'MLOps',
    color: 'purple',
    Icon:  Cpu,
    modules: [
      {
        slug:        'mlops/retraining',
        title:       'Retraining Triggers',
        description: 'Scheduled vs. drift-triggered retraining, data flywheel, versioning.',
        sections:    0,
        live:        false,
      },
      {
        slug:        'mlops/feature-store',
        title:       'Feature Store',
        description: 'Online vs. offline stores, training-serving skew, feature freshness.',
        sections:    0,
        live:        false,
      },
    ],
  },
  {
    id:    'system-design',
    label: 'System Design',
    color: 'rose',
    Icon:  Layers,
    modules: [
      {
        slug:        'system-design/recommender',
        title:       'Two-Stage Recommender',
        description: 'Candidate retrieval, ranking, business rules, cold-start strategies.',
        sections:    0,
        live:        false,
      },
    ],
  },
];

const COLOR = {
  blue:    { icon: 'text-blue-400',    iconBg: 'bg-blue-500/10',    badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',    heading: 'text-blue-400',    card: 'hover:border-blue-500/30' },
  emerald: { icon: 'text-emerald-400', iconBg: 'bg-emerald-500/10', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', heading: 'text-emerald-400', card: 'hover:border-emerald-500/30' },
  purple:  { icon: 'text-purple-400',  iconBg: 'bg-purple-500/10',  badge: 'bg-purple-500/10 border-purple-500/20 text-purple-400',  heading: 'text-purple-400',  card: 'hover:border-purple-500/30' },
  rose:    { icon: 'text-rose-400',    iconBg: 'bg-rose-500/10',    badge: 'bg-rose-500/10 border-rose-500/20 text-rose-400',    heading: 'text-rose-400',    card: 'hover:border-rose-500/30' },
} as const;

const totalSections = CATEGORIES.flatMap(c => c.modules).reduce((s, m) => s + m.sections, 0);
const liveModules   = CATEGORIES.flatMap(c => c.modules).filter(m => m.live).length;

export default function StudyGuidePage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Study Guide</h1>
        <p className="text-slate-400 max-w-2xl leading-relaxed">
          Deep-dive study materials for every simulator. Each module has concept breakdowns,
          AI-generated quiz questions, and a practice interview mode with structured feedback.
        </p>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-mono text-slate-300">{liveModules} live modules</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <span className="text-xs font-mono text-slate-300">{totalSections}+ sections</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span className="text-xs font-mono text-slate-300">AI quiz + practice per section</span>
          </div>
        </div>
      </div>

      {/* Categories */}
      {CATEGORIES.map(cat => {
        const c = COLOR[cat.color as keyof typeof COLOR];
        const CatIcon = cat.Icon;
        return (
          <section key={cat.id} className="space-y-4">
            <div className="flex items-center gap-2.5">
              <CatIcon className={`w-4 h-4 ${c.icon}`} />
              <h2 className={`text-sm font-bold uppercase tracking-widest ${c.heading}`}>{cat.label}</h2>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.modules.map(mod => mod.live ? (
                <Link key={mod.slug} href={`/study-guide/${mod.slug}`}>
                  <div className={`group h-full bg-slate-900 border border-slate-800 rounded-xl p-5 cursor-pointer transition-all duration-200 ${c.card} hover:bg-slate-800/60`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                        {mod.title}
                      </h3>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${c.badge}`}>
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{mod.description}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                      <span>{mod.sections} sections</span>
                      <span>·</span>
                      <span>AI quiz</span>
                      <span>·</span>
                      <span>Practice</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div key={mod.slug} className="h-full bg-slate-900/40 border border-slate-800/60 rounded-xl p-5 opacity-50 cursor-not-allowed">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="text-sm font-medium text-slate-400">{mod.title}</h3>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-500">
                      Soon
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{mod.description}</p>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
