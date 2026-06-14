'use client';
import clsx from 'clsx';
import { useSimulation, type TaskType } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'classification',        label: 'Classification' },
  { value: 'information_retrieval', label: 'Information retrieval' },
  { value: 'anomaly_detection',     label: 'Anomaly detection' },
];

const OPTIMIZE_FOR: { value: 'precision' | 'recall' | 'f1' | 'f_beta'; label: string }[] = [
  { value: 'precision', label: 'Precision' },
  { value: 'recall',    label: 'Recall' },
  { value: 'f1',        label: 'F1' },
  { value: 'f_beta',    label: 'F-beta' },
];

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={clsx('border rounded-lg p-3 text-center', highlight ? 'border-blue-200 bg-blue-50' : 'border-gray-200 bg-white')}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={clsx('text-xl font-mono font-semibold', highlight ? 'text-blue-800' : 'text-gray-900')}>{value}</div>
    </div>
  );
}

export function PrecisionRecallSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  const maxF1 = Math.max(...d.curve.map(c => c.f1));
  const maxPoint = d.curve.find(c => c.f1 === maxF1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Precision-Recall Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Explore precision-recall tradeoffs across tasks and class imbalance levels.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Precision"  value={`${(d.precision * 100).toFixed(1)}%`} highlight={sim.optimizeFor === 'precision'} />
        <Metric label="Recall"     value={`${(d.recall * 100).toFixed(1)}%`}    highlight={sim.optimizeFor === 'recall'} />
        <Metric label="F1"         value={d.f1.toFixed(3)}                       highlight={sim.optimizeFor === 'f1'} />
        <Metric label="F-beta"     value={d.fBeta.toFixed(3)}                    highlight={sim.optimizeFor === 'f_beta'} />
        <Metric label="AUC-ROC"    value={d.aucRoc.toFixed(3)} />
        <Metric label="AUPRC"      value={d.auprc.toFixed(3)} />
      </div>

      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <div className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Precision-Recall curve</div>
        <div className="relative h-36 flex items-end gap-0.5">
          {d.curve.map((point, i) => {
            const isActive = Math.abs(point.threshold - sim.threshold) < 0.03;
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-0.5">
                <div
                  className={clsx('w-full rounded-t-sm transition-all duration-200', isActive ? 'bg-blue-500' : 'bg-gray-200')}
                  style={{ height: `${point.precision * 100}%` }}
                  title={`t=${point.threshold.toFixed(2)} P=${(point.precision * 100).toFixed(0)}% R=${(point.recall * 100).toFixed(0)}%`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>0.05</span><span>Threshold</span><span>0.95</span>
        </div>
        {maxPoint && (
          <div className="mt-2 text-xs text-gray-500">
            Best F1 ({maxF1.toFixed(3)}) at threshold {maxPoint.threshold.toFixed(2)}
          </div>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
        {d.recommendation}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Task type</label>
          <div className="flex gap-2 flex-wrap">
            {TASK_TYPES.map(t => (
              <button key={t.value} onClick={() => sim.setTaskType(t.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.taskType === t.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.taskType !== t.value,
                })}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Optimize for</label>
          <div className="flex gap-2 flex-wrap">
            {OPTIMIZE_FOR.map(o => (
              <button key={o.value} onClick={() => sim.setOptimizeFor(o.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.optimizeFor === o.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.optimizeFor !== o.value,
                })}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Threshold: <span className="font-mono">{sim.threshold.toFixed(2)}</span> (optimal: {d.optimalThreshold.toFixed(2)})
          </label>
          <input type="range" min={0.05} max={0.95} step={0.05} value={sim.threshold}
            onChange={e => sim.setThreshold(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Class imbalance: {(sim.classImbalance * 100).toFixed(0)}% positive
          </label>
          <input type="range" min={0.01} max={0.5} step={0.01} value={sim.classImbalance}
            onChange={e => sim.setImbalance(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        {sim.optimizeFor === 'f_beta' && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Beta value: {sim.betaValue}</label>
            <input type="range" min={0.5} max={5} step={0.5} value={sim.betaValue}
              onChange={e => sim.setBeta(Number(e.target.value))} className="w-full accent-gray-800" />
          </div>
        )}

        <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Reset
        </button>
      </div>

      <AIAdvisorPanel state={sim} derived={d} />
    </div>
  );
}
