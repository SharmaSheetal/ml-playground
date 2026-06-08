'use client';

import { STAGES } from './useSimulation';
import type { SimStatus } from './useSimulation';

interface Props {
  stageIdx: number;
  status:   SimStatus;
}

const STAGE_LABELS = ['0%', '1%', '5%', '25%', '50%', '100%'];

export default function StageBar({ stageIdx, status }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Traffic Progression
        </span>
        {status === 'complete' && (
          <span className="text-xs font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
            Deployment Complete
          </span>
        )}
        {status === 'rolledBack' && (
          <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            Rolled Back
          </span>
        )}
        {status === 'observing' && (
          <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
            Observing…
          </span>
        )}
      </div>

      {/* Stage dots + connecting bars */}
      <div className="flex items-center">
        {STAGES.map((_, i) => {
          const isActive   = i === stageIdx && status === 'observing';
          const isComplete = status === 'complete' ? true : i < stageIdx;
          const isCurrent  = i === stageIdx;

          return (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              {/* Node */}
              <div className="relative flex flex-col items-center">
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-500',
                    status === 'complete'
                      ? 'bg-green-500 border-green-400 text-white'
                      : isActive
                        ? 'bg-amber-500 border-amber-300 text-white shadow-lg shadow-amber-500/40'
                        : isComplete
                          ? 'bg-green-400 border-green-400 text-white'
                          : isCurrent && status === 'idle'
                            ? 'bg-gray-200 border-gray-300 text-gray-500'
                            : 'bg-gray-100 border-gray-200 text-gray-400',
                  ].join(' ')}
                >
                  {(isComplete && status !== 'observing') || status === 'complete' ? '✓' : STAGES[i] === 0 ? '—' : `${STAGES[i]}`}
                </div>
                <span className={[
                  'absolute -bottom-5 text-[10px] font-medium whitespace-nowrap',
                  isActive ? 'text-amber-600' : isComplete || status === 'complete' ? 'text-green-600' : 'text-gray-400',
                ].join(' ')}>
                  {STAGE_LABELS[i]}
                </span>
              </div>

              {/* Connector bar */}
              {i < STAGES.length - 1 && (
                <div className="flex-1 h-1 mx-1 rounded-full overflow-hidden bg-gray-200">
                  <div
                    className={[
                      'h-full rounded-full transition-all duration-700',
                      status === 'complete'
                        ? 'w-full bg-green-500'
                        : i < stageIdx - 1
                          ? 'w-full bg-green-400'
                          : i === stageIdx - 1 && stageIdx > 0
                            ? 'w-full bg-green-400'
                            : 'w-0',
                    ].join(' ')}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6" />
    </div>
  );
}
