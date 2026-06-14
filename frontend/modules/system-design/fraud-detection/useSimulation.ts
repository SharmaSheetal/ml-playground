'use client';
import { useState, useMemo } from 'react';

export type SamplingStrategy = 'none' | 'oversample' | 'undersample' | 'smote';

export interface SimState {
  threshold: number;
  fraudRate: number;
  samplingStrategy: SamplingStrategy;
  rejectInference: boolean;
  featureCount: number;
  fpCostDollars: number;
  fnCostDollars: number;
}

export interface DerivedMetrics {
  tp: number; fp: number; tn: number; fn: number;
  precision: number; recall: number; f1: number;
  dailyCost: number;
  approvalRate: number;
  aucEstimate: number;
}

function normCDF(z: number): number {
  return 1 / (1 + Math.exp(-1.702 * z));
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    threshold: 0.5, fraudRate: 0.02, samplingStrategy: 'none',
    rejectInference: false, featureCount: 20,
    fpCostDollars: 15, fnCostDollars: 200,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { threshold, fraudRate, samplingStrategy, rejectInference, featureCount, fpCostDollars, fnCostDollars } = state;
    const N = 50000;
    const pos = Math.round(N * fraudRate);
    const neg = N - pos;

    const samplingBoost = samplingStrategy === 'none' ? 0 : samplingStrategy === 'oversample' ? 0.06 : samplingStrategy === 'undersample' ? 0.04 : 0.09;
    const riBenefit = rejectInference ? 0.04 : 0;
    const featureBenefit = (featureCount - 10) * 0.003;

    const baseSensitivity = normCDF((1.5 - threshold * 2) + samplingBoost + riBenefit + featureBenefit);
    const baseSpecificity  = normCDF((threshold * 2 - 0.5));

    const tp = Math.round(pos * Math.min(0.99, baseSensitivity));
    const fn = pos - tp;
    const fp = Math.round(neg * (1 - Math.min(0.999, baseSpecificity)));
    const tn = neg - fp;

    const precision    = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall       = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1           = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    const dailyCost    = fp * fpCostDollars + fn * fnCostDollars;
    const approvalRate = (tn + fn) / N;
    const aucEstimate  = Math.min(0.99, 0.72 + samplingBoost * 0.5 + riBenefit * 0.5 + featureBenefit * 0.3);

    return { tp, fp, tn, fn, precision, recall, f1, dailyCost, approvalRate, aucEstimate };
  }, [state]);

  const setThreshold        = (v: number) => setState(p => ({ ...p, threshold: v }));
  const setFraudRate        = (v: number) => setState(p => ({ ...p, fraudRate: v }));
  const setSamplingStrategy = (v: SamplingStrategy) => setState(p => ({ ...p, samplingStrategy: v }));
  const toggleRejectInference = () => setState(p => ({ ...p, rejectInference: !p.rejectInference }));
  const setFeatureCount     = (v: number) => setState(p => ({ ...p, featureCount: v }));
  const setFpCost           = (v: number) => setState(p => ({ ...p, fpCostDollars: v }));
  const setFnCost           = (v: number) => setState(p => ({ ...p, fnCostDollars: v }));
  const reset = () => setState({ threshold: 0.5, fraudRate: 0.02, samplingStrategy: 'none', rejectInference: false, featureCount: 20, fpCostDollars: 15, fnCostDollars: 200 });

  return { ...state, derived, setThreshold, setFraudRate, setSamplingStrategy, toggleRejectInference, setFeatureCount, setFpCost, setFnCost, reset };
}
