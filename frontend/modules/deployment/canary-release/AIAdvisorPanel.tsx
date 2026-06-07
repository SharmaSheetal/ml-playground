'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';
import { ask, type LLMSource } from '@/lib/llm';
import { AI_PROMPT_TEMPLATE } from './content';
import type { Metrics, Gates, FaultType, SimStatus } from './useSimulation';
import { STAGES } from './useSimulation';

interface Props {
  stageIdx:  number;
  champion:  Metrics;
  canary:    Metrics;
  gates:     Gates;
  elapsed:   number;
  minWindow: number;
  fault:     FaultType;
  status:    SimStatus;
}

type State = 'idle' | 'loading' | 'done';

const SOURCE_LABEL: Record<LLMSource, { label: string; color: string }> = {
  'user-key':   { label: 'Your API key',    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'  },
  'server-key': { label: 'Server AI',       color: 'text-indigo-400  border-indigo-500/30  bg-indigo-500/5'   },
  'static':     { label: 'Static fallback', color: 'text-slate-400   border-slate-600/40   bg-slate-800/40'   },
};

function staticFallback(props: Props): string {
  const { stageIdx, champion, canary, gates, elapsed, minWindow, fault } = props;
  const stage = STAGES[stageIdx];

  if (fault !== 'none') {
    const faultDesc = fault === 'latency' ? `P99 spiking to ${canary.p99.toFixed(0)}ms`
      : fault === 'errors' ? `error rate at ${canary.errorRate.toFixed(2)}%`
      : `PSI at ${canary.psi.toFixed(3)}`;
    return `Active fault detected — canary ${faultDesc}. Gates are failing. If auto-rollback is off, manually roll back now. Investigate the fault before re-promoting. Keep the canary pod at 0% traffic for diagnosis.`;
  }
  if (gates.p99 === 'fail')
    return `P99 gate failing — canary latency ${canary.p99.toFixed(0)}ms exceeds 105% of champion (${champion.p99.toFixed(0)}ms). Hold and investigate before promoting. Check for warm-up issues or memory pressure.`;
  if (gates.errorRate === 'fail')
    return `Error rate gate failing — canary at ${canary.errorRate.toFixed(2)}%, threshold is 1%. Do not promote. Check service logs for 5xx causes.`;
  if (gates.psi === 'fail')
    return `PSI gate failing at ${canary.psi.toFixed(3)} — prediction distribution has shifted. Investigate preprocessing differences between champion and canary before promoting.`;
  if (elapsed < minWindow)
    return `All gates passing at ${stage}% traffic — ${minWindow - elapsed}s remaining in the observation window. Do not promote early. Time in window is as important as gate status.`;
  return `All gates passing, observation window complete at ${stage}% traffic. Safe to promote to ${STAGES[stageIdx + 1] ?? 100}%. Champion P99: ${champion.p99.toFixed(0)}ms, Canary: ${canary.p99.toFixed(0)}ms, PSI: ${canary.psi.toFixed(3)}.`;
}

export function AIAdvisorPanel(props: Props) {
  const [state,  setState]  = useState<State>('idle');
  const [text,   setText]   = useState('');
  const [source, setSource] = useState<LLMSource | null>(null);
  const [warn,   setWarn]   = useState('');

  const { stageIdx, champion, canary, gates, elapsed, minWindow, fault, status } = props;
  const stage = STAGES[stageIdx];

  async function handleAsk() {
    setState('loading');
    setWarn('');
    const prompt = AI_PROMPT_TEMPLATE(
      stage, canary.p99, champion.p99,
      canary.errorRate, champion.errorRate,
      canary.psi, elapsed, minWindow, fault,
    );
    const res = await ask(prompt, staticFallback(props), w => setWarn(w));
    setText(res.text);
    setSource(res.source);
    setState('done');
  }

  const srcMeta = source ? SOURCE_LABEL[source] : null;
  const disabled = state === 'loading' || status === 'idle';

  return (
    <div className="border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div>
          <p className="text-xs font-mono font-semibold text-slate-300">AI Advisor</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {status === 'idle'
              ? 'Start a canary to get AI advice on your deployment.'
              : 'Ask AI what to do with the current canary state.'}
          </p>
        </div>
        <button
          onClick={handleAsk}
          disabled={disabled}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-mono font-semibold transition-all',
            disabled
              ? 'border-slate-700 text-slate-600 cursor-not-allowed'
              : 'border-indigo-600/60 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/5 active:scale-95'
          )}
        >
          {state === 'loading' ? (
            <>
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 0.9, repeat: Infinity }}
              />
              Thinking…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              {state === 'done' ? 'Ask again' : 'Ask AI'}
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {state !== 'idle' && text && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden border-t border-slate-800"
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

              {warn && <p className="text-xs text-amber-400 font-mono">{warn}</p>}

              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{text}</p>

              {/* Context snapshot */}
              <div className="flex gap-4 pt-1 flex-wrap text-xs font-mono text-slate-500">
                {[
                  { label: 'stage',       value: `${stage}%` },
                  { label: 'canary P99',  value: `${canary.p99.toFixed(0)}ms`,       alert: gates.p99 === 'fail' },
                  { label: 'error rate',  value: `${canary.errorRate.toFixed(2)}%`,   alert: gates.errorRate === 'fail' },
                  { label: 'PSI',         value: canary.psi.toFixed(3),               alert: gates.psi === 'fail' },
                  { label: 'window',      value: `${elapsed}s / ${minWindow}s` },
                ].map(({ label, value, alert }) => (
                  <span key={label}>
                    {label}: <span className={clsx('font-semibold', alert ? 'text-red-400' : 'text-slate-300')}>{value}</span>
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
