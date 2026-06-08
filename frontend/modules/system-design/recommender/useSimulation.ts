'use client';
import { useState, useMemo } from 'react';

export type RetrievalStrategy = 'ann' | 'bm25' | 'two_tower';
export type RankingModel = 'gbdt' | 'deep_fm' | 'dnn';

export interface SimState {
  catalogSize: number;
  retrievalK: number;
  retrievalStrategy: RetrievalStrategy;
  rankingModel: RankingModel;
  diversityWeight: number;
  freshnessBoost: boolean;
}

export interface DerivedMetrics {
  retrievalLatencyMs: number;
  rankingLatencyMs: number;
  totalLatencyMs: number;
  precision10: number;
  recall10: number;
  ndcg10: number;
  diversityScore: number;
  throughput: number;
}

const RETRIEVAL_BASE: Record<RetrievalStrategy, { latency: number; recall: number }> = {
  ann:       { latency: 8,  recall: 0.78 },
  bm25:      { latency: 12, recall: 0.65 },
  two_tower: { latency: 15, recall: 0.85 },
};

const RANKING_BASE: Record<RankingModel, { latency: number; ndcg: number }> = {
  gbdt:    { latency: 5,  ndcg: 0.72 },
  deep_fm: { latency: 18, ndcg: 0.81 },
  dnn:     { latency: 25, ndcg: 0.84 },
};

export function useSimulation() {
  const [state, setState] = useState<SimState>({
    catalogSize: 1000000, retrievalK: 200,
    retrievalStrategy: 'ann', rankingModel: 'deep_fm',
    diversityWeight: 0.3, freshnessBoost: false,
  });

  const derived = useMemo<DerivedMetrics>(() => {
    const { catalogSize, retrievalK, retrievalStrategy, rankingModel, diversityWeight, freshnessBoost } = state;
    const rBase = RETRIEVAL_BASE[retrievalStrategy];
    const kBase = RANKING_BASE[rankingModel];
    const catalogFactor = Math.log10(catalogSize / 100000);
    const retrievalLatency = Math.round(rBase.latency * (1 + catalogFactor * 0.3) * (retrievalK / 200) * 0.7);
    const rankingLatency   = Math.round(kBase.latency * (retrievalK / 200) * 0.8);
    const totalLatency     = retrievalLatency + rankingLatency;
    const precision10 = Math.min(0.99, rBase.recall * kBase.ndcg * (1 - diversityWeight * 0.15) + (freshnessBoost ? 0.03 : 0));
    const recall10    = Math.min(0.99, rBase.recall * 0.9 + (freshnessBoost ? 0.02 : 0));
    const ndcg10      = Math.min(0.99, kBase.ndcg * (1 - diversityWeight * 0.08) + (freshnessBoost ? 0.01 : 0));
    const diversityScore = 0.3 + diversityWeight * 0.6;
    const throughput  = Math.round(1000 / totalLatency * 1000);
    return { retrievalLatencyMs: retrievalLatency, rankingLatencyMs: rankingLatency, totalLatencyMs: totalLatency, precision10, recall10, ndcg10, diversityScore, throughput };
  }, [state]);

  const setCatalogSize         = (v: number) => setState(p => ({ ...p, catalogSize: v }));
  const setRetrievalK          = (v: number) => setState(p => ({ ...p, retrievalK: v }));
  const setRetrievalStrategy   = (v: RetrievalStrategy) => setState(p => ({ ...p, retrievalStrategy: v }));
  const setRankingModel        = (v: RankingModel) => setState(p => ({ ...p, rankingModel: v }));
  const setDiversityWeight     = (v: number) => setState(p => ({ ...p, diversityWeight: v }));
  const toggleFreshnessBoost   = () => setState(p => ({ ...p, freshnessBoost: !p.freshnessBoost }));
  const reset = () => setState({ catalogSize: 1000000, retrievalK: 200, retrievalStrategy: 'ann', rankingModel: 'deep_fm', diversityWeight: 0.3, freshnessBoost: false });

  return { ...state, derived, setCatalogSize, setRetrievalK, setRetrievalStrategy, setRankingModel, setDiversityWeight, toggleFreshnessBoost, reset };
}
