import Link from 'next/link';
import {
  FlaskConical, BookOpen, Mic, Rocket, BarChart3,
  Cpu, Layers, ArrowRight, Circle, Zap,
} from 'lucide-react';

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-2.5 px-4 py-2 rounded-full border bg-slate-900/60 backdrop-blur ${color}`}>
      <span className="text-sm font-bold text-slate-100">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function FeatureCard({
  href, Icon, iconColor, iconBg, title, subtitle, badge, badgeColor, features, accentBorder,
}: {
  href: string;
  Icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  features: string[];
  accentBorder: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className={`relative h-full bg-slate-900 border border-slate-800 rounded-2xl p-6 transition-all duration-300 hover:border-opacity-60 hover:-translate-y-0.5 hover:shadow-xl ${accentBorder} overflow-hidden`}>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

        <div className="relative space-y-4">
          <div className="flex items-start justify-between">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>{badge}</span>
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-100 group-hover:text-white transition-colors">{title}</h2>
            <p className="text-sm text-slate-400 mt-1 leading-relaxed">{subtitle}</p>
          </div>

          <ul className="space-y-1.5">
            {features.map(f => (
              <li key={f} className="flex items-center gap-2 text-xs text-slate-500">
                <Circle className="w-1 h-1 fill-slate-600 stroke-none shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors pt-1">
            <span>Open</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}

function ModuleChip({ label, status, color }: { label: string; status: 'live' | 'soon'; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
      status === 'live'
        ? color
        : 'bg-slate-900/40 border-slate-800/60 text-slate-600 cursor-not-allowed opacity-60'
    }`}>
      <Zap className={`w-2.5 h-2.5 shrink-0 ${status === 'live' ? 'text-emerald-400' : 'text-slate-600'}`} />
      {label}
      {status === 'live' && <span className="ml-auto text-emerald-500 text-[10px] font-bold">LIVE</span>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-[0.04]"
            style={{ background: 'radial-gradient(ellipse, #6366f1 0%, transparent 70%)' }} />
          <div className="absolute top-20 left-1/4 w-[400px] h-[300px] rounded-full opacity-[0.025]"
            style={{ background: 'radial-gradient(ellipse, #f59e0b 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-xs font-mono text-slate-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            2 live simulators · actively building
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-slate-100 leading-[1.05] mb-6">
            Learn MLOps by{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                breaking things
              </span>
              <span className="absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-indigo-500/0 via-violet-500/50 to-purple-500/0" />
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-10">
            Interactive simulators for deployment, monitoring, and system design. Inject faults, watch
            gates fire, practice interviews with AI feedback — the stuff that doesn't show up in docs.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <Stat value="2"   label="Live simulators"          color="border-emerald-500/20" />
            <Stat value="37"  label="Study sections"           color="border-indigo-500/20"  />
            <Stat value="80+" label="Interview Q&As"           color="border-violet-500/20"  />
            <Stat value="AI"  label="Feedback on every answer" color="border-amber-500/20"   />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/labs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/25">
              Open Labs
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/study-guide"
              className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm transition-all">
              Study Guide
            </Link>
            <Link href="/mock-interview"
              className="px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-semibold text-sm transition-all">
              Mock Interview
            </Link>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FeatureCard
            href="/labs"
            Icon={FlaskConical}
            iconColor="text-emerald-400"
            iconBg="bg-emerald-500/10 border border-emerald-500/20"
            title="Labs"
            subtitle="Interactive simulators with live metrics, fault injection, and automated gates."
            badge="Active"
            badgeColor="bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            accentBorder="hover:border-emerald-500/30"
            features={[
              'Traffic split with live packet flow',
              'Canary stepper with gate automation',
              'Fault injection + auto-rollback',
              '12+ simulators coming',
            ]}
          />
          <FeatureCard
            href="/study-guide"
            Icon={BookOpen}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10 border border-indigo-500/20"
            title="Study Guide"
            subtitle="Deep-dive concept breakdowns for every simulator, with AI quiz and practice mode."
            badge="Active"
            badgeColor="bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
            accentBorder="hover:border-indigo-500/30"
            features={[
              '37 sections across 2 modules',
              'AI-generated quiz per concept',
              'Practice — answer — AI feedback',
              'Ask AI anything in context',
            ]}
          />
          <FeatureCard
            href="/mock-interview"
            Icon={Mic}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10 border border-violet-500/20"
            title="Mock Interview"
            subtitle="80+ real-world MLOps questions with AI evaluation and structured signal feedback."
            badge="Active"
            badgeColor="bg-violet-500/10 border-violet-500/30 text-violet-400"
            accentBorder="hover:border-violet-500/30"
            features={[
              '80+ questions across all domains',
              'AI evaluates GOT RIGHT / MISSED',
              'Completion modal + keep going mode',
              'Shuffled every session',
            ]}
          />
        </div>
      </section>

      {/* Simulator map */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest">All Simulators</h2>
            <Link href="/labs" className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-mono transition-colors">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-3">
                <Rocket className="w-3 h-3 text-blue-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Deployment</p>
              </div>
              <ModuleChip label="Traffic Split"     status="live" color="bg-blue-500/8 border-blue-500/25 text-blue-300" />
              <ModuleChip label="Canary Stepper"    status="live" color="bg-blue-500/8 border-blue-500/25 text-blue-300" />
              <ModuleChip label="Shadow Mode"       status="soon" color="" />
              <ModuleChip label="Latency Optimizer" status="soon" color="" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-3">
                <BarChart3 className="w-3 h-3 text-emerald-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Monitoring</p>
              </div>
              <ModuleChip label="Drift Injector"    status="soon" color="" />
              <ModuleChip label="Metrics Dashboard" status="soon" color="" />
              <ModuleChip label="Alert Threshold"   status="soon" color="" />
              <ModuleChip label="A/B Significance"  status="soon" color="" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-3">
                <Cpu className="w-3 h-3 text-purple-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400">MLOps</p>
              </div>
              <ModuleChip label="Skew Detector"      status="soon" color="" />
              <ModuleChip label="Retraining Trigger" status="soon" color="" />
              <ModuleChip label="Feature Store"      status="soon" color="" />
              <ModuleChip label="CI/CD Pipeline"     status="soon" color="" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 mb-3">
                <Layers className="w-3 h-3 text-amber-400" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">System Design</p>
              </div>
              <ModuleChip label="Recommender"      status="soon" color="" />
              <ModuleChip label="Fraud Detection"  status="soon" color="" />
              <ModuleChip label="Scalability"      status="soon" color="" />
              <ModuleChip label="Precision/Recall" status="soon" color="" />
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-slate-900 to-violet-500/5 p-8 text-center space-y-4">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 rounded-full opacity-[0.08]"
              style={{ background: 'radial-gradient(ellipse, #6366f1 0%, transparent 70%)' }} />
          </div>
          <h2 className="relative text-2xl font-bold text-slate-100">Ready to get interview-ready?</h2>
          <p className="relative text-slate-400 max-w-md mx-auto text-sm">
            Start with the Traffic Split simulator — it covers the most ground and has the deepest
            study material of any module.
          </p>
          <div className="relative flex flex-wrap gap-3 justify-center pt-2">
            <Link href="/labs/deployment/traffic-split"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all hover:-translate-y-0.5">
              Start with Traffic Split
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/study-guide/deployment/traffic-split"
              className="px-6 py-2.5 rounded-xl border border-slate-700 hover:border-slate-500 text-slate-300 font-semibold text-sm transition-all">
              Read study guide first
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
