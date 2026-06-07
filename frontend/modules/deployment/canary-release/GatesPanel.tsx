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
      status === 'pass'  ? 'bg-emerald-500/10 border-emerald-500/30' :
      status === 'fail'  ? 'bg-red-500/10 border-red-500/40 animate-pulse' :
      'bg-slate-700/40 border-slate-600',
    ].join(' ')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <span className={[
          'text-sm font-bold',
          status === 'pass' ? 'text-emerald-400' :
          status === 'fail' ? 'text-red-400' :
          'text-slate-500',
        ].join(' ')}>
          {status === 'pass' ? '✓ PASS' : status === 'fail' ? '✕ FAIL' : '● WAIT'}
        </span>
      </div>
      <span className="text-[10px] text-slate-500">{threshold}</span>
    </div>
  );
}

function Timer({ elapsed, minWindow }: { elapsed: number; minWindow: number }) {
  const pct = Math.min(100, (elapsed / minWindow) * 100);
  const rem = Math.max(0, minWindow - elapsed);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400 font-medium">Observation Window</span>
        <span className={`font-mono font-bold ${pct >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
          {elapsed}s / {minWindow}s {pct >= 100 ? '✓' : `(${rem}s left)`}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
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
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-5">
      <h3 className="text-sm font-semibold text-slate-200">Gate Status</h3>

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
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors shadow-lg shadow-amber-500/20"
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
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed',
              ].join(' ')}
            >
              {canPromote ? `Promote → ${[0,1,5,25,50,100][stageIdx + 1] ?? 100}%` : 'Promote (waiting…)'}
            </button>

            <button
              onClick={onRollback}
              className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 font-medium text-sm transition-colors"
            >
              Manual Rollback
            </button>

            <button
              onClick={onToggleAuto}
              className={[
                'w-full py-2 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2',
                autoRollback
                  ? 'border-violet-500/40 text-violet-300 bg-violet-500/10'
                  : 'border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-300',
              ].join(' ')}
            >
              <span className={[
                'w-2 h-2 rounded-full',
                autoRollback ? 'bg-violet-400' : 'bg-slate-600',
              ].join(' ')} />
              Auto-Rollback: {autoRollback ? 'ON' : 'OFF'}
            </button>
          </>
        )}

        {(isComplete || isRolled) && (
          <>
            {isComplete && (
              <div className="text-center py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <p className="text-3xl font-black text-emerald-500 mb-1">↑</p>
                <p className="text-emerald-400 font-bold text-sm">Canary promoted to champion</p>
                <p className="text-slate-400 text-xs mt-0.5">100% traffic on new version</p>
              </div>
            )}
            {isRolled && (
              <div className="text-center py-3 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-3xl font-black text-red-500 mb-1">←</p>
                <p className="text-red-400 font-bold text-sm">Rolled back</p>
                <p className="text-slate-400 text-xs mt-0.5">Champion is serving 100% traffic</p>
              </div>
            )}
            <button
              onClick={onReset}
              className="w-full py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500 font-medium text-sm transition-colors"
            >
              Reset Simulation
            </button>
          </>
        )}
      </div>
    </div>
  );
}
