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
    const prompt = `You are an ML infrastructure architect. Current serving configuration:
- QPS target: ${state.qpsTarget}, Instance count: ${state.instanceCount}
- Scaling: ${state.scalingStrategy}, Batch mode: ${state.batchMode} (size ${state.batchSize})
- GPU: ${state.gpuEnabled}, Model size: ${state.modelSizeMB}MB
- p50 latency: ${derived.latencyP50}ms, p95: ${derived.latencyP95}ms
- Throughput: ${derived.throughput} req/s, GPU utilization: ${derived.gpuUtilization}%
- Cost: $${derived.costPerHour}/hr, Status: ${derived.scalingStatus}
- Bottleneck: ${derived.bottleneck}

Provide 3 numbered recommendations: how to eliminate the identified bottleneck, the cost/performance tradeoff of the current setup, and one architectural optimization that would have the highest impact.`;
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
      {!advice && !loading && <p className="text-xs text-gray-400">Configure the serving cluster then click for scaling architecture advice.</p>}
    </div>
  );
}
