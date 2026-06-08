'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/canary-release/content';

export default function CanaryReleaseStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Canary Release"
      moduleCategory="Deployment"
      moduleDesc="Staged traffic promotion, observation windows, automated gates, PSI monitoring, and rollback strategy."
      accentColor="amber"
    />
  );
}
