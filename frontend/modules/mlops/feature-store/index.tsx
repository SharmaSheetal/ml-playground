'use client';
import clsx from 'clsx';
import { useSimulation, type StoreMode } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const SKEW_COLORS = { low: 'text-green-700 bg-green-100', medium: 'text-yellow-700 bg-yellow-100', high: 'text-red-700 bg-red-100' };

export function FeatureStoreSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  const storeModes: StoreMode[] = ['online', 'offline', 'both'];
  const patterns: SimState_readPattern[] = ['point_lookup', 'range_scan', 'batch'];

  type SimState_readPattern = 'point_lookup' | 'range_scan' | 'batch';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Feature Store Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Explore online vs offline store tradeoffs, point-in-time correctness, and training-serving skew risk.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500 mb-1">Online latency (avg)</div>
          <div className="text-2xl font-mono font-semibold text-gray-900">{d.avgOnlineLatency}ms</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500 mb-1">Offline latency (avg)</div>
          <div className="text-2xl font-mono font-semibold text-gray-900">{d.avgOfflineLatency}ms</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500 mb-1">Throughput</div>
          <div className="text-2xl font-mono font-semibold text-gray-900">{d.throughput.toLocaleString()}/s</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <div className="text-xs text-gray-500 mb-1">Skew risk</div>
          <span className={clsx('inline-block px-2 py-0.5 rounded text-sm font-medium capitalize mt-1', SKEW_COLORS[d.skewRisk as keyof typeof SKEW_COLORS])}>{d.skewRisk}</span>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
        <div className="px-4 py-2 grid grid-cols-4 gap-2 text-xs font-medium text-gray-500">
          <span>Feature</span><span>Online</span><span>Offline</span><span>Lag</span>
        </div>
        {d.features.map(f => (
          <div key={f.name} className="px-4 py-2 grid grid-cols-4 gap-2 text-sm">
            <span className="font-mono text-gray-700 truncate">{f.name}</span>
            <span className="font-mono text-gray-900">{f.onlineLatencyMs}ms</span>
            <span className="font-mono text-gray-900">{f.offlineLatencyMs}ms</span>
            <span className={clsx('font-mono', f.staleness > 60 ? 'text-yellow-700' : 'text-gray-500')}>{f.lastMaterialized}</span>
          </div>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Store mode</label>
          <div className="flex gap-2">
            {storeModes.map(m => (
              <button key={m} onClick={() => sim.setStoreMode(m)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors capitalize', {
                  'bg-gray-900 text-white border-gray-900': sim.storeMode === m,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.storeMode !== m,
                })}>
                {m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Read pattern</label>
          <div className="flex gap-2 flex-wrap">
            {patterns.map(p => (
              <button key={p} onClick={() => sim.setReadPattern(p)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.readPattern === p,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.readPattern !== p,
                })}>
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Features: {sim.numFeatures}</label>
          <input type="range" min={2} max={6} step={1} value={sim.numFeatures}
            onChange={e => sim.setNumFeatures(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sim.cacheEnabled} onChange={sim.toggleCache} className="accent-gray-800" />
            Redis cache
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sim.pointInTimeCorrect} onChange={sim.togglePIT} className="accent-gray-800" />
            Point-in-time correct
          </label>
        </div>

        <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Reset
        </button>
      </div>

      <AIAdvisorPanel state={sim} derived={d} />
    </div>
  );
}
