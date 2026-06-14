'use client';

import dynamic from 'next/dynamic';

const LatencyOptimizerSimulator = dynamic(
  () => import('@/modules/deployment/latency-optimizer').then(m => m.LatencyOptimizerSimulator),
  { ssr: false }
);

export default function ClientPage() {
  return <LatencyOptimizerSimulator />;
}
