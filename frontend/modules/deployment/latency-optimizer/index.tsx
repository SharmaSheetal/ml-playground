'use client';

import { clsx } from 'clsx';
import { RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useSimulation, type QuantLevel } from './useSimulation';
import { AIAdvisorPanel } from './AIAdvisorPanel';

// ── Delta badge ───────────────────────────────────────────────────────────────

function Delta({ current, base, invert = false }: { current: number; base: number; invert?: boolean }) {
  const pct = ((current - base) / base) * 100;
  const improved = invert ? pct > 0 : pct < 0;
  if (Math.abs(pct) < 0.5) return <span className="text-gray-400 text-[10px] font-mono">—</span>;
  return (
    <span className={clsx(
      'flex items-center gap-0.5 text-[10px] font-mono font-semibold',
      improved ? 'text-green-600' : 'text-red-600'
    )}>
      {improved ? <TrendingDown className="w-2.5 h-2.5" /> : <TrendingUp className="w-2.5 h-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// ── Metric row ────────────────────────────────────────────────────────────────

function MetricRow({ label, current, base, unit = 'ms', invert = false }: {
  label: string; current: number; base: number; unit?: string; invert?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
      <span className="text-xs font-mono text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-gray-400 tabular-nums">{base.toFixed(unit === 'ms' ? 0 : 2)}{unit}</span>
        <span className="text-gray-400">→</span>
        <span className="text-sm font-bold text-gray-900 tabular-nums">{current.toFixed(unit === 'ms' ? 0 : 2)}{unit}</span>
        <Delta current={current} base={base} invert={invert} />
      </div>
    </div>
  );
}

// ── Toggle button ─────────────────────────────────────────────────────────────

function Toggle({ label, desc, active, onClick }: { label: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left px-4 py-3 rounded-xl border transition-all',
        active
          ? 'bg-blue-50 border-blue-200 text-blue-600'
          : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
      )}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-mono font-semibold">{label}</span>
        <span className={clsx(
          'text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full border',
          active ? 'border-blue-200 text-blue-600 bg-blue-50' : 'border-gray-200 text-gray-400 bg-gray-100'
        )}>
          {active ? 'ON' : 'OFF'}
        </span>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
    </button>
  );
}

// ── Main simulator ────────────────────────────────────────────────────────────

export function LatencyOptimizerSimulator() {
  const {
    config, metrics, baseline,
    setBatchSize, setQuantization,
    toggleCaching, setCacheSize,
    toggleTensorRT, toggleAsync,
    reset,
  } = useSimulation();

  const QUANT_OPTIONS: { value: QuantLevel; label: string; desc: string }[] = [
    { value: 'fp32', label: 'FP32',  desc: 'Baseline — full precision, no speedup' },
    { value: 'fp16', label: 'FP16',  desc: '~47% faster, < 0.1% accuracy drop, widely supported' },
    { value: 'int8', label: 'INT8',  desc: '~60% faster, < 1% accuracy drop, requires calibration' },
  ];

  const BATCH_OPTIONS = [1, 2, 4, 8, 16, 32];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Latency Optimizer</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Apply quantization, batching, caching, and TensorRT · see P50/P95/P99 impact in real time.
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

      {/* Metrics panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1">
          <p className="text-xs font-mono font-semibold text-gray-500 mb-3">Latency (baseline → current)</p>
          <MetricRow label="P50"  current={metrics.p50}  base={baseline.p50}  />
          <MetricRow label="P95"  current={metrics.p95}  base={baseline.p95}  />
          <MetricRow label="P99"  current={metrics.p99}  base={baseline.p99}  />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-1">
          <p className="text-xs font-mono font-semibold text-gray-500 mb-3">Cost & Throughput</p>
          <MetricRow label="Throughput"    current={metrics.throughput} base={baseline.throughput} unit=" RPS" invert />
          <MetricRow label="Cost / 1k req" current={metrics.costPer1k}  base={baseline.costPer1k}  unit="$" />
          <MetricRow label="Memory"        current={metrics.memoryMB}   base={baseline.memoryMB}   unit=" MB" />
          {config.cachingEnabled && (
            <div className="flex items-center justify-between py-2 border-t border-gray-200 mt-1">
              <span className="text-xs font-mono text-gray-400">Cache hit rate</span>
              <span className="text-sm font-bold text-green-600 tabular-nums">{metrics.cacheHitRate}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Optimization controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Quantization */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="text-xs font-mono font-semibold text-gray-500">Quantization</p>
          <div className="space-y-2">
            {QUANT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setQuantization(opt.value)}
                className={clsx(
                  'w-full text-left px-4 py-3 rounded-xl border transition-all',
                  config.quantization === opt.value
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                )}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={clsx(
                    'w-2 h-2 rounded-full',
                    config.quantization === opt.value ? 'bg-amber-500' : 'bg-gray-300'
                  )} />
                  <span className="text-xs font-mono font-semibold">{opt.label}</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed pl-4">{opt.desc}</p>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 font-mono">
            INT8 requires NVIDIA Tensor Cores or AVX-512 VNNI for actual speedup.
          </p>
        </div>

        {/* Batching */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono font-semibold text-gray-500">Dynamic Batch Size</p>
            <span className="text-xs font-mono font-bold text-gray-800">×{config.batchSize}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {BATCH_OPTIONS.map(b => (
              <button
                key={b}
                onClick={() => setBatchSize(b)}
                className={clsx(
                  'py-2 text-xs font-mono font-semibold rounded-lg border transition-all',
                  config.batchSize === b
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                )}
              >
                {b}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 font-mono">
            Larger batches increase GPU throughput but add per-request queue wait latency.
          </p>

          {/* Toggles */}
          <div className="space-y-2 pt-2">
            <Toggle
              label="TensorRT"
              desc="Kernel fusion, hardware-specific optimization. Requires NVIDIA GPU."
              active={config.tensorrtEnabled}
              onClick={toggleTensorRT}
            />
            <Toggle
              label="Async Serving"
              desc="Queue-based processing. Improves throughput under burst traffic, may increase P99."
              active={config.asyncEnabled}
              onClick={toggleAsync}
            />
          </div>
        </div>
      </div>

      {/* Caching */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono font-semibold text-gray-500">Prediction Caching</p>
          <button
            onClick={toggleCaching}
            className={clsx(
              'px-3 py-1 text-xs font-mono font-bold rounded-full border transition-all',
              config.cachingEnabled
                ? 'border-green-200 text-green-600 bg-green-50'
                : 'border-gray-200 text-gray-400 hover:border-gray-300'
            )}
          >
            {config.cachingEnabled ? 'ENABLED' : 'DISABLED'}
          </button>
        </div>

        {config.cachingEnabled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-gray-500">
              <span>Cache size</span>
              <span className="font-bold text-gray-800">{config.cacheSize} MB</span>
            </div>
            <input
              type="range" min={64} max={4096} step={64}
              value={config.cacheSize}
              onChange={e => setCacheSize(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #10b981 ${(config.cacheSize / 4096) * 100}%, #e5e7eb ${(config.cacheSize / 4096) * 100}%)` }}
            />
            <div className="flex justify-between text-[10px] font-mono text-gray-400">
              <span>64 MB (~{(64/512*40+20).toFixed(0)}% hit rate)</span>
              <span>4096 MB (~85% hit rate)</span>
            </div>
          </div>
        )}
        <p className="text-[10px] text-gray-400 font-mono">
          Prediction cache serves exact-match repeated inputs at sub-millisecond latency. Invalidate on model retrain.
        </p>
      </div>

      {/* AI Advisor */}
      <AIAdvisorPanel config={config} metrics={metrics} baseline={baseline} />
    </div>
  );
}
