'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';
import { ask, type LLMSource } from '@/lib/llm';
import { AI_PROMPT_TEMPLATE } from './content';
import type { OptConfig, LatencyMetrics } from './useSimulation';

interface Props {
  config:   OptConfig;
  metrics:  LatencyMetrics;
  baseline: LatencyMetrics;
}

type State = 'idle' | 'loading' | 'done';

const SOURCE_LABEL: Record<LLMSource, { label: string; color: string }> = {
  'user-key':   { label: 'Your API key',    color: 'text-green-600 border-green-200 bg-green-50'  },
  'server-key': { label: 'Server AI',       color: 'text-blue-600  border-blue-200  bg-blue-50'   },
  'static':     { label: 'Static fallback', color: 'text-gray-500  border-gray-300  bg-gray-50'   },
};

function staticFallback(p: Props): string {
  const { config, metrics, baseline } = p;
  const p99Reduction = ((baseline.p99 - metrics.p99) / baseline.p99 * 100).toFixed(0);

  if (!config.tensorrtEnabled && config.quantization !== 'fp32') {
    return `You have quantization applied (${config.quantization}) but TensorRT is not enabled. Enabling TensorRT with ${config.quantization} will activate kernel fusion and hardware-specific optimizations, typically reducing P99 by an additional 25-30% on NVIDIA GPUs. Enable TensorRT next.`;
  }
  if (config.quantization === 'fp32' && !config.tensorrtEnabled) {
    return `Baseline configuration: P99 ${metrics.p99.toFixed(0)}ms, ${metrics.throughput} RPS. Highest-impact next step: apply FP16 quantization — typically reduces P99 by ~47% on modern GPUs with negligible accuracy impact. This is the lowest-risk, highest-reward optimization.`;
  }
  if (!config.cachingEnabled && config.batchSize > 8) {
    return `You have high batch size (${config.batchSize}) which is increasing P99 latency for individual requests. Consider enabling prediction caching — at your traffic level, cache hit rate can reduce effective latency significantly without the queue wait cost of large batches.`;
  }
  if (config.cachingEnabled && config.cacheSize < 512) {
    return `Cache is enabled but cache size ${config.cacheSize}MB may be too small for meaningful hit rates. Increasing cache size to 1024-2048MB typically increases hit rate by 20-30%, reducing effective P99 substantially. Balance memory cost against latency savings.`;
  }
  return `Current optimizations have reduced P99 by ${p99Reduction}% from baseline (${baseline.p99}ms → ${metrics.p99.toFixed(0)}ms). Throughput is ${metrics.throughput} RPS. Consider load testing under peak traffic patterns — bursty real-world traffic often reveals P99 spikes not captured in steady-state benchmarks.`;
}

export function AIAdvisorPanel(props: Props) {
  const [uiState, setUiState] = useState<State>('idle');
  const [text,    setText]    = useState('');
  const [source,  setSource]  = useState<LLMSource | null>(null);
  const [warn,    setWarn]    = useState('');

  const { config, metrics } = props;

  async function handleAsk() {
    setUiState('loading');
    setWarn('');
    const prompt = AI_PROMPT_TEMPLATE(
      metrics.p99, metrics.p50, metrics.throughput,
      metrics.cacheHitRate, config.batchSize,
      config.quantization,
      config.tensorrtEnabled,
    );
    const res = await ask(prompt, staticFallback(props), w => setWarn(w));
    setText(res.text);
    setSource(res.source);
    setUiState('done');
  }

  const srcMeta  = source ? SOURCE_LABEL[source] : null;
  const disabled = uiState === 'loading';

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-xs font-mono font-semibold text-gray-700">AI Advisor</p>
          <p className="text-xs text-gray-400 mt-0.5">Ask what optimization to apply next for maximum impact.</p>
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
                  { label: 'P99',        value: `${metrics.p99.toFixed(0)}ms` },
                  { label: 'P50',        value: `${metrics.p50.toFixed(0)}ms` },
                  { label: 'throughput', value: `${metrics.throughput} RPS` },
                  { label: 'quant',      value: config.quantization.toUpperCase() },
                  { label: 'batch',      value: `×${config.batchSize}` },
                  { label: 'TensorRT',   value: config.tensorrtEnabled ? 'on' : 'off' },
                  { label: 'cache hit',  value: config.cachingEnabled ? `${metrics.cacheHitRate}%` : 'off' },
                ].map(({ label, value }) => (
                  <span key={label}>
                    {label}: <span className="font-semibold text-gray-700">{value}</span>
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
