'use client';

import dynamic from 'next/dynamic';

const ShadowModeSimulator = dynamic(
  () => import('@/modules/deployment/shadow-mode').then(m => m.ShadowModeSimulator),
  { ssr: false }
);

export default function ClientPage() {
  return <ShadowModeSimulator />;
}
