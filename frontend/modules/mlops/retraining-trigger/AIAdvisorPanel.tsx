'use client';
import { useState } from 'react';
import { ask } from '@/lib/llm';
import type { SimState } from './useSimulation';

interface Props { state: SimState; }

export function AIAdvisorPanel({ state }: Props) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice]   = useState('');

  async function getAdvice() {
    setLoading(true);
    setAdvice('');
    const prompt = `You are an MLOps engineer advising on retraining strategy.
Current state:
- Trigger mode: ${state.triggerMode}
- Current accuracy: ${state.currentAccuracy.toFixed(4)}, threshold: ${state.perfThreshold}
- Current PSI: ${state.currentPSI.toFixed(4)}, threshold: ${state.driftThreshold}
- Retrains so far: ${state.retrainCount}
- Pipeline stage: ${state.pipelineStage}

Provide 3 numbered recommendations: whether the current trigger strategy is appropriate, how to avoid unnecessary retraining churn, and how to estimate the minimum retraining frequency for this model.`;
    try {
      const res = await ask(prompt, "");
      setAdvice(res.text);
    } catch {
      setAdvice('Could not reach AI advisor. Check your API key in Settings.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">AI Advisor</span>
        <button onClick={getAdvice} disabled={loading} className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">
          {loading ? 'Analyzing...' : 'Get recommendation'}
        </button>
      </div>
      {loading && (
        <div className="flex gap-1 py-2">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      )}
      {advice && !loading && <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{advice}</p>}
      {!advice && !loading && <p className="text-xs text-gray-400">Run the simulator to observe degradation, then click for AI-powered retraining advice.</p>}
    </div>
  );
}
