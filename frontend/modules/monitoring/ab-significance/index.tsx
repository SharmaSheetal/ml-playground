'use client';
import clsx from 'clsx';
import { useSimulation } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

function Metric({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={clsx('border rounded-lg p-3 text-center', highlight ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white')}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={clsx('text-xl font-mono font-semibold', highlight ? 'text-green-800' : 'text-gray-900')}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function ABSignificanceSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">A/B Significance Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Advance days to accumulate sample size and watch p-value and power evolve toward significance.</p>
      </div>

      <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-white">
        <div>
          <div className="text-sm font-medium text-gray-700">Day {sim.day}</div>
          <div className="text-xs text-gray-400 mt-0.5">{(sim.sampleSizePerDay * sim.day * 2).toLocaleString()} total observations</div>
        </div>
        <div className={clsx('px-3 py-1.5 rounded-full text-sm font-medium border', d.significant
          ? 'bg-green-100 text-green-800 border-green-200'
          : 'bg-gray-100 text-gray-600 border-gray-200')}>
          {d.significant ? 'Significant' : 'Not significant'}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="p-value"     value={d.pValue.toFixed(4)} sub={`alpha ${sim.alpha}`} highlight={d.significant} />
        <Metric label="Power"       value={`${(d.power * 100).toFixed(1)}%`} sub="target 80%" />
        <Metric label="Z-score"     value={d.zScore.toFixed(3)} />
        <Metric label="Abs lift"    value={`+${(d.absoluteLift * 100).toFixed(3)}%`} />
        <Metric label="Rel lift"    value={`${(d.relativeLift * 100).toFixed(1)}%`} />
        <Metric label="Days needed" value={d.daysToSignificance !== null ? `${d.daysToSignificance}d` : 'N/A'} sub="for MDE" />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Control rate</label>
            <input type="number" min={0.001} max={0.999} step={0.001} value={sim.controlRate}
              onChange={e => sim.setControlRate(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Treatment rate</label>
            <input type="number" min={0.001} max={0.999} step={0.001} value={sim.treatmentRate}
              onChange={e => sim.setTreatmentRate(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-md px-3 py-1.5 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Sample size per day (per variant): {sim.sampleSizePerDay.toLocaleString()}
          </label>
          <input type="range" min={100} max={5000} step={100} value={sim.sampleSizePerDay}
            onChange={e => sim.setSampleSize(Number(e.target.value))}
            className="w-full accent-gray-800"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={sim.advanceDay} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors">
            Advance 1 day
          </button>
          <button
            onClick={() => { for (let i = 0; i < 7; i++) sim.advanceDay(); }}
            className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            +7 days
          </button>
          <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>
      </div>

      <AIAdvisorPanel state={sim} derived={d} />
    </div>
  );
}
