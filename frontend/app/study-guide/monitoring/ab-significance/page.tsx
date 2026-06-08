import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/monitoring/ab-significance/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="A/B Significance"
      moduleCategory="Monitoring"
      moduleDesc="Run statistically sound A/B experiments and avoid common pitfalls."
      accentColor="indigo"
    />
  );
}
