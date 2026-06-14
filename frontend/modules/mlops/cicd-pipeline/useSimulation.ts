'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export type StageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface PipelineStage {
  id: string;
  label: string;
  durationSec: number;
  status: StageStatus;
  progress: number;
  gate: string;
}

export interface SimState {
  isRunning: boolean;
  currentStageIdx: number;
  failureProbability: number;
  stages: PipelineStage[];
  runCount: number;
  lastRunResult: 'none' | 'success' | 'failed';
  failedAt: string | null;
}

const STAGE_DEFS = [
  { id: 'data_validation', label: 'Data validation',   durationSec: 3,  gate: 'Schema + stats check' },
  { id: 'training',        label: 'Model training',    durationSec: 5,  gate: 'Loss convergence' },
  { id: 'offline_eval',    label: 'Offline evaluation',durationSec: 3,  gate: 'AUC > baseline' },
  { id: 'staging',         label: 'Staging deploy',    durationSec: 2,  gate: 'Integration tests' },
  { id: 'canary',          label: 'Canary rollout',    durationSec: 4,  gate: 'Error rate < 0.1%' },
  { id: 'production',      label: 'Production deploy', durationSec: 2,  gate: 'Health check' },
];

function initStages(): PipelineStage[] {
  return STAGE_DEFS.map(s => ({ ...s, status: 'pending', progress: 0 }));
}

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    isRunning: false, currentStageIdx: -1, failureProbability: 15,
    stages: initStages(), runCount: 0, lastRunResult: 'none', failedAt: null,
  });

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageStartRef = useRef<number>(0);

  const startPipeline = useCallback(() => {
    setState(p => ({
      ...p, isRunning: true, currentStageIdx: 0, stages: initStages(),
      lastRunResult: 'none', failedAt: null, runCount: p.runCount + 1,
    }));
    stageStartRef.current = Date.now();
  }, []);

  const tick = useCallback(() => {
    setState(prev => {
      if (!prev.isRunning || prev.currentStageIdx < 0) return prev;
      const idx = prev.currentStageIdx;
      if (idx >= prev.stages.length) return { ...prev, isRunning: false, lastRunResult: 'success' };
      const stage = prev.stages[idx];
      const elapsed = (Date.now() - stageStartRef.current) / 1000;
      const progress = Math.min(100, (elapsed / stage.durationSec) * 100);

      if (progress < 100) {
        const newStages = prev.stages.map((s, i) => i === idx ? { ...s, status: 'running' as StageStatus, progress } : s);
        return { ...prev, stages: newStages };
      }

      const failed = Math.random() * 100 < prev.failureProbability;
      if (failed) {
        const newStages = prev.stages.map((s, i) => {
          if (i < idx) return s;
          if (i === idx) return { ...s, status: 'failed' as StageStatus, progress: 100 };
          return { ...s, status: 'skipped' as StageStatus };
        });
        return { ...prev, isRunning: false, stages: newStages, lastRunResult: 'failed', failedAt: stage.label };
      }

      const nextIdx = idx + 1;
      const newStages = prev.stages.map((s, i) =>
        i === idx ? { ...s, status: 'passed' as StageStatus, progress: 100 } : s
      );
      stageStartRef.current = Date.now();
      if (nextIdx >= prev.stages.length) {
        return { ...prev, isRunning: false, stages: newStages, lastRunResult: 'success', currentStageIdx: nextIdx };
      }
      return { ...prev, stages: newStages, currentStageIdx: nextIdx };
    });
  }, []);

  useEffect(() => {
    if (state.isRunning) {
      tickRef.current = setInterval(tick, 200);
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [state.isRunning, tick]);

  const setFailureProbability = (v: number) => setState(p => ({ ...p, failureProbability: v }));
  const reset = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    setState({ isRunning: false, currentStageIdx: -1, failureProbability: 15, stages: initStages(), runCount: 0, lastRunResult: 'none', failedAt: null });
  };

  return { ...state, startPipeline, setFailureProbability, reset };
}
