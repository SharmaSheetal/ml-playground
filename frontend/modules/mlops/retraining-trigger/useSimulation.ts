'use client';
import { useState, useEffect, useRef, useCallback } from 'react';

export type TriggerMode = 'scheduled' | 'performance' | 'drift';
export type PipelineStage = 'idle' | 'data_validation' | 'training' | 'evaluation' | 'staging' | 'done';

export interface SimState {
  isRunning: boolean;
  triggerMode: TriggerMode;
  perfThreshold: number;
  driftThreshold: number;
  currentAccuracy: number;
  currentPSI: number;
  retrainCount: number;
  pipelineStage: PipelineStage;
  pipelineProgress: number;
  triggered: boolean;
  triggerReason: string;
  tickCount: number;
}

const STAGES: PipelineStage[] = ['data_validation', 'training', 'evaluation', 'staging', 'done'];
const STAGE_LABELS: Record<PipelineStage, string> = {
  idle:            'Idle',
  data_validation: 'Data validation',
  training:        'Training',
  evaluation:      'Evaluation',
  staging:         'Staging',
  done:            'Deployed',
};

export { STAGE_LABELS };

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    isRunning: false, triggerMode: 'performance',
    perfThreshold: 0.88, driftThreshold: 0.15,
    currentAccuracy: 0.94, currentPSI: 0.02,
    retrainCount: 0, pipelineStage: 'idle',
    pipelineProgress: 0, triggered: false, triggerReason: '',
    tickCount: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runPipeline = useCallback((reason: string) => {
    setState(p => ({ ...p, triggered: true, triggerReason: reason, pipelineStage: 'data_validation', pipelineProgress: 0 }));
    let stageIdx = 0;
    stageTimerRef.current = setInterval(() => {
      stageIdx++;
      if (stageIdx >= STAGES.length) {
        clearInterval(stageTimerRef.current!);
        setState(p => ({
          ...p, pipelineStage: 'done', pipelineProgress: 100,
          currentAccuracy: Math.min(0.97, p.currentAccuracy + 0.04),
          currentPSI: Math.max(0.01, p.currentPSI * 0.3),
          retrainCount: p.retrainCount + 1, triggered: false,
        }));
        setTimeout(() => setState(p => ({ ...p, pipelineStage: 'idle', pipelineProgress: 0 })), 2000);
      } else {
        setState(p => ({ ...p, pipelineStage: STAGES[stageIdx], pipelineProgress: (stageIdx / STAGES.length) * 100 }));
      }
    }, 1800);
  }, []);

  const tick = useCallback(() => {
    setState(prev => {
      if (prev.pipelineStage !== 'idle') return { ...prev, tickCount: prev.tickCount + 1 };
      const acc = Math.max(0.70, prev.currentAccuracy - 0.003 * (0.5 + Math.random()));
      const psi = Math.min(0.5, prev.currentPSI + 0.008 * (0.5 + Math.random()));
      let shouldTrigger = false;
      let reason = '';
      if (prev.triggerMode === 'performance' && acc < prev.perfThreshold) { shouldTrigger = true; reason = `Accuracy ${acc.toFixed(3)} < threshold ${prev.perfThreshold}`; }
      if (prev.triggerMode === 'drift' && psi > prev.driftThreshold) { shouldTrigger = true; reason = `PSI ${psi.toFixed(3)} > threshold ${prev.driftThreshold}`; }
      if (prev.triggerMode === 'scheduled' && prev.tickCount > 0 && prev.tickCount % 8 === 0) { shouldTrigger = true; reason = 'Scheduled retraining window reached'; }
      return { ...prev, currentAccuracy: acc, currentPSI: psi, tickCount: prev.tickCount + 1, _trigger: shouldTrigger ? reason : null } as SimState & { _trigger: string | null };
    });
  }, []);

  useEffect(() => {
    if (state.isRunning) {
      intervalRef.current = setInterval(tick, 1500);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [state.isRunning, tick]);

  const extState = state as SimState & { _trigger?: string | null };
  useEffect(() => {
    if (extState._trigger && state.pipelineStage === 'idle') {
      runPipeline(extState._trigger);
    }
  }, [extState._trigger, state.pipelineStage, runPipeline]);

  const startMonitoring   = () => setState(p => ({ ...p, isRunning: true }));
  const stopMonitoring    = () => setState(p => ({ ...p, isRunning: false }));
  const setTriggerMode    = (v: TriggerMode) => setState(p => ({ ...p, triggerMode: v }));
  const setPerfThreshold  = (v: number) => setState(p => ({ ...p, perfThreshold: v }));
  const setDriftThreshold = (v: number) => setState(p => ({ ...p, driftThreshold: v }));
  const manualTrigger     = () => { if (state.pipelineStage === 'idle') runPipeline('Manual trigger'); };
  const reset = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
    setState({ isRunning: false, triggerMode: 'performance', perfThreshold: 0.88, driftThreshold: 0.15, currentAccuracy: 0.94, currentPSI: 0.02, retrainCount: 0, pipelineStage: 'idle', pipelineProgress: 0, triggered: false, triggerReason: '', tickCount: 0 });
  };

  return { ...state, STAGE_LABELS, startMonitoring, stopMonitoring, setTriggerMode, setPerfThreshold, setDriftThreshold, manualTrigger, reset };
}
