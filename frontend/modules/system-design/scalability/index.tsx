'use client';
import clsx from 'clsx';
import { useSimulation, type BatchMode } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const STATUS_COLORS = {
  healthy:    'bg-green-100 text-green-800 border-green-200',
  degraded:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  overloaded: 'bg-red-100 text-red-800 border-red-200',
};

const BATCH_MODES: { value: BatchMode; label: string }[] = [
  { value: 'none',    label: 'No batching' },
  { value: 'static',  label: 'Static batch' },
  { value: 'dynamic', label: 'Dynamic batch' },
];

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-mono font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function ScalabilitySimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">ML Scalability Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Configure a serving cluster and observe latency, throughput, GPU utilization, and cost tradeoffs.</p>
      </div>

      <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-white">
        <div>
          <div className="text-sm font-medium text-gray-700">{d.bottleneck}</div>
          <div className="text-xs text-gray-400 mt-0.5">{sim.instanceCount} instance{sim.instanceCount !== 1 ? 's' : ''} — ${d.costPerHour}/hr</div>
        </div>
        <span className={clsx('px-3 py-1.5 rounded-full text-sm font-medium border capitalize', STATUS_COLORS[d.scalingStatus])}>
          {d.scalingStatus}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="p50 latency"  value={`${d.latencyP50}ms`} />
        <Metric label="p95 latency"  value={`${d.latencyP95}ms`} />
        <Metric label="Throughput"   value={`${d.throughput.toLocaleString()}`} sub="req/s" />
        <Metric label="GPU util"     value={`${d.gpuUtilization}%`} />
        <Metric label="Memory"       value={`${(d.memoryUsageMB / 1024).toFixed(1)}GB`} sub="total" />
        <Metric label="Cost"         value={`$${d.costPerHour}`} sub="/hr" />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Target QPS: {sim.qpsTarget.toLocaleString()}
          </label>
          <input type="range" min={100} max={10000} step={100} value={sim.qpsTarget}
            onChange={e => sim.setQpsTarget(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Instances: {sim.instanceCount}
          </label>
          <input type="range" min={1} max={20} step={1} value={sim.instanceCount}
            onChange={e => sim.setInstanceCount(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Batching mode</label>
          <div className="flex gap-2">
            {BATCH_MODES.map(m => (
              <button key={m.value} onClick={() => sim.setBatchMode(m.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.batchMode === m.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.batchMode !== m.value,
                })}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {sim.batchMode !== 'none' && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Batch size: {sim.batchSize}</label>
            <input type="range" min={1} max={128} step={1} value={sim.batchSize}
              onChange={e => sim.setBatchSize(Number(e.target.value))} className="w-full accent-gray-800" />
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Model size: {sim.modelSizeMB}MB</label>
          <input type="range" min={100} max={5000} step={100} value={sim.modelSizeMB}
            onChange={e => sim.setModelSize(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sim.gpuEnabled} onChange={sim.toggleGpu} className="accent-gray-800" />
            GPU inference
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
