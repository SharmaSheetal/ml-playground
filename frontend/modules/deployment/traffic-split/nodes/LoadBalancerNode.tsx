'use client';

import { motion } from 'framer-motion';
import { Handle, Position } from '@xyflow/react';

const HEX = '60,4 108,30 108,82 60,108 12,82 12,30';

export function LoadBalancerNode({ data }: { data: { rps: number } }) {
  return (
    <div className="select-none">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <svg width="120" height="118" viewBox="0 0 120 118">

        {/* Outer glow */}
        <motion.polygon
          points={HEX}
          fill="none" stroke="#38bdf8" strokeWidth="1"
          animate={{ opacity: [0.15, 0.5, 0.15] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Solid hexagon border */}
        <polygon points={HEX} fill="#0c1a2e" stroke="#38bdf8" strokeWidth="1.5" />

        {/* Inner hex grid lines */}
        {[14, 26, 38].map((offset) => (
          <polygon
            key={offset}
            points={`60,${4 + offset} ${108 - offset * 0.8},${30 + offset * 0.6} ${108 - offset * 0.8},${82 - offset * 0.6} 60,${108 - offset} ${12 + offset * 0.8},${82 - offset * 0.6} ${12 + offset * 0.8},${30 + offset * 0.6}`}
            fill="none" stroke="#38bdf8" strokeWidth="0.4" strokeOpacity="0.2"
          />
        ))}

        {/* Rotating dashed ring */}
        <motion.circle
          cx="60" cy="56" r="28"
          fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="6 5"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '60px 56px' }}
        />

        {/* Counter-rotating inner ring */}
        <motion.circle
          cx="60" cy="56" r="18"
          fill="none" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 6"
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '60px 56px' }}
        />

        {/* Center pulse */}
        <motion.circle
          cx="60" cy="56" r="9"
          fill="#0ea5e9"
          animate={{ scale: [1, 1.35, 1], opacity: [0.9, 0.4, 0.9] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '60px 56px' }}
        />

        {/* LB label */}
        <text x="60" y="60" textAnchor="middle" fill="white" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
          LB
        </text>

        {/* Bottom label */}
        <text x="60" y="112" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontFamily="monospace" letterSpacing="1">
          LOAD BALANCER
        </text>
      </svg>
      <Handle type="source" position={Position.Bottom} id="left"  style={{ left: '32%', opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="right" style={{ left: '68%', opacity: 0 }} />
    </div>
  );
}
