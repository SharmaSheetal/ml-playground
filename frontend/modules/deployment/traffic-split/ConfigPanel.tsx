'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import type { SimConfig, DegradationMode, SimSpeed, VersionProfile } from './types';
import { getInsight } from './insights';
import { Tooltip, JARGON } from './Tooltip';

const SPEEDS: { value: SimSpeed; label: string }[] = [
  { value: 'fast',   label: 'Fast'   },
  { value: 'normal', label: 'Normal' },
  { value: 'slow',   label: 'Slow'   },
];

const DEG_MODES: { value: DegradationMode; label: string; desc: string }[] = [
  { value: 'latency', label: 'Latency Spike', desc: 'P99 jumps 9×, errors minor'    },
  { value: 'errors',  label: 'Error Storm',   desc: 'Error rate hits 15%+, latency mild' },
  { value: 'gradual', label: 'Gradual Decay', desc: 'Metrics worsen 20% per tick'   },
];

interface ProfileEditorProps {
  version:   'v1' | 'v2';
  profile:   VersionProfile;
  onChange:  (p: VersionProfile) => void;
  onInsight: (text: string) => void;
}

function ProfileEditor({ version, profile, onChange, onInsight }: ProfileEditorProps) {
  const accent = version === 'v1' ? 'text-blue-600' : 'text-purple-600';
  const fields: Array<{
    key: 'p50' | 'p99' | 'errorRate';
    label: React.ReactNode;
    min: number; max: number; step: number;
  }> = [
    { key: 'p50',       label: <Tooltip {...JARGON.p50}>P50 (ms)</Tooltip>,     min: 1,   max: 2000, step: 1   },
    { key: 'p99',       label: <Tooltip {...JARGON.p99}>P99 (ms)</Tooltip>,     min: 1,   max: 8000, step: 1   },
    { key: 'errorRate', label: <Tooltip {...JARGON.errorRate}>ERR (%)</Tooltip>, min: 0.1, max: 5,    step: 0.1 },
  ];

  return (
    <div>
      <p className={clsx('text-xs font-mono font-semibold uppercase tracking-widest mb-2', accent)}>
        {version} - healthy baseline
      </p>
      <div className="grid grid-cols-3 gap-2">
        {fields.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <label className="text-xs text-gray-400 font-mono block mb-1">{label}</label>
            <input
              type="number"
              min={min} max={max} step={step}
              value={profile[key]}
              onChange={(e) => {
                const updated = { ...profile, [key]: parseFloat(e.target.value) || min };
                onChange(updated);
                onInsight(getInsight('profile-change', { version, p50: updated.p50, p99: updated.p99 }));
              }}
              className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-800 font-mono focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface ConfigPanelProps {
  config:     SimConfig;
  onChange:   (c: SimConfig) => void;
  onInsight:  (text: string) => void;
}

export function ConfigPanel({ config, onChange, onInsight }: ConfigPanelProps) {
  const [open, setOpen] = useState(false);

  function set<K extends keyof SimConfig>(key: K, value: SimConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex justify-between items-center px-5 py-3.5 hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-mono font-semibold text-gray-500 uppercase tracking-widest">
          Advanced Config
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-3 border-t border-gray-200 space-y-5">

              {/* ── Row 1: RPS + Speed ── */}
              <div className="grid grid-cols-2 gap-5">
                {/* Total RPS */}
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-gray-400 font-mono">Total RPS</label>
                    <span className="text-xs text-gray-700 font-mono font-semibold">
                      {config.totalRps.toLocaleString()}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={100} max={5000} step={100}
                    value={config.totalRps}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      set('totalRps', v);
                      onInsight(getInsight('rps-change', { rps: v }));
                    }}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200 accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 font-mono mt-1">
                    <span>100</span><span>5k</span>
                  </div>
                </div>

                {/* Sim Speed */}
                <div>
                  <label className="text-xs text-gray-400 font-mono block mb-1.5">Sim Speed</label>
                  <div className="flex gap-1.5">
                    {SPEEDS.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => {
                          set('speed', s.value);
                          onInsight(getInsight('speed-change', { speed: s.value }));
                        }}
                        className={clsx(
                          'flex-1 py-1.5 text-xs font-mono rounded-lg border transition-colors',
                          config.speed === s.value
                            ? 'border-blue-300 bg-blue-50 text-blue-600'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Row 2: Profiles ── */}
              <div className="grid grid-cols-2 gap-5">
                <ProfileEditor
                  version="v1"
                  profile={config.v1Profile}
                  onChange={(p) => set('v1Profile', p)}
                  onInsight={onInsight}
                />
                <ProfileEditor
                  version="v2"
                  profile={config.v2Profile}
                  onChange={(p) => set('v2Profile', p)}
                  onInsight={onInsight}
                />
              </div>

              {/* ── Row 3: Degradation mode ── */}
              <div>
                <label className="text-xs text-gray-400 font-mono block mb-2 uppercase tracking-widest">
                  Degradation Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DEG_MODES.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => {
                        set('degradationMode', m.value);
                        onInsight(getInsight(`mode-${m.value}` as any));
                      }}
                      className={clsx(
                        'text-left p-3 rounded-lg border text-xs transition-colors',
                        config.degradationMode === m.value
                          ? 'border-blue-200 bg-blue-50 text-gray-800'
                          : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
                      )}
                    >
                      <div className="font-semibold font-mono mb-1">{m.label}</div>
                      <div className="text-gray-400 text-xs leading-tight">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Row 4: Auto-rollback ── */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-gray-200 bg-gray-50">
                <div>
                  <p className="text-xs font-mono font-semibold text-gray-700">Auto-rollback</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Shift 100% to v1 when v2 P99 breaches threshold
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {config.autoRollback && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 font-mono">P99 &gt;</span>
                      <input
                        type="number"
                        min={100} max={10000} step={50}
                        value={config.autoRollbackThreshold}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          set('autoRollbackThreshold', v);
                          onInsight(getInsight('rollback-threshold', { threshold: v }));
                        }}
                        className="w-20 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs font-mono text-gray-800 focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-xs text-gray-400 font-mono">ms</span>
                    </div>
                  )}
                  {/* Toggle */}
                  <button
                    onClick={() => {
                      const next = !config.autoRollback;
                      set('autoRollback', next);
                      onInsight(getInsight(next ? 'auto-rollback-on' : 'auto-rollback-off', { threshold: config.autoRollbackThreshold }));
                    }}
                    className={clsx(
                      'relative w-10 h-5 rounded-full transition-colors',
                      config.autoRollback ? 'bg-indigo-600' : 'bg-gray-300'
                    )}
                  >
                    <motion.span
                      animate={{ x: config.autoRollback ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white block"
                    />
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
