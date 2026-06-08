'use client';

import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { VersionMetrics } from './types';
import { Tooltip, JARGON } from './Tooltip';

interface MetricRowProps {
  label:     React.ReactNode;
  value:     string;
  highlight?: boolean;
}

function MetricRow({ label, value, highlight }: MetricRowProps) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-200 last:border-0">
      <span className="text-xs text-gray-400 font-mono">{label}</span>
      <motion.span
        key={value}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className={clsx('text-xs font-mono font-semibold tabular-nums',
          highlight ? 'text-red-600' : 'text-gray-800')}
      >
        {value}
      </motion.span>
    </div>
  );
}

interface MetricCardProps {
  version:  'v1' | 'v2';
  label:    string;
  metrics:  VersionMetrics;
  degraded: boolean;
}

export function MetricCard({ version, label, metrics, degraded }: MetricCardProps) {
  const accent   = version === 'v1' ? 'border-blue-200' : 'border-purple-200';
  const glow     = version === 'v1' ? 'shadow-blue-100' : 'shadow-purple-100';
  const dot      = metrics.status === 'healthy' ? 'bg-green-500' : 'bg-red-500';
  const dotPulse = metrics.status === 'degraded';

  return (
    <div className={clsx('bg-white border rounded-xl p-4 shadow-lg', accent, glow)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono font-bold text-gray-700 uppercase tracking-widest">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          <motion.span
            className={clsx('w-2 h-2 rounded-full', dot)}
            animate={dotPulse ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
          <Tooltip {...JARGON.degraded}>
            <span className={clsx('text-xs font-mono', dotPulse ? 'text-red-600' : 'text-green-600')}>
              {metrics.status}
            </span>
          </Tooltip>
        </div>
      </div>

      {/* Metrics */}
      <MetricRow
        label={<Tooltip {...JARGON.rps}>RPS</Tooltip>}
        value={metrics.rps.toLocaleString()}
      />
      <MetricRow
        label={<Tooltip {...JARGON.p50}>P50</Tooltip>}
        value={`${metrics.p50} ms`}
        highlight={degraded && metrics.p50 > 200}
      />
      <MetricRow
        label={<Tooltip {...JARGON.p95}>P95</Tooltip>}
        value={`${metrics.p95} ms`}
        highlight={degraded && metrics.p95 > 500}
      />
      <MetricRow
        label={<Tooltip {...JARGON.p99}>P99</Tooltip>}
        value={`${metrics.p99} ms`}
        highlight={degraded && metrics.p99 > 1000}
      />
      <MetricRow
        label={<Tooltip {...JARGON.errorRate}>Error rate</Tooltip>}
        value={`${metrics.errorRate}%`}
        highlight={metrics.errorRate > 1}
      />
    </div>
  );
}

interface MetricsPanelProps {
  metrics:    { v1: VersionMetrics; v2: VersionMetrics };
  v1Degraded: boolean;
  v2Degraded: boolean;
  v1Traffic:  number;
}

export function MetricsPanel({ metrics, v1Degraded, v2Degraded, v1Traffic }: MetricsPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <MetricCard version="v1" label={`v1 Stable — ${v1Traffic}%`}      metrics={metrics.v1} degraded={v1Degraded} />
      <MetricCard version="v2" label={`v2 Canary — ${100 - v1Traffic}%`} metrics={metrics.v2} degraded={v2Degraded} />
    </div>
  );
}
