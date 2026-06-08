import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/monitoring/alert-threshold/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Alert Thresholds"
      moduleCategory="Monitoring"
      moduleDesc="Tune alert thresholds to balance false alarms and missed incidents."
      accentColor="teal"
    />
  );
}
