'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { InterviewPDFModal, type SessionAnswer } from '@/components/InterviewPDFModal';

const DEMO_QA = [
  {
    question: 'How do you decide the initial traffic percentage for a canary deployment, and what metrics trigger a rollback?',
    difficulty: 'mid' as const,
    keyPoints: ['Start at 1–5% traffic', 'Monitor error rate, latency P99, and business KPIs', 'Automated rollback gates', 'Observation window before promotion'],
    trap: 'Relying on a single metric (e.g. only error rate) while latency degrades silently.',
  },
  {
    question: 'Explain the difference between shadow mode and A/B testing. When would you use each?',
    difficulty: 'senior' as const,
    keyPoints: ['Shadow copies live traffic with no user impact', 'A/B testing exposes real users to variant', 'Shadow for validation before any exposure', 'A/B for measuring business outcome difference'],
    trap: 'Deploying to shadow and skipping A/B — shadow cannot measure real user behavioral outcomes.',
  },
  {
    question: 'What is Population Stability Index (PSI) and how do you use it to detect model drift?',
    difficulty: 'junior' as const,
    keyPoints: ['PSI measures distribution shift between training and serving data', 'PSI < 0.1 stable, 0.1–0.25 moderate shift, > 0.25 significant drift', 'Computed per-feature and on model output score', 'Triggers retraining pipeline'],
    trap: 'Choosing a PSI threshold without considering business cost of false positives in drift alerts.',
  },
  {
    question: 'You have a model serving P99 latency of 280ms but your SLA requires 200ms. Walk through how you would diagnose and fix this.',
    difficulty: 'senior' as const,
    keyPoints: ['Profile: is it preprocessing, inference, or post-processing?', 'Try dynamic batching, model quantization (FP16/INT8)', 'TensorRT or ONNX Runtime for GPU inference', 'Add a caching layer for repeated inputs', 'Async serving to eliminate blocking waits'],
    trap: 'Jumping to quantization without profiling first — sometimes the bottleneck is data serialization or feature lookup, not the model itself.',
  },
];

const DEMO_SESSION_ANSWERS: SessionAnswer[] = [
  {
    question: DEMO_QA[0].question,
    difficulty: 'mid',
    userAnswer: 'I would start at around 2% of traffic to minimize blast radius. I would watch error rate, P99 latency, and conversion rate. If any of those degrade beyond a threshold — like error rate exceeding baseline by 1% — an automated gate should halt the rollout and roll back.',
    gotRight: 'Mentioned starting small, monitoring multiple metrics, and automated rollback gates.',
    missed: 'Did not mention the observation window duration or how to set statistically meaningful thresholds for each metric.',
    followUp: 'How would you set the rollback threshold for P99 latency specifically — absolute value or relative delta from baseline?',
    signal: 'pass',
  },
  {
    question: DEMO_QA[1].question,
    difficulty: 'senior',
    userAnswer: 'Shadow mode runs the new model on duplicated live traffic without affecting users, so you can compare outputs. A/B testing actually routes real users to different variants and measures real outcomes. I would use shadow first for sanity checks, then A/B to measure actual impact on business metrics.',
    gotRight: 'Clear distinction between shadow and A/B, correct use-case framing.',
    missed: 'Did not mention that shadow cannot measure behavioral outcome differences — users still see the old model.',
    followUp: 'How do you validate that shadow traffic is representative enough to trust the comparison results?',
    signal: 'pass',
  },
];

const SIGNALS = ['pass', 'pass', 'borderline', 'fail'] as const;
const DOT_CLS: Record<string, string> = {
  pass: 'bg-green-500', borderline: 'bg-amber-400', fail: 'bg-red-400',
};

export default function DemoPage() {
  const router = useRouter();
  const [showPDF, setShowPDF] = useState(false);

  if (showPDF) {
    return (
      <InterviewPDFModal
        interviewQA={DEMO_QA}
        moduleTitle="Traffic Split and Deployment"
        moduleCategory="Deployment"
        sessionAnswers={DEMO_SESSION_ANSWERS}
        onClose={() => setShowPDF(false)}
      />
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      >
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => router.push('/mock-interview')} />

        <motion.div
          className="relative z-10 w-full max-w-sm bg-white border border-gray-200 rounded-xl p-7 shadow-xl"
          initial={{ scale: 0.88, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          <div className="flex justify-center mb-5">
            <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-600">4/4</span>
            </div>
          </div>

          <h2 className="text-center text-base font-semibold text-gray-900 mb-1">Session complete</h2>
          <p className="text-center text-xs text-gray-500 mb-5">
            You covered all 4 topics in this round
          </p>

          <div className="flex justify-center gap-1.5 flex-wrap mb-4">
            {SIGNALS.map((s, i) => (
              <motion.div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${DOT_CLS[s]}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.07, type: 'spring', stiffness: 400 }}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { label: 'Strong',     count: 2, cls: 'text-green-700 border-green-200 bg-green-50' },
              { label: 'Borderline', count: 1, cls: 'text-amber-700 border-amber-200 bg-amber-50' },
              { label: 'Weak',       count: 1, cls: 'text-red-700   border-red-200   bg-red-50'   },
            ].map(({ label, count, cls }) => (
              <motion.div
                key={label}
                className={`rounded-lg border px-2 py-2.5 text-center ${cls}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-lg font-bold tabular-nums">{count}</p>
                <p className="text-xs opacity-70">{label}</p>
              </motion.div>
            ))}
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => router.push('/mock-interview')}
              className="w-full py-2.5 rounded-lg border border-blue-300 text-blue-700 bg-blue-50 text-sm font-medium hover:bg-blue-100 active:scale-95 transition-all"
            >
              Keep going
            </button>
            <button
              onClick={() => setShowPDF(true)}
              className="w-full py-2.5 rounded-lg border border-gray-200 text-gray-700 bg-white text-sm font-medium hover:border-gray-300 hover:bg-gray-50 active:scale-95 transition-all"
            >
              Interview preparation guide
            </button>
            <button
              onClick={() => router.push('/mock-interview')}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Start fresh
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
