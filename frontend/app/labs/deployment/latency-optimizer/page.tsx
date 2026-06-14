import ClientPage from './ClientPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title:       'Latency Optimizer | MLOps Playground',
  description: 'Apply quantization, dynamic batching, caching, and TensorRT to an ML serving setup and observe P50/P95/P99 impact in real time.',
};

export default function LatencyOptimizerPage() {
  return <ClientPage />;
}
