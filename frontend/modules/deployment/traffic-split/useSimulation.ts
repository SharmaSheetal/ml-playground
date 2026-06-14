'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import type {
  VersionMetrics, VersionStatus, SimulationSnapshot,
  SimConfig,
} from './types';

const TICK_MS: Record<SimConfig['speed'], number> = {
  fast: 300, normal: 600, slow: 1200,
};
const HISTORY_LIMIT = 40;

interface ApiResponse {
  v1: { p50: number; p95: number; p99: number; error_rate: number; rps: number; status: string };
  v2: { p50: number; p95: number; p99: number; error_rate: number; rps: number; status: string };
}

function toVersionMetrics(r: ApiResponse['v1']): VersionMetrics {
  return {
    p50:       r.p50,
    p95:       r.p95,
    p99:       r.p99,
    errorRate: r.error_rate,
    rps:       r.rps,
    status:    r.status as VersionStatus,
  };
}

export function useSimulation(config: SimConfig) {
  const [v1Traffic,  _setV1Traffic]  = useState(70);
  const [v1Degraded, _setV1Degraded] = useState(false);
  const [v2Degraded, _setV2Degraded] = useState(false);
  const [running, setRunning]         = useState(true);
  const [metrics, setMetrics]         = useState<{ v1: VersionMetrics; v2: VersionMetrics }>(() => ({
    v1: { p50: 44,  p95: 155, p99: 245,  errorRate: 0.2, rps: 700, status: 'healthy' },
    v2: { p50: 44,  p95: 155, p99: 245,  errorRate: 0.2, rps: 300, status: 'healthy' },
  }));
  const [history,       setHistory]       = useState<SimulationSnapshot[]>([]);
  const [rollbackEvent, setRollbackEvent] = useState<string | null>(null);

  const v1TrafficRef = useRef(70);
  const v1DegRef     = useRef(false);
  const v2DegRef     = useRef(false);
  const v1Ticks      = useRef(0);
  const v2Ticks      = useRef(0);

  function setV1Traffic(v: number) {
    v1TrafficRef.current = v;
    _setV1Traffic(v);
  }
  function setV1Degraded(v: boolean) {
    if (!v) v1Ticks.current = 0;
    v1DegRef.current = v;
    _setV1Degraded(v);
  }
  function setV2Degraded(v: boolean) {
    if (!v) v2Ticks.current = 0;
    v2DegRef.current = v;
    _setV2Degraded(v);
  }

  const tick = useCallback(() => {
    const t1 = v1TrafficRef.current;
    const d1 = v1DegRef.current;
    const d2 = v2DegRef.current;

    if (d1) v1Ticks.current++;
    if (d2) v2Ticks.current++;

    api.post<ApiResponse>('/api/deployment/traffic-split/simulate', {
      v1_traffic:       t1,
      v1_degraded:      d1,
      v2_degraded:      d2,
      degradation_mode: config.degradationMode,
      v1_profile:       { p50: config.v1Profile.p50, p99: config.v1Profile.p99, error_rate: config.v1Profile.errorRate },
      v2_profile:       { p50: config.v2Profile.p50, p99: config.v2Profile.p99, error_rate: config.v2Profile.errorRate },
      total_rps:        config.totalRps,
      ticks_v1:         v1Ticks.current,
      ticks_v2:         v2Ticks.current,
    }).then(result => {
      const v1 = toVersionMetrics(result.v1);
      const v2 = toVersionMetrics(result.v2);

      if (config.autoRollback && d2 && v2.p99 > config.autoRollbackThreshold) {
        setV1Traffic(100);
        const msg = `Auto-rollback triggered - v2 P99 ${v2.p99}ms exceeded ${config.autoRollbackThreshold}ms threshold`;
        setRollbackEvent(msg);
        setTimeout(() => setRollbackEvent(null), 5000);
      }

      setMetrics({ v1, v2 });
      setHistory(prev => [
        ...prev.slice(-(HISTORY_LIMIT - 1)),
        { t: Date.now(), v1p50: v1.p50, v2p50: v2.p50, v1p95: v1.p95, v2p95: v2.p95 },
      ]);
    }).catch(console.error);
  }, [config]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, TICK_MS[config.speed]);
    return () => clearInterval(id);
  }, [running, tick, config.speed]);

  return {
    v1Traffic, setV1Traffic,
    v1Degraded, setV1Degraded,
    v2Degraded, setV2Degraded,
    running, setRunning,
    metrics, history, rollbackEvent,
  };
}
