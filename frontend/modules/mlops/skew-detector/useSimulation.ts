'use client';
import { useState, useMemo } from 'react';

export type SkewType = 'none' | 'preprocessing' | 'feature_computation' | 'serving_pipeline';

export interface FeatureSkew {
  name: string;
  trainMean: number;
  servingMean: number;
  trainStd: number;
  servingStd: number;
  skewScore: number;
  skewType: string;
}

export interface SimState {
  injectedSkew: SkewType;
  severity: number;
  numFeatures: number;
}

export interface DerivedMetrics {
  features: FeatureSkew[];
  maxSkew: number;
  detectedIssues: string[];
  overallHealth: 'healthy' | 'degraded' | 'critical';
}

const FEATURE_DEFS = [
  { name: 'income',        trainMean: 68500, trainStd: 18000, skewTypes: ['preprocessing', 'feature_computation'] },
  { name: 'age',           trainMean: 42,    trainStd: 12,    skewTypes: ['preprocessing'] },
  { name: 'spend_30d',     trainMean: 312,   trainStd: 220,   skewTypes: ['feature_computation', 'serving_pipeline'] },
  { name: 'session_count', trainMean: 18.4,  trainStd: 9.2,   skewTypes: ['serving_pipeline'] },
  { name: 'recency_days',  trainMean: 7.2,   trainStd: 4.1,   skewTypes: ['preprocessing', 'serving_pipeline'] },
];

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    injectedSkew: 'none', severity: 50, numFeatures: 4,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { injectedSkew, severity, numFeatures } = state;
    const features: FeatureSkew[] = FEATURE_DEFS.slice(0, numFeatures).map(f => {
      const affected = injectedSkew !== 'none' && f.skewTypes.includes(injectedSkew);
      const factor = affected ? (severity / 100) * 0.6 : 0;
      const servingMean = f.trainMean * (1 + factor + (Math.random() - 0.5) * 0.02);
      const servingStd  = f.trainStd  * (1 + factor * 0.5);
      const skewScore   = Math.abs(servingMean - f.trainMean) / (f.trainStd || 1);
      return {
        name: f.name, trainMean: f.trainMean, servingMean: Math.round(servingMean * 10) / 10,
        trainStd: f.trainStd, servingStd: Math.round(servingStd * 10) / 10,
        skewScore: Math.round(skewScore * 100) / 100,
        skewType: affected ? injectedSkew.replace('_', ' ') : 'none',
      };
    });
    const maxSkew = Math.max(...features.map(f => f.skewScore));
    const issues = features.filter(f => f.skewScore > 0.5).map(f => `${f.name}: ${f.skewType} skew (score ${f.skewScore})`);
    const health = maxSkew > 2 ? 'critical' : maxSkew > 0.5 ? 'degraded' : 'healthy';
    return { features, maxSkew, detectedIssues: issues, overallHealth: health };
  }, [state]);

  const injectSkew    = (v: SkewType) => setState(p => ({ ...p, injectedSkew: v }));
  const setSeverity   = (v: number)   => setState(p => ({ ...p, severity: v }));
  const setNumFeatures= (v: number)   => setState(p => ({ ...p, numFeatures: v }));
  const reset         = () => setState({ injectedSkew: 'none', severity: 50, numFeatures: 4 });

  return { ...state, derived, injectSkew, setSeverity, setNumFeatures, reset };
}
