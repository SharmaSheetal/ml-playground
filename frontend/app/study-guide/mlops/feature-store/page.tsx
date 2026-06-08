import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/mlops/feature-store/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Feature Store"
      moduleCategory="MLOps"
      moduleDesc="Architect online and offline feature stores with point-in-time correctness."
      accentColor="purple"
    />
  );
}
