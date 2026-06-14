'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/shadow-mode/content';

export default function ShadowModeStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Shadow Mode"
      moduleCategory="Deployment"
      moduleDesc="Learn how to run a new model in parallel with live traffic, measure prediction divergence without user impact, and handle the challenges of stateful models and async logging that make shadow mode hard in practice."
      accentColor="cyan"
    />
  );
}
