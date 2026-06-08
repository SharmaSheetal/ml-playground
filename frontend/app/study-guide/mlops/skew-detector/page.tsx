import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/mlops/skew-detector/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Skew Detection"
      moduleCategory="MLOps"
      moduleDesc="Detect and eliminate training-serving skew in ML pipelines."
      accentColor="indigo"
    />
  );
}
