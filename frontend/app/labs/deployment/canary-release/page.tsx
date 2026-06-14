import ClientPage from './ClientPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:       'Canary Release Stepper | MLOps Playground',
  description: 'Simulate a staged canary deployment with automated gate evaluation, fault injection, and auto-rollback.',
};

export default function CanaryReleasePage() {
  return <ClientPage />;
}
