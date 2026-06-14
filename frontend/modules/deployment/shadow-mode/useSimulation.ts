'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

export type FaultType  = 'none' | 'latency' | 'divergence' | 'errors';
export type GateStatus = 'pass' | 'fail' | 'pending';
export type SimStatus  = 'idle' | 'running' | 'promoted' | 'abandoned';

export interface ChampionMetrics {
  p99:       number;
  errorRate: number;
  rps:       number;
}

export interface ShadowMetrics {
  p99:       number;
  errorRate: number;
  rps:       number;
}

export interface DivergenceMetrics {
  exactMatch: number;
  deltaP95:   number;
  ndcg:       number;
}

export interface Gates {
  latency:    GateStatus;
  errors:     GateStatus;
  divergence: GateStatus;
  ndcg:       GateStatus;
}

export interface LogEntry {
  id:    string;
  ts:    number;
  msg:   string;
  level: 'info' | 'warn' | 'success' | 'error';
}

export interface SimState {
  status:     SimStatus;
  mirrorPct:  number;
  champion:   ChampionMetrics;
  shadow:     ShadowMetrics;
  divergence: DivergenceMetrics;
  gates:      Gates;
  elapsed:    number;
  fault:      FaultType;
  log:        LogEntry[];
}

interface ApiResponse {
  champion:   { p99: number; error_rate: number; rps: number };
  shadow:     { p99: number; error_rate: number; rps: number };
  divergence: { exact_match: number; delta_p95: number; ndcg: number };
  gates:      { latency: string; errors: string; divergence: string; ndcg: string };
}

function toChampion(r: ApiResponse['champion']): ChampionMetrics {
  return { p99: r.p99, errorRate: r.error_rate, rps: r.rps };
}

function toShadow(r: ApiResponse['shadow']): ShadowMetrics {
  return { p99: r.p99, errorRate: r.error_rate, rps: r.rps };
}

function toDivergence(r: ApiResponse['divergence']): DivergenceMetrics {
  return { exactMatch: r.exact_match, deltaP95: r.delta_p95, ndcg: r.ndcg };
}

function toGates(r: ApiResponse['gates']): Gates {
  return {
    latency:    r.latency    as GateStatus,
    errors:     r.errors     as GateStatus,
    divergence: r.divergence as GateStatus,
    ndcg:       r.ndcg       as GateStatus,
  };
}

function allPass(gates: Gates): boolean {
  return gates.latency === 'pass' && gates.errors === 'pass' &&
    gates.divergence === 'pass' && gates.ndcg === 'pass';
}

function mkLog(msg: string, level: LogEntry['level']): LogEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, ts: Date.now(), msg, level };
}

const INITIAL: SimState = {
  status:     'idle',
  mirrorPct:  20,
  champion:   { p99: 85, errorRate: 0.3, rps: 500 },
  shadow:     { p99: 0, errorRate: 0, rps: 0 },
  divergence: { exactMatch: 0, deltaP95: 0, ndcg: 0 },
  gates:      { latency: 'pending', errors: 'pending', divergence: 'pending', ndcg: 'pending' },
  elapsed:    0,
  fault:      'none',
  log: [mkLog('Shadow mode ready. Press "Start Shadow" to begin mirroring traffic.', 'info')],
};

export function useSimulation() {
  const [state, setState] = useState<SimState>(INITIAL);
  const stateRef = useRef<SimState>(INITIAL);

  useEffect(() => { stateRef.current = state; }, [state]);

  const tick = useCallback(() => {
    const prev = stateRef.current;
    if (prev.status !== 'running') return;

    api.post<ApiResponse>('/api/deployment/shadow-mode/simulate', {
      mirror_pct: prev.mirrorPct,
      fault: prev.fault,
    }).then(result => {
      const champion  = toChampion(result.champion);
      const shadow    = toShadow(result.shadow);
      const div       = toDivergence(result.divergence);
      const gates     = toGates(result.gates);

      setState(s => {
        if (s.status !== 'running') return s;
        const elapsed = s.elapsed + 1;
        const newLogs = s.log.slice(-60);

        if (elapsed % 5 === 0) {
          if (allPass(gates)) {
            newLogs.push(mkLog(
              `Gates passing - ${elapsed}s elapsed, exact match ${div.exactMatch.toFixed(1)}%, NDCG ${div.ndcg.toFixed(3)}`,
              'success'
            ));
          } else {
            const failing = (Object.keys(gates) as (keyof Gates)[]).filter(k => gates[k] === 'fail');
            newLogs.push(mkLog(`Gate FAIL: ${failing.join(', ')} at ${elapsed}s`, 'warn'));
          }
        }

        return { ...s, champion, shadow, divergence: div, gates, elapsed, log: newLogs };
      });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.status, tick]);

  function startShadow() {
    api.post<ApiResponse>('/api/deployment/shadow-mode/simulate', {
      mirror_pct: state.mirrorPct,
      fault: 'none',
    }).then(result => {
      const champion = toChampion(result.champion);
      const shadow   = toShadow(result.shadow);
      const div      = toDivergence(result.divergence);
      const gates    = toGates(result.gates);
      setState(prev => ({
        ...prev, champion, shadow, divergence: div, gates,
        elapsed: 0, fault: 'none', status: 'running',
        log: [...prev.log, mkLog(`Shadow started - mirroring ${prev.mirrorPct}% of traffic. Observing divergence…`, 'info')],
      }));
    }).catch(console.error);
  }

  function promoteToCanary() {
    setState(prev => ({
      ...prev, status: 'promoted',
      log: [...prev.log, mkLog('Shadow gates passed. Shadow model promoted to canary at 1% traffic. Begin canary observation.', 'success')],
    }));
  }

  function abandon() {
    setState(prev => ({
      ...prev, status: 'abandoned', fault: 'none',
      log: [...prev.log, mkLog('Shadow test abandoned. Model requires investigation before any canary exposure.', 'error')],
    }));
  }

  function injectFault(fault: FaultType) {
    const labels: Record<FaultType, string> = {
      none:       'cleared',
      latency:    'Shadow Latency - shadow P99 exceeding 1.2× champion',
      divergence: 'Prediction Divergence - exact match rate dropping below 80%',
      errors:     'Shadow Errors - shadow error rate exceeding 2%',
    };
    setState(prev => ({
      ...prev, fault,
      log: [...prev.log, mkLog(`FAULT: ${labels[fault]}`, fault === 'none' ? 'info' : 'error')],
    }));
  }

  function setMirrorPct(pct: number) {
    setState(prev => ({
      ...prev, mirrorPct: pct,
      log: [...prev.log, mkLog(`Mirror percentage changed to ${pct}%.`, 'info')],
    }));
  }

  function reset() {
    setState({ ...INITIAL, log: [mkLog('Simulator reset.', 'info')] });
  }

  const canPromote =
    state.status === 'running' &&
    allPass(state.gates) &&
    state.elapsed >= 15;

  return { state, startShadow, promoteToCanary, abandon, injectFault, setMirrorPct, reset, canPromote };
}
