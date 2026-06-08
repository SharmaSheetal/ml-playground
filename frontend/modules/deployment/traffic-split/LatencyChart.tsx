'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { SimulationSnapshot } from './types';

interface LatencyChartProps {
  history:   SimulationSnapshot[];
  threshold: number;
}

export function LatencyChart({ history, threshold }: LatencyChartProps) {
  if (history.length < 2) {
    return (
      <div className="h-52 flex items-center justify-center text-gray-400 text-xs font-mono">
        Collecting data...
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">
          P50 Latency — Live (ms)
        </p>
        <div className="flex items-center gap-3 text-xs font-mono text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-indigo-400 inline-block" /> v1
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-purple-400 inline-block" /> v2
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-400 inline-block border-dashed" /> threshold
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="v1fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="v2fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#a855f7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#a855f7" stopOpacity={0}   />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" hide />
          <YAxis
            width={46}
            tick={{ fill: '#9ca3af', fontSize: 10, fontFamily: 'monospace' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}ms`}
          />
          <Tooltip
            contentStyle={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
            }}
            labelFormatter={() => ''}
            formatter={(v: number, name: string) => [
              `${v} ms`,
              name === 'v1p50' ? 'v1 P50' : 'v2 P50',
            ]}
          />

          {/* Dynamic threshold line from config */}
          <ReferenceLine
            y={threshold}
            stroke="#f59e0b"
            strokeDasharray="5 4"
            strokeOpacity={0.5}
            label={{ value: `${threshold}ms`, fill: '#f59e0b', fontSize: 9, fontFamily: 'monospace' }}
          />

          <Area
            type="monotone" dataKey="v1p50"
            stroke="#6366f1" strokeWidth={2}
            fill="url(#v1fill)" dot={false} isAnimationActive={false}
          />
          <Area
            type="monotone" dataKey="v2p50"
            stroke="#a855f7" strokeWidth={2}
            fill="url(#v2fill)" dot={false} isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
