'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export const STAGES = [0, 1, 5, 25, 50, 100] as const;
export type FaultType  = 'none' | 'latency' | 'errors' | 'drift';
export type GateStatus = 'pass' | 'fail' | 'pending';
export type SimStatus  = 'idle' | 'observing' | 'complete' | 'rolledBack';

export interface Metrics {
  p99:       number; // ms
  errorRate: number; // %
  psi:       number; // 0–1
}

export interface Gates {
  p99:       GateStatus;
  errorRate: GateStatus;
  psi:       GateStatus;
}

export interface LogEntry {
  id:    string;
  ts:    number;
  msg:   string;
  level: 'info' | 'warn' | 'success' | 'error';
}

export interface SimState {
  stageIdx:     number;
  champion:     Metrics;
  canary:       Metrics;
  gates:        Gates;
  elapsed:      number;   // seconds at current stage
  minWindow:    number;   // seconds required before promote
  fault:        FaultType;
  status:       SimStatus;
  autoRollback: boolean;
  log:          LogEntry[];
}

const MIN_WINDOW = 20;
const BASE_CHAMPION: Metrics = { p99: 80, errorRate: 0.2, psi: 0 };

function rand(base: number, pct: number) {
  return +(base + (Math.random() - 0.5) * 2 * base * pct).toFixed(2);
}

function canaryMetrics(fault: FaultType): Metrics {
  switch (fault) {
    case 'latency': return { p99: rand(128, 0.12), errorRate: rand(0.28, 0.3), psi: rand(0.03, 0.4) };
    case 'errors':  return { p99: rand(84,  0.08), errorRate: rand(3.8,  0.2), psi: rand(0.04, 0.3) };
    case 'drift':   return { p99: rand(83,  0.08), errorRate: rand(0.28, 0.3), psi: rand(0.19, 0.15) };
    default:        return { p99: rand(82,  0.07), errorRate: rand(0.25, 0.3), psi: rand(0.02, 0.5) };
  }
}

function champMetrics(): Metrics {
  return { p99: rand(80, 0.03), errorRate: rand(0.2, 0.1), psi: 0 };
}

export function evalGates(champion: Metrics, canary: Metrics): Gates {
  return {
    p99:       canary.p99 / champion.p99 <= 1.05 ? 'pass' : 'fail',
    errorRate: canary.errorRate < 1.0            ? 'pass' : 'fail',
    psi:       canary.psi < 0.1                  ? 'pass' : 'fail',
  };
}

export function allPass(gates: Gates): boolean {
  return gates.p99 === 'pass' && gates.errorRate === 'pass' && gates.psi === 'pass';
}

function mkLog(msg: string, level: LogEntry['level']): LogEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now(), msg, level };
}

const INITIAL: SimState = {
  stageIdx:     0,
  champion:     BASE_CHAMPION,
  canary:       { p99: 0, errorRate: 0, psi: 0 },
  gates:        { p99: 'pending', errorRate: 'pending', psi: 'pending' },
  elapsed:      0,
  minWindow:    MIN_WINDOW,
  fault:        'none',
  status:       'idle',
  autoRollback: false,
  log: [mkLog('Simulator ready. Press "Start Canary" to deploy at 1% traffic.', 'info')],
};

