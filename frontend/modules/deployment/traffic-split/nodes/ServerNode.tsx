'use client';

import { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Handle, Position } from '@xyflow/react';
import type { VersionStatus } from '../types';

interface ServerNodeData {
  version: 'v1' | 'v2';
  label: string;
  degraded: boolean;
  status: VersionStatus;
  p50: number;
  errorRate: number;
}

const VERSION_COLOR = { v1: '#6366f1', v2: '#a855f7' };
const STATUS_LED   = { healthy: '#22c55e', degraded: '#ef4444' };

export function ServerNode({ data }: { data: ServerNodeData }) {
  const controls = useAnimation();
  const accent = VERSION_COLOR[data.version];
  const led    = STATUS_LED[data.status];
  const [scanY, setScanY] = useState(0);

  /* shake on degrade */
  useEffect(() => {
    if (data.degraded) {
      controls.start({
        x: [-4, 4, -3, 3, -2, 2, 0],
        transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2.5 },
      });
    } else {
      controls.stop();
      controls.set({ x: 0 });
    }
  }, [data.degraded, controls]);

  /* scan line */
  useEffect(() => {
    const id = setInterval(
      () => setScanY((y) => (y + 1.5) % 54),
      data.degraded ? 60 : 30
    );
    return () => clearInterval(id);
  }, [data.degraded]);

  return (
    <div className="select-none">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <motion.div animate={controls}>
        <svg width="120" height="148" viewBox="0 0 120 148">

          {/* Chassis shadow */}
          <rect x="8" y="8" width="104" height="136" rx="8" fill="black" fillOpacity="0.4" />

          {/* Main chassis */}
          <rect x="4" y="4" width="104" height="136" rx="8" fill="#060d1a" stroke={accent} strokeWidth="1.5" />

          {/* Top accent bar */}
          <rect x="4" y="4" width="104" height="26" rx="8" fill={accent} fillOpacity="0.25" />
          <rect x="4" y="20" width="104" height="10" fill={accent} fillOpacity="0.25" />

          {/* Version badge */}
          <text x="60" y="21" textAnchor="middle" fill="white" fontSize="9" fontFamily="monospace" fontWeight="bold" letterSpacing="1.5">
            {data.label}
          </text>

          {/* Screen bezel */}
          <rect x="10" y="36" width="92" height="62" rx="4" fill="#020812" stroke={accent} strokeWidth="0.6" strokeOpacity="0.5" />

          {/* Scan line */}
          <rect
            x="10" y={36 + scanY} width="92" height="3"
            fill={data.degraded ? '#ef4444' : accent}
            fillOpacity="0.18"
          />

          {/* Screen text */}
          <text x="18" y="57" fill={data.degraded ? '#f87171' : '#4ade80'} fontSize="8" fontFamily="monospace">
            P50: {data.p50}ms
          </text>
          <text x="18" y="70" fill={data.degraded ? '#f87171' : '#4ade80'} fontSize="8" fontFamily="monospace">
            ERR: {data.errorRate}%
          </text>
          <text x="18" y="83" fill={data.degraded ? '#f87171' : '#94a3b8'} fontSize="7" fontFamily="monospace">
            STATUS: {data.status.toUpperCase()}
          </text>

          {/* Blinking cursor */}
          <motion.rect
            x="76" y="88" width="7" height="8"
            fill={data.degraded ? '#f87171' : '#4ade80'}
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
          />

          {/* LED row */}
          <rect x="10" y="106" width="92" height="22" rx="4" fill="#020812" stroke={accent} strokeWidth="0.5" strokeOpacity="0.35" />
          {[20, 38, 56, 74, 92].map((cx, i) => (
            <motion.circle
              key={i}
              cx={cx} cy="117" r="5"
              fill={led}
              animate={{ opacity: data.degraded ? [1, 0.15, 1] : [0.9, 0.5, 0.9] }}
              transition={{
                duration: data.degraded ? 0.35 : 2.2,
                repeat: Infinity,
                delay: i * 0.08,
              }}
            />
          ))}

          {/* Drive slots */}
          {[136, 142].map((y) => (
            <rect key={y} x="12" y={y} width="88" height="3" rx="1" fill={accent} fillOpacity="0.15" />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}
