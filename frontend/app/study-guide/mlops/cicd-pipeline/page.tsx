import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/mlops/cicd-pipeline/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="CI/CD Pipeline"
      moduleCategory="MLOps"
      moduleDesc="Build reliable CI/CD pipelines for safe ML model deployment."
      accentColor="blue"
    />
  );
}
