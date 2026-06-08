'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';
import { ask, type LLMSource } from '@/lib/llm';
import { AI_PROMPT_TEMPLATE } from './content';
import type { ChampionMetrics, ShadowMetrics, DivergenceMetrics, Gates, FaultType, SimStatus } from './useSimulation';

interface Props {
  mirrorPct:  number;
  champion:   ChampionMetrics;
  shadow:     ShadowMetrics;
  divergence: DivergenceMetrics;
  gates:      Gates;
  fault:      FaultType;
  status:     SimStatus;
}

type State = 'idle' | 'loading' | 'done';

const SOURCE_LABEL: Record<LLMSource, { label: string; color: string }> = {
  'user-key':   { label: 'Your API key',    color: 'text-green-600 border-green-200 bg-green-50'  },
  'server-key': { label: 'Server AI',       color: 'text-blue-600  border-blue-200  bg-blue-50'   },
  'static':     { label: 'Static fallback', color: 'text-gray-500  border-gray-300  bg-gray-50'   },
};

function staticFallback(p: Props): string {
  const { gates, divergence, shadow, champion, fault } = p;
  if (fault === 'latency')
    return `Shadow latency is ${shadow.p99.toFixed(0)}ms vs champion ${champion.p99.toFixed(0)}ms — exceeding the 1.2× gate. The shadow model has a serving performance regression. Investigate before promoting to canary. Check for memory leaks, missing model optimization (quantization, TensorRT), or framework incompatibility.`;
  if (fault === 'divergence')
    return `Exact match rate dropped to ${divergence.exactMatch.toFixed(1)}% — well below the 80% gate. The shadow model is making systematically different predictions. Do not promote to canary. Investigate preprocessing differences, feature schema changes, or training data issues.`;
  if (fault === 'errors')
    return `Shadow error rate is ${shadow.errorRate.toFixed(2)}% — exceeding the 2% gate. The shadow model has serving errors. Roll back shadow traffic and investigate serving configuration, missing dependencies, or model loading failures.`;
  if (gates.latency === 'fail')
    return `Shadow P99 ${shadow.p99.toFixed(0)}ms exceeds 120% of champion ${champion.p99.toFixed(0)}ms. Hold shadow and investigate serving performance before promotion.`;
  if (gates.divergence === 'fail')
    return `Exact match rate ${divergence.exactMatch.toFixed(1)}% below 80% gate. Predictions are diverging systematically — hold shadow and investigate model differences before any canary exposure.`;
  if (gates.ndcg === 'fail')
    return `NDCG ${divergence.ndcg.toFixed(3)} below 0.85 gate. Ranking quality has degraded. Shadow model is reordering recommendations in ways that may harm user experience.`;
  if (gates.errors === 'fail')
    return `Shadow error rate ${shadow.errorRate.toFixed(2)}% exceeds 2% gate. Investigate serving errors before promotion.`;
  return `All shadow gates passing. Exact match ${divergence.exactMatch.toFixed(1)}%, NDCG ${divergence.ndcg.toFixed(3)}, shadow P99 ${shadow.p99.toFixed(0)}ms. Continue observation — after sufficient coverage of traffic patterns including at least one peak period, shadow model is ready for canary at 1%.`;
}

export function AIAdvisorPanel(props: Props) {
  const [uiState, setUiState] = useState<State>('idle');
  const [text,    setText]    = useState('');
  const [source,  setSource]  = useState<LLMSource | null>(null);
  const [warn,    setWarn]    = useState('');

  const { mirrorPct, champion, shadow, divergence, gates, fault, status } = props;

  async function handleAsk() {
    setUiState('loading');
    setWarn('');
    const prompt = AI_PROMPT_TEMPLATE(
      mirrorPct,
      champion.p99, shadow.p99,
      champion.errorRate, shadow.errorRate,
      divergence.exactMatch, divergence.ndcg, fault,
    );
    const res = await ask(prompt, staticFallback(props), w => setWarn(w));
    setText(res.text);
    setSource(res.source);
    setUiState('done');
  }

  const srcMeta  = source ? SOURCE_LABEL[source] : null;
  const disabled = uiState === 'loading' || status === 'idle';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-xs font-mono font-semibold text-gray-700">AI Advisor</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {status === 'idle'
              ? 'Start the shadow test to get AI advice on your divergence metrics.'
              : 'Ask AI whether to promote, hold, or abandon the shadow test.'}
          </p>
        </div>
        <button
          onClick={handleAsk}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
            disabled
              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 active:scale-95'
          )}
        >
          {uiState === 'loading' ? (
            <>
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-blue-500"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
              Thinking…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              {uiState === 'done' ? 'Ask again' : 'Ask AI'}
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {uiState !== 'idle' && text && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-gray-200"
          >
            <div className="px-5 py-4 space-y-3">
              {srcMeta && (
                <span className={clsx(
                  'inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border',
                  srcMeta.color
                )}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  {srcMeta.label}
                </span>
              )}
              {warn && <p className="text-xs text-amber-600 font-mono">{warn}</p>}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{text}</p>
              <div className="flex gap-4 pt-1 flex-wrap text-xs font-mono text-gray-400">
                {[
                  { label: 'mirror',      value: `${mirrorPct}%` },
                  { label: 'champ P99',   value: `${champion.p99.toFixed(0)}ms` },
                  { label: 'shadow P99',  value: `${shadow.p99.toFixed(0)}ms`,      alert: gates.latency === 'fail' },
                  { label: 'exact match', value: `${divergence.exactMatch.toFixed(1)}%`, alert: gates.divergence === 'fail' },
                  { label: 'NDCG',        value: divergence.ndcg.toFixed(3),         alert: gates.ndcg === 'fail' },
                  { label: 'shadow err',  value: `${shadow.errorRate.toFixed(2)}%`,  alert: gates.errors === 'fail' },
                ].map(({ label, value, alert }) => (
                  <span key={label}>
                    {label}: <span className={clsx('font-semibold', alert ? 'text-red-600' : 'text-gray-700')}>{value}</span>
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
