'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/traffic-split/content';

export default function TrafficSplitStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Traffic Split"
      moduleCategory="Deployment"
      moduleDesc="Learn how to route production traffic safely across model versions, define rollback criteria that trigger automatically, and evaluate challenger models against a live champion before full promotion."
      accentColor="blue"
    />
  );
}
