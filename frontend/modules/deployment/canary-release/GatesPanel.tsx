'use client';

import type { Gates, GateStatus, SimStatus } from './useSimulation';

interface Props {
  gates:          Gates;
  elapsed:        number;
  minWindow:      number;
  status:         SimStatus;
  canPromote:     boolean;
  autoRollback:   boolean;
  stageIdx:       number;
  onPromote:      () => void;
  onRollback:     () => void;
  onToggleAuto:   () => void;
  onStartCanary:  () => void;
  onReset:        () => void;
}

function GateCard({ label, status, threshold }: { label: string; status: GateStatus; threshold: string }) {
  return (
    <div className={[
      'flex flex-col gap-1 rounded-lg border p-3 transition-all',
      status === 'pass'  ? 'bg-green-50 border-green-200' :
      status === 'fail'  ? 'bg-red-50 border-red-200 animate-pulse' :
      'bg-gray-50 border-gray-200',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className={[
          'text-sm font-bold',
          status === 'pass' ? 'text-green-600' :
          status === 'fail' ? 'text-red-600' :
          'text-gray-400',
        ].join(' ')}>
          {status === 'pass' ? '✓ PASS' : status === 'fail' ? '✕ FAIL' : '● WAIT'}
        </span>
      </div>
      <span className="text-[10px] text-gray-400">{threshold}</span>
    </div>
  );
}

function Timer({ elapsed, minWindow }: { elapsed: number; minWindow: number }) {
  const pct = Math.min(100, (elapsed / minWindow) * 100);
  const rem = Math.max(0, minWindow - elapsed);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500 font-medium">Observation Window</span>
        <span className={`font-mono font-bold ${pct >= 100 ? 'text-green-600' : 'text-amber-600'}`}>
          {elapsed}s / {minWindow}s {pct >= 100 ? '✓' : `(${rem}s left)`}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-green-500' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function GatesPanel({
  gates, elapsed, minWindow, status, canPromote, autoRollback,
  stageIdx, onPromote, onRollback, onToggleAuto, onStartCanary, onReset,
}: Props) {
  const isIdle     = status === 'idle';
  const isComplete = status === 'complete';
  const isRolled   = status === 'rolledBack';
  const isObserving = status === 'observing';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-gray-800">Gate Status</h3>

      {/* Gate cards */}
      <div className="space-y-2">
        <GateCard
          label="P99 Latency"
          status={isObserving ? gates.p99 : 'pending'}
          threshold="Canary P99 ≤ 105% of champion"
        />
        <GateCard
          label="Error Rate"
          status={isObserving ? gates.errorRate : 'pending'}
          threshold="Error rate < 1%"
        />
        <GateCard
          label="Prediction PSI"
          status={isObserving ? gates.psi : 'pending'}
          threshold="PSI < 0.1 (no distribution shift)"
        />
      </div>

      {/* Timer */}
      {isObserving && (
        <Timer elapsed={elapsed} minWindow={minWindow} />
      )}

      {/* Controls */}
      <div className="space-y-3 pt-1">
        {isIdle && (
          <button
            onClick={onStartCanary}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
          >
            Start Canary at 1%
          </button>
        )}

        {isObserving && (
          <>
            <button
              disabled={!canPromote}
              onClick={onPromote}
              title={!canPromote ? 'Wait for all gates to pass and observation window to elapse' : ''}
              className={[
                'w-full py-2.5 rounded-lg font-bold text-sm transition-all',
                canPromote
                  ? 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed',
              ].join(' ')}
            >
              {canPromote ? `Promote → ${[0,1,5,25,50,100][stageIdx + 1] ?? 100}%` : 'Promote (waiting…)'}
            </button>

            <button
              onClick={onRollback}
              className="w-full py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-medium text-sm transition-colors"
            >
              Manual Rollback
            </button>

            <button
              onClick={onToggleAuto}
              className={[
                'w-full py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                autoRollback
                  ? 'border-violet-200 text-violet-600 bg-violet-50'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700',
              ].join(' ')}
            >
              <span className={[
                'w-2 h-2 rounded-full',
                autoRollback ? 'bg-violet-500' : 'bg-gray-300',
              ].join(' ')} />
              Auto-Rollback: {autoRollback ? 'ON' : 'OFF'}
            </button>
          </>
        )}

        {(isComplete || isRolled) && (
          <>
            {isComplete && (
              <div className="text-center py-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-3xl font-black text-green-600 mb-1">↑</p>
                <p className="text-green-600 font-bold text-sm">Canary promoted to champion</p>
                <p className="text-gray-500 text-xs mt-0.5">100% traffic on new version</p>
              </div>
            )}
            {isRolled && (
              <div className="text-center py-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-3xl font-black text-red-600 mb-1">←</p>
                <p className="text-red-600 font-bold text-sm">Rolled back</p>
                <p className="text-gray-500 text-xs mt-0.5">Champion is serving 100% traffic</p>
              </div>
            )}
            <button
              onClick={onReset}
              className="w-full py-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 font-medium text-sm transition-colors"
            >
              Reset Simulation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
