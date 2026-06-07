'use client';

import Link from 'next/link';
import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/canary-release/content';

export default function CanaryReleaseStudyGuide() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
        <Link href="/study-guide" className="hover:text-slate-300 transition-colors">Study Guide</Link>
        <span>/</span>
        <span className="text-amber-400">Deployment</span>
        <span>/</span>
        <span className="text-slate-300">Canary Release</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Canary Release</h1>
        <p className="text-slate-500 text-sm mt-1">
          Staged traffic promotion, observation windows, automated gates, PSI monitoring, and rollback strategy.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['10 sections', 'AI quiz', 'Practice interview', 'Ask AI'].map(tag => (
          <span key={tag} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            {tag}
          </span>
        ))}
      </div>

      <StudyGuideViewer
        studyContent={STUDY_CONTENT}
        moduleTitle="Canary Release"
        moduleCategory="Deployment"
        accentColor="amber"
      />
    </div>
  );
}
