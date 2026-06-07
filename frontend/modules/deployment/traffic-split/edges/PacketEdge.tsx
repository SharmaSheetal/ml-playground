'use client';

import { getBezierPath, type EdgeProps } from '@xyflow/react';

interface PacketEdgeData {
  version: 'v1' | 'v2';
  trafficPct: number;
  degraded: boolean;
  errorRate: number;
}

const VERSION_COLOR = { v1: '#6366f1', v2: '#a855f7' };

export function PacketEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
}: EdgeProps) {
  const d = data as PacketEdgeData;
  const [edgePath] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });

  const color      = VERSION_COLOR[d?.version ?? 'v1'];
  const trafficPct = d?.trafficPct ?? 50;
  const degraded   = d?.degraded ?? false;
  const errorRate  = d?.errorRate ?? 0;

  const strokeW    = Math.max(1.2, (trafficPct / 100) * 4);
  const count      = Math.max(1, Math.round(trafficPct / 18));   // 1–5 packets
  const duration   = degraded ? 3.2 : 1.0;                       // slower when degraded
  const pathId     = `ep-${id}`;

  return (
    <g>
      {/* Glowing base path */}
      <path d={edgePath} fill="none" stroke={color} strokeWidth={strokeW + 3} strokeOpacity={0.08} />
      <path id={pathId} d={edgePath} fill="none" stroke={color} strokeWidth={strokeW} strokeOpacity={0.35} />

      {/* Animated packet dots */}
      {Array.from({ length: count }).map((_, i) => {
        const isError = errorRate > 2 && i === count - 1;
        const begin   = `${i * (duration / count)}s`;
        return (
          <circle key={i} r={isError ? 5 : 4} fill={isError ? '#ef4444' : color} fillOpacity={0.92}>
            <animateMotion
              dur={`${duration}s`}
              begin={begin}
              repeatCount="indefinite"
              path={edgePath}
            />
          </circle>
        );
      })}
    </g>
  );
}
