'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  term: string;
  definition: string;
  children: React.ReactNode;
}

interface Rect { top: number; left: number; width: number }

export function Tooltip({ term, definition, children }: TooltipProps) {
  const [open,    setOpen]    = useState(false);
  const [rect,    setRect]    = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Portal requires the DOM to be ready
  useEffect(() => { setMounted(true); }, []);

  function show() {
    if (timer.current) clearTimeout(timer.current);
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width });
    }
    setOpen(true);
  }

  function hide() {
    timer.current = setTimeout(() => setOpen(false), 80);
  }

  // Position: centred above the trigger using fixed coords (viewport-relative, never clipped)
  const tooltipStyle = rect
    ? {
        position:  'fixed' as const,
        top:       rect.top - 8,
        left:      rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%)',
        zIndex:    9999,
      }
    : {};

  const portal = mounted
    ? createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={tooltipStyle}
              className="pointer-events-none"
            >
              <div className="w-60 px-3 py-2.5 rounded-lg border border-slate-600/60 bg-slate-900 shadow-2xl shadow-black/60">
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                  border-l-[5px] border-r-[5px] border-t-[5px]
                  border-l-transparent border-r-transparent border-t-slate-600/60" />
                <p className="text-xs font-mono font-bold text-indigo-400 mb-1">{term}</p>
                <p className="text-xs text-slate-300 leading-relaxed">{definition}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <span
      ref={triggerRef}
      className="inline-flex items-center gap-0.5 cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      {children}
      <span className="w-1 h-1 rounded-full bg-indigo-500/50 mb-1 shrink-0" />
      {portal}
    </span>
  );
}

