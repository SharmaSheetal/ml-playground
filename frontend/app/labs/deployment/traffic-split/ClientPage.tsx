'use client';

import dynamic from 'next/dynamic';

const TrafficSplitSimulator = dynamic(
  () => import('@/modules/deployment/traffic-split').then((m) => m.TrafficSplitSimulator),
  { ssr: false }
);

export default function ClientPage() {
  return <TrafficSplitSimulator />;
}
