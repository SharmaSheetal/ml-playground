'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/canary-release/content';

export default function CanaryReleaseStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Canary Release"
      moduleCategory="Deployment"
      moduleDesc="Understand how staged rollouts catch regressions before they reach all users - from configuring automated PSI gates and observation windows to wiring Argo Rollouts for zero-touch promotion or instant rollback."
      accentColor="amber"
    />
  );
}
