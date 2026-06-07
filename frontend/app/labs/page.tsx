import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const TOPIC_AREAS = [
  {
    id: "deployment",
    label: "Deployment",
    color: "text-blue-400",
    borderColor: "border-blue-500/20",
    simulators: [
      { slug: "traffic-split", title: "Traffic Split Playground" },
      { slug: "canary-release", title: "Canary Release Stepper" },
      { slug: "shadow-mode", title: "Shadow Mode Differ" },
      { slug: "latency-optimizer", title: "Latency Optimizer" },
    ],
  },
  {
    id: "monitoring",
    label: "Metrics & Monitoring",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/20",
    simulators: [
      { slug: "drift-injector", title: "Drift Injector" },
      { slug: "metrics-dashboard", title: "Four-Layer Metrics Dashboard" },
      { slug: "alert-threshold", title: "Alert Threshold Tuner" },
      { slug: "ab-significance", title: "A/B Significance Calculator" },
      { slug: "feedback-loop", title: "Feedback Loop Simulator" },
    ],
  },
  {
    id: "mlops",
    label: "MLOps",
    color: "text-purple-400",
    borderColor: "border-purple-500/20",
    simulators: [
      { slug: "skew-detector", title: "Training-Serving Skew Detector" },
      { slug: "retraining-trigger", title: "Retraining Trigger Lab" },
      { slug: "feature-store", title: "Feature Store Visualizer" },
      { slug: "cicd-pipeline", title: "CI/CD Pipeline Runner" },
    ],
  },
  {
    id: "system-design",
    label: "System Design",
    color: "text-amber-400",
    borderColor: "border-amber-500/20",
    simulators: [
      { slug: "recommender", title: "Two-Stage Recommender Simulator" },
      { slug: "fraud-detection", title: "Fraud Detection Flow" },
      { slug: "scalability", title: "Scalability Stress Tester" },
      { slug: "precision-recall", title: "Precision/Recall Explorer" },
      { slug: "build-vs-buy", title: "Build vs Buy Calculator" },
    ],
  },
];

export default function LabsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-slate-100 mb-2">Labs</h1>
      <p className="text-slate-400 mb-12">
        Interactive simulators across four MLOps domains.
      </p>

      <div className="space-y-12">
        {TOPIC_AREAS.map((area) => (
          <section key={area.id}>
            <h2
              className={`text-xs font-semibold uppercase tracking-widest mb-4 ${area.color}`}
            >
              {area.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {area.simulators.map((sim) => (
                <Card
                  key={sim.slug}
                  className={`${area.borderColor} opacity-60 cursor-not-allowed`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-300 text-sm font-medium">
                      {sim.title}
                    </span>
                    <Badge color="slate">Soon</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
