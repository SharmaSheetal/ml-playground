'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export type QuantLevel = 'fp32' | 'fp16' | 'int8';

export interface OptConfig {
  batchSize:       number;
  quantization:    QuantLevel;
  cachingEnabled:  boolean;
  cacheSize:       number;
  tensorrtEnabled: boolean;
  asyncEnabled:    boolean;
}

export interface LatencyMetrics {
  p50:          number;
  p95:          number;
  p99:          number;
  throughput:   number;
  costPer1k:    number;
  memoryMB:     number;
  cacheHitRate: number;
}

const BASELINE: LatencyMetrics = {
  p50:          150,
  p95:          280,
  p99:          450,
  throughput:   80,
  costPer1k:    1.20,
  memoryMB:     4200,
  cacheHitRate: 0,
};

const DEFAULT_CONFIG: OptConfig = {
  batchSize:       1,
  quantization:    'fp32',
  cachingEnabled:  false,
  cacheSize:       256,
  tensorrtEnabled: false,
  asyncEnabled:    false,
};

interface ApiResponse {
  p50:            number;
  p95:            number;
  p99:            number;
  throughput:     number;
  cost_per_1k:    number;
  memory_mb:      number;
  cache_hit_rate: number;
}

export interface SimState {
  config:   OptConfig;
  metrics:  LatencyMetrics;
  baseline: LatencyMetrics;
}

export function useSimulation() {
  const [config,  setConfig]  = useState<OptConfig>(DEFAULT_CONFIG);
  const [metrics, setMetrics] = useState<LatencyMetrics>(BASELINE);

  async function applyConfig(next: OptConfig) {
    setConfig(next);
    try {
      const result = await api.post<ApiResponse>('/api/deployment/latency-optimizer/compute', {
        batch_size:       next.batchSize,
        quantization:     next.quantization,
        caching_enabled:  next.cachingEnabled,
        cache_size_mb:    next.cacheSize,
        tensorrt_enabled: next.tensorrtEnabled,
        async_enabled:    next.asyncEnabled,
      });
      setMetrics({
        p50:          result.p50,
        p95:          result.p95,
        p99:          result.p99,
        throughput:   result.throughput,
        costPer1k:    result.cost_per_1k,
        memoryMB:     result.memory_mb,
        cacheHitRate: result.cache_hit_rate,
      });
    } catch (e) {
      console.error(e);
    }
  }

  function setBatchSize(v: number) { applyConfig({ ...config, batchSize: v }); }
  function setQuantization(v: QuantLevel) { applyConfig({ ...config, quantization: v }); }
  function toggleCaching() { applyConfig({ ...config, cachingEnabled: !config.cachingEnabled }); }
  function setCacheSize(v: number) { applyConfig({ ...config, cacheSize: v }); }
  function toggleTensorRT() { applyConfig({ ...config, tensorrtEnabled: !config.tensorrtEnabled }); }
  function toggleAsync() { applyConfig({ ...config, asyncEnabled: !config.asyncEnabled }); }

  function reset() {
    setConfig(DEFAULT_CONFIG);
    setMetrics(BASELINE);
  }

  function pctChange(current: number, base: number) {
    return (((current - base) / base) * 100).toFixed(0);
  }

  return {
    config, metrics, baseline: BASELINE,
    setBatchSize, setQuantization,
    toggleCaching, setCacheSize,
    toggleTensorRT, toggleAsync,
    reset, pctChange,
  };
}
