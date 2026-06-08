'use client';
import { useState, useMemo } from 'react';

export type StoreMode = 'online' | 'offline' | 'both';

export interface FeatureRow {
  name: string;
  onlineLatencyMs: number;
  offlineLatencyMs: number;
  lastMaterialized: string;
  staleness: number;
}

export interface SimState {
  storeMode: StoreMode;
  readPattern: 'point_lookup' | 'range_scan' | 'batch';
  numFeatures: number;
  cacheEnabled: boolean;
  pointInTimeCorrect: boolean;
}

export interface DerivedMetrics {
  avgOnlineLatency: number;
  avgOfflineLatency: number;
  throughput: number;
  skewRisk: string;
  materializationLag: number;
  features: FeatureRow[];
}

const FEATURE_DEFS = [
  { name: 'user_age_bucket',      baseOnline: 2,   baseOffline: 800  },
  { name: 'purchase_count_30d',   baseOnline: 5,   baseOffline: 1200 },
  { name: 'avg_order_value',      baseOnline: 4,   baseOffline: 950  },
  { name: 'days_since_last_login',baseOnline: 3,   baseOffline: 700  },
  { name: 'category_affinity',    baseOnline: 12,  baseOffline: 3200 },
  { name: 'geo_region',           baseOnline: 1,   baseOffline: 400  },
];

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    storeMode: 'both', readPattern: 'point_lookup',
    numFeatures: 4, cacheEnabled: true, pointInTimeCorrect: true,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { storeMode, readPattern, numFeatures, cacheEnabled, pointInTimeCorrect } = state;
    const featureDefs = FEATURE_DEFS.slice(0, numFeatures);
    const patternMult = readPattern === 'point_lookup' ? 1 : readPattern === 'range_scan' ? 3 : 8;
    const cacheFactor = cacheEnabled ? 0.4 : 1;
    const features: FeatureRow[] = featureDefs.map((f, i) => ({
      name: f.name,
      onlineLatencyMs:  Math.round(f.baseOnline  * patternMult * cacheFactor * (1 + Math.random() * 0.1)),
      offlineLatencyMs: Math.round(f.baseOffline * patternMult              * (1 + Math.random() * 0.1)),
      lastMaterialized: `${Math.round(15 + i * 8)} min ago`,
      staleness:        15 + i * 8,
    }));
    const avgOnlineLatency  = features.reduce((s, f) => s + f.onlineLatencyMs, 0) / features.length;
    const avgOfflineLatency = features.reduce((s, f) => s + f.offlineLatencyMs, 0) / features.length;
    const throughput = Math.round((storeMode === 'online' ? 50000 : 5000) / (avgOnlineLatency / 10) * (cacheEnabled ? 1.8 : 1));
    const maxStaleness = Math.max(...features.map(f => f.staleness));
    const skewRisk = !pointInTimeCorrect ? 'high' : maxStaleness > 60 ? 'medium' : 'low';
    return { avgOnlineLatency: Math.round(avgOnlineLatency), avgOfflineLatency: Math.round(avgOfflineLatency), throughput, skewRisk, materializationLag: maxStaleness, features };
  }, [state]);

  const setStoreMode    = (v: StoreMode) => setState(p => ({ ...p, storeMode: v }));
  const setReadPattern  = (v: SimState['readPattern']) => setState(p => ({ ...p, readPattern: v }));
  const setNumFeatures  = (v: number) => setState(p => ({ ...p, numFeatures: v }));
  const toggleCache     = () => setState(p => ({ ...p, cacheEnabled: !p.cacheEnabled }));
  const togglePIT       = () => setState(p => ({ ...p, pointInTimeCorrect: !p.pointInTimeCorrect }));
  const reset = () => setState({ storeMode: 'both', readPattern: 'point_lookup', numFeatures: 4, cacheEnabled: true, pointInTimeCorrect: true });

  return { ...state, derived, setStoreMode, setReadPattern, setNumFeatures, toggleCache, togglePIT, reset };
}
