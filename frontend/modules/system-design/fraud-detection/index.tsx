'use client';
import clsx from 'clsx';
import { useSimulation, type SamplingStrategy } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const SAMPLING_OPTIONS: { value: SamplingStrategy; label: string }[] = [
  { value: 'none',        label: 'None' },
  { value: 'oversample',  label: 'Oversample' },
  { value: 'undersample', label: 'Undersample' },
  { value: 'smote',       label: 'SMOTE' },
];

function Metric({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={clsx('border rounded-lg p-3 text-center', warn ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white')}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={clsx('text-xl font-mono font-semibold', warn ? 'text-yellow-800' : 'text-gray-900')}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function FraudDetectionSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Fraud Detection Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Tune threshold, sampling strategy, and cost matrix for a highly imbalanced fraud classifier.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Precision"     value={`${(d.precision * 100).toFixed(1)}%`} sub={`${d.tp} TP / ${d.fp} FP`} />
        <Metric label="Recall"        value={`${(d.recall * 100).toFixed(1)}%`}    sub={`${d.fn} missed`} />
        <Metric label="F1"            value={d.f1.toFixed(3)} />
        <Metric label="AUC estimate"  value={d.aucEstimate.toFixed(3)} />
        <Metric label="Approval rate" value={`${(d.approvalRate * 100).toFixed(1)}%`} />
        <Metric label="Daily cost"    value={`$${d.dailyCost.toLocaleString()}`} warn={d.dailyCost > 50000} sub="FP+FN cost" />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Decision threshold: <span className="font-mono">{sim.threshold.toFixed(2)}</span>
          </label>
          <input type="range" min={0.1} max={0.9} step={0.01} value={sim.threshold}
            onChange={e => sim.setThreshold(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Fraud rate: {(sim.fraudRate * 100).toFixed(1)}%
          </label>
          <input type="range" min={0.005} max={0.15} step={0.005} value={sim.fraudRate}
            onChange={e => sim.setFraudRate(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Imbalance handling</label>
          <div className="flex gap-2 flex-wrap">
            {SAMPLING_OPTIONS.map(o => (
              <button key={o.value} onClick={() => sim.setSamplingStrategy(o.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.samplingStrategy === o.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.samplingStrategy !== o.value,
                })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">FP cost ($/case)</label>
            <input type="number" min={0} max={500} value={sim.fpCostDollars}
              onChange={e => sim.setFpCost(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">FN cost ($/fraud)</label>
            <input type="number" min={0} max={5000} value={sim.fnCostDollars}
              onChange={e => sim.setFnCost(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={sim.rejectInference} onChange={sim.toggleRejectInference} className="accent-gray-800" />
            Reject inference
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
