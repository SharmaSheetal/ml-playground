'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

export const STAGES = [0, 1, 5, 25, 50, 100] as const;
export type FaultType  = 'none' | 'latency' | 'errors' | 'drift';
export type GateStatus = 'pass' | 'fail' | 'pending';
export type SimStatus  = 'idle' | 'observing' | 'complete' | 'rolledBack';

export interface Metrics {
  p99:       number;
  errorRate: number;
  psi:       number;
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
  elapsed:      number;
  minWindow:    number;
  fault:        FaultType;
  status:       SimStatus;
  autoRollback: boolean;
  log:          LogEntry[];
}

const MIN_WINDOW = 20;

interface ApiResponse {
  champion: { p99: number; error_rate: number; psi: number };
  canary:   { p99: number; error_rate: number; psi: number };
  gates:    { p99: string; error_rate: string; psi: string };
}

function toMetrics(r: { p99: number; error_rate: number; psi: number }): Metrics {
  return { p99: r.p99, errorRate: r.error_rate, psi: r.psi };
}

function toGates(r: { p99: string; error_rate: string; psi: string }): Gates {
  return { p99: r.p99 as GateStatus, errorRate: r.error_rate as GateStatus, psi: r.psi as GateStatus };
}

export function allPass(gates: Gates): boolean {
  return gates.p99 === 'pass' && gates.errorRate === 'pass' && gates.psi === 'pass';
}

function mkLog(msg: string, level: LogEntry['level']): LogEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now(), msg, level };
}

const INITIAL: SimState = {
  stageIdx:     0,
  champion:     { p99: 80, errorRate: 0.2, psi: 0 },
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
  const stateRef = useRef<SimState>(INITIAL);

  useEffect(() => { stateRef.current = state; }, [state]);

  const tick = useCallback(() => {
    const prev = stateRef.current;
    if (prev.status !== 'observing') return;

    api.post<ApiResponse>('/api/deployment/canary-release/simulate', {
      stage_pct: STAGES[prev.stageIdx],
      fault: prev.fault,
    }).then(result => {
      const champion = toMetrics(result.champion);
      const canary   = toMetrics(result.canary);
      const gates    = toGates(result.gates);

      setState(s => {
        if (s.status !== 'observing') return s;
        const elapsed = s.elapsed + 1;
        const newLogs = s.log.slice(-60);

        if (!allPass(gates) && s.autoRollback) {
          const failing = (Object.keys(gates) as (keyof Gates)[]).filter(k => gates[k] === 'fail');
          const prevIdx = Math.max(0, s.stageIdx - 1);
          newLogs.push(mkLog(
            `AUTO-ROLLBACK — ${failing.join(', ')} gate failed. Rolling back to ${STAGES[prevIdx]}%.`,
            'error'
          ));
          return {
            ...s, champion, canary, gates,
            stageIdx: prevIdx,
            elapsed: 0,
            status: prevIdx === 0 ? 'idle' : 'observing',
            fault: 'none', log: newLogs,
          };
        }

        if (elapsed % 5 === 0) {
          if (allPass(gates)) {
            newLogs.push(mkLog(
              `Gates passing — ${elapsed}s / ${s.minWindow}s window at ${STAGES[s.stageIdx]}%`,
              'success'
            ));
          } else {
            const failing = (Object.keys(gates) as (keyof Gates)[]).filter(k => gates[k] === 'fail');
            newLogs.push(mkLog(`Gate FAIL: ${failing.join(', ')} at ${elapsed}s`, 'warn'));
          }
        }

        return { ...s, champion, canary, gates, elapsed, log: newLogs };
      });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (state.status !== 'observing') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.status, tick]);

  function startCanary() {
    api.post<ApiResponse>('/api/deployment/canary-release/simulate', {
      stage_pct: STAGES[1],
      fault: 'none',
    }).then(result => {
      const champion = toMetrics(result.champion);
      const canary   = toMetrics(result.canary);
      const gates    = toGates(result.gates);
      setState(prev => ({
        ...prev, stageIdx: 1, champion, canary, gates,
        elapsed: 0, fault: 'none', status: 'observing',
        log: [...prev.log, mkLog('Canary started at 1% traffic. Observation window running…', 'info')],
      }));
    }).catch(console.error);
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
        log: [...prev.log, mkLog(`Manual rollback — traffic returned to ${STAGES[prevIdx]}%.`, 'warn')],
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
      ...prev, fault,
      log: [...prev.log, mkLog(`FAULT: ${labels[fault]}`, fault === 'none' ? 'info' : 'error')],
    }));
  }

  function toggleAutoRollback() {
    setState(prev => ({
      ...prev, autoRollback: !prev.autoRollback,
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
