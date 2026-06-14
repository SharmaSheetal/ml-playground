'use client';

import { useSimulation } from './useSimulation';
import type { FaultType } from './useSimulation';
import StageBar        from './StageBar';
import MetricsPanel    from './MetricsPanel';
import GatesPanel      from './GatesPanel';
import EventLog        from './EventLog';
import { AIAdvisorPanel } from './AIAdvisorPanel';

export function CanaryReleaseSimulator() {
  const {
    state, startCanary, promote, rollBack, injectFault,
    toggleAutoRollback, reset, canPromote,
  } = useSimulation();

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Canary Release Stepper
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Start the canary · inject faults · watch gates evaluate · promote or roll back.
          </p>
        </div>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs font-mono border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors mt-1"
        >
          RESET
        </button>
      </div>

      {/* Stage bar */}
      <StageBar stageIdx={state.stageIdx} status={state.status} />

      {/* Metrics + Gates side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
        <MetricsPanel
          champion={state.champion}
          canary={state.canary}
          gates={state.gates}
          fault={state.fault}
          status={state.status}
          stageIdx={state.stageIdx}
          onInject={(f: FaultType) => injectFault(f)}
        />
        <GatesPanel
          gates={state.gates}
          elapsed={state.elapsed}
          minWindow={state.minWindow}
          status={state.status}
          canPromote={canPromote}
          autoRollback={state.autoRollback}
          stageIdx={state.stageIdx}
          onPromote={promote}
          onRollback={rollBack}
          onToggleAuto={toggleAutoRollback}
          onStartCanary={startCanary}
          onReset={reset}
        />
      </div>

      {/* AI Advisor */}
      <AIAdvisorPanel
        stageIdx={state.stageIdx}
        champion={state.champion}
        canary={state.canary}
        gates={state.gates}
        elapsed={state.elapsed}
        minWindow={state.minWindow}
        fault={state.fault}
        status={state.status}
      />

      {/* Event log */}
      <EventLog log={state.log} />

    </div>
  );
}
