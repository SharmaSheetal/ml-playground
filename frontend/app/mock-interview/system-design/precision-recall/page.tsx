'use client';
import Link from 'next/link';
import { MockInterviewRunner } from '@/components/MockInterviewRunner';
import { INTERVIEW_QA, STUDY_CONTENT } from '@/modules/system-design/precision-recall/content';

export default function MockInterview() {
  return (
    <>
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
          <Link href="/mock-interview">Mock Interview</Link>
          <span>/</span>
          <span>System Design</span>
          <span>/</span>
          <span>Precision vs Recall</span>
        </div>
      </div>
      <MockInterviewRunner
        interviewQA={INTERVIEW_QA}
        studyContent={STUDY_CONTENT}
        moduleTitle="Precision vs Recall"
        moduleCategory="System Design"
      />
    </>
  );
}
