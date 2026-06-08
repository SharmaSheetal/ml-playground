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
    const degraded = state.metrics.filter(m => m.status !== 'normal').map(m => `${m.label}: ${m.value}${m.unit}`).join(', ');
    const prompt = `You are an ML observability expert. A four-layer metrics dashboard shows:
- Fault layer: ${state.faultLayer ?? 'none'}
- Cascade mode: ${state.cascadeEnabled}
- Degraded metrics: ${degraded || 'none'}

Provide 3 numbered, specific actions the on-call engineer should take. Cover triage order, escalation, and whether a rollback is warranted.`;
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
      {!advice && !loading && <p className="text-xs text-gray-400">Inject a fault then click to get AI-powered triage advice.</p>}
    </div>
  );
}
