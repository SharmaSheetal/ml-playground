'use client';

import dynamic from 'next/dynamic';

const CanaryReleaseSimulator = dynamic(
  () => import('@/modules/deployment/canary-release').then(m => m.CanaryReleaseSimulator),
  { ssr: false }
);

export default function ClientPage() {
  return <CanaryReleaseSimulator />;
}
