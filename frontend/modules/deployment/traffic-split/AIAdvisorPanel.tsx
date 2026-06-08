'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { ask, type LLMSource } from '@/lib/llm';
import { AI_PROMPT_TEMPLATE } from './content';
import type { VersionMetrics } from './types';

interface Props {
  v1Traffic: number;
  metrics:   { v1: VersionMetrics; v2: VersionMetrics };
}

type State = 'idle' | 'loading' | 'done' | 'error';

const SOURCE_LABEL: Record<LLMSource, { label: string; color: string }> = {
  'user-key':   { label: 'Your API key',    color: 'text-green-600 border-green-200 bg-green-50'  },
  'server-key': { label: 'Server AI',       color: 'text-blue-600  border-blue-200  bg-blue-50'   },
  'static':     { label: 'Static fallback', color: 'text-gray-500  border-gray-300  bg-gray-50'   },
};

function staticFallback(v1Traffic: number, metrics: Props['metrics']): string {
  const v2 = metrics.v2;
  const v1 = metrics.v1;
  if (v2.status === 'degraded' && v2.p99 > 1000)
    return `v2 is clearly degraded — P99 at ${v2.p99}ms is unacceptable. Roll back to 100% v1 immediately and keep the canary pod running at 0% for diagnosis. Do not proceed until you understand the root cause.`;
  if (v2.status === 'degraded')
    return `v2 shows early degradation signals. Hold at the current split (${100 - v1Traffic}% canary) and monitor for the next 10 minutes. If P99 continues to climb, roll back. Do not increase canary traffic while metrics are unstable.`;
  if (v1Traffic > 70)
    return `System looks healthy. v2 P99 is ${v2.p99}ms vs v1's ${v1.p99}ms — within acceptable range. Safe to increase canary traffic to ${Math.min(100 - v1Traffic + 10, 50)}% and observe for another 15 minutes.`;
  return `Both versions healthy. At ${100 - v1Traffic}% canary you are past the high-risk window. Continue stepping up by 10–20% increments with 15-minute observation windows at each stage.`;
}

export function AIAdvisorPanel({ v1Traffic, metrics }: Props) {
  const [state,   setState]   = useState<State>('idle');
  const [text,    setText]    = useState('');
  const [source,  setSource]  = useState<LLMSource | null>(null);
  const [warn,    setWarn]    = useState('');

  async function handleAsk() {
    setState('loading');
    setWarn('');
    const prompt   = AI_PROMPT_TEMPLATE(
      v1Traffic,
      metrics.v1.p50, metrics.v2.p50,
      metrics.v1.errorRate, metrics.v2.errorRate,
    );
    const fallback = staticFallback(v1Traffic, metrics);
    const res = await ask(prompt, fallback, setWarn);
    setText(res.text);
    setSource(res.source);
    setState('done');
  }

  const srcMeta = source ? SOURCE_LABEL[source] : null;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* ── Trigger row ── */}
      <div className="flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-xs font-mono font-semibold text-gray-700">AI Advisor</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Ask the AI what to do with the current deployment state.
          </p>
        </div>
        <button
          onClick={handleAsk}
          disabled={state === 'loading'}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
            state === 'loading'
              ? 'border-blue-200 text-blue-300 cursor-not-allowed'
              : 'border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 active:scale-95'
          )}
        >
          {state === 'loading' ? (
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
              <span className="text-blue-500">✦</span>
              {state === 'done' ? 'Ask again' : 'Ask AI'}
            </>
          )}
        </button>
      </div>

      {/* ── Response area ── */}
      <AnimatePresence>
        {(state === 'done' || state === 'loading') && text && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-gray-200"
          >
            <div className="px-5 py-4 space-y-3">
              {/* Source badge */}
              {srcMeta && (
                <span className={clsx(
                  'inline-flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border',
                  srcMeta.color
                )}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                  {srcMeta.label}
                </span>
              )}

              {/* Warn */}
              {warn && (
                <p className="text-xs text-amber-600 font-mono">{warn}</p>
              )}

              {/* Response text */}
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {text}
              </p>

              {/* Context snapshot */}
              <div className="flex gap-3 pt-1 flex-wrap">
                {[
                  { label: 'v1 traffic', value: `${v1Traffic}%` },
                  { label: 'v2 P99',     value: `${metrics.v2.p99}ms`, alert: metrics.v2.p99 > 800 },
                  { label: 'v2 errors',  value: `${metrics.v2.errorRate}%`, alert: metrics.v2.errorRate > 1 },
                  { label: 'v1 P99',     value: `${metrics.v1.p99}ms`, alert: metrics.v1.p99 > 800 },
                ].map(({ label, value, alert }) => (
                  <span key={label} className="text-xs font-mono text-gray-400">
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
