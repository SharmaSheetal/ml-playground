'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

import { useSimulation } from './useSimulation';
import { useSound }      from './useSound';
import { FlowCanvas }    from './FlowCanvas';
import { MetricsPanel }  from './MetricsPanel';
import { LatencyChart }  from './LatencyChart';
import { ConfigPanel }   from './ConfigPanel';
import { InsightBox }      from './InsightBox';
import { AIAdvisorPanel }  from './AIAdvisorPanel';
import { getInsight }      from './insights';
import { DEFAULT_CONFIG, type SimConfig } from './types';

export function TrafficSplitSimulator() {
  const [config, setConfig] = useState<SimConfig>(DEFAULT_CONFIG);
  const [muted, setMuted]     = useState(true);
  const [insight, setInsight] = useState('');

  const sim = useSimulation(config);
  const { playDegrade, playRecover } = useSound(muted);

  function handleTrafficChange(v: number) {
    sim.setV1Traffic(v);
    setInsight(getInsight('traffic-split', {
      v1Traffic: v,
      autoRollback: config.autoRollback,
      threshold: config.autoRollbackThreshold,
    }));
  }

  function handleDegradeV1() {
    const next = !sim.v1Degraded;
    sim.setV1Degraded(next);
    next ? playDegrade() : playRecover();
    setInsight(getInsight(next ? 'degrade-v1-on' : 'degrade-v1-off', {
      v1Traffic: sim.v1Traffic,
    }));
  }

  function handleDegradeV2() {
    const next = !sim.v2Degraded;
    sim.setV2Degraded(next);
    next ? playDegrade() : playRecover();
    setInsight(getInsight(next ? 'degrade-v2-on' : 'degrade-v2-off', {
      v1Traffic: sim.v1Traffic,
      autoRollback: config.autoRollback,
      threshold: config.autoRollbackThreshold,
    }));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            Traffic Split Playground
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Drag the slider · inject degradation · watch the system respond live.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setMuted((m) => !m)}
            className="px-3 py-1.5 text-xs font-mono border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {muted ? 'SFX OFF' : 'SFX ON'}
          </button>
          <button
            onClick={() => sim.setRunning((r) => !r)}
            className={clsx(
              'px-3 py-1.5 text-xs font-mono border rounded-lg transition-colors',
              sim.running
                ? 'border-green-300 text-green-700 bg-green-50'
                : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
            )}
          >
            {sim.running ? 'RUNNING' : 'PAUSED'}
          </button>
        </div>
      </div>

      {/* ── Auto-rollback notification ── */}
      <AnimatePresence>
        {sim.rollbackEvent && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-600 text-xs font-mono"
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
            />
            {sim.rollbackEvent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flow Canvas ── */}
      <FlowCanvas
        v1Traffic={sim.v1Traffic}
        v1Degraded={sim.v1Degraded}
        v2Degraded={sim.v2Degraded}
        metrics={sim.metrics}
      />

      {/* ── Traffic Controls ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5">
        <div>
          <div className="flex justify-between text-xs font-mono text-gray-500 mb-2">
            <span>v1 (Stable)</span>
            <span className="text-gray-800 font-semibold tabular-nums">
              {sim.v1Traffic}% / {100 - sim.v1Traffic}%
            </span>
            <span>v2 (Canary)</span>
          </div>
          <input
            type="range"
            min={0} max={100} step={5}
            value={sim.v1Traffic}
            onChange={(e) => handleTrafficChange(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #6366f1 ${sim.v1Traffic}%, #a855f7 ${sim.v1Traffic}%)`,
            }}
          />
          <div className="flex gap-1 mt-2 h-1.5 rounded-full overflow-hidden">
            <motion.div
              className="bg-indigo-500 rounded-l-full"
              animate={{ width: `${sim.v1Traffic}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
            <motion.div
              className="bg-purple-500 rounded-r-full"
              animate={{ width: `${100 - sim.v1Traffic}%` }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDegradeV1}
            className={clsx(
              'py-2 px-4 text-xs font-mono rounded-lg border transition-all',
              sim.v1Degraded
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'border-gray-200 text-gray-600 hover:border-indigo-500/50 hover:text-indigo-400'
            )}
          >
            {sim.v1Degraded ? 'DEGRADE v1  [active]' : 'DEGRADE v1'}
          </button>
          <button
            onClick={handleDegradeV2}
            className={clsx(
              'py-2 px-4 text-xs font-mono rounded-lg border transition-all',
              sim.v2Degraded
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'border-gray-200 text-gray-600 hover:border-purple-500/50 hover:text-purple-400'
            )}
          >
            {sim.v2Degraded ? 'DEGRADE v2  [active]' : 'DEGRADE v2'}
          </button>
        </div>
      </div>

      {/* ── Insight Box ── */}
      <InsightBox text={insight} />

      {/* ── Advanced Config ── */}
      <ConfigPanel
        config={config}
        onChange={setConfig}
        onInsight={setInsight}
      />

      {/* ── Metrics ── */}
      <MetricsPanel
        metrics={sim.metrics}
        v1Degraded={sim.v1Degraded}
        v2Degraded={sim.v2Degraded}
        v1Traffic={sim.v1Traffic}
      />

      {/* ── AI Advisor ── */}
      <AIAdvisorPanel v1Traffic={sim.v1Traffic} metrics={sim.metrics} />

      {/* ── Chart ── */}
      <LatencyChart
        history={sim.history}
        threshold={config.autoRollback ? config.autoRollbackThreshold : 500}
      />

    </div>
  );
}
