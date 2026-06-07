'use client';

import { motion } from 'framer-motion';
import { Handle, Position } from '@xyflow/react';

export function UserNode({ data }: { data: { rps: number } }) {
  return (
    <div className="select-none">
      <svg width="140" height="96" viewBox="0 0 140 96">
        {/* Soft glow backdrop */}
        <ellipse cx="70" cy="44" rx="62" ry="38" fill="#6366f1" fillOpacity="0.06" />

        {/* Expanding pulse rings — radar style */}
        {[0, 0.9, 1.8].map((delay, i) => (
          <motion.circle
            key={i}
            cx={70} cy={44} r={22}
            fill="none" stroke="#6366f1" strokeWidth={1}
            animate={{ scale: [1, 2.2, 2.2], opacity: [0.45, 0, 0] }}
            transition={{ duration: 2.7, delay, repeat: Infinity, ease: 'easeOut' }}
            style={{ transformOrigin: '70px 44px' }}
          />
        ))}

        {/* Browser window icon — the "traffic origin" */}
        <rect x={46} y={28} width={48} height={34} rx={4}
          fill="#0f1729" stroke="#6366f1" strokeWidth={1.4} />
        {/* Title bar */}
        <rect x={46} y={28} width={48} height={11} rx={4} fill="#1e2d4a" />
        <rect x={46} y={33} width={48} height={6} fill="#1e2d4a" />
        {/* Traffic light dots */}
        <circle cx={54} cy={34} r={2.2} fill="#ef4444" fillOpacity={0.85} />
        <circle cx={61} cy={34} r={2.2} fill="#f59e0b" fillOpacity={0.85} />
        <circle cx={68} cy={34} r={2.2} fill="#22c55e" fillOpacity={0.85} />
        {/* URL bar */}
        <rect x={74} y={30.5} width={16} height={7} rx={2} fill="#0a1525" stroke="#334155" strokeWidth={0.6} />
        {/* Content lines */}
        <rect x={50} y={44} width={38} height={3} rx={1.5} fill="#6366f1" fillOpacity={0.22} />
        <rect x={50} y={50} width={28} height={3} rx={1.5} fill="#6366f1" fillOpacity={0.14} />
        <rect x={50} y={56} width={34} height={3} rx={1.5} fill="#6366f1" fillOpacity={0.10} />

        {/* Pulsing center dot on the window */}
        <motion.circle
          cx={70} cy={44} r={3}
          fill="#6366f1"
          animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.15, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '70px 44px' }}
        />

        {/* RPS label */}
        <text x="70" y="80" textAnchor="middle" fill="#94a3b8"
          fontSize="7.5" fontFamily="monospace" letterSpacing="1.5">
          TRAFFIC SOURCE
        </text>
        <text x="70" y="91" textAnchor="middle" fill="#818cf8"
          fontSize="8.5" fontFamily="monospace" fontWeight="600">
          {data.rps.toLocaleString()} RPS
        </text>
      </svg>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
