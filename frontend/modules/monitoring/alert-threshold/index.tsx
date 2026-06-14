'use client';
import { useSimulation } from './useSimulation';
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

export function AlertThresholdSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Alert Threshold Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Tune classification threshold and see real-time impact on precision, recall, and daily alert cost.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Precision"  value={`${(d.precision * 100).toFixed(1)}%`} sub={`TP ${d.tp} / FP ${d.fp}`} />
        <Metric label="Recall"     value={`${(d.recall    * 100).toFixed(1)}%`} sub={`FN ${d.fn} missed`} />
        <Metric label="F1 Score"   value={d.f1.toFixed(3)} />
        <Metric label="FPR"        value={`${(d.fpr * 100).toFixed(1)}%`} sub="false alarm rate" />
        <Metric label="True Negs"  value={d.tn.toLocaleString()} />
        <Metric label="Daily Cost" value={`$${d.dailyCost.toLocaleString()}`} sub={`FP $${sim.fpCost} + FN $${sim.fnCost}`} />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Classification threshold: <span className="font-mono">{sim.threshold.toFixed(2)}</span>
          </label>
          <input type="range" min={0.05} max={0.95} step={0.01} value={sim.threshold}
            onChange={e => sim.setThreshold(Number(e.target.value))}
            className="w-full accent-gray-800"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0.05 (more recall)</span><span>0.95 (more precision)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">FP cost ($/alert)</label>
            <input type="number" min={0} max={500} value={sim.fpCost}
              onChange={e => sim.setFpCost(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">FN cost ($/miss)</label>
            <input type="number" min={0} max={5000} value={sim.fnCost}
              onChange={e => sim.setFnCost(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Class prevalence: {(sim.prevalence * 100).toFixed(1)}%
          </label>
          <input type="range" min={0.01} max={0.5} step={0.01} value={sim.prevalence}
            onChange={e => sim.setPrevalence(Number(e.target.value))}
            className="w-full accent-gray-800"
          />
        </div>

        <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Reset
        </button>
      </div>

      <AIAdvisorPanel state={sim} derived={d} />
    </div>
  );
}
