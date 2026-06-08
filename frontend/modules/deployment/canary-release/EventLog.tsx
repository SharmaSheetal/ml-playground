'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from './useSimulation';

interface Props { log: LogEntry[]; }

const LEVEL_STYLES: Record<LogEntry['level'], string> = {
  info:    'text-gray-500',
  warn:    'text-amber-600',
  success: 'text-green-600',
  error:   'text-red-600',
};

const LEVEL_PREFIX: Record<LogEntry['level'], string> = {
  info:    '›',
  warn:    '⚠',
  success: '✓',
  error:   '✕',
};

export default function EventLog({ log }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  function fmt(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
        Event Log
      </h3>
      <div className="flex-1 overflow-y-auto max-h-48 space-y-1 font-mono text-xs">
        {log.map(entry => (
          <div key={entry.id} className="flex items-start gap-2">
            <span className="text-gray-400 shrink-0 tabular-nums">{fmt(entry.ts)}</span>
            <span className={`shrink-0 font-bold ${LEVEL_STYLES[entry.level]}`}>
              {LEVEL_PREFIX[entry.level]}
            </span>
            <span className={LEVEL_STYLES[entry.level]}>{entry.msg}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
