'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface InsightBoxProps {
  text: string;
}

export function InsightBox({ text }: InsightBoxProps) {
  return (
    <AnimatePresence mode="wait">
      {text && (
        <motion.div
          key={text}
          initial={{ opacity: 0, y: 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.99 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative flex gap-3 px-4 py-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 overflow-hidden"
        >
          {/* Left accent bar */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500/60 rounded-l-xl" />

          {/* Icon */}
          <div className="shrink-0 mt-0.5">
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1"
            />
          </div>

          {/* Content */}
          <div>
            <p className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-widest mb-1">
              Insight
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              {text}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
