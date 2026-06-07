export interface StudySection { heading: string; body: string; }
export interface InterviewQ {
  difficulty: 'junior' | 'mid' | 'senior';
  question:   string;
  answer?:    string;
  keyPoints:  string[];
  trap?:      string;
}

// ── Study Content ─────────────────────────────────────────────────────────────

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'What is a Canary Release?',
    body: `A canary release exposes a new model version to a small, controlled fraction of production traffic before a full rollout. The name comes from coal miners who carried canaries into mines — a canary dying first warned of danger. In ML, the canary model "dies" (degrades metrics) before the regression reaches all users.

The mechanics: your load balancer or service mesh (Istio, AWS ALB) routes, say, 1% of traffic to the new model while 99% continues to the stable champion. You observe metrics at this small slice for a defined window. If everything looks healthy, you step up: 5% → 25% → 50% → 100%.

The key property canary provides: blast radius control. A regression at 1% traffic affects 1% of users, not 100%. You catch the problem while it is still small.`,
  },
  {
    heading: 'Choosing Traffic Percentages',
    body: `The traffic stages are not arbitrary — each step is chosen to balance statistical confidence against blast radius.

1% — minimum viable signal. Detects only severe regressions (P99 doubling, error rate > 5%). Fine for a first gate.
5% — starts giving meaningful statistical samples on most business metrics.
25% — high confidence on latency and error rate; meaningful signal on conversion and CTR.
50% — often used as the A/B test split to measure business impact before full commit.
100% — full rollout. Champion is replaced.

The right stages depend on your traffic volume. At 10k RPS:
  1% = 100 RPS on canary — plenty for latency measurement.
  0.1% = 10 RPS — too low for reliable percentile estimates.

At 100 RPS total, even 10% gives only 10 RPS — you may need to start at a higher percentage and rely more on longer observation windows to compensate for lower sample rates.`,
  },
  {
    heading: 'Observation Windows — Why 30 Minutes?',
    body: `An observation window is the minimum time you must watch metrics at a given traffic percentage before promoting. Setting this correctly is as important as setting the right thresholds.

Why 30 minutes (or more)?
  Latency: a single spike can look like a degradation. 30 minutes of data smooths out transient noise.
  Error rates: some errors are time-dependent — they appear after warm-up, after a cache cold start, or at specific times of day.
  Business metrics: CTR and conversion need enough samples to be statistically meaningful.

Common mistake: watching metrics for 5 minutes at 1% traffic (= 5 RPS × 300s = 1,500 requests), seeing no red flags, and promoting. 1,500 requests is enough to catch 500ms P99 spikes but not a 10% CTR regression.

The observation window is not just about time — it is about accumulated sample count. Volume × time determines confidence.`,
  },
  {
    heading: 'Automated Gates vs. Human Judgment',
    body: `Gate automation is essential at any deploy frequency above once per week. Human-in-the-loop does not scale, and humans are biased toward shipping (especially under deadline pressure).

An automated gate works like this: after every interval (say, 60 seconds), a monitoring system evaluates predefined conditions. If all pass AND the observation window has elapsed, the canary can be promoted. If any fail, promotion is blocked, and optionally an automatic rollback triggers.

Tools for automated canary gates:
  Argo Rollouts: defines AnalysisRuns — Prometheus queries that evaluate at each step.
  Flagger: GitOps-native canary controller with built-in metric providers.
  Spinnaker: pipeline-based with manual approval stages or automated metric checks.

The key discipline: thresholds must be set BEFORE the experiment, not adjusted after you see the data. Post-hoc threshold tuning is how teams rationalize shipping bad models.`,
  },
  {
    heading: 'When to Rollback vs. When to Hold',
    body: `Not every gate failure is a rollback trigger. The decision depends on the severity and trend:

ROLLBACK immediately:
  Error rate > 5% (users experiencing failures)
  P99 > 2× baseline (severe user impact)
  PSI > 0.25 (prediction distribution has fundamentally shifted)

HOLD and monitor:
  Single-tick threshold breach that recovers within 60 seconds (transient spike, not a regression)
  P99 within 10% of baseline (borderline — watch for trend)
  Error rate at 1.5% (borderline — check if trending up or plateauing)

DIAGNOSE before deciding:
  Check if the issue is isolated to a specific feature value, user cohort, or time of day
  Compare feature distributions between canary and champion traffic slices
  Look at the serving trace to see if latency is in feature lookup vs. inference

The worst decision: rolling back prematurely when the canary is actually fine. Premature rollbacks erode confidence in the deployment process and make teams reluctant to ship.`,
  },
  {
    heading: 'The Cost of Rolling Back Too Soon',
    body: `Teams that set rollback thresholds too aggressively create a "boy who cried wolf" problem. Every deploy triggers a rollback at 1% for transient spikes, engineers lose confidence in the metrics, and eventually someone overrides the automation.

Overly sensitive gates hurt in three ways:
  1. False positives: P99 spikes are common during warm-up (first few minutes as JVM compiles, GPU cache warms). Triggering rollback during warm-up means you never successfully deploy anything.
  2. Automation distrust: if the gate fires twice on good deploys, engineers start ignoring or bypassing it.
  3. Slow release velocity: 6 rollbacks per week from false positives costs hours of engineering time.

Solutions:
  Exclude the warm-up period from gate evaluation (first 2-3 minutes)
  Use rolling averages rather than instantaneous values for threshold comparison
  Tune thresholds on historical deploy data — what normal variance looks like at 1% traffic
  Distinguish between "gate not passing" (observation window not yet elapsed) and "gate failed" (threshold breached)`,
  },
  {
    heading: 'Multi-Dimensional Gates',
    body: `A robust canary gate is not a single metric — it is a conjunction of multiple conditions across layers:

Infrastructure layer:
  P99 latency within 5% of champion
  Error rate (5xx) below 1%
  Throughput not degraded below 95% of expected

Model quality layer:
  Prediction distribution: PSI < 0.1 on model outputs
  Null/fallback rate not elevated (model not bailing out silently)
  Per-class accuracy metrics if labels are available online

Business layer (for later stages at 25-50%):
  CTR not degraded by more than 2%
  Conversion rate within confidence interval
  Revenue per user within 3% of champion

A model can pass all infrastructure gates and fail business gates — this is a silent model failure. Canary gates that only check latency and error rate miss the most damaging regressions.

Implementation: in Argo Rollouts, each AnalysisTemplate defines a separate Prometheus query. The canary advances only when ALL AnalysisRuns succeed.`,
  },
  {
    heading: 'What to Do With the Bad Version',
    body: `After a rollback, the instinct is to delete the failed canary deployment. Resist this.

The failed canary is your evidence. Keep it at 0% traffic:
  Run profiling against the live champion to find the regression
  Replay production traffic logs against the canary in a staging environment
  Inspect the model weights and preprocessing pipeline for differences vs. champion
  Check feature distribution differences between training data and the canary's first 5 minutes of production traffic

Only after you understand WHY it failed should you delete it. Common root causes found by keeping the bad version:
  Preprocessing bug (null handling, feature encoding) that only appears at production scale
  Model trained on a different feature schema than what the serving pipeline provides
  Memory leak that only manifests after extended operation — would have been missed with only staging load tests

After diagnosis, write a post-mortem capturing: what failed, why automated gates caught it, how long it took to roll back, and what gate would catch it faster next time.`,
  },
  {
    heading: 'Argo Rollouts — Automating Canary Steps',
    body: `Argo Rollouts is a Kubernetes controller that extends the standard Deployment with traffic management and analysis built in.

A Rollout spec defines the canary steps explicitly:
  steps:
    - setWeight: 1
    - analysis: { templates: [latency-check, error-check] }
    - pause: { duration: 30m }
    - setWeight: 5
    - pause: { duration: 30m }
    ...

The AnalysisTemplate queries Prometheus (or Datadog, New Relic, etc.) on a schedule. A failed query fails the analysis, which automatically rolls back the Rollout to the last stable weight.

Why this matters for ML:
  Model-specific Prometheus metrics (prediction entropy, PSI, business CTR) can be defined as AnalysisTemplates alongside standard infra metrics
  The 30m observation window is enforced by the spec, not by human memory
  Rollback is automatic and documented in the Rollout history — full audit trail

Integration with GitOps: Argo Rollouts works seamlessly with Argo CD. When a new model image is pushed to the registry and the Rollout spec is updated, Argo CD applies it and Argo Rollouts manages the traffic progression automatically.`,
  },
  {
    heading: 'PSI — Measuring Prediction Drift During Canary',
    body: `Population Stability Index (PSI) measures how much a distribution has shifted between two samples. During a canary, you compute PSI between the canary model's prediction distribution and the champion's prediction distribution on the same incoming traffic.

Formula: PSI = Σ (actual% - expected%) × ln(actual% / expected%)

Interpretation:
  PSI < 0.1: no significant shift — models behave similarly
  0.1 ≤ PSI < 0.2: moderate shift — monitor closely, investigate
  PSI ≥ 0.2: major shift — gate should fail, investigate before promoting

Why PSI matters more than accuracy during canary: you rarely have ground truth labels available in real time. PSI gives you a proxy for behavioral change without needing labels — if the distribution of scores has shifted significantly, the model is making different predictions, regardless of whether they are correct.

Common cause of PSI spikes during canary: the new model has different preprocessing than the champion — a feature normalization change, a new feature, or a different null handling strategy. PSI detects this as distribution shift even if latency and error rate look fine.`,
  },
];

