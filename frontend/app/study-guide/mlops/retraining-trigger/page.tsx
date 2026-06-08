import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/mlops/retraining-trigger/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Retraining Triggers"
      moduleCategory="MLOps"
      moduleDesc="Design automated model retraining pipelines with smart trigger strategies."
      accentColor="violet"
    />
  );
}
