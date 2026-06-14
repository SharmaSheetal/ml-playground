'use client';
import clsx from 'clsx';
import { useSimulation, type RetrievalStrategy, type RankingModel } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-mono font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const RETRIEVAL_OPTIONS: { value: RetrievalStrategy; label: string }[] = [
  { value: 'ann',       label: 'ANN index' },
  { value: 'bm25',      label: 'BM25' },
  { value: 'two_tower', label: 'Two-tower' },
];

const RANKING_OPTIONS: { value: RankingModel; label: string }[] = [
  { value: 'gbdt',    label: 'GBDT' },
  { value: 'deep_fm', label: 'DeepFM' },
  { value: 'dnn',     label: 'DNN' },
];

export function RecommenderSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Recommender System Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Configure the two-stage retrieval-ranking pipeline and explore latency vs. quality tradeoffs.</p>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Retrieval ({sim.retrievalStrategy})</span>
          <span className="text-sm font-mono text-gray-900">{d.retrievalLatencyMs}ms</span>
        </div>
        <div className="px-4 py-2">
          <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(100, (d.retrievalLatencyMs / 80) * 100)}%` }} />
          </div>
        </div>
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Ranking ({sim.rankingModel})</span>
          <span className="text-sm font-mono text-gray-900">{d.rankingLatencyMs}ms</span>
        </div>
        <div className="px-4 py-2">
          <div className="h-2 bg-violet-100 rounded-full overflow-hidden">
            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min(100, (d.rankingLatencyMs / 80) * 100)}%` }} />
          </div>
        </div>
        <div className="px-4 py-3 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-800">Total latency</span>
          <span className={clsx('text-sm font-mono font-semibold', d.totalLatencyMs > 80 ? 'text-red-700' : d.totalLatencyMs > 50 ? 'text-yellow-700' : 'text-green-700')}>
            {d.totalLatencyMs}ms
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="NDCG@10"      value={d.ndcg10.toFixed(3)} />
        <Metric label="Precision@10" value={`${(d.precision10 * 100).toFixed(1)}%`} />
        <Metric label="Recall@10"    value={`${(d.recall10 * 100).toFixed(1)}%`} />
        <Metric label="Diversity"    value={d.diversityScore.toFixed(2)} sub="0–1 score" />
        <Metric label="Throughput"   value={`${d.throughput.toLocaleString()}`} sub="req/s" />
        <Metric label="Retrieval K"  value={String(sim.retrievalK)} sub="candidates" />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Retrieval strategy</label>
          <div className="flex gap-2">
            {RETRIEVAL_OPTIONS.map(o => (
              <button key={o.value} onClick={() => sim.setRetrievalStrategy(o.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.retrievalStrategy === o.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.retrievalStrategy !== o.value,
                })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Ranking model</label>
          <div className="flex gap-2">
            {RANKING_OPTIONS.map(o => (
              <button key={o.value} onClick={() => sim.setRankingModel(o.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.rankingModel === o.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.rankingModel !== o.value,
                })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Retrieval K: {sim.retrievalK}
          </label>
          <input type="range" min={50} max={500} step={50} value={sim.retrievalK}
            onChange={e => sim.setRetrievalK(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Diversity weight: {sim.diversityWeight.toFixed(1)}
          </label>
          <input type="range" min={0} max={1} step={0.1} value={sim.diversityWeight}
            onChange={e => sim.setDiversityWeight(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sim.freshnessBoost} onChange={sim.toggleFreshnessBoost} className="accent-gray-800" />
            Freshness boost
          </label>
          <button onClick={sim.reset} className="ml-auto px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>
      </div>

      <AIAdvisorPanel state={sim} derived={d} />
    </div>
  );
}
