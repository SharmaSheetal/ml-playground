'use client';

import Link from 'next/link';
import { MockInterviewRunner } from '@/components/MockInterviewRunner';
import { INTERVIEW_QA, STUDY_CONTENT } from '@/modules/deployment/canary-release/content';

export default function CanaryReleaseInterview() {
  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <Link href="/mock-interview" className="hover:text-slate-300 transition-colors">Mock Interview</Link>
          <span>/</span>
          <span className="text-amber-400">Deployment</span>
          <span>/</span>
          <span className="text-slate-300">Canary Release</span>
        </div>
      </div>
      <MockInterviewRunner
        interviewQA={INTERVIEW_QA}
        studyContent={STUDY_CONTENT}
        moduleTitle="Canary Release"
        moduleCategory="Deployment"
      />
    </>
  );
}
