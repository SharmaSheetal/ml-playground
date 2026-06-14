import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/mlops/skew-detector/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Skew Detection"
      moduleCategory="MLOps"
      moduleDesc="Understand why models trained on clean data degrade silently in production, and learn to diagnose whether the root cause is preprocessing differences, feature computation bugs, or serving pipeline drift."
      accentColor="indigo"
    />
  );
}
