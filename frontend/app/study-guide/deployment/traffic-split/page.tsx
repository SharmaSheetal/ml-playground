'use client';

import Link from 'next/link';
import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/traffic-split/content';

export default function TrafficSplitStudyGuide() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
        <Link href="/study-guide" className="hover:text-slate-300 transition-colors">Study Guide</Link>
        <span>/</span>
        <span className="text-blue-400">Deployment</span>
        <span>/</span>
        <span className="text-slate-300">Traffic Split</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Traffic Split</h1>
        <p className="text-slate-500 text-sm mt-1">
          Canary deployments, blue/green, shadow mode, rollback mechanics, and serving patterns.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['27 sections', 'AI quiz', 'Practice interview', 'Ask AI'].map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
            {tag}
          </span>
        ))}
      </div>

      <StudyGuideViewer
        studyContent={STUDY_CONTENT}
        moduleTitle="Traffic Split"
        moduleCategory="Deployment"
        accentColor="blue"
      />
    </div>
  );
}
