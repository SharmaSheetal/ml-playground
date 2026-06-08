'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/shadow-mode/content';

export default function ShadowModeStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Shadow Mode"
      moduleCategory="Deployment"
      moduleDesc="Request mirroring, divergence metrics, Istio/Envoy implementation, stateful model constraints, and comparison pipelines."
      accentColor="cyan"
    />
  );
}
