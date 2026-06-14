'use client';
import clsx from 'clsx';
import { useSimulation, type TriggerMode } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const STAGE_LABELS: Record<string, string> = {
  idle: 'Idle', data_validation: 'Data validation',
  training: 'Training', evaluation: 'Evaluation',
  staging: 'Staging', done: 'Deployed',
};

const TRIGGER_MODES: { value: TriggerMode; label: string }[] = [
  { value: 'performance', label: 'Performance-based' },
  { value: 'drift',       label: 'Drift-based' },
  { value: 'scheduled',   label: 'Scheduled' },
];

export function RetrainingTriggerSimulator() {
  const sim = useSimulation();

  const accOk  = sim.currentAccuracy >= sim.perfThreshold;
  const psiOk  = sim.currentPSI <= sim.driftThreshold;
  const stages = ['data_validation', 'training', 'evaluation', 'staging', 'done'];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Retraining Trigger Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Watch model performance degrade over time and observe automatic retraining pipeline execution.</p>
      </div>

      {sim.triggered && (
        <div className="border border-orange-300 bg-orange-50 rounded-lg px-4 py-3 text-sm text-orange-800 font-medium">
          Retraining triggered: {sim.triggerReason}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className={clsx('border rounded-lg p-3 text-center', accOk ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50')}>
          <div className="text-xs text-gray-500 mb-1">Accuracy</div>
          <div className={clsx('text-2xl font-mono font-semibold', accOk ? 'text-gray-900' : 'text-red-700')}>{sim.currentAccuracy.toFixed(4)}</div>
          <div className="text-xs text-gray-400 mt-0.5">threshold {sim.perfThreshold}</div>
        </div>
        <div className={clsx('border rounded-lg p-3 text-center', psiOk ? 'border-gray-200 bg-white' : 'border-red-200 bg-red-50')}>
          <div className="text-xs text-gray-500 mb-1">PSI</div>
          <div className={clsx('text-2xl font-mono font-semibold', psiOk ? 'text-gray-900' : 'text-red-700')}>{sim.currentPSI.toFixed(4)}</div>
          <div className="text-xs text-gray-400 mt-0.5">threshold {sim.driftThreshold}</div>
        </div>
        <div className="border border-gray-200 rounded-lg p-3 text-center bg-white">
          <div className="text-xs text-gray-500 mb-1">Retrains</div>
          <div className="text-2xl font-mono font-semibold text-gray-900">{sim.retrainCount}</div>
        </div>
      </div>

      {sim.pipelineStage !== 'idle' && (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Pipeline</span>
            <span className="text-sm text-gray-500">{STAGE_LABELS[sim.pipelineStage]}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gray-800 rounded-full transition-all duration-700" style={{ width: `${sim.pipelineProgress}%` }} />
          </div>
          <div className="flex gap-2">
            {stages.map((s, i) => (
              <div key={s} className="flex items-center gap-1 text-xs">
                <span className={clsx('w-2 h-2 rounded-full', {
                  'bg-green-400': stages.indexOf(sim.pipelineStage) > i || sim.pipelineStage === 'done',
                  'bg-gray-800': s === sim.pipelineStage && s !== 'done',
                  'bg-gray-200': stages.indexOf(sim.pipelineStage) < i,
                })} />
                <span className="text-gray-500 hidden sm:inline">{STAGE_LABELS[s].split(' ')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">Trigger mode</label>
          <div className="flex gap-2 flex-wrap">
            {TRIGGER_MODES.map(t => (
              <button key={t.value} onClick={() => sim.setTriggerMode(t.value)}
                className={clsx('px-3 py-1.5 text-xs rounded-md border transition-colors', {
                  'bg-gray-900 text-white border-gray-900': sim.triggerMode === t.value,
                  'bg-white text-gray-700 border-gray-200 hover:border-gray-300': sim.triggerMode !== t.value,
                })}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {sim.triggerMode === 'performance' && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              Performance threshold: {sim.perfThreshold}
            </label>
            <input type="range" min={0.75} max={0.97} step={0.01} value={sim.perfThreshold}
              onChange={e => sim.setPerfThreshold(Number(e.target.value))} className="w-full accent-gray-800" />
          </div>
        )}
        {sim.triggerMode === 'drift' && (
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              PSI threshold: {sim.driftThreshold}
            </label>
            <input type="range" min={0.05} max={0.40} step={0.01} value={sim.driftThreshold}
              onChange={e => sim.setDriftThreshold(Number(e.target.value))} className="w-full accent-gray-800" />
          </div>
        )}

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
          <button onClick={sim.manualTrigger} disabled={sim.pipelineStage !== 'idle'} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Manual trigger
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
