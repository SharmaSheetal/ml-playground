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
    body: `A canary release exposes a new model version to a small, controlled fraction of production traffic before a full rollout. The name comes from the coal mining practice of carrying canaries into mines as early warning systems for toxic gases - a canary dying first warned miners of danger before it reached them. In ML deployment, the canary model "fails" (degrades on observable metrics) before a regression reaches all users. The core engineering insight is blast radius control: a regression at 1% traffic affects 1% of users, not all of them, and you have time to observe and respond before the damage scales.

The mechanics: your load balancer or service mesh (Istio VirtualService, AWS ALB weighted target groups, NGINX upstream weights) routes a defined percentage of incoming requests to the new model version while the remainder continues to the stable champion. Both versions run simultaneously. At Uber's Michelangelo platform, which processes thousands of model updates weekly, canary is the default deployment path for every online model update. Uber's system gates on prediction drift (PSI of model outputs) alongside infrastructure metrics - a distinction that separates teams doing ML-aware canary from teams simply doing infrastructure canary.

The key property canary provides that no staging environment can replicate: real production traffic. Staging environments use synthetic or replayed traffic, operate at smaller data scales, do not replicate real caching behavior, and cannot reproduce the correlated, bursty nature of real user request patterns. A model that fails on real production traffic at 1% canary slice often passed all staging tests cleanly. ML behavioral regressions - subtle changes in prediction distributions, degraded performance on specific user cohorts, interactions with real feature freshness patterns - are frequently invisible in staging and only emerge under real production conditions at volume.`,
  },
  {
    heading: 'Choosing Traffic Percentages',
    body: `The traffic stages in a canary ramp are not arbitrary - each step is chosen to balance statistical power against blast radius at that stage. The key variable is not time, but accumulated request count at the canary slice. Reliable P99 latency estimation requires roughly 1,000+ requests at the canary traffic level. Reliable CTR regression detection requires 10,000+ requests. These sample requirements determine your minimum viable traffic percentage given your service's total RPS.

At a service handling 10,000 RPS: 1% canary = 100 RPS at the canary slice, which accumulates 6,000 requests in one minute - sufficient for reliable latency percentile estimation and capable of detecting a doubling of error rate. A 10% CTR regression at 1% canary traffic would take 17 minutes to reach statistical significance at 80% power. This informs the observation window duration at each stage.

At a service handling 200 RPS: 1% canary = 2 RPS, accumulating only 120 requests per minute. Latency percentile estimation at 2 RPS is unreliable. For low-traffic services, the minimum viable starting percentage is often 5–10%, with compensation through longer observation windows to accumulate the needed sample counts. The traffic stage selection is a function of volume, not of convention.

Common stage progressions and their rationale: 1% (severe regression detection, near-zero blast radius) → 5% (moderate regression detection, statistically meaningful latency distribution) → 25% (business metric preliminary signal, strong infrastructure confidence) → 50% (A/B-equivalent split for business metric statistical significance) → 100% (full promotion, champion replaced). A team that starts at 25% without going through 1% and 5% first is accepting 25x the blast radius of the minimal first stage. For a high-risk change - new model architecture, new feature set, preprocessing logic rewrite - the extra 30 minutes spent at 1% and 5% is cheap insurance. For a low-risk change (minor retrain on the same architecture and features), starting at 10% may be defensible.`,
  },
  {
    heading: 'Observation Windows - Why 30 Minutes?',
    body: `An observation window is the minimum elapsed time you must observe metrics at a given traffic percentage before promoting to the next stage. Configuring this correctly is as consequential as configuring the right threshold values - a well-tuned gate at the wrong time window will miss real regressions or generate false alarms on transient noise.

The 30-minute convention exists for three reasons that compound. First, transient noise: a P99 latency spike during pod warm-up, a brief cache miss storm after deployment, or a momentary GC pause can produce a gate-failure metric that resolves within 2–5 minutes. Five minutes of observation cannot distinguish a transient spike from a real regression. Thirty minutes of data, with rolling window averaging, can. Second, time-dependent failure modes: some ML regressions only manifest after the model has been serving for 10–20 minutes - after a feature store cache warms to the new model's access pattern, after JIT compilation in the serving framework completes, after a background indexing job completes and releases I/O bandwidth. A 5-minute window misses all of these. Third, statistical power for business metrics: CTR and conversion rate require enough samples to distinguish a real regression from sampling variance. At 5% canary traffic on a 1,000 RPS service, you accumulate 50 RPS × 30 minutes = 90,000 canary requests. A 5% CTR drop from 10% baseline to 9.5% requires approximately 100,000+ samples to detect at 80% power - meaning 30 minutes is approximately the minimum viable window for early business metric signal at this traffic level.

The operationally important distinction: the observation window is not the same as the elapsed time since deployment. If the gate fails and then recovers, the observation window clock should reset or continue with conservative accounting. Systems like Argo Rollouts restart the AnalysisRun timer if a gate failure occurs during the window, effectively requiring a clean continuous window of the full duration before promotion is allowed. A model that fails at minute 25 and recovers at minute 27 should not be promoted - the observation window should start over to confirm the recovery is stable.

For business metrics with longer feedback loops - 7-day retention, subscription conversion, downstream purchase conversion - the observation window must extend beyond 30 minutes. A recommendation model whose impact on 7-day retention cannot be measured within 30 minutes should be held at 25% or 50% for at least 48–72 hours before final promotion. The canary schedule must account for the feedback delay of the most important downstream metric, not just the feedback delay of the fastest-responding infrastructure metric.`,
  },
  {
    heading: 'Automated Gates vs. Human Judgment',
    body: `Automated canary gates are not optional at any organization deploying ML models more frequently than once per week. Human review of canary metrics under deadline pressure is demonstrably unreliable: teams rationalize borderline numbers, adjust informal thresholds to match the data they already see, and approve deployments that pre-committed gates would have blocked. The discipline of pre-specified, automated gates converts a social process (human decides) into an engineering contract (system enforces).

Argo Rollouts is the dominant open-source tool for automated canary gate enforcement in Kubernetes environments. A Rollout resource defines the canary steps declaratively: set traffic to 5%, run AnalysisRun for 30 minutes, if AnalysisRun passes set traffic to 25%, run AnalysisRun for 60 minutes, and so on. AnalysisTemplates define the Prometheus queries that constitute each gate - they are reusable across multiple Rollout definitions and can be maintained by a platform team and consumed by every model deployment without per-model configuration. Flagger is an alternative with a similar model that integrates more natively with GitOps workflows via Flux. Spinnaker provides a pipeline-based approach with richer UI for manual approval stages when human oversight is required for specific promotion steps.

Netflix's Kayenta platform exemplifies the ideal: gates evaluate metric conditions, not just elapsed time. A canary with excellent metrics can promote within minutes; a canary with borderline or failing metrics is blocked indefinitely until either the metrics improve or a human makes an explicit override decision. This is the correct model - promotion should be earned by meeting quality thresholds, not granted by surviving a timer. Kayenta's insight is that time-based gates are a proxy for metric stability: you wait 30 minutes because you expect metrics to stabilize by then. But if metrics are stable and excellent at 10 minutes, there is no engineering reason to wait 30. The timer is hiding a metric condition; better to make that condition explicit.

The threshold-specification discipline: all gate thresholds must be written into the AnalysisTemplate before the canary starts, reviewed by the team, and locked from modification during the canary run. Post-hoc threshold adjustment - "well, P99 is at 107ms which is above our 105ms threshold, but looking at the data I think that's acceptable" - is the mechanism by which bad models ship under deadline pressure. Pre-committed thresholds with automated enforcement remove this failure mode. For organizations that require flexibility, build the threshold values into a configuration file committed to git, reviewed in the PR, and enforced by the gate system - not into a UI that can be changed at runtime without audit trail.`,
  },
  {
    heading: 'When to Rollback vs. When to Hold',
    body: `Not every gate failure is a rollback trigger, and treating all threshold breaches as immediate rollback signals causes premature rollbacks that erode confidence in the deployment pipeline. The decision framework depends on the severity of the breach, the trend direction of the metric, and whether the failure is in a hard gate or a soft gate.

Immediate rollback is warranted when hard gates breach clear thresholds indicating active user harm: HTTP 5xx error rate above 5% means users are experiencing failures at a rate that is visible and damaging; P99 latency above 2x the champion baseline means 1 in 100 user requests is taking twice as long as expected; PSI on model outputs above 0.25 means the model's prediction distribution has fundamentally shifted, suggesting a preprocessing failure or major model regression. These conditions should trigger automated rollback via Argo Rollouts without human intervention - the time between gate failure detection and rollback execution should be measured in seconds, not minutes.

Hold and investigate is appropriate for soft gate breaches that may be transient or contextual: a single-tick P99 spike to 1.1x baseline that recovers within 60 seconds is a noise event, not a regression signal - the rolling window average will not breach the threshold; an error rate at 1.3% against a 1.0% threshold during the first 5 minutes of deployment when caches are cold is a warm-up artifact. The correct response is to pause promotion and accumulate more data, not to roll back immediately. The hold state (canary remains at its current traffic percentage but does not advance) is distinct from rollback (traffic returns to 0% on canary). Hold preserves the canary traffic as an ongoing signal source; rollback ends the canary experiment.

Diagnose before deciding when the signal is ambiguous: check if the issue is isolated to a specific time window (consistent with a cron job on the same cluster consuming resources), a specific user cohort (indicating a subset of inputs the model handles differently), or a specific feature value (suggesting a preprocessing edge case). The serving trace breakdown - showing feature store latency separately from inference latency separately from post-processing - is the most efficient diagnostic tool for latency-ambiguous cases. An elevated P99 that comes entirely from feature store latency is an infrastructure problem with the feature store, not a model problem. Rolling back the model would not fix it.`,
  },
  {
    heading: 'The Cost of Rolling Back Too Soon',
    body: `Premature rollbacks from over-sensitive canary gates create a compounding organizational failure mode that is more damaging than the occasional bad model that slips through with under-sensitive gates. When automated gates generate false positives - rolling back good deploys due to transient warm-up spikes, early noise in small sample windows, or thresholds set too tightly for normal variance - engineers lose trust in the system and begin bypassing it. The bypass becomes the failure mode that eventually allows a bad model to ship.

The warm-up false positive is the most common. In the first 2–3 minutes after a new model pod starts, several latency-inflating events occur simultaneously: GPU kernel compilation (CUDA kernels are JIT-compiled on first execution, adding 100–500ms to the first several requests), feature store cache population (the new pod has no local cache for recently accessed features, so the first N requests pay full database lookup latency), and TensorRT engine serialization verification (TensorRT verifies the cached engine on startup, briefly consuming GPU resources). A canary gate that evaluates P99 during this warm-up window will almost always fire a false positive. The standard mitigation is to configure a minimum sample threshold - gates should not evaluate until at least 500–1,000 requests have been processed by the canary pod - and to exclude the first 3 minutes from gate evaluation windows.

The organizational cost of frequent false-positive rollbacks accumulates through multiple channels: each rollback requires an investigation (was this a real regression or a false positive?), a re-deploy after the investigation, and a second canary ramp that repeats the observation window. For teams deploying multiple times per day, four false-positive rollbacks per week cost 8–12 engineer-hours per week in investigation and re-deploy time, plus slower release velocity for all other changes waiting behind the blocked pipeline. The correct calibration is to tune gate thresholds on historical deploy data - compute the P99 distribution during the warm-up period for the last 20 successful deployments and set thresholds at the 99th percentile of that distribution plus a buffer. This gives you a gate that fires on real regressions while tolerating normal warm-up variance.`,
  },
  {
    heading: 'Multi-Dimensional Gates',
    body: `A production-grade canary gate system is not a single P99 threshold - it is a conjunction of independent conditions evaluated across three layers that catch distinct, non-overlapping failure modes. A canary model that passes all infrastructure gates can fail business gates spectacularly, and a model that passes business metric gate preliminary checks can have a seriously degraded prediction distribution that only becomes visible through model-quality gates.

The infrastructure layer evaluates fast-feedback signals within the first 5–15 minutes: P99 latency within 5% of the champion baseline (a tight threshold that catches performance regressions while tolerating normal variance), HTTP 5xx error rate below 1%, and throughput not degraded below 95% of expected given the traffic split. These gates catch serving failures, memory leaks, dependency errors, and timeout cascades quickly. They are the trip-wire layer - if they fire, rollback immediately before investing time in longer-window analysis.

The model quality layer evaluates signals that require 15–30 minutes of accumulated data: PSI on the model's prediction output distribution below 0.1 (above 0.2 is a major distribution shift requiring investigation before any further promotion), null or fallback prediction rate not elevated above the champion baseline (a spike indicates upstream feature ingestion broke, causing the model to return default predictions silently), and output entropy distribution within historical bounds (sudden confidence spikes indicate the model is extrapolating outside its training distribution). These gates catch silent model failures - the class of failure where the serving stack is healthy but the model's predictions are systematically wrong.

The business metric layer requires 30–60 minutes of data at meaningful traffic percentages (typically applied starting at the 25% stage): CTR not degraded by more than 2% relative to the champion slice on the same traffic, conversion rate within a confidence interval computed using a two-sample proportion test against the champion, and revenue-per-request within 3% of the champion baseline. These are the ultimate validation layer - the only signals that directly measure whether the model is doing its job. Implementing Argo Rollouts AnalysisTemplates for business metrics requires exposing these metrics as Prometheus counters from the serving layer or from a downstream analytics pipeline with sufficiently low latency.`,
  },
  {
    heading: 'What to Do With the Bad Version',
    body: `After a canary rollback, the immediate operational instinct is to clean up the failed deployment - scale down the canary pods, remove the traffic weight configuration, and treat the episode as over. This is the wrong response. The failed canary deployment is the most valuable debugging artifact available, and destroying it destroys your ability to understand what went wrong and prevent it from happening again.

The failed canary pod is the only place where you can reproduce the exact failure in its production configuration. The pod contains the exact model binary, the exact preprocessing code, the exact dependency versions, and (if the pod is still running at 0% traffic) the exact in-memory model state at the time of failure. Replay production traffic logs - captured during the canary window - against the failed pod in isolation to reproduce the failure deterministically. Compare the pod's configuration, loaded model, and serving code against the champion pod line by line. Profile the failed pod under synthetic production-like load to find memory leaks that only manifest after extended operation (a class of bug invisible in staging load tests where traffic runs for minutes, not hours). None of this is possible once the pod is deleted.

Common root causes that preservation of the bad version enables discovering: a preprocessing bug (null handling, feature encoding mismatch, timezone handling for time-based features) that only surfaces at production scale or with production input distributions rather than the synthetic inputs used in staging; a model artifact that was trained on a different feature schema than the serving pipeline provides (the model was retrained after a feature engineering change but before the serving pipeline was updated, creating a schema mismatch); a memory leak in the serving framework that manifests after 20+ minutes of continuous serving but is invisible in 5-minute staging load tests.

The process after diagnosis: write a post-mortem that documents what failed, how automated gates detected it (and how quickly), how long the rollback took, and what specific gate or monitoring would have detected the issue at the pre-canary stage rather than during canary. This last point is the highest-value output of the post-mortem - each canary failure should result in a new pre-canary validation check that prevents the same failure from requiring a canary to catch it in the future. Over time, this shifts the detection point progressively earlier in the pipeline, reducing blast radius and mean time to remediation.`,
  },
  {
    heading: 'Argo Rollouts - Automating Canary Steps',
    body: `Argo Rollouts is a Kubernetes controller and set of Custom Resource Definitions that replaces the standard Kubernetes Deployment object with a Rollout resource that natively supports progressive delivery: canary, blue/green, and experiment traffic management built into the control plane. It integrates with service meshes (Istio, Linkerd), ingress controllers (NGINX, AWS ALB, Traefik), and metric providers (Prometheus, Datadog, CloudWatch, New Relic, Wavefront) to make traffic shifting and gate evaluation declarative and automated.

The Rollout spec defines canary steps explicitly as a list of operations: setWeight (adjusting the traffic percentage to the canary), pause (waiting for a specified duration or indefinitely for manual approval), and analysis (running an AnalysisRun against a referenced AnalysisTemplate). An AnalysisTemplate is a separate Kubernetes resource that defines one or more metric queries, their evaluation interval, success conditions, and failure conditions. A Prometheus AnalysisTemplate might query the P99 latency of the canary versus champion using a Prometheus rate expression, evaluate every 60 seconds, succeed if the ratio is below 1.05, and fail if the ratio exceeds 1.10. When an AnalysisRun evaluates as failed, Argo Rollouts automatically reverts the Rollout to the last stable step weight - typically 0% on the canary.

For ML deployments, the critical capability is the ability to define ML-specific AnalysisTemplates alongside infrastructure templates. A PSI AnalysisTemplate queries a Prometheus metric exported by the serving layer (prediction_score_bucket histograms from both champion and canary, with the PSI computation happening in the Prometheus query or in a separate computation that exports the PSI value as a gauge). A business CTR AnalysisTemplate queries a downstream analytics Prometheus metric (converted from Kafka event streams by a Flink job). Both are defined as AnalysisTemplates and referenced from the Rollout spec alongside the P99 latency and error rate templates. The canary only advances when all referenced AnalysisRuns succeed simultaneously.

Integration with Argo CD enables a fully automated GitOps workflow: a new model image is pushed to the container registry, the image tag in the Rollout manifest is updated in git, Argo CD detects the manifest change and applies it to the cluster, and Argo Rollouts begins the traffic progression automatically. The entire pipeline from model training completion to production canary start can be fully automated, with human oversight only required for explicit pause steps (such as the transition from 50% to 100%, which a team might want to require manual approval for). The Rollout history provides a complete audit trail of every weight change and AnalysisRun result - essential for post-mortem analysis and regulatory compliance in domains that require deployment audit logs.`,
  },
  {
    heading: 'PSI - Measuring Prediction Drift During Canary',
    body: `Population Stability Index (PSI) quantifies how much a probability distribution has shifted between two samples. In canary deployment, you compute PSI by comparing the distribution of model output scores from the canary model against the distribution from the champion model, both operating on the same incoming production traffic during the same time window. PSI is the standard drift detection metric in production ML because it is label-free - it requires only the model's output scores, not ground truth labels, which are rarely available in real time.

The formula: PSI = sum over buckets of (actual_proportion - expected_proportion) times the natural log of (actual_proportion divided by expected_proportion), where "expected" is the champion distribution and "actual" is the canary distribution. In practice, output scores are bucketed into 10–20 equally spaced bins (for a [0,1] classifier output, bins of width 0.05 or 0.1) and the proportions are computed per bucket. The industry-standard interpretation: PSI below 0.1 indicates no meaningful distribution shift and the models are behaving similarly; PSI between 0.1 and 0.2 indicates moderate shift warranting investigation before promotion; PSI above 0.2 indicates major distribution shift, and a canary gate at this threshold should halt promotion and trigger an alert.

Why PSI outperforms point-in-time accuracy during canary: accuracy requires ground truth labels for each prediction, which arrive with a delay of hours to days (a click signal, a conversion, a fraud determination after investigation). PSI requires only the model's output scores, which are available at inference time with zero delay. A PSI spike can be detected within minutes of canary traffic starting, while accuracy degradation might not be measurable for 24–48 hours. At Facebook's production ML systems, output distribution monitoring is explicitly listed as a first-class metric alongside infrastructure SLOs, with automated rollback triggers on distribution shift - precisely because it provides early regression signal without requiring labels.

The most common cause of PSI elevation during a canary that teams need to understand: the new model was trained on a different feature distribution or with different preprocessing logic than the champion. Even if the serving infrastructure is identical, a model that received slightly different feature values during training will produce a different output distribution on the same inputs. PSI detects this as distribution shift even when latency and error rate look perfectly healthy. This is the "silent model failure" scenario - the serving stack reports green on all infrastructure metrics while the model is making fundamentally different decisions than the champion. PSI in the canary gate is the specific mechanism that catches this class of failure before full rollout.`,
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
      'Limits blast radius - a regression at 1% affects 1% of users, not all',
      'ML behavioral regressions are subtle and only visible at scale - canary gives signal without full exposure',
      'Provides real production traffic (not synthetic) for validation, which staging cannot replicate',
    ],
    trap: 'Saying canary is just about being "careful." The key insight is blast radius control and real-traffic validation that staging cannot provide.',
  },
  {
    difficulty: 'mid',
    question: 'Why can\'t staging environment testing replace canary validation in production for ML models?',
    keyPoints: [
      'Staging uses synthetic or replayed traffic - it cannot replicate real user distribution, real caching behavior, or real downstream dependency state',
      'Staging database scale is typically much smaller; edge cases visible at production scale are invisible in staging',
      'ML quality regressions (output distribution drift, ranking degradation) only manifest under real user behavior - CTR drops, click patterns, and session signals cannot be simulated',
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
      'Traffic volume matters: at 10k RPS, 1% = 100 RPS - enough for reliable latency percentiles. At 100 RPS total, you may need to start higher',
    ],
  },
  {
    difficulty: 'junior',
    question: 'Your service handles 500 RPS total. At 1% canary traffic, how many RPS is the canary receiving? Is that enough for reliable P99 latency estimates, and why?',
    keyPoints: [
      '1% of 500 RPS = 5 RPS going to the canary',
      '5 RPS × 1800 seconds (30-minute window) = 9,000 requests - sufficient for a reliable P99 estimate (rule of thumb: ~1,000 requests minimum)',
      'At very low total traffic (< 20 RPS), 1% yields almost nothing - you may need to start at 5-10% to accumulate enough samples for meaningful signal',
      'Volume is necessary but not sufficient: canary traffic must also cover at least one traffic peak to represent real-world load patterns',
    ],
    trap: 'Thinking more total traffic always means 1% is safe. At 50 RPS total, 1% = 0.5 RPS - you would need hours just to get 1,000 samples. Adjust the starting percentage to your actual volume.',
  },
  {
    difficulty: 'senior',
    question: 'A team proposes skipping 1% and 5% stages and starting directly at 25% traffic. When is this defensible, and when is it reckless?',
    keyPoints: [
      'Defensible when total traffic is very low (< 20 RPS) and lower stages yield no statistically meaningful signal',
      'Defensible when the change is narrowly scoped - a config-only change, not a model logic or feature pipeline change',
      'Reckless when the model architecture changed, training data distribution shifted, or new feature inputs were added',
      'Key question: what is the blast radius if 25% fails? At 25%, one in four users is affected before any rollback signal - worth extra caution for high-risk changes',
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
      '30 minutes is a common minimum - shorter windows miss transient regressions that appear after warm-up',
      'Volume × time = confidence: at low RPS, longer windows are needed to compensate for fewer samples',
    ],
    trap: 'Saying "just watch for a few minutes." Transient spikes during warm-up look like regressions; you need enough time and sample volume to distinguish signal from noise.',
  },
  {
    difficulty: 'junior',
    question: 'Your canary has been running for 8 minutes at 1% traffic and all metrics are green. Should you promote to the next stage?',
    keyPoints: [
      'No - 8 minutes is well below the typical minimum observation window of 30 minutes',
      'Short windows miss failures that emerge after warm-up, cache cold-start, or time-of-day traffic pattern shifts',
      'Green metrics at 8 minutes only mean no failures were detected in a very small sample window - not that no failures exist',
      'Wait for the full observation window regardless of how healthy metrics appear - early green signals are unreliable',
    ],
  },
  {
    difficulty: 'senior',
    question: 'ML business metrics like click-through rate and conversion often arrive with a 24-hour delay. How does this change your observation window strategy?',
    keyPoints: [
      'Infrastructure metrics (latency, errors) fail fast - minutes. Business outcome metrics (CTR, conversion, revenue) arrive hours or days later',
      'Smart canary systems operate on dual time horizons: fast system metrics for immediate anomaly detection, slow business metrics for final validation before 100%',
      'Do not promote to 100% before at least one cycle of delayed business metric data is available - for a recommendation model this may mean waiting 24-48 hours at 25-50%',
      'Use leading indicators as proxies: dwell time, add-to-cart rate, and session length often respond faster than purchase conversions and can serve as early business signal',
    ],
    trap: 'Treating all canary gates as fast-feedback loops. Infrastructure gates are fast; business outcome gates require patience. Rushing to 100% before business metrics arrive is one of the most common real-world canary failures.',
  },

  // ── Section 4: Automated Gates vs. Human Judgment ────────────────────────
  {
    difficulty: 'senior',
    question: 'Why should canary thresholds be defined before the canary starts, not adjusted after you see the data?',
    keyPoints: [
      'Post-hoc threshold setting introduces confirmation bias - you subconsciously tune to justify the outcome you want',
      'Automated gates require pre-specified thresholds - you cannot automate on thresholds defined mid-experiment',
      'Pre-defined thresholds force stakeholder alignment before shipping pressure exists',
      'Regulatory and audit trails in some domains require pre-specified evaluation criteria',
    ],
    trap: 'Accepting that "adjusting for context" is reasonable. This is how teams rationalize shipping regressions under deadline pressure.',
  },
  {
    difficulty: 'mid',
    question: 'Netflix\'s Kayenta uses automated canary analysis to promote or rollback. What is the key difference between Kayenta\'s gate model and a naive "wait N minutes" approach?',
    keyPoints: [
      'Kayenta gates on metric conditions, not elapsed time - a canary with excellent metrics can promote in 5 minutes; a mediocre one stalls indefinitely',
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
      'Human visual inspection is subject to confirmation bias - especially under deadline pressure where there is incentive to ship',
      'Automated gates encode pre-agreed thresholds with stakeholder alignment; bypassing them means those agreements are meaningless',
      '"Looks fine" is not a reproducible or auditable decision - it cannot be reviewed in a post-mortem',
      'Each manual bypass sets a precedent and makes the next one easier to justify - the safety system degrades gradually and silently',
    ],
    trap: 'Thinking an experienced engineer\'s judgment can replace automated gates. Gates exist precisely because human judgment is inconsistent under pressure.',
  },

  // ── Section 5: When to Rollback vs. When to Hold ─────────────────────────
  {
    difficulty: 'senior',
    question: 'What is the difference between a gate failing and auto-rollback triggering? When would you want auto-rollback disabled?',
    keyPoints: [
      'Gate failing: a threshold is breached - promotion is blocked, alert fires, human investigates',
      'Auto-rollback: system automatically shifts traffic back to previous stage on gate failure - no human needed',
      'Auto-rollback is appropriate when: error rate > 5% (user-visible failures), P99 > 2× baseline (severe UX impact)',
      'Auto-rollback disabled when: the gate is a soft metric (business CTR) where human judgment is needed, or when you want to investigate while the canary is still running',
    ],
  },
  {
    difficulty: 'mid',
    question: 'What is the difference between pausing a canary at its current stage and rolling it back to 0%? When do you choose each?',
    keyPoints: [
      'Hold (pause): stops stage advancement but leaves canary traffic at the current percentage - the canary keeps running and accumulating data',
      'Rollback: shifts traffic to 0% - the canary stops serving users immediately and the champion takes all traffic',
      'Hold when a metric is borderline or possibly transient - you need more data before making a rollback call',
      'Rollback when a hard gate (error rate, P99) has clearly breached threshold - you are actively harming users and need to stop now',
    ],
    trap: 'Defaulting to rollback for every gate alert. A "not yet passing" state (window not elapsed) warrants a hold, not a rollback - premature rollbacks train teams to distrust the automation.',
  },

  // ── Section 6: Cost of Rolling Back Too Soon ──────────────────────────────
  {
    difficulty: 'junior',
    question: 'True or false: canary rollbacks are essentially free because they complete in seconds. Explain your reasoning.',
    keyPoints: [
      'False - rollbacks are operationally fast but carry real total costs beyond the execution time',
      'Engineering time: investigation, post-mortem, root cause analysis, fix development, and re-validation all take hours to days',
      'User impact: real users experienced degraded service during the canary window, even at 1% traffic',
      'Velocity cost: blocked deployments, coordination overhead, and potential delays to downstream teams waiting on the model',
    ],
    trap: 'Conflating operational execution time (seconds) with total business cost. Fast rollback is a safety property - it does not make rollbacks without consequence.',
  },
  {
    difficulty: 'senior',
    question: 'Your automated gate system has triggered three false-positive rollbacks this month - all during the warm-up period before metrics stabilize. How do you fix this without making real regressions harder to catch?',
    keyPoints: [
      'Add a warm-up exclusion: do not evaluate gates during the first 5-10 minutes while caches fill and model state stabilizes',
      'Use minimum sample thresholds: gates should not fire until N requests have been processed, preventing early-noise failures on tiny samples',
      'Audit gate sensitivity per phase: if P99 naturally spikes 20% during warm-up, use a higher threshold in that phase only - not globally',
      'Do not simply raise thresholds permanently - that trades false positives for false negatives on real regressions',
    ],
    trap: 'Fixing false positives by loosening thresholds globally. The correct fix is phase-aware gates or minimum sample requirements, not insensitive thresholds.',
  },

  // ── Section 7: Multi-Dimensional Gates ───────────────────────────────────
  {
    difficulty: 'junior',
    question: 'Name three categories of gates a production ML canary should check. What distinct failure mode does each catch?',
    keyPoints: [
      'Infrastructure gates (P99 latency, error rate): catch serving failures, memory leaks, timeout spikes - fast feedback, minutes to detect',
      'Model quality gates (prediction PSI, confidence score distribution, null response rate): catch silent model regressions invisible in infrastructure metrics',
      'Business metric gates (CTR, conversion rate, revenue per request): catch user-impact regressions that only show up in downstream outcomes',
      'Each layer catches different failures - infrastructure gates alone would promote a model with a 4% CTR regression because latency looks fine',
    ],
  },
  {
    difficulty: 'mid',
    question: 'PSI is 0.18 during your canary at 10% traffic. All infrastructure gates (P99, error rate) are passing. Do you promote?',
    keyPoints: [
      'PSI of 0.18 is in the "moderate shift" range (0.1–0.2) - this is a yellow flag, not a clear rollback signal',
      'Do not promote without understanding why the distribution shifted - could be a legitimate model improvement or a preprocessing bug',
      'Check: are the output distributions shifting in a way that makes sense? (e.g. a fraud model scoring more transactions as fraudulent after training on newer fraud patterns)',
      'Either hold and monitor for trend, or investigate the source of the PSI shift before making a decision',
    ],
    trap: 'Promoting because infrastructure gates pass. PSI > 0.1 is a model-quality gate failure - the fact that latency is fine does not mean the model is behaving correctly.',
  },
  {
    difficulty: 'senior',
    question: 'Design a canary gate strategy for a recommendation model where business-metric ground truth (click data) arrives with a 24-hour delay.',
    keyPoints: [
      'Phase 1 (hours 0–4): gate on infrastructure and model quality proxies only - PSI, null response rate, confidence score distribution',
      'Phase 2 (hour 24+): once click data is available, run a statistical significance test against champion CTR before advancing beyond 50%',
      'Use surrogate leading indicators if available: dwell time, add-to-cart, and session engagement correlate with CTR and respond faster',
      'Accept that full business metric validation takes 24 hours - plan canary stages accordingly and do not rush to 100% before day-1 data arrives',
    ],
    trap: 'Promoting to 100% before business metric data is available. A model can look healthy on infrastructure and PSI while silently degrading user experience in ways that only appear in lagged signals.',
  },

  // ── Section 8: What to Do With the Bad Version ───────────────────────────
  {
    difficulty: 'senior',
    question: 'After rolling back a canary, an engineer deletes the failed deployment pods to clean up. What critical mistake is being made?',
    keyPoints: [
      'The failed pods are the evidence - you need them to reproduce the failure, profile memory/CPU, and inspect logs at the failure state',
      'Without the failed version, you cannot diff against the champion to find the regression',
      'Without understanding root cause, the same bug will appear in the next deploy',
      'Correct process: keep at 0% traffic, schedule post-mortem, investigate, then delete after root cause is documented',
    ],
  },
  {
    difficulty: 'mid',
    question: 'You identified a one-line preprocessing bug as the root cause of a canary failure. Should you push the fix directly to 100% without running a new canary? Why or why not?',
    keyPoints: [
      'No - even a one-line fix should go through a new canary starting at 1%',
      'Preprocessing changes propagate through all downstream feature computation - a one-line fix can have non-obvious effects at scale',
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
      'Argo Rollouts uses AnalysisTemplates - Prometheus (or Datadog/New Relic) queries evaluated on a schedule at each traffic step',
      'All AnalysisRuns must succeed before the Rollout advances to the next step; failure triggers rollback',
      'Add PSI as a custom Prometheus metric: export PSI from your model serving code, scrape with Prometheus, define an AnalysisTemplate with threshold < 0.1',
      'AnalysisTemplates are reusable across Rollouts - define once in the platform team, shared by all model deployments',
    ],
    trap: 'Thinking Argo Rollouts only checks infrastructure metrics. It queries any Prometheus metric - you can gate on prediction quality metrics, business metrics, or any custom signal.',
  },
  {
    difficulty: 'mid',
    question: 'How does Argo Rollouts integrate with Argo CD in a GitOps workflow? What triggers a Rollout to begin and what controls when it advances?',
    keyPoints: [
      'Argo CD syncs Rollout manifests from git; the Argo Rollouts controller watches the manifest and manages traffic shifting via VirtualService or Ingress',
      'A Rollout begins when the container image in the manifest changes - Argo CD detects the git commit and applies the updated manifest',
      'Advancement between stages is controlled by AnalysisRuns (automated gates) and optionally by manual pause steps requiring explicit human approval',
      'Pause steps allow mixed automation and human oversight: e.g., auto-advance to 25%, then require explicit promotion before 50%',
    ],
  },

  // ── Section 10: PSI - Measuring Prediction Drift ─────────────────────────
  {
    difficulty: 'junior',
    question: 'What does a PSI of 0.04, 0.12, and 0.28 each indicate about a model\'s prediction distribution during a canary?',
    keyPoints: [
      'PSI < 0.1 (0.04): minimal drift - canary and champion distributions are effectively the same; no action needed',
      'PSI 0.1–0.2 (0.12): moderate shift - investigate before promoting; could be intentional improvement or a preprocessing issue',
      'PSI > 0.2 (0.28): significant distribution shift - high likelihood of meaningful behavioral change; gate should fail and require investigation',
      'PSI is symmetric across output buckets - it detects shifts toward both higher and lower predictions, which matters for fraud scoring and ranking models',
    ],
  },
  {
    difficulty: 'mid',
    question: 'What is the difference between "gates not yet passing" and "gates failed" in a canary? Why does this distinction matter operationally?',
    keyPoints: [
      '"Not yet passing" = observation window has not elapsed, or metrics are stable but sample size is still small - promotion blocked but not a problem',
      '"Failed" = threshold breached - active regression, alert should fire, human investigates',
      'Treating "not yet passing" as "failed" causes premature rollbacks and erodes trust in automation',
      'Good tooling surfaces this distinction: "Healthy - waiting on 18/30 minute window" vs. "ALERT - P99 threshold breached"',
    ],
  },
  {
    difficulty: 'senior',
    question: 'PSI is 0.08 at 1%, 0.09 at 5%, and 0.12 at 25% - trending upward with each stage. All other gates are passing. Do you promote to 50%?',
    keyPoints: [
      'No - a monotonically rising PSI trend is more concerning than a single reading above threshold; it suggests systematic drift that worsens with more traffic',
      'At 0.12, the gate is already at the borderline failure range (> 0.1); the upward trend makes this more alarming, not less',
      'Investigate root cause: is this a training distribution mismatch that becomes more visible at higher traffic? A preprocessing path that diverges at scale?',
      'Hold at 25% and investigate - if PSI reaches 0.2+ at 50%, you will have exposed more users to a behaviorally worse model',
    ],
    trap: 'Evaluating each PSI reading in isolation. A monotonically rising PSI across stages is a systematic signal, not noise - the trend matters as much as the threshold.',
  },
  {
    difficulty: 'senior',
    question: 'A canary passes all gates at 1%, 5%, and 25%. At 50% you notice a 4% drop in CTR, but P99 and error rate are still healthy. What do you do?',
    keyPoints: [
      'CTR drop at 50% is a business metric failure - the model is behaviorally worse even though it is technically healthy',
      'This is a silent model regression: infrastructure looks fine, user impact is real',
      'Roll back to 25% (or 0%), keep the canary running for diagnosis, check what changed in the model that would produce different recommendations',
      'This is why business metric gates at 50% are critical - a latency+error gate alone would have promoted this to 100%',
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
