'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  VersionMetrics, VersionStatus, SimulationSnapshot,
  SimConfig, DegradationMode, VersionProfile,
} from './types';

const TICK_MS: Record<SimConfig['speed'], number> = {
  fast: 300, normal: 600, slow: 1200,
};
const HISTORY_LIMIT = 40;

function jitter(base: number, pct = 0.12, enabled = true): number {
  if (!enabled) return Math.round(base);
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct));
}

function degradedMultipliers(
  mode: DegradationMode,
  ticks: number
): { p50: number; p99: number; err: number } {
  switch (mode) {
    case 'latency':
      return { p50: 8,   p99: 9,   err: 3   };
    case 'errors':
      return { p50: 1.2, p99: 2,   err: 60  };  // err clamped to min 15% downstream
    case 'gradual': {
      const m = Math.min(10, 1 + ticks * 0.2);
      return { p50: m, p99: m * 1.25, err: m * 2 };
    }
  }
}

function buildMetrics(
  degraded:  boolean,
  traffic:   number,
  profile:   VersionProfile,
  mode:      DegradationMode,
  ticks:     number,
  totalRps:  number,
  withJitter = true,
): VersionMetrics {
  let { p50, p99, errorRate } = profile;
  const p95base = p50 + (p99 - p50) * 0.55;

  if (degraded) {
    const m = degradedMultipliers(mode, ticks);
    p50       = profile.p50 * m.p50;
    p99       = profile.p99 * m.p99;
    errorRate = mode === 'errors'
      ? Math.max(profile.errorRate * m.err, 15)
      : profile.errorRate * m.err;
  }

  const p95 = p50 + (p99 - p50) * 0.55;

  return {
    p50:       jitter(p50, 0.12, withJitter),
    p95:       jitter(p95, 0.12, withJitter),
    p99:       jitter(p99, 0.12, withJitter),
    errorRate: withJitter
      ? parseFloat((errorRate * (1 + (Math.random() - 0.5) * 0.2)).toFixed(2))
      : parseFloat(errorRate.toFixed(2)),
    rps:       Math.round((traffic / 100) * totalRps),
    status:    (degraded ? 'degraded' : 'healthy') as VersionStatus,
  };
}

export function useSimulation(config: SimConfig) {
  /* ── display state (drives re-renders) ── */
  const [v1Traffic,  _setV1Traffic]  = useState(70);
  const [v1Degraded, _setV1Degraded] = useState(false);
  const [v2Degraded, _setV2Degraded] = useState(false);
  const [running, setRunning]         = useState(true);
  const [metrics, setMetrics]         = useState(() => ({
    v1: buildMetrics(false, 70, config.v1Profile, config.degradationMode, 0, config.totalRps, false),
    v2: buildMetrics(false, 30, config.v2Profile, config.degradationMode, 0, config.totalRps, false),
  }));
  const [history,       setHistory]       = useState<SimulationSnapshot[]>([]);
  const [rollbackEvent, setRollbackEvent] = useState<string | null>(null);

  /* ── refs (always-current values for tick callback) ── */
  const v1TrafficRef = useRef(70);
  const v1DegRef     = useRef(false);
  const v2DegRef     = useRef(false);
  const v1Ticks      = useRef(0);
  const v2Ticks      = useRef(0);

  /* ── wrapped setters keep state + ref in sync ── */
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

  /* ── simulation tick ── */
  const tick = useCallback(() => {
    const t1 = v1TrafficRef.current;
    const d1 = v1DegRef.current;
    const d2 = v2DegRef.current;

    if (d1) v1Ticks.current++;
    if (d2) v2Ticks.current++;

    const v1 = buildMetrics(d1, t1,       config.v1Profile, config.degradationMode, v1Ticks.current, config.totalRps);
    const v2 = buildMetrics(d2, 100 - t1, config.v2Profile, config.degradationMode, v2Ticks.current, config.totalRps);

    /* auto-rollback */
    if (config.autoRollback && d2 && v2.p99 > config.autoRollbackThreshold) {
      setV1Traffic(100);
      const msg = `Auto-rollback triggered — v2 P99 ${v2.p99}ms exceeded ${config.autoRollbackThreshold}ms threshold`;
      setRollbackEvent(msg);
      setTimeout(() => setRollbackEvent(null), 5000);
    }

    setMetrics({ v1, v2 });
    setHistory((prev) => [
      ...prev.slice(-(HISTORY_LIMIT - 1)),
      { t: Date.now(), v1p50: v1.p50, v2p50: v2.p50, v1p95: v1.p95, v2p95: v2.p95 },
    ]);
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
