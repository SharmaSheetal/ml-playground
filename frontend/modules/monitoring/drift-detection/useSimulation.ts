'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export type DriftStatus = 'healthy' | 'warning' | 'critical';

export interface FeatureStats {
  name: string;
  psi: number;
  baselineMean: number;
  currentMean: number;
}

export interface SimState {
  isRunning: boolean;
  driftSeverity: number;
  psiThreshold: number;
  features: FeatureStats[];
  overallPSI: number;
  status: DriftStatus;
  alertFired: boolean;
  tickCount: number;
}

const INITIAL_FEATURES: FeatureStats[] = [
  { name: 'age',        psi: 0.01, baselineMean: 42.3,  currentMean: 42.3  },
  { name: 'income',     psi: 0.02, baselineMean: 68500,  currentMean: 68500 },
  { name: 'spend_30d',  psi: 0.01, baselineMean: 312.4,  currentMean: 312.4 },
  { name: 'days_active',psi: 0.03, baselineMean: 18.7,   currentMean: 18.7  },
];

function computeStatus(psi: number, threshold: number): DriftStatus {
  if (psi >= threshold) return 'critical';
  if (psi >= threshold * 0.5) return 'warning';
  return 'healthy';
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    isRunning: false,
    driftSeverity: 40,
    psiThreshold: 0.20,
    features: INITIAL_FEATURES.map(f => ({ ...f })),
    overallPSI: 0.02,
    status: 'healthy',
    alertFired: false,
    tickCount: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setState(prev => {
      const drifting = prev.driftSeverity > 0;
      const features = prev.features.map(f => {
        let psi = f.psi;
        if (drifting) {
          psi = Math.min(0.5, psi + (Math.random() * prev.driftSeverity) / 6000);
        } else {
          psi = Math.max(0.005, psi * 0.88);
        }
        const shift = drifting ? (psi - 0.01) * f.baselineMean * 0.8 : 0;
        return { ...f, psi, currentMean: f.baselineMean + shift };
      });
      const overallPSI = features.reduce((s, f) => s + f.psi, 0) / features.length;
      const status = computeStatus(overallPSI, prev.psiThreshold);
      return { ...prev, features, overallPSI, status, alertFired: overallPSI >= prev.psiThreshold, tickCount: prev.tickCount + 1 };
    });
  }, []);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(tick, 1200);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.isRunning, tick]);

  const startMonitoring  = () => setState(p => ({ ...p, isRunning: true }));
  const stopMonitoring   = () => setState(p => ({ ...p, isRunning: false }));
  const setDriftSeverity = (v: number) => setState(p => ({ ...p, driftSeverity: v }));
  const clearDrift       = () => setState(p => ({ ...p, driftSeverity: 0 }));
  const setPsiThreshold  = (v: number) => setState(p => ({ ...p, psiThreshold: v }));

  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState({
      isRunning: false, driftSeverity: 40, psiThreshold: 0.20,
      features: INITIAL_FEATURES.map(f => ({ ...f })),
      overallPSI: 0.02, status: 'healthy', alertFired: false, tickCount: 0,
    });
  };

  return { ...state, startMonitoring, stopMonitoring, setDriftSeverity, clearDrift, setPsiThreshold, reset };
}
