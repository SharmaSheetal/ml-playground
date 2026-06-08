import { StudyGuideViewer } from '@/components/StudyGuideViewer';
import { STUDY_CONTENT } from '@/modules/monitoring/metrics-dashboard/content';

export default function StudyGuide() {
  return (
    <StudyGuideViewer
      studyContent={STUDY_CONTENT}
      moduleTitle="Metrics Dashboard"
      moduleCategory="Monitoring"
      moduleDesc="Design four-layer ML observability dashboards for production systems."
      accentColor="green"
    />
  );
}
