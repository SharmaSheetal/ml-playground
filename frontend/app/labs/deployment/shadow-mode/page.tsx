import ClientPage from './ClientPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:       'Shadow Mode Differ | MLOps Playground',
  description: 'Mirror live traffic to a shadow model, compare predictions, measure divergence, and decide whether to promote to canary.',
};

export default function ShadowModePage() {
  return <ClientPage />;
}
