import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/system-design/fraud-detection/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Fraud Detection"
      moduleCategory="System Design"
      moduleDesc="Learn how to design fraud ML systems where the cost of a missed fraud vastly outweighs a false decline - covering threshold selection via cost matrices, class imbalance handling, reject inference, and real-time scoring constraints."
      accentColor="orange"
    />
  );
}
