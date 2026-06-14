export type VersionId     = 'v1' | 'v2';
export type VersionStatus  = 'healthy' | 'degraded';
export type DegradationMode = 'latency' | 'errors' | 'gradual';
export type SimSpeed        = 'fast' | 'normal' | 'slow';

export interface VersionProfile {
  p50:       number;
  p99:       number;
  errorRate: number;
}

export interface SimConfig {
  totalRps:              number;
  speed:                 SimSpeed;
  v1Profile:             VersionProfile;
  v2Profile:             VersionProfile;
  degradationMode:       DegradationMode;
  autoRollback:          boolean;
  autoRollbackThreshold: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  totalRps:              1000,
  speed:                 'normal',
  v1Profile:             { p50: 44,  p99: 245,  errorRate: 0.2 },
  v2Profile:             { p50: 44,  p99: 245,  errorRate: 0.2 },
  degradationMode:       'latency',
  autoRollback:          false,
  autoRollbackThreshold: 1000,
};

export interface VersionMetrics {
  p50:       number;
  p95:       number;
  p99:       number;
  errorRate: number;
  rps:       number;
  status:    VersionStatus;
}

export interface SimulationSnapshot {
  t:     number;
  v1p50: number;
  v2p50: number;
  v1p95: number;
  v2p95: number;
}
