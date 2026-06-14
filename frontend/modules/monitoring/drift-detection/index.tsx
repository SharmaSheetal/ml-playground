'use client';
import clsx from 'clsx';
import { useSimulation } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const PSI_THRESHOLDS = [
  { label: 'Conservative (0.10)', value: 0.10 },
  { label: 'Standard (0.20)',     value: 0.20 },
  { label: 'Lenient (0.25)',      value: 0.25 },
];

export function DriftDetectionSimulator() {
  const sim = useSimulation();

  const statusColor = {
    healthy:  'bg-green-100 text-green-800 border-green-200',
    warning:  'bg-yellow-100 text-yellow-800 border-yellow-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  }[sim.status];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Drift Detection Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Inject feature drift and observe PSI-based alerting in real time.</p>
      </div>

      {sim.alertFired && (
        <div className="border border-red-300 bg-red-50 rounded-lg px-4 py-3 text-sm text-red-800 font-medium">
          Drift alert fired: overall PSI {sim.overallPSI.toFixed(4)} exceeds threshold {sim.psiThreshold}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="border border-gray-200 rounded-lg p-3 bg-white text-center">
          <div className="text-xs text-gray-500 mb-1">Overall PSI</div>
          <div className="text-2xl font-mono font-semibold text-gray-900">{sim.overallPSI.toFixed(4)}</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 bg-white text-center">
          <div className="text-xs text-gray-500 mb-1">Threshold</div>
          <div className="text-2xl font-mono font-semibold text-gray-900">{sim.psiThreshold}</div>
        </div>
        <div className={clsx('border rounded-lg p-3 text-center', statusColor)}>
          <div className="text-xs mb-1 opacity-70">Status</div>
          <div className="text-lg font-semibold capitalize">{sim.status}</div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
        {sim.features.map(f => (
          <div key={f.name} className="px-4 py-3">
            <div className="flex justify-between mb-1.5">
              <span className="text-sm font-mono text-gray-700">{f.name}</span>
              <span className="text-sm font-mono text-gray-900">PSI {f.psi.toFixed(4)}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all duration-700', {
                  'bg-green-400':  f.psi < sim.psiThreshold * 0.5,
                  'bg-yellow-400': f.psi >= sim.psiThreshold * 0.5 && f.psi < sim.psiThreshold,
                  'bg-red-500':    f.psi >= sim.psiThreshold,
                })}
                style={{ width: `${Math.min(100, (f.psi / 0.5) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>baseline {f.baselineMean.toLocaleString()}</span>
              <span>current {f.currentMean.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">PSI Threshold</label>
          <div className="flex gap-2 flex-wrap">
            {PSI_THRESHOLDS.map(t => (
              <button
                key={t.value}
                onClick={() => sim.setPsiThreshold(t.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.psiThreshold === t.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.psiThreshold !== t.value,
                })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Drift Severity: {sim.driftSeverity === 0 ? 'off' : sim.driftSeverity}
          </label>
          <input
            type="range" min={0} max={100} value={sim.driftSeverity}
            onChange={e => sim.setDriftSeverity(Number(e.target.value))}
            className="w-full accent-gray-800"
          />
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
          <button onClick={sim.clearDrift} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Clear drift
          </button>
          <button onClick={sim.reset} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
            Reset
          </button>
        </div>
      </div>

      <AIAdvisorPanel state={sim} />
    </div>
  );
}