// ── Interview Q&A ─────────────────────────────────────────────────────────────

export const INTERVIEW_QA: InterviewQ[] = [
  // ── Section 1: What is a Canary Release? ──────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is a canary release and why is it preferred over big-bang deployments for ML models?',
    keyPoints: [
      'Exposes a small fraction of traffic (1-5%) to the new model before full rollout',
      'Limits blast radius — a regression at 1% affects 1% of users, not all',
      'ML behavioral regressions are subtle and only visible at scale — canary gives signal without full exposure',
      'Provides real production traffic (not synthetic) for validation, which staging cannot replicate',
    ],
    trap: 'Saying canary is just about being "careful." The key insight is blast radius control and real-traffic validation that staging cannot provide.',
  },
  {
    difficulty: 'mid',
    question: 'Why can\'t staging environment testing replace canary validation in production for ML models?',
    keyPoints: [
      'Staging uses synthetic or replayed traffic — it cannot replicate real user distribution, real caching behavior, or real downstream dependency state',
      'Staging database scale is typically much smaller; edge cases visible at production scale are invisible in staging',
      'ML quality regressions (output distribution drift, ranking degradation) only manifest under real user behavior — CTR drops, click patterns, and session signals cannot be simulated',
      'Real production traffic also uncovers training-serving skew that staging never sees: the model encounters input distributions it was never trained on',
    ],
    trap: 'Thinking thorough staging testing makes canary unnecessary. Staging reduces obvious failure risk; canary catches subtle behavioral regressions that only appear at real scale.',
  },

  // ── Section 2: Choosing Traffic Percentages ───────────────────────────────
  {
    difficulty: 'mid',
    question: 'How do you choose traffic percentages for canary stages? Why 1% → 5% → 25% → 50% → 100% and not just 50% → 100%?',
    keyPoints: [
      'Each stage increases statistical confidence while limiting risk at the previous level',
      '1% detects severe regressions (error rate > 5%) at near-zero user impact',
      'Starting at 50% means a bad deploy affects half your users before you have any signal',
      'Traffic volume matters: at 10k RPS, 1% = 100 RPS — enough for reliable latency percentiles. At 100 RPS total, you may need to start higher',
    ],
  },
  {
    difficulty: 'junior',
    question: 'Your service handles 500 RPS total. At 1% canary traffic, how many RPS is the canary receiving? Is that enough for reliable P99 latency estimates, and why?',
    keyPoints: [
      '1% of 500 RPS = 5 RPS going to the canary',
      '5 RPS × 1800 seconds (30-minute window) = 9,000 requests — sufficient for a reliable P99 estimate (rule of thumb: ~1,000 requests minimum)',
      'At very low total traffic (< 20 RPS), 1% yields almost nothing — you may need to start at 5-10% to accumulate enough samples for meaningful signal',
      'Volume is necessary but not sufficient: canary traffic must also cover at least one traffic peak to represent real-world load patterns',
    ],
    trap: 'Thinking more total traffic always means 1% is safe. At 50 RPS total, 1% = 0.5 RPS — you would need hours just to get 1,000 samples. Adjust the starting percentage to your actual volume.',
  },
  {
    difficulty: 'senior',
    question: 'A team proposes skipping 1% and 5% stages and starting directly at 25% traffic. When is this defensible, and when is it reckless?',
    keyPoints: [
      'Defensible when total traffic is very low (< 20 RPS) and lower stages yield no statistically meaningful signal',
      'Defensible when the change is narrowly scoped — a config-only change, not a model logic or feature pipeline change',
      'Reckless when the model architecture changed, training data distribution shifted, or new feature inputs were added',
      'Key question: what is the blast radius if 25% fails? At 25%, one in four users is affected before any rollback signal — worth extra caution for high-risk changes',
    ],
    trap: 'Treating stage-skipping as always fine or always wrong. It is a risk trade-off that depends on traffic volume, change scope, and blast radius tolerance.',
  },

  // ── Section 3: Observation Windows ───────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'What is an observation window in canary deployment and what determines its minimum duration?',
    keyPoints: [
      'The minimum time you must observe metrics at a stage before promoting to the next',
      'Duration is determined by: time to accumulate statistically meaningful samples, and time for time-dependent failures to manifest (warm-up, cache cold starts)',
      '30 minutes is a common minimum — shorter windows miss transient regressions that appear after warm-up',
      'Volume × time = confidence: at low RPS, longer windows are needed to compensate for fewer samples',
    ],
    trap: 'Saying "just watch for a few minutes." Transient spikes during warm-up look like regressions; you need enough time and sample volume to distinguish signal from noise.',
  },
  {
    difficulty: 'junior',
    question: 'Your canary has been running for 8 minutes at 1% traffic and all metrics are green. Should you promote to the next stage?',
    keyPoints: [
      'No — 8 minutes is well below the typical minimum observation window of 30 minutes',
      'Short windows miss failures that emerge after warm-up, cache cold-start, or time-of-day traffic pattern shifts',
      'Green metrics at 8 minutes only mean no failures were detected in a very small sample window — not that no failures exist',
      'Wait for the full observation window regardless of how healthy metrics appear — early green signals are unreliable',
    ],
  },
  {
    difficulty: 'senior',
    question: 'ML business metrics like click-through rate and conversion often arrive with a 24-hour delay. How does this change your observation window strategy?',
    keyPoints: [
      'Infrastructure metrics (latency, errors) fail fast — minutes. Business outcome metrics (CTR, conversion, revenue) arrive hours or days later',
      'Smart canary systems operate on dual time horizons: fast system metrics for immediate anomaly detection, slow business metrics for final validation before 100%',
      'Do not promote to 100% before at least one cycle of delayed business metric data is available — for a recommendation model this may mean waiting 24-48 hours at 25-50%',
      'Use leading indicators as proxies: dwell time, add-to-cart rate, and session length often respond faster than purchase conversions and can serve as early business signal',
    ],
    trap: 'Treating all canary gates as fast-feedback loops. Infrastructure gates are fast; business outcome gates require patience. Rushing to 100% before business metrics arrive is one of the most common real-world canary failures.',
  },

  // ── Section 4: Automated Gates vs. Human Judgment ────────────────────────
  {
    difficulty: 'senior',
    question: 'Why should canary thresholds be defined before the canary starts, not adjusted after you see the data?',
    keyPoints: [
      'Post-hoc threshold setting introduces confirmation bias — you subconsciously tune to justify the outcome you want',
      'Automated gates require pre-specified thresholds — you cannot automate on thresholds defined mid-experiment',
      'Pre-defined thresholds force stakeholder alignment before shipping pressure exists',
      'Regulatory and audit trails in some domains require pre-specified evaluation criteria',
    ],
    trap: 'Accepting that "adjusting for context" is reasonable. This is how teams rationalize shipping regressions under deadline pressure.',
  },
  {
    difficulty: 'mid',
    question: 'Netflix\'s Kayenta uses automated canary analysis to promote or rollback. What is the key difference between Kayenta\'s gate model and a naive "wait N minutes" approach?',
    keyPoints: [
      'Kayenta gates on metric conditions, not elapsed time — a canary with excellent metrics can promote in 5 minutes; a mediocre one stalls indefinitely',
      'This is the correct model: promotion should be earned by meeting quality thresholds, not just by surviving a timer',
      'Naive time-based gates frequently fail under pressure: teams start treating the timer as a formality to get through rather than an actual quality check',
      'Metric-gated promotion forces the canary to prove it is at least as good as the champion before being allowed to advance',
    ],
    trap: 'Thinking a time-based observation window is equivalent to a metric-gated system. Time gives you data; metrics tell you whether that data is acceptable.',
  },
  {
    difficulty: 'senior',
    question: 'An engineer says "I looked at the canary data and everything looks fine" to justify bypassing the automated gate system and manually promoting. What process failure does this represent?',
    keyPoints: [
      'Human visual inspection is subject to confirmation bias — especially under deadline pressure where there is incentive to ship',
      'Automated gates encode pre-agreed thresholds with stakeholder alignment; bypassing them means those agreements are meaningless',
      '"Looks fine" is not a reproducible or auditable decision — it cannot be reviewed in a post-mortem',
      'Each manual bypass sets a precedent and makes the next one easier to justify — the safety system degrades gradually and silently',
    ],
    trap: 'Thinking an experienced engineer\'s judgment can replace automated gates. Gates exist precisely because human judgment is inconsistent under pressure.',
  },

  // ── Section 5: When to Rollback vs. When to Hold ─────────────────────────
  {
    difficulty: 'senior',
    question: 'What is the difference between a gate failing and auto-rollback triggering? When would you want auto-rollback disabled?',
    keyPoints: [
      'Gate failing: a threshold is breached — promotion is blocked, alert fires, human investigates',
      'Auto-rollback: system automatically shifts traffic back to previous stage on gate failure — no human needed',
      'Auto-rollback is appropriate when: error rate > 5% (user-visible failures), P99 > 2× baseline (severe UX impact)',
      'Auto-rollback disabled when: the gate is a soft metric (business CTR) where human judgment is needed, or when you want to investigate while the canary is still running',
    ],
  },
  {
    difficulty: 'mid',
    question: 'What is the difference between pausing a canary at its current stage and rolling it back to 0%? When do you choose each?',
    keyPoints: [
      'Hold (pause): stops stage advancement but leaves canary traffic at the current percentage — the canary keeps running and accumulating data',
      'Rollback: shifts traffic to 0% — the canary stops serving users immediately and the champion takes all traffic',
      'Hold when a metric is borderline or possibly transient — you need more data before making a rollback call',
      'Rollback when a hard gate (error rate, P99) has clearly breached threshold — you are actively harming users and need to stop now',
    ],
    trap: 'Defaulting to rollback for every gate alert. A "not yet passing" state (window not elapsed) warrants a hold, not a rollback — premature rollbacks train teams to distrust the automation.',
  },

  // ── Section 6: Cost of Rolling Back Too Soon ──────────────────────────────
  {
    difficulty: 'junior',
    question: 'True or false: canary rollbacks are essentially free because they complete in seconds. Explain your reasoning.',
    keyPoints: [
      'False — rollbacks are operationally fast but carry real total costs beyond the execution time',
      'Engineering time: investigation, post-mortem, root cause analysis, fix development, and re-validation all take hours to days',
      'User impact: real users experienced degraded service during the canary window, even at 1% traffic',
      'Velocity cost: blocked deployments, coordination overhead, and potential delays to downstream teams waiting on the model',
    ],
    trap: 'Conflating operational execution time (seconds) with total business cost. Fast rollback is a safety property — it does not make rollbacks without consequence.',
  },
  {
    difficulty: 'senior',
    question: 'Your automated gate system has triggered three false-positive rollbacks this month — all during the warm-up period before metrics stabilize. How do you fix this without making real regressions harder to catch?',
    keyPoints: [
      'Add a warm-up exclusion: do not evaluate gates during the first 5-10 minutes while caches fill and model state stabilizes',
      'Use minimum sample thresholds: gates should not fire until N requests have been processed, preventing early-noise failures on tiny samples',
      'Audit gate sensitivity per phase: if P99 naturally spikes 20% during warm-up, use a higher threshold in that phase only — not globally',
      'Do not simply raise thresholds permanently — that trades false positives for false negatives on real regressions',
    ],
    trap: 'Fixing false positives by loosening thresholds globally. The correct fix is phase-aware gates or minimum sample requirements, not insensitive thresholds.',
  },

  // ── Section 7: Multi-Dimensional Gates ───────────────────────────────────
  {
    difficulty: 'junior',
    question: 'Name three categories of gates a production ML canary should check. What distinct failure mode does each catch?',
    keyPoints: [
      'Infrastructure gates (P99 latency, error rate): catch serving failures, memory leaks, timeout spikes — fast feedback, minutes to detect',
      'Model quality gates (prediction PSI, confidence score distribution, null response rate): catch silent model regressions invisible in infrastructure metrics',
      'Business metric gates (CTR, conversion rate, revenue per request): catch user-impact regressions that only show up in downstream outcomes',
      'Each layer catches different failures — infrastructure gates alone would promote a model with a 4% CTR regression because latency looks fine',
    ],
  },
  {
    difficulty: 'mid',
    question: 'PSI is 0.18 during your canary at 10% traffic. All infrastructure gates (P99, error rate) are passing. Do you promote?',
    keyPoints: [
      'PSI of 0.18 is in the "moderate shift" range (0.1–0.2) — this is a yellow flag, not a clear rollback signal',
      'Do not promote without understanding why the distribution shifted — could be a legitimate model improvement or a preprocessing bug',
      'Check: are the output distributions shifting in a way that makes sense? (e.g. a fraud model scoring more transactions as fraudulent after training on newer fraud patterns)',
      'Either hold and monitor for trend, or investigate the source of the PSI shift before making a decision',
    ],
    trap: 'Promoting because infrastructure gates pass. PSI > 0.1 is a model-quality gate failure — the fact that latency is fine does not mean the model is behaving correctly.',
  },
  {
    difficulty: 'senior',
    question: 'Design a canary gate strategy for a recommendation model where business-metric ground truth (click data) arrives with a 24-hour delay.',
    keyPoints: [
      'Phase 1 (hours 0–4): gate on infrastructure and model quality proxies only — PSI, null response rate, confidence score distribution',
      'Phase 2 (hour 24+): once click data is available, run a statistical significance test against champion CTR before advancing beyond 50%',
      'Use surrogate leading indicators if available: dwell time, add-to-cart, and session engagement correlate with CTR and respond faster',
      'Accept that full business metric validation takes 24 hours — plan canary stages accordingly and do not rush to 100% before day-1 data arrives',
    ],
    trap: 'Promoting to 100% before business metric data is available. A model can look healthy on infrastructure and PSI while silently degrading user experience in ways that only appear in lagged signals.',
  },

  // ── Section 8: What to Do With the Bad Version ───────────────────────────
  {
    difficulty: 'senior',
    question: 'After rolling back a canary, an engineer deletes the failed deployment pods to clean up. What critical mistake is being made?',
    keyPoints: [
      'The failed pods are the evidence — you need them to reproduce the failure, profile memory/CPU, and inspect logs at the failure state',
      'Without the failed version, you cannot diff against the champion to find the regression',
      'Without understanding root cause, the same bug will appear in the next deploy',
      'Correct process: keep at 0% traffic, schedule post-mortem, investigate, then delete after root cause is documented',
    ],
  },
  {
    difficulty: 'mid',
    question: 'You identified a one-line preprocessing bug as the root cause of a canary failure. Should you push the fix directly to 100% without running a new canary? Why or why not?',
    keyPoints: [
      'No — even a one-line fix should go through a new canary starting at 1%',
      'Preprocessing changes propagate through all downstream feature computation — a one-line fix can have non-obvious effects at scale',
      'The previous canary failure means the system is in a heightened state; this is the wrong time to reduce validation rigor',
      '"Simple fix" is often the most dangerous change to rush because low perceived risk reduces review quality and testing thoroughness',
    ],
    trap: 'Assuming a small change is safe to bypass canary. In ML pipelines, preprocessing changes propagate in non-obvious ways and their effects only become visible at scale.',
  },

  // ── Section 9: Argo Rollouts ──────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'How does Argo Rollouts enforce automated canary gates, and how would you add an ML-specific gate (e.g. prediction PSI) to it?',
    keyPoints: [
      'Argo Rollouts uses AnalysisTemplates — Prometheus (or Datadog/New Relic) queries evaluated on a schedule at each traffic step',
      'All AnalysisRuns must succeed before the Rollout advances to the next step; failure triggers rollback',
      'Add PSI as a custom Prometheus metric: export PSI from your model serving code, scrape with Prometheus, define an AnalysisTemplate with threshold < 0.1',
      'AnalysisTemplates are reusable across Rollouts — define once in the platform team, shared by all model deployments',
    ],
    trap: 'Thinking Argo Rollouts only checks infrastructure metrics. It queries any Prometheus metric — you can gate on prediction quality metrics, business metrics, or any custom signal.',
  },
  {
    difficulty: 'mid',
    question: 'How does Argo Rollouts integrate with Argo CD in a GitOps workflow? What triggers a Rollout to begin and what controls when it advances?',
    keyPoints: [
      'Argo CD syncs Rollout manifests from git; the Argo Rollouts controller watches the manifest and manages traffic shifting via VirtualService or Ingress',
      'A Rollout begins when the container image in the manifest changes — Argo CD detects the git commit and applies the updated manifest',
      'Advancement between stages is controlled by AnalysisRuns (automated gates) and optionally by manual pause steps requiring explicit human approval',
      'Pause steps allow mixed automation and human oversight: e.g., auto-advance to 25%, then require explicit promotion before 50%',
    ],
  },

  // ── Section 10: PSI — Measuring Prediction Drift ─────────────────────────
  {
    difficulty: 'junior',
    question: 'What does a PSI of 0.04, 0.12, and 0.28 each indicate about a model\'s prediction distribution during a canary?',
    keyPoints: [
      'PSI < 0.1 (0.04): minimal drift — canary and champion distributions are effectively the same; no action needed',
      'PSI 0.1–0.2 (0.12): moderate shift — investigate before promoting; could be intentional improvement or a preprocessing issue',
      'PSI > 0.2 (0.28): significant distribution shift — high likelihood of meaningful behavioral change; gate should fail and require investigation',
      'PSI is symmetric across output buckets — it detects shifts toward both higher and lower predictions, which matters for fraud scoring and ranking models',
    ],
  },
  {
    difficulty: 'mid',
    question: 'What is the difference between "gates not yet passing" and "gates failed" in a canary? Why does this distinction matter operationally?',
    keyPoints: [
      '"Not yet passing" = observation window has not elapsed, or metrics are stable but sample size is still small — promotion blocked but not a problem',
      '"Failed" = threshold breached — active regression, alert should fire, human investigates',
      'Treating "not yet passing" as "failed" causes premature rollbacks and erodes trust in automation',
      'Good tooling surfaces this distinction: "Healthy — waiting on 18/30 minute window" vs. "ALERT — P99 threshold breached"',
    ],
  },
  {
    difficulty: 'senior',
    question: 'PSI is 0.08 at 1%, 0.09 at 5%, and 0.12 at 25% — trending upward with each stage. All other gates are passing. Do you promote to 50%?',
    keyPoints: [
      'No — a monotonically rising PSI trend is more concerning than a single reading above threshold; it suggests systematic drift that worsens with more traffic',
      'At 0.12, the gate is already at the borderline failure range (> 0.1); the upward trend makes this more alarming, not less',
      'Investigate root cause: is this a training distribution mismatch that becomes more visible at higher traffic? A preprocessing path that diverges at scale?',
      'Hold at 25% and investigate — if PSI reaches 0.2+ at 50%, you will have exposed more users to a behaviorally worse model',
    ],
    trap: 'Evaluating each PSI reading in isolation. A monotonically rising PSI across stages is a systematic signal, not noise — the trend matters as much as the threshold.',
  },
  {
    difficulty: 'senior',
    question: 'A canary passes all gates at 1%, 5%, and 25%. At 50% you notice a 4% drop in CTR, but P99 and error rate are still healthy. What do you do?',
    keyPoints: [
      'CTR drop at 50% is a business metric failure — the model is behaviorally worse even though it is technically healthy',
      'This is a silent model regression: infrastructure looks fine, user impact is real',
      'Roll back to 25% (or 0%), keep the canary running for diagnosis, check what changed in the model that would produce different recommendations',
      'This is why business metric gates at 50% are critical — a latency+error gate alone would have promoted this to 100%',
    ],
    trap: 'Continuing to promote because infrastructure gates pass. A 4% CTR drop at 50% traffic is a material business regression regardless of P99 health.',
  },
];

// ── AI Prompt ─────────────────────────────────────────────────────────────────

export const AI_PROMPT_TEMPLATE = (
  stage: number,
  p99canary: number, p99champ: number,
  errCanary: number, errChamp: number,
  psi: number,
  elapsed: number, minWindow: number,
  fault: string,
) =>
  `I am running a canary release at ${stage}% traffic. Champion P99: ${p99champ}ms, Canary P99: ${p99canary}ms. Champion error rate: ${errChamp}%, Canary: ${errCanary}%. Prediction PSI: ${psi.toFixed(3)}. Observation time: ${elapsed}s of ${minWindow}s required.${fault !== 'none' ? ` Active fault: ${fault}.` : ''} In 2–3 sentences: should I promote, hold, or roll back? Be direct.`;
