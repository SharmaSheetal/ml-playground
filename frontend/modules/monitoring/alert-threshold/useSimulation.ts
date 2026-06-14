'use client';
import { useState, useMemo } from 'react';

export interface SimState {
  threshold: number;
  fpCost: number;
  fnCost: number;
  prevalence: number;
  total: number;
}

export interface DerivedMetrics {
  tp: number; fp: number; tn: number; fn: number;
  precision: number; recall: number; f1: number; fpr: number;
  dailyCost: number;
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    threshold: 0.5,
    fpCost: 5,
    fnCost: 50,
    prevalence: 0.08,
    total: 10000,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { threshold, fpCost, fnCost, prevalence, total } = state;
    const pos = total * prevalence;
    const neg = total - pos;
    const sensitivity = 1 / (1 + Math.exp(15 * (threshold - 0.5)));
    const specificity  = 1 / (1 + Math.exp(-15 * (threshold - 0.5)));
    const tp = Math.round(pos * sensitivity);
    const fn = Math.round(pos - tp);
    const fp = Math.round(neg * (1 - specificity));
    const tn = Math.round(neg - fp);
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    const fpr       = fp + tn > 0 ? fp / (fp + tn) : 0;
    const dailyCost = fp * fpCost + fn * fnCost;
    return { tp, fp, tn, fn, precision, recall, f1, fpr, dailyCost };
  }, [state]);

  const setThreshold  = (v: number) => setState(p => ({ ...p, threshold: v }));
  const setFpCost     = (v: number) => setState(p => ({ ...p, fpCost: v }));
  const setFnCost     = (v: number) => setState(p => ({ ...p, fnCost: v }));
  const setPrevalence = (v: number) => setState(p => ({ ...p, prevalence: v }));
  const reset         = () => setState({ threshold: 0.5, fpCost: 5, fnCost: 50, prevalence: 0.08, total: 10000 });

  return { ...state, derived, setThreshold, setFpCost, setFnCost, setPrevalence, reset };
}
