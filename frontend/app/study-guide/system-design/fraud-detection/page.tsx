import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/system-design/fraud-detection/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Fraud Detection"
      moduleCategory="System Design"
      moduleDesc="Build fraud detection systems with cost-aware threshold optimization."
      accentColor="orange"
    />
  );
}
