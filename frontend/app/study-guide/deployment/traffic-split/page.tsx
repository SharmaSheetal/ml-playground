'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/traffic-split/content';

export default function TrafficSplitStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Traffic Split"
      moduleCategory="Deployment"
      moduleDesc="Canary deployments, blue/green, shadow mode, rollback mechanics, and serving patterns."
      accentColor="blue"
    />
  );
}
