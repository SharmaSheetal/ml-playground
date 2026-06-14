'use client';
import clsx from 'clsx';
import { useSimulation, type SkewType } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const SKEW_TYPES: { value: SkewType; label: string }[] = [
  { value: 'none',                label: 'No skew' },
  { value: 'preprocessing',       label: 'Preprocessing' },
  { value: 'feature_computation', label: 'Feature computation' },
  { value: 'serving_pipeline',    label: 'Serving pipeline' },
];

const HEALTH_COLORS = {
  healthy:  'bg-green-100 text-green-800 border-green-200',
  degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
};

export function SkewDetectorSimulator() {
  const sim = useSimulation();
  const d   = sim.derived;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Skew Detector Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Inject different types of training-serving skew and observe feature distribution divergence.</p>
      </div>

      <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-white">
        <div>
          <div className="text-sm font-medium text-gray-700">Max skew score: {d.maxSkew}</div>
          <div className="text-xs text-gray-400 mt-0.5">{d.detectedIssues.length} issue{d.detectedIssues.length !== 1 ? 's' : ''} detected</div>
        </div>
        <span className={clsx('px-3 py-1.5 rounded-full text-sm font-medium border capitalize', HEALTH_COLORS[d.overallHealth])}>
          {d.overallHealth}
        </span>
      </div>

      {d.detectedIssues.length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-3 space-y-1">
          {d.detectedIssues.map(issue => (
            <div key={issue} className="text-xs text-yellow-800 font-mono">{issue}</div>
          ))}
        </div>
      )}

      <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
        <div className="px-4 py-2 grid grid-cols-4 gap-2 text-xs font-medium text-gray-500">
          <span>Feature</span><span>Train mean</span><span>Serving mean</span><span>Skew</span>
        </div>
        {d.features.map(f => (
          <div key={f.name} className="px-4 py-2.5 grid grid-cols-4 gap-2">
            <span className="text-sm font-mono text-gray-700">{f.name}</span>
            <span className="text-sm font-mono text-gray-600">{f.trainMean.toLocaleString()}</span>
            <span className={clsx('text-sm font-mono', f.skewScore > 0.5 ? 'text-red-700 font-medium' : 'text-gray-900')}>
              {f.servingMean.toLocaleString()}
            </span>
            <div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full', {
                    'bg-green-400':  f.skewScore < 0.5,
                    'bg-yellow-400': f.skewScore >= 0.5 && f.skewScore < 2,
                    'bg-red-500':    f.skewScore >= 2,
                  })}
                  style={{ width: `${Math.min(100, (f.skewScore / 3) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 mt-0.5 block">{f.skewScore}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Inject skew type</label>
          <div className="flex gap-2 flex-wrap">
            {SKEW_TYPES.map(t => (
              <button key={t.value} onClick={() => sim.injectSkew(t.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.injectedSkew === t.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.injectedSkew !== t.value,
                })}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Severity: {sim.severity}%
          </label>
          <input type="range" min={10} max={100} step={5} value={sim.severity}
            onChange={e => sim.setSeverity(Number(e.target.value))}
            disabled={sim.injectedSkew === 'none'}
            className="w-full accent-gray-800 disabled:opacity-40"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Features: {sim.numFeatures}</label>
          <input type="range" min={2} max={5} step={1} value={sim.numFeatures}
            onChange={e => sim.setNumFeatures(Number(e.target.value))} className="w-full accent-gray-800" />
        </div>

        <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
          Reset
        </button>
      </div>

      <AIAdvisorPanel state={sim} derived={d} />
    </div>
  );
}
