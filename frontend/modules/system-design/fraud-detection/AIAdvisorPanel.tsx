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
    const prompt = `You are a fraud detection ML engineer. Current model configuration:
- Threshold: ${state.threshold}, Fraud rate: ${(state.fraudRate * 100).toFixed(1)}%
- Sampling: ${state.samplingStrategy}, Reject inference: ${state.rejectInference}
- AUC estimate: ${derived.aucEstimate.toFixed(3)}, F1: ${derived.f1.toFixed(3)}
- Precision: ${(derived.precision * 100).toFixed(1)}%, Recall: ${(derived.recall * 100).toFixed(1)}%
- Daily cost: $${derived.dailyCost.toLocaleString()}, Approval rate: ${(derived.approvalRate * 100).toFixed(1)}%
- FP cost $${state.fpCostDollars}, FN cost $${state.fnCostDollars}

Provide 3 numbered recommendations: optimal threshold given this cost matrix, how to handle class imbalance more effectively, and the most important feature engineering step for fraud detection.`;
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
      {!advice && !loading && <p className="text-xs text-gray-400">Configure the model and cost matrix, then click for fraud detection recommendations.</p>}
    </div>
  );
}
