'use client';
import { useState } from 'react';
import { ask } from '@/lib/llm';
import type { SimState, DerivedMetrics } from './useSimulation';

interface Props { state: SimState; derived: DerivedMetrics; }

export function AIAdvisorPanel({ state, derived }: Props) {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice]   = useState('');

  async function getAdvice() {
    setLoading(true);
    setAdvice('');
    const prompt = `You are an experimentation platform expert reviewing an A/B test.
Current state after day ${state.day}:
- Control conversion: ${(state.controlRate * 100).toFixed(2)}%, Treatment: ${(state.treatmentRate * 100).toFixed(2)}%
- Absolute lift: ${(derived.absoluteLift * 100).toFixed(3)}%
- p-value: ${derived.pValue.toFixed(4)} (alpha: ${state.alpha})
- Statistical power: ${(derived.power * 100).toFixed(1)}%
- Significant: ${derived.significant}
- Sample per variant per day: ${state.sampleSizePerDay}

Provide 3 numbered recommendations: whether to stop or continue the test, risk of peeking bias, and how to report these results to a product manager.`;
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
      {!advice && !loading && <p className="text-xs text-gray-400">Advance days and adjust rates, then click to get AI-powered experiment analysis.</p>}
    </div>
  );
}
