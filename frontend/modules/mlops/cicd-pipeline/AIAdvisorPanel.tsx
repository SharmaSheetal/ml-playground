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
    const passed = state.stages.filter(s => s.status === 'passed').map(s => s.label).join(', ');
    const prompt = `You are an MLOps CI/CD expert reviewing a model deployment pipeline.
Run count: ${state.runCount}
Last result: ${state.lastRunResult}
Failed at: ${state.failedAt ?? 'n/a'}
Passed stages: ${passed || 'none'}
Failure probability: ${state.failureProbability}%

Provide 3 numbered recommendations: how to improve the gate at the failed stage, what automated checks would catch this failure earlier, and how to implement a safe rollback strategy.`;
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
      {!advice && !loading && <p className="text-xs text-gray-400">Run a pipeline to completion (or failure), then click for AI-powered pipeline advice.</p>}
    </div>
  );
}
