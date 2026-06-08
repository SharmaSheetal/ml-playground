import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/monitoring/drift-detection/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Drift Detection"
      moduleCategory="Monitoring"
      moduleDesc="Detect and respond to data and concept drift using PSI and statistical tests."
      accentColor="emerald"
    />
  );
}