export function useSimulation() {
  const [state, setState] = useState<SimState>(INITIAL);

  // Tick every second while observing
  const tick = useCallback(() => {
    setState(prev => {
      if (prev.status !== 'observing') return prev;

      const champion = champMetrics();
      const canary   = canaryMetrics(prev.fault);
      const gates    = evalGates(champion, canary);
      const elapsed  = prev.elapsed + 1;
      const newLogs  = prev.log.slice(-60); // keep last 60 entries

      // Auto-rollback on gate failure
      if (!allPass(gates) && prev.autoRollback) {
        const failing = (Object.keys(gates) as (keyof Gates)[])
          .filter(k => gates[k] === 'fail');
        const prevIdx = Math.max(0, prev.stageIdx - 1);
        newLogs.push(mkLog(
          `AUTO-ROLLBACK — ${failing.join(', ')} gate failed. Rolling back to ${STAGES[prevIdx]}%.`,
          'error'
        ));
        return {
          ...prev, champion, canary, gates,
          stageIdx: prevIdx,
          elapsed: 0,
          status: prevIdx === 0 ? 'idle' : 'observing',
          fault: 'none', log: newLogs,
        };
      }

      // Periodic gate check log every 5s
      if (elapsed % 5 === 0) {
        if (allPass(gates)) {
          newLogs.push(mkLog(
            `Gates passing — ${elapsed}s / ${prev.minWindow}s window at ${STAGES[prev.stageIdx]}%`,
            'success'
          ));
        } else {
          const failing = (Object.keys(gates) as (keyof Gates)[]).filter(k => gates[k] === 'fail');
          newLogs.push(mkLog(`Gate FAIL: ${failing.join(', ')} at ${elapsed}s`, 'warn'));
        }
      }

      return { ...prev, champion, canary, gates, elapsed, log: newLogs };
    });
  }, []);

  useEffect(() => {
    if (state.status !== 'observing') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.status, tick]);

  function startCanary() {
    const champion = champMetrics();
    const canary   = canaryMetrics('none');
    const gates    = evalGates(champion, canary);
    setState(prev => ({
      ...prev, stageIdx: 1, champion, canary, gates,
      elapsed: 0, fault: 'none', status: 'observing',
      log: [...prev.log, mkLog('Canary started at 1% traffic. Observation window running…', 'info')],
    }));
  }

  function promote() {
    setState(prev => {
      if (prev.status !== 'observing') return prev;
      if (!allPass(prev.gates) || prev.elapsed < prev.minWindow) return prev;
      const nextIdx = prev.stageIdx + 1;
      if (nextIdx >= STAGES.length) return prev;
      const nextStage = STAGES[nextIdx];
      const isComplete = nextStage === 100;
      return {
        ...prev,
        stageIdx: nextIdx,
        elapsed: 0,
        status: isComplete ? 'complete' : 'observing',
        log: [...prev.log, mkLog(
          isComplete
            ? 'Deployed to 100% — canary is now the champion. Deployment complete.'
            : `Promoted to ${nextStage}% traffic. New ${MIN_WINDOW}s observation window started.`,
          'success'
        )],
      };
    });
  }

  function rollBack() {
    setState(prev => {
      const prevIdx = Math.max(0, prev.stageIdx - 1);
      return {
        ...prev,
        stageIdx: prevIdx,
        elapsed: 0,
        fault: 'none',
        status: prevIdx === 0 ? 'idle' : 'observing',
        log: [...prev.log, mkLog(
          `Manual rollback — traffic returned to ${STAGES[prevIdx]}%.`,
          'warn'
        )],
      };
    });
  }

  function injectFault(fault: FaultType) {
    const labels: Record<FaultType, string> = {
      none:    'cleared',
      latency: 'Latency Spike — canary P99 spiking above threshold',
      errors:  'Error Injection — canary error rate exceeding 1%',
      drift:   'Feature Drift — PSI rising above 0.1',
    };
    setState(prev => ({
      ...prev,
      fault,
      log: [...prev.log, mkLog(`FAULT: ${labels[fault]}`, fault === 'none' ? 'info' : 'error')],
    }));
  }

  function toggleAutoRollback() {
    setState(prev => ({
      ...prev,
      autoRollback: !prev.autoRollback,
      log: [...prev.log, mkLog(
        !prev.autoRollback
          ? 'Auto-rollback ON — gates will trigger rollback automatically on failure.'
          : 'Auto-rollback OFF.',
        'info'
      )],
    }));
  }

  function reset() {
    setState({ ...INITIAL, log: [mkLog('Simulator reset.', 'info')] });
  }

  const canPromote =
    state.status === 'observing' &&
    allPass(state.gates) &&
    state.elapsed >= state.minWindow;

  return { state, startCanary, promote, rollBack, injectFault, toggleAutoRollback, reset, canPromote };
}
