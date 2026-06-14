'use client';
import clsx from 'clsx';
import { useSimulation } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

const STATUS_STYLES = {
  pending: 'bg-gray-100 text-gray-400 border-gray-200',
  running: 'bg-blue-100 text-blue-700 border-blue-200',
  passed:  'bg-green-100 text-green-700 border-green-200',
  failed:  'bg-red-100 text-red-700 border-red-200',
  skipped: 'bg-gray-50 text-gray-300 border-gray-100',
};

const STATUS_ICON: Record<string, string> = {
  pending: '-', running: '...', passed: 'pass', failed: 'fail', skipped: 'skip',
};

export function CICDPipelineSimulator() {
  const sim = useSimulation();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">CI/CD Pipeline Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">Simulate the ML deployment pipeline with configurable failure probability and observe gate outcomes.</p>
      </div>

      <div className="flex items-center justify-between border border-gray-200 rounded-lg px-4 py-3 bg-white">
        <div>
          <div className="text-sm font-medium text-gray-700">
            {sim.lastRunResult === 'none' ? 'Ready to run' : sim.lastRunResult === 'success' ? 'Pipeline passed' : `Failed at: ${sim.failedAt}`}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Run #{sim.runCount}</div>
        </div>
        <div className={clsx('px-3 py-1.5 rounded-full text-sm font-medium border', {
          'bg-gray-100 text-gray-600 border-gray-200':    sim.lastRunResult === 'none',
          'bg-green-100 text-green-700 border-green-200': sim.lastRunResult === 'success',
          'bg-red-100 text-red-700 border-red-200':       sim.lastRunResult === 'failed',
        })}>
          {sim.lastRunResult === 'none' ? 'Not started' : sim.lastRunResult === 'success' ? 'Success' : 'Failed'}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg bg-white divide-y divide-gray-100">
        {sim.stages.map((stage, i) => (
          <div key={stage.id} className="px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                <span className="text-sm font-medium text-gray-800">{stage.label}</span>
              </div>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border font-medium', STATUS_STYLES[stage.status])}>
                {STATUS_ICON[stage.status]}
              </span>
            </div>
            <div className="ml-6">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div
                  className={clsx('h-full rounded-full transition-all duration-200', {
                    'bg-blue-400 animate-pulse': stage.status === 'running',
                    'bg-green-400':              stage.status === 'passed',
                    'bg-red-500':                stage.status === 'failed',
                    'bg-gray-200':               stage.status === 'pending' || stage.status === 'skipped',
                  })}
                  style={{ width: `${stage.progress}%` }}
                />
              </div>
              <div className="text-xs text-gray-400">Gate: {stage.gate}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Failure probability: {sim.failureProbability}% per stage
          </label>
          <input type="range" min={0} max={60} step={5} value={sim.failureProbability}
            onChange={e => sim.setFailureProbability(Number(e.target.value))}
            className="w-full accent-gray-800"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>0% (always pass)</span><span>60% (high risk)</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={sim.startPipeline}
            disabled={sim.isRunning}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {sim.isRunning ? 'Running...' : 'Run pipeline'}
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