/* ── Pre-wired terms ── */
export const JARGON: Record<string, { term: string; definition: string }> = {
  rps: {
    term: 'RPS — Requests Per Second',
    definition: 'The number of API calls your model receives each second. High RPS exposes latency regressions that are invisible at low load.',
  },
  p50: {
    term: 'P50 — 50th Percentile',
    definition: 'The median response time. Half of all requests complete faster than this. A good baseline, but hides tail latency.',
  },
  p95: {
    term: 'P95 — 95th Percentile',
    definition: '95% of requests complete within this time. Captures the experience of "typical slow" users — a useful middle ground.',
  },
  p99: {
    term: 'P99 — 99th Percentile',
    definition: '99% of requests complete within this time. Captures tail latency — the worst 1 in 100 requests. SLOs are usually set here.',
  },
  errorRate: {
    term: 'Error Rate',
    definition: 'Percentage of requests returning an error (5xx). Above 1% is usually a production incident; above 5% triggers emergency rollback.',
  },
  slo: {
    term: 'SLO — Service Level Objective',
    definition: 'A target for service performance (e.g. P99 < 300ms, error rate < 0.5%). Breaching an SLO triggers alerts and rollbacks.',
  },
  canary: {
    term: 'Canary Deployment',
    definition: 'A strategy where the new version serves a small slice of traffic first. If metrics stay healthy, traffic gradually shifts to 100%.',
  },
  degraded: {
    term: 'Degraded',
    definition: 'A service in a degraded state is still responding but with worse latency or higher errors than its healthy baseline.',
  },
  shadowMode: {
    term: 'Shadow Mode',
    definition: 'The new model receives a copy of live traffic and its outputs are logged, but users always receive the champion\'s response. Zero risk, used before first production deploy.',
  },
  blueGreen: {
    term: 'Blue/Green Deployment',
    definition: 'Two identical environments run simultaneously. Traffic switches 100% instantly. Fast rollback, but no gradual validation — if the new version is broken, all users are affected.',
  },
  champChallenger: {
    term: 'Champion/Challenger',
    definition: 'A continuous pattern where the champion serves most traffic and a challenger is always being evaluated on a small slice. When the challenger wins, it becomes the new champion.',
  },
  psi: {
    term: 'PSI — Population Stability Index',
    definition: 'Measures how much the distribution of a feature has shifted between training and production. PSI > 0.2 signals significant drift that may degrade model performance.',
  },
  rollback: {
    term: 'Rollback',
    definition: 'Shifting traffic back to the previous stable version. In Kubernetes this takes seconds via ReplicaSet switching. The bad version is kept at 0% traffic for debugging.',
  },
  featureStore: {
    term: 'Feature Store',
    definition: 'A system that stores and serves ML features consistently for both training and serving. Eliminates training-serving skew by ensuring both pipelines read from the same feature definitions.',
  },
  dynamicBatching: {
    term: 'Dynamic Batching',
    definition: 'A model server waits a few milliseconds to accumulate multiple requests, groups them into one batch, runs a single GPU inference pass, and returns individual responses. Dramatically improves GPU utilization at high QPS.',
  },
  featureFlag: {
    term: 'Feature Flag',
    definition: 'A code-level toggle that enables or disables behaviour without a new deployment. In ML serving, lets you decouple when code is deployed from when users are exposed to it.',
  },
  darkLaunch: {
    term: 'Dark Launch',
    definition: 'Enabling new model behaviour for a small internal cohort (employees, beta users) before external traffic. Users see real responses — unlike shadow mode where only the champion response is ever shown.',
  },
  liveness: {
    term: 'Liveness Probe',
    definition: 'Kubernetes probe that checks if a container is alive. Failure triggers a pod restart. Catches deadlocks and crashes but does not prevent routing traffic to pods still loading the model.',
  },
  readiness: {
    term: 'Readiness Probe',
    definition: 'Kubernetes probe that checks if a pod is ready to serve traffic. Failure removes it from the load balancer rotation. Critical for ML — prevents requests being routed to a pod still loading its model into GPU memory.',
  },
  distributionShift: {
    term: 'Distribution Shift',
    definition: 'Production traffic distribution P(X) differs from training distribution. The model learned correctly — the world changed. Detected via statistical tests (KS, PSI) on incoming features vs. training baseline.',
  },
  feedbackLoop: {
    term: 'Feedback Loop / Exposure Bias',
    definition: 'The model\'s own predictions change what data it sees next. Classic in recommendations: the model only surfaces items it scored highly, so it never gets training signal on items it ranked low.',
  },
  ptq: {
    term: 'PTQ — Post-Training Quantization',
    definition: 'Quantize a model after training using a calibration dataset to compute scaling factors. Fast (hours, not days), no retraining. Typically costs 0.5–2% accuracy for INT8. Always try this before QAT.',
  },
  qat: {
    term: 'QAT — Quantization-Aware Training',
    definition: 'Simulate quantization noise during the training forward pass so the model learns to be robust to it. Recovers most accuracy lost by PTQ. Requires retraining — significantly more expensive.',
  },
  distillation: {
    term: 'Knowledge Distillation',
    definition: 'Train a small student model to mimic a large teacher using soft probability labels, not just hard class labels. Soft labels transfer structural knowledge (e.g. cats and lynxes are similar) that hard labels discard.',
  },
  keda: {
    term: 'KEDA — Kubernetes Event-Driven Autoscaler',
    definition: 'Extends Kubernetes HPA to scale on custom metrics like queue depth, GPU utilization, or Kafka lag — instead of CPU. Essential for ML serving where CPU is a misleading autoscaling signal.',
  },
  speculativeDecoding: {
    term: 'Speculative Decoding',
    definition: 'A small draft model generates K candidate tokens; the large target model verifies all K in one parallel pass. Accepted tokens are kept. Achieves 2–4× LLM throughput with mathematically identical output quality.',
  },
  mab: {
    term: 'Multi-Armed Bandit (MAB)',
    definition: 'Dynamically shifts traffic toward the better-performing model variant while the experiment runs, reducing regret vs. fixed A/B splits. Best when feedback is immediate; A/B is better when feedback is delayed.',
  },
  modelRegistry: {
    term: 'Model Registry',
    definition: 'Stores model artifacts alongside full metadata: training code commit, dataset hash, hyperparameters, eval metrics, and deployment stage. Enables true rollback (not just binary swap) and audit trails for regulated domains.',
  },
  openTelemetry: {
    term: 'OpenTelemetry',
    definition: '2025 industry standard for unified observability — one SDK emits metrics, logs, and distributed traces to any backend. Vendor-agnostic. Use it to instrument ML serving paths end-to-end.',
  },
};
