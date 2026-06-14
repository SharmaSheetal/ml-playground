'use client';
import { useState, useMemo } from 'react';

export interface SimState {
  controlRate: number;
  treatmentRate: number;
  sampleSizePerDay: number;
  day: number;
  alpha: number;
  minDetectableEffect: number;
}

export interface DerivedMetrics {
  nControl: number;
  nTreatment: number;
  absoluteLift: number;
  relativeLift: number;
  zScore: number;
  pValue: number;
  power: number;
  significant: boolean;
  daysToSignificance: number | null;
}

function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-0.5 * z * z);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    controlRate: 0.05,
    treatmentRate: 0.058,
    sampleSizePerDay: 500,
    day: 1,
    alpha: 0.05,
    minDetectableEffect: 0.01,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { controlRate: pc, treatmentRate: pt, sampleSizePerDay, day, alpha } = state;
    const n = sampleSizePerDay * day;
    const pooled = (pc + pt) / 2;
    const se = Math.sqrt(pooled * (1 - pooled) * (2 / n));
    const zScore = se > 0 ? (pt - pc) / se : 0;
    const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
    const zAlpha  = 1.96;
    const zBeta   = 0.84;
    const seMde = Math.sqrt(pooled * (1 - pooled) * 2);
    const nNeeded = Math.ceil(((zAlpha + zBeta) * seMde / state.minDetectableEffect) ** 2);
    const daysNeeded = Math.ceil(nNeeded / sampleSizePerDay);
    const power = normalCDF(Math.abs(zScore) - zAlpha);
    return {
      nControl: n, nTreatment: n,
      absoluteLift: pt - pc,
      relativeLift: pc > 0 ? (pt - pc) / pc : 0,
      zScore, pValue,
      power: Math.max(0, Math.min(1, power)),
      significant: pValue < alpha && zScore > 0,
      daysToSignificance: daysNeeded,
    };
  }, [state]);

  const advanceDay        = () => setState(p => ({ ...p, day: p.day + 1 }));
  const setControlRate    = (v: number) => setState(p => ({ ...p, controlRate: v, day: 1 }));
  const setTreatmentRate  = (v: number) => setState(p => ({ ...p, treatmentRate: v, day: 1 }));
  const setSampleSize     = (v: number) => setState(p => ({ ...p, sampleSizePerDay: v, day: 1 }));
  const setAlpha          = (v: number) => setState(p => ({ ...p, alpha: v }));
  const reset             = () => setState({ controlRate: 0.05, treatmentRate: 0.058, sampleSizePerDay: 500, day: 1, alpha: 0.05, minDetectableEffect: 0.01 });

  return { ...state, derived, advanceDay, setControlRate, setTreatmentRate, setSampleSize, setAlpha, reset };
}
