import type { DegradationMode, SimSpeed } from './types';

export type InsightKey =
  | 'traffic-split'
  | 'degrade-v1-on'  | 'degrade-v1-off'
  | 'degrade-v2-on'  | 'degrade-v2-off'
  | 'mode-latency'   | 'mode-errors'    | 'mode-gradual'
  | 'auto-rollback-on' | 'auto-rollback-off' | 'rollback-threshold'
  | 'rps-change'
  | 'speed-change'
  | 'profile-change';

interface InsightParams {
  v1Traffic?:  number;
  autoRollback?: boolean;
  threshold?:  number;
  rps?:        number;
  speed?:      SimSpeed;
  version?:    'v1' | 'v2';
  p50?:        number;
  p99?:        number;
}

export function getInsight(key: InsightKey, p: InsightParams = {}): string {
  switch (key) {
    // ── Traffic slider ────────────────────────────────────────────────────────
    case 'traffic-split': {
      const v1 = p.v1Traffic ?? 70;
      const v2 = 100 - v1;
      if (v1 === 100)
        return `100% on v1 - this is blue-green territory. v2 is completely dark. Zero risk from the new model, but also zero production validation. You'd only do this after a full rollback or before starting a new canary.`;
      if (v1 === 0)
        return `Full cutover to v2. The canary has become production. If v2 degrades now, every user is affected simultaneously. In practice, this is the final step after sustained stability at 90%+ for hours or days.`;
      if (v1 >= 80)
        return `${v1}/${v2} split - classic early-stage canary. Only ${v2}% of users see v2. The blast radius is small: if v2 is broken, you catch it early and roll back before most users are impacted. P99 differences start to become statistically meaningful around this split.`;
      if (v1 >= 50)
        return `${v1}/${v2} split - v2 is carrying significant real traffic. This is where subtle behavioural regressions (not just crashes) surface at scale. Recommender or ranking models especially can look fine at 10% but reveal distribution shifts at 40%+.`;
      return `${v1}/${v2} split - v2 is the majority. You've already validated it at lower percentages. At this stage you're watching business metrics (CTR, conversion) not just latency. Final signal before full cutover.`;
    }

    // ── Degrade buttons ───────────────────────────────────────────────────────
    case 'degrade-v1-on':
      return `v1 (stable) is now degraded. In production this could be a memory leak, a slow upstream dependency, or a model hitting a cold cache after a restart. Since v1 carries ${p.v1Traffic ?? 70}% of traffic, most users are affected. Watch the packet flow slow and P99 spike - this is your SLO breach moment.`;
    case 'degrade-v1-off':
      return `v1 has recovered. Metrics will return to baseline within a few ticks. In a real system this could be a hotfix deploy, a restart clearing leaked memory, or an upstream service recovering. Notice how the canary (v2) was completely unaffected - isolation is the point of traffic splitting.`;
    case 'degrade-v2-on':
      return p.autoRollback
        ? `v2 (canary) is degraded. Auto-rollback is active - when v2's P99 crosses ${p.threshold ?? 1000}ms, traffic will automatically shift 100% to v1. This is exactly how production canary systems work: the monitoring stack, not a human, pulls the cord.`
        : `v2 (canary) is degraded and auto-rollback is off. In production, this means degraded responses are serving ${100 - (p.v1Traffic ?? 70)}% of real users with no automated protection. This is why alert thresholds and automated rollbacks exist - human reaction time is too slow.`;
    case 'degrade-v2-off':
      return `v2 has recovered. In a real canary workflow you would now resume incrementally increasing traffic - from ${100 - (p.v1Traffic ?? 70)}% toward 50%, then 80%, watching latency and error metrics stabilise at each stage before proceeding.`;

    // ── Degradation modes ─────────────────────────────────────────────────────
    case 'mode-latency':
      return `Latency spike mode: degradation multiplies P99 by 9×. This models a slow model - large payload, cold cache, under-provisioned GPU, or a blocking downstream call. The model is responding, just slowly. Users experience timeouts. Error rates stay low, which makes this failure mode hard to catch without P99 monitoring.`;
    case 'mode-errors':
      return `Error storm mode: error rate jumps to 15%+ while latency stays near normal. Errors fail fast - so P99 looks deceptively low. This models schema mismatches in input features, an OOM error on the serving container, or a model that throws exceptions on out-of-distribution inputs. The low latency masks the severity.`;
    case 'mode-gradual':
      return `Gradual decay mode: metrics worsen by 20% every simulation tick. This models memory leaks, data drift accumulating over hours, or a cache slowly filling until it evicts aggressively. It is the hardest failure mode to catch - it creeps past alert thresholds instead of triggering them instantly. Watch the chart slope.`;

    // ── Auto-rollback ─────────────────────────────────────────────────────────
    case 'auto-rollback-on':
      return `Auto-rollback is now active at P99 > ${p.threshold ?? 1000}ms. When v2 breaches this, 100% of traffic shifts to v1 automatically and an amber alert fires. This mirrors production systems like Argo Rollouts or Spinnaker: they watch SLO metrics and halt canary promotion before a human even pages.`;
    case 'auto-rollback-off':
      return `Auto-rollback is disabled. You are now in manual mode - any degradation event must be caught and actioned by a human. Useful when you want to observe what happens across the threshold without the simulation interrupting. In production, manual rollback means your MTTR is bounded by pager latency.`;
    case 'rollback-threshold':
      return `Rollback threshold set to ${p.threshold}ms. This is your P99 SLO for v2. Below this, the canary is considered healthy. Above it, auto-rollback fires. Setting this too low causes false positives (jitter triggers rollback). Too high means real degradation slips through. In practice, set it at 2× your baseline P99.`;

    // ── Config ────────────────────────────────────────────────────────────────
    case 'rps-change':
      return (p.rps ?? 1000) > 2500
        ? `${p.rps?.toLocaleString()} RPS - high load. This is where thread pool exhaustion, GC pauses, and cache evictions start to compound. A model that looks fine at 1k RPS can show 3× P99 regression at 4k. Canary deployments at low traffic can miss load-sensitive regressions entirely.`
        : `${p.rps?.toLocaleString()} RPS - moderate load. Most models behave predictably here. Real production issues often only surface at 3–5× normal traffic during peak hours or flash sales. Consider stress-testing your canary at peak-load levels before full cutover.`;
    case 'speed-change':
      return p.speed === 'fast'
        ? `Fast mode (300ms/tick). Each tick fires like a high-frequency scrape interval. Good for watching gradual decay accumulate quickly or triggering auto-rollback in a short session.`
        : p.speed === 'slow'
        ? `Slow mode (1.2s/tick). Gives you time to read each metric update carefully. Useful when studying gradual decay - you can see each step of the degradation and understand how the multiplier compounds.`
        : `Normal mode (600ms/tick). This mirrors a typical Prometheus scrape interval in production. What you see here is close to what an on-call engineer would observe on a Grafana dashboard during an incident.`;
    case 'profile-change':
      return `${p.version?.toUpperCase()} baseline updated: P50=${p.p50}ms, P99=${p.p99}ms. Degradation multipliers now apply on top of these values. Setting these to match your actual model's production latency makes the simulation realistic - you can predict exactly what your P99 will look like under each failure mode before it happens in production.`;

    default:
      return '';
  }
}
