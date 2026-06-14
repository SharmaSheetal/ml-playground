'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/latency-optimizer/content';

export default function LatencyOptimizerStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Latency Optimizer"
      moduleCategory="Deployment"
      moduleDesc="Understand why P99 latency matters more than mean, and learn how to systematically reduce it through quantization, TensorRT, dynamic batching, and caching - with a framework for deciding which optimization to apply first."
      accentColor="orange"
    />
  );
}
