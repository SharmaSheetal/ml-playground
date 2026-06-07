'use client';

import type { Metrics, GateStatus, FaultType, SimStatus } from './useSimulation';

interface Props {
  champion:    Metrics;
  canary:      Metrics;
  gates:       { p99: GateStatus; errorRate: GateStatus; psi: GateStatus };
  fault:       FaultType;
  status:      SimStatus;
  stageIdx:    number;
  onInject:    (f: FaultType) => void;
}

function gateColor(g: GateStatus) {
  if (g === 'pass')    return 'text-emerald-400';
  if (g === 'fail')    return 'text-red-400';
  return 'text-slate-400';
}

function deltaColor(delta: number, invertGood = false) {
  const bad = invertGood ? delta < 0 : delta > 0;
  if (Math.abs(delta) < 1) return 'text-slate-400';
  return bad ? 'text-red-400' : 'text-emerald-400';
}

function MetricRow({
  label, champVal, canaryVal, unit, gateKey, gates, higherIsBad = true,
}: {
  label: string;
  champVal: number;
  canaryVal: number;
  unit: string;
  gateKey: keyof { p99: GateStatus; errorRate: GateStatus; psi: GateStatus };
  gates: { p99: GateStatus; errorRate: GateStatus; psi: GateStatus };
  higherIsBad?: boolean;
}) {
  const pct   = champVal === 0 ? 0 : ((canaryVal - champVal) / champVal) * 100;
  const arrow = pct > 1 ? '▲' : pct < -1 ? '▼' : '–';
  const g     = gates[gateKey];

  return (
    <div className="grid grid-cols-3 items-center gap-4 py-3 border-b border-slate-700/50 last:border-0">
      {/* Label + gate badge */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold ${gateColor(g)}`}>
          {g === 'pass' ? '●' : g === 'fail' ? '✕' : '○'}
        </span>
        <span className="text-sm text-slate-300">{label}</span>
      </div>

      {/* Champion */}
      <div className="text-center">
        <span className="text-sm font-mono text-slate-300">
          {champVal.toFixed(unit === 'ms' ? 0 : 3)}{unit}
        </span>
      </div>

      {/* Canary */}
      <div className="text-center">
        <span className={`text-sm font-mono font-bold ${g === 'fail' ? 'text-red-400' : g === 'pass' ? 'text-emerald-300' : 'text-slate-300'}`}>
          {canaryVal.toFixed(unit === 'ms' ? 0 : 3)}{unit}
        </span>
        <span className={`ml-1.5 text-[10px] ${deltaColor(pct, !higherIsBad)}`}>
          {arrow}{Math.abs(pct).toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

const FAULTS: { key: FaultType; label: string; desc: string; color: string }[] = [
  { key: 'latency', label: 'Latency Spike',  desc: 'P99 → 128ms',     color: 'amber'  },
  { key: 'errors',  label: 'Error Burst',    desc: 'error rate → 3.8%', color: 'red'    },
  { key: 'drift',   label: 'Feature Drift',  desc: 'PSI → 0.19',       color: 'violet' },
];

export default function MetricsPanel({ champion, canary, gates, fault, status, stageIdx, onInject }: Props) {
  const isLive = status === 'observing';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Live Metrics</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-slate-500" />
            Champion
          </span>
          <span className="flex items-center gap-1">
            <span className={`inline-block w-2 h-2 rounded-full ${isLive ? 'bg-amber-400 animate-pulse' : 'bg-slate-600'}`} />
            Canary ({stageIdx > 0 ? `${[0,1,5,25,50,100][stageIdx]}%` : '—'})
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-700">
        <span>Metric</span>
        <span className="text-center">Champion</span>
        <span className="text-center">Canary</span>
      </div>

      {/* Metric rows */}
      <MetricRow
        label="P99 Latency" unit="ms" gateKey="p99" gates={gates} higherIsBad
        champVal={champion.p99} canaryVal={isLive ? canary.p99 : 0}
      />
      <MetricRow
        label="Error Rate" unit="%" gateKey="errorRate" gates={gates} higherIsBad
        champVal={champion.errorRate} canaryVal={isLive ? canary.errorRate : 0}
      />
      <MetricRow
        label="Prediction PSI" unit="" gateKey="psi" gates={gates} higherIsBad
        champVal={0} canaryVal={isLive ? canary.psi : 0}
      />

      {/* Gate legend */}
      <div className="flex gap-4 text-[10px] text-slate-500 pt-1">
        <span><span className="text-emerald-400">●</span> Pass</span>
        <span><span className="text-red-400">✕</span> Fail</span>
        <span><span className="text-slate-400">○</span> Pending</span>
        <span className="ml-auto">Thresholds: P99 ≤105% champ · Error &lt;1% · PSI &lt;0.1</span>
      </div>

      {/* Fault injection */}
      {isLive && (
        <div className="pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">
            Fault Injection
          </p>
          <div className="flex flex-wrap gap-2">
            {FAULTS.map(f => (
              <button
                key={f.key}
                onClick={() => onInject(fault === f.key ? 'none' : f.key)}
                className={[
                  'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                  fault === f.key
                    ? f.color === 'amber'
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                      : f.color === 'red'
                        ? 'bg-red-500/20 border-red-500/60 text-red-300'
                        : 'bg-violet-500/20 border-violet-500/60 text-violet-300'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-500',
                ].join(' ')}
              >
                {fault === f.key ? '✕ Clear' : f.label}
                <span className="ml-1 opacity-60">{f.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
