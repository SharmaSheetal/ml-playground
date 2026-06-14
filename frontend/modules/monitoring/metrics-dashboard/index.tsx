'use client';
import clsx from 'clsx';
import { useSimulation, type LayerName } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const LAYER_LABELS: Record<LayerName, string> = {
  infrastructure: 'Infrastructure',
  model_quality:  'Model Quality',
  business:       'Business',
  data_quality:   'Data Quality',
};

const STATUS_COLORS = {
  normal:   'border-gray-200 bg-white',
  degraded: 'border-yellow-300 bg-yellow-50',
  critical: 'border-red-300 bg-red-50',
};

const STATUS_DOT = {
  normal:   'bg-green-400',
  degraded: 'bg-yellow-400',
  critical: 'bg-red-500 animate-pulse',
};

export function MetricsDashboardSimulator() {
  const sim = useSimulation();

  const layers: LayerName[] = ['infrastructure', 'model_quality', 'business', 'data_quality'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Metrics Dashboard Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Inject faults per layer and observe how metrics cascade across the monitoring stack.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {layers.map(layer => {
          const layerMetrics = sim.metrics.filter(m => m.layer === layer);
          const worst = layerMetrics.some(m => m.status === 'critical') ? 'critical' : layerMetrics.some(m => m.status === 'degraded') ? 'degraded' : 'normal';
          return (
            <div key={layer} className={clsx('border rounded-lg p-3', STATUS_COLORS[worst])}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">{LAYER_LABELS[layer]}</span>
                <span className={clsx('w-2 h-2 rounded-full', STATUS_DOT[worst])} />
              </div>
              {layerMetrics.map(m => (
                <div key={m.label} className="flex justify-between text-sm mt-1">
                  <span className="text-gray-600">{m.label}</span>
                  <span className="font-mono text-gray-900">{m.value}{m.unit}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Inject fault at layer</label>
          <div className="flex gap-2 flex-wrap">
            {layers.map(l => (
              <button
                key={l}
                onClick={() => sim.faultLayer === l ? sim.clearFault() : sim.injectFault(l)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-red-600 text-white border-red-600': sim.faultLayer === l,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.faultLayer !== l,
                })}
              >
                {LAYER_LABELS[l]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={sim.toggleCascade}
            className={clsx('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', {
              'bg-gray-900': sim.cascadeEnabled,
              'bg-gray-300': !sim.cascadeEnabled,
            })}
          >
            <span className={clsx('inline-block h-4 w-4 transform rounded-full bg-white transition-transform', {
              'translate-x-4': sim.cascadeEnabled,
              'translate-x-0.5': !sim.cascadeEnabled,
            })} />
          </button>
          <span className="text-sm text-gray-600">Cascade to downstream layers</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!sim.isRunning ? (
            <button onClick={sim.startMonitoring} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
              Start monitoring
            </button>
          ) : (
            <button onClick={sim.stopMonitoring} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              Pause
            </button>
          )}
          <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>
      </div>

      <AIAdvisorPanel state={sim} />
    </div>
  );
}
