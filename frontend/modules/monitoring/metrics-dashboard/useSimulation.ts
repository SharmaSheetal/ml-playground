'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export type LayerName = 'infrastructure' | 'model_quality' | 'business' | 'data_quality';
export type MetricStatus = 'normal' | 'degraded' | 'critical';

export interface MetricCard {
  layer: LayerName;
  label: string;
  value: number;
  unit: string;
  baseline: number;
  status: MetricStatus;
}

export interface SimState {
  isRunning: boolean;
  faultLayer: LayerName | null;
  cascadeEnabled: boolean;
  metrics: MetricCard[];
  tickCount: number;
}

const BASELINE_METRICS: Omit<MetricCard, 'status'>[] = [
  { layer: 'infrastructure',  label: 'GPU utilization',   value: 72,   unit: '%',  baseline: 72   },
  { layer: 'infrastructure',  label: 'Latency p95',        value: 120,  unit: 'ms', baseline: 120  },
  { layer: 'model_quality',   label: 'Accuracy',           value: 0.93, unit: '',   baseline: 0.93 },
  { layer: 'model_quality',   label: 'AUC-ROC',            value: 0.89, unit: '',   baseline: 0.89 },
  { layer: 'business',        label: 'Conversion rate',    value: 4.2,  unit: '%',  baseline: 4.2  },
  { layer: 'business',        label: 'Revenue / req',      value: 0.82, unit: '$',  baseline: 0.82 },
  { layer: 'data_quality',    label: 'Null rate',          value: 0.3,  unit: '%',  baseline: 0.3  },
  { layer: 'data_quality',    label: 'Schema violations',  value: 0,    unit: '/h', baseline: 0    },
];

function assignStatus(m: Omit<MetricCard,'status'>, fault: LayerName | null, cascade: boolean): MetricStatus {
  if (!fault) return 'normal';
  const affected = m.layer === fault || (cascade && layerIndex(m.layer) > layerIndex(fault));
  if (!affected) return 'normal';
  const severity = cascade ? layerIndex(m.layer) - layerIndex(fault) : 0;
  return severity > 1 ? 'critical' : 'degraded';
}

function layerIndex(l: LayerName) {
  return ({ infrastructure: 0, model_quality: 1, business: 2, data_quality: 3 })[l];
}

function degrade(m: MetricCard, status: MetricStatus): MetricCard {
  if (status === 'normal') return { ...m, value: m.baseline };
  const factor = status === 'critical' ? 0.6 : 0.82;
  const isHighBad = m.label.includes('Latency') || m.label.includes('Null') || m.label.includes('violations');
  const value = isHighBad ? m.baseline / factor : m.baseline * factor;
  return { ...m, value: parseFloat(value.toFixed(m.baseline < 1 ? 4 : 1)), status };
}

export function useSimulation() {
  const init = (): SimState => ({
    isRunning: false, faultLayer: null, cascadeEnabled: true,
    metrics: BASELINE_METRICS.map(m => ({ ...m, status: 'normal' })),
    tickCount: 0,
  });

  const [state, setState] = useState<SimState>(init);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setState(prev => {
      const metrics = prev.metrics.map(m => {
        const status = assignStatus(m, prev.faultLayer, prev.cascadeEnabled);
        const base = degrade(m, status);
        const jitter = (Math.random() - 0.5) * 0.04 * base.value;
        return { ...base, value: parseFloat((base.value + jitter).toFixed(base.baseline < 1 ? 4 : 1)) };
      });
      return { ...prev, metrics, tickCount: prev.tickCount + 1 };
    });
  }, []);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(tick, 1500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.isRunning, tick]);

  const startMonitoring = () => setState(p => ({ ...p, isRunning: true }));
  const stopMonitoring  = () => setState(p => ({ ...p, isRunning: false }));
  const injectFault     = (layer: LayerName) => setState(p => ({ ...p, faultLayer: layer }));
  const clearFault      = () => setState(p => ({ ...p, faultLayer: null }));
  const toggleCascade   = () => setState(p => ({ ...p, cascadeEnabled: !p.cascadeEnabled }));
  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setState(init());
  };

  return { ...state, startMonitoring, stopMonitoring, injectFault, clearFault, toggleCascade, reset };
}
