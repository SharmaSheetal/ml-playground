'use client';

import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, ArrowRight, XCircle } from 'lucide-react';
import { useSimulation } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';
import type { Gates, GateStatus, LogEntry, FaultType } from './useSimulation';

// ── Gate badge ────────────────────────────────────────────────────────────────

function GateBadge({ status, label }: { status: GateStatus; label: string }) {
  return (
    <div className={clsx(
      'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono',
      status === 'pass'    && 'bg-green-50  border-green-200 text-green-600',
      status === 'fail'    && 'bg-red-50    border-red-200   text-red-600',
      status === 'pending' && 'bg-gray-50   border-gray-200  text-gray-400',
    )}>
      <span className={clsx('w-1.5 h-1.5 rounded-full',
        status === 'pass'    && 'bg-green-500',
        status === 'fail'    && 'bg-red-500',
        status === 'pending' && 'bg-gray-300',
      )} />
      {label}
      <span className="ml-auto font-bold uppercase text-[10px]">{status}</span>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 font-mono mb-1">{label}</p>
      <p className={clsx('text-2xl font-bold tabular-nums', accent ? 'text-amber-600' : 'text-gray-900')}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Event log ─────────────────────────────────────────────────────────────────

function EventLog({ log }: { log: LogEntry[] }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <p className="text-xs font-mono font-semibold text-gray-400 mb-3">Event Log</p>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {[...log].reverse().map(e => (
          <div key={e.id} className={clsx('text-xs font-mono flex gap-2', {
            'text-gray-500':   e.level === 'info',
            'text-amber-600':  e.level === 'warn',
            'text-green-600':  e.level === 'success',
            'text-red-600':    e.level === 'error',
          })}>
            <span className="shrink-0 text-gray-400">{new Date(e.ts).toLocaleTimeString()}</span>
            <span>{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main simulator ────────────────────────────────────────────────────────────

export function ShadowModeSimulator() {
  const {
    state, startShadow, promoteToCanary, abandon,
    injectFault, setMirrorPct, reset, canPromote,
  } = useSimulation();

  const { status, mirrorPct, champion, shadow, divergence, gates, elapsed, fault, log } = state;
  const running = status === 'running';

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shadow Mode Differ</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Mirror traffic to a shadow model · compare predictions · decide: promote to canary or abandon.
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          RESET
        </button>
      </div>

      {/* Status banner */}
      <AnimatePresence>
        {status === 'promoted' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-green-200 bg-green-50 text-green-700 text-xs font-mono"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            Shadow gates passed — model promoted to canary queue at 1% traffic.
          </motion.div>
        )}
        {status === 'abandoned' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-mono"
          >
            <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            Shadow test abandoned — model requires investigation before any user exposure.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mirror control */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-gray-500">Traffic Mirror Percentage</p>
          <span className="text-xs font-mono font-bold text-gray-800">{mirrorPct}% of live traffic</span>
        </div>
        <input
          type="range" min={5} max={100} step={5}
          value={mirrorPct}
          onChange={e => setMirrorPct(Number(e.target.value))}
          disabled={running}
          className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40"
          style={{ background: `linear-gradient(to right, #6366f1 ${mirrorPct}%, #e5e7eb ${mirrorPct}%)` }}
        />
        <p className="text-[11px] text-gray-400 font-mono">
          10–20% is statistically sufficient for systematic divergence detection. 100% doubles compute cost.
        </p>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-1">
          {status === 'idle' && (
            <button
              onClick={startShadow}
              className="px-4 py-2 text-xs font-mono font-semibold rounded-lg border border-blue-300 text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all"
            >
              Start Shadow
            </button>
          )}
          {running && (
            <>
              <button
                onClick={promoteToCanary}
                disabled={!canPromote}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-semibold rounded-lg border transition-all',
                  canPromote
                    ? 'border-green-300 text-green-700 hover:border-green-400 hover:bg-green-50'
                    : 'border-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                <ArrowRight className="w-3 h-3" />
                Promote to Canary
              </button>
              <button
                onClick={abandon}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-semibold rounded-lg border border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
              >
                <XCircle className="w-3 h-3" />
                Abandon
              </button>
            </>
          )}
        </div>

        {running && !canPromote && (
          <p className="text-[11px] text-gray-400 font-mono">
            {![ gates.latency, gates.errors, gates.divergence, gates.ndcg ].every(g => g === 'pass')
              ? 'Gates failing — resolve issues before promotion.'
              : `Observation: ${elapsed}s elapsed (minimum 15s). ${Math.max(0, 15 - elapsed)}s remaining.`}
          </p>
        )}
      </div>

      {/* Fault injection */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-mono text-gray-400">Fault Injection</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['none', 'latency', 'divergence', 'errors'] as FaultType[]).map(f => (
            <button
              key={f}
              onClick={() => injectFault(f)}
              disabled={!running}
              className={clsx(
                'py-2 px-3 text-xs font-mono rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed',
                fault === f && f !== 'none'
                  ? 'bg-red-50 border-red-200 text-red-600'
                  : fault === 'none' && f === 'none'
                  ? 'bg-green-50 border-green-200 text-green-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              )}
            >
              {f === 'none' ? 'Clear' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics — Champion vs Shadow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Champion */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <p className="text-xs font-mono font-semibold text-gray-700">Champion (live)</p>
            <span className="ml-auto text-[10px] font-mono text-gray-400">{champion.rps} RPS</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="P99 Latency" value={`${running ? champion.p99.toFixed(0) : '—'}ms`} />
            <MetricCard label="Error Rate"  value={running ? `${champion.errorRate.toFixed(2)}%` : '—'} />
          </div>
        </div>

        {/* Shadow */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-xs font-mono font-semibold text-gray-700">Shadow (mirrored · never served)</p>
            <span className="ml-auto text-[10px] font-mono text-gray-400">{running ? shadow.rps : 0} RPS</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MetricCard label="P99 Latency" value={`${running ? shadow.p99.toFixed(0) : '—'}ms`} accent={gates.latency === 'fail'} />
            <MetricCard label="Error Rate"  value={running ? `${shadow.errorRate.toFixed(2)}%` : '—'} accent={gates.errors === 'fail'} />
          </div>
        </div>
      </div>

      {/* Divergence metrics */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-mono font-semibold text-gray-500">Prediction Divergence</p>
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Exact Match Rate" value={running ? `${divergence.exactMatch.toFixed(1)}%` : '—'} sub="gate: ≥ 80%" accent={gates.divergence === 'fail'} />
          <MetricCard label="Score Delta P95"  value={running ? divergence.deltaP95.toFixed(3) : '—'}     sub="gate: ≤ 0.10" />
          <MetricCard label="NDCG Correlation" value={running ? divergence.ndcg.toFixed(3) : '—'}          sub="gate: ≥ 0.85" accent={gates.ndcg === 'fail'} />
        </div>
      </div>

      {/* Gates */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
        <p className="text-xs font-mono font-semibold text-gray-500">Shadow Gates</p>
        <div className="grid grid-cols-2 gap-2">
          <GateBadge status={gates.latency}    label={`Shadow P99 ≤ 1.2× champion (${running ? champion.p99.toFixed(0) : '—'}ms)`} />
          <GateBadge status={gates.errors}     label="Shadow error rate < 2%" />
          <GateBadge status={gates.divergence} label="Exact match rate ≥ 80%" />
          <GateBadge status={gates.ndcg}       label="NDCG rank correlation ≥ 0.85" />
        </div>
      </div>

      {/* AI Advisor */}
      <AIAdvisorPanel
        mirrorPct={mirrorPct}
        champion={champion}
        shadow={shadow}
        divergence={divergence}
        gates={gates}
        fault={fault}
        status={status}
      />

      {/* Event log */}
      <EventLog log={log} />
    </div>
  );
}
