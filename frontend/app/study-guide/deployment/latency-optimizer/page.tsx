'use client';

import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/deployment/latency-optimizer/content';

export default function LatencyOptimizerStudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Latency Optimizer"
      moduleCategory="Deployment"
      moduleDesc="P99 tail latency, quantization, dynamic batching, TensorRT, caching strategies, GPU vs CPU serving, and SLA design."
      accentColor="orange"
    />
  );
}
