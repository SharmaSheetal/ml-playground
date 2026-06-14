import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/system-design/precision-recall/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Precision vs Recall"
      moduleCategory="System Design"
      moduleDesc="Master precision-recall tradeoffs and choose the right metric for each task."
      accentColor="blue"
    />
  );
}
