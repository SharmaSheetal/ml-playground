'use client';
import { useState, useMemo } from 'react';

export type ScalingStrategy = 'vertical' | 'horizontal' | 'auto';
export type BatchMode = 'none' | 'dynamic' | 'static';

export interface SimState {
  qpsTarget: number;
  instanceCount: number;
  scalingStrategy: ScalingStrategy;
  batchMode: BatchMode;
  batchSize: number;
  gpuEnabled: boolean;
  modelSizeMB: number;
}

export interface DerivedMetrics {
  latencyP50: number;
  latencyP95: number;
  throughput: number;
  gpuUtilization: number;
  memoryUsageMB: number;
  costPerHour: number;
  scalingStatus: 'healthy' | 'degraded' | 'overloaded';
  bottleneck: string;
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    qpsTarget: 1000, instanceCount: 4, scalingStrategy: 'horizontal',
    batchMode: 'dynamic', batchSize: 32, gpuEnabled: true, modelSizeMB: 800,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { qpsTarget, instanceCount, batchMode, batchSize, gpuEnabled, modelSizeMB } = state;
    const gpuFactor = gpuEnabled ? 0.15 : 1;
    const batchFactor = batchMode === 'none' ? 1 : batchMode === 'static' ? 0.6 : 0.45;
    const baseSingleLatency = 120 * gpuFactor * batchFactor;
    const effectiveBatch = batchMode === 'none' ? 1 : batchSize;
    const throughputPerInstance = (1000 / baseSingleLatency) * effectiveBatch;
    const totalThroughput = Math.round(throughputPerInstance * instanceCount);
    const load = qpsTarget / Math.max(1, totalThroughput);
    const latencyP50 = Math.round(baseSingleLatency * (1 + Math.max(0, load - 0.7) * 2));
    const latencyP95 = Math.round(latencyP50 * (1 + load * 0.8));
    const gpuUtil = Math.min(100, Math.round(load * 85));
    const memPerInstance = modelSizeMB * 1.8 + effectiveBatch * 4;
    const totalMem = Math.round(memPerInstance * instanceCount);
    const costPerHour = Math.round(instanceCount * (gpuEnabled ? 3.2 : 0.6) * 100) / 100;
    const scalingStatus = load > 1.1 ? 'overloaded' : load > 0.85 ? 'degraded' : 'healthy';
    const bottleneck = load > 1 ? 'Insufficient capacity - scale out' : gpuUtil > 85 ? 'GPU bound - reduce batch or add instances' : totalMem > 32000 ? 'Memory bound - upgrade instance type' : 'None';
    return { latencyP50, latencyP95, throughput: totalThroughput, gpuUtilization: gpuUtil, memoryUsageMB: totalMem, costPerHour, scalingStatus, bottleneck };
  }, [state]);

  const setQpsTarget       = (v: number) => setState(p => ({ ...p, qpsTarget: v }));
  const setInstanceCount   = (v: number) => setState(p => ({ ...p, instanceCount: v }));
  const setScalingStrategy = (v: ScalingStrategy) => setState(p => ({ ...p, scalingStrategy: v }));
  const setBatchMode       = (v: BatchMode) => setState(p => ({ ...p, batchMode: v }));
  const setBatchSize       = (v: number) => setState(p => ({ ...p, batchSize: v }));
  const toggleGpu          = () => setState(p => ({ ...p, gpuEnabled: !p.gpuEnabled }));
  const setModelSize       = (v: number) => setState(p => ({ ...p, modelSizeMB: v }));
  const reset = () => setState({ qpsTarget: 1000, instanceCount: 4, scalingStrategy: 'horizontal', batchMode: 'dynamic', batchSize: 32, gpuEnabled: true, modelSizeMB: 800 });

  return { ...state, derived, setQpsTarget, setInstanceCount, setScalingStrategy, setBatchMode, setBatchSize, toggleGpu, setModelSize, reset };
}
