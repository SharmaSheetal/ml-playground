import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/system-design/recommender/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Recommender Systems"
      moduleCategory="System Design"
      moduleDesc="Design two-stage retrieval-ranking recommender systems at scale."
      accentColor="amber"
    />
  );
}
