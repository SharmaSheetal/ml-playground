import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/system-design/scalability/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="ML Scalability"
      moduleCategory="System Design"
      moduleDesc="Scale ML serving infrastructure with batching, GPU fleets, and auto-scaling."
      accentColor="red"
    />
  );
}
