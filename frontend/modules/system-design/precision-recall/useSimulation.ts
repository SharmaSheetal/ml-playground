'use client';
import { useState, useMemo } from 'react';

export type TaskType = 'classification' | 'information_retrieval' | 'anomaly_detection';

export interface SimState {
  threshold: number;
  taskType: TaskType;
  classImbalance: number;
  optimizeFor: 'precision' | 'recall' | 'f1' | 'f_beta';
  betaValue: number;
}

export interface CurvePoint { threshold: number; precision: number; recall: number; f1: number; }

export interface DerivedMetrics {
  precision: number;
  recall: number;
  f1: number;
  fBeta: number;
  auprc: number;
  aucRoc: number;
  optimalThreshold: number;
  curve: CurvePoint[];
  recommendation: string;
}

function sigmoidSensitivity(t: number, imbalance: number): number {
  const bias = 0.3 + imbalance * 0.4;
  return 1 / (1 + Math.exp(10 * (t - bias)));
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    threshold: 0.5, taskType: 'classification',
    classImbalance: 0.1, optimizeFor: 'f1', betaValue: 2,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { threshold, classImbalance, optimizeFor, betaValue } = state;
    const recall    = sigmoidSensitivity(threshold, classImbalance);
    const precision = 1 - 0.5 * (1 - recall) * (1 - classImbalance);
    const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    const fBeta     = precision + recall > 0 ? (1 + betaValue ** 2) * precision * recall / (betaValue ** 2 * precision + recall) : 0;
    const auprc     = 0.55 + (1 - classImbalance) * 0.35;
    const aucRoc    = 0.70 + (1 - classImbalance) * 0.25;
    const curve: CurvePoint[] = Array.from({ length: 19 }, (_, i) => {
      const t   = 0.05 + i * 0.05;
      const r   = sigmoidSensitivity(t, classImbalance);
      const p   = 1 - 0.5 * (1 - r) * (1 - classImbalance);
      const f   = p + r > 0 ? 2 * p * r / (p + r) : 0;
      return { threshold: t, precision: p, recall: r, f1: f };
    });
    let optimalThreshold: number;
    if (optimizeFor === 'precision') optimalThreshold = 0.8;
    else if (optimizeFor === 'recall') optimalThreshold = 0.2 + classImbalance * 0.2;
    else if (optimizeFor === 'f_beta') optimalThreshold = betaValue > 1 ? 0.25 : 0.65;
    else optimalThreshold = 0.5;
    const recs: Record<TaskType, string> = {
      classification: 'Use F1 or F-beta depending on class imbalance and business cost matrix.',
      information_retrieval: 'Optimize for recall@K at retrieval stage; precision@K at ranking stage.',
      anomaly_detection: 'High recall (low threshold) is typically preferred to avoid missing anomalies.',
    };
    return { precision, recall, f1, fBeta, auprc, aucRoc, optimalThreshold, curve, recommendation: recs[state.taskType] };
  }, [state]);

  const setThreshold    = (v: number) => setState(p => ({ ...p, threshold: v }));
  const setTaskType     = (v: TaskType) => setState(p => ({ ...p, taskType: v }));
  const setImbalance    = (v: number) => setState(p => ({ ...p, classImbalance: v }));
  const setOptimizeFor  = (v: SimState['optimizeFor']) => setState(p => ({ ...p, optimizeFor: v }));
  const setBeta         = (v: number) => setState(p => ({ ...p, betaValue: v }));
  const reset = () => setState({ threshold: 0.5, taskType: 'classification', classImbalance: 0.1, optimizeFor: 'f1', betaValue: 2 });

  return { ...state, derived, setThreshold, setTaskType, setImbalance, setOptimizeFor, setBeta, reset };
}
