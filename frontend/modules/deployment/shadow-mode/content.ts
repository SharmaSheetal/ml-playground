export interface StudySection { heading: string; body: string; }

export interface InterviewQ {
  difficulty: 'junior' | 'mid' | 'senior';
  question:   string;
  keyPoints:  string[];
  trap?:      string;
}

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'What is Shadow Mode and Request Mirroring',
    body: `Shadow mode (also called dark launch, mirroring, or shadowing) deploys a new model alongside the production model without returning its results to users. The infrastructure layer - a gateway, sidecar proxy, or load balancer - duplicates every incoming request: the original flows synchronously to the champion model, whose response is returned to the caller. A copy is dispatched asynchronously (fire-and-forget) to the shadow model, whose response is logged and discarded.

The critical design constraint is that mirroring must be fully out-of-band. The shadow path must never block, delay, or degrade the primary request path. When implemented correctly using Istio or Envoy (not NGINX, which can block), asynchronous mirroring adds less than 2ms P99 latency overhead at the gateway. This is the property that makes shadow mode risk-free: you can run a completely broken new model in shadow mode without any user impact.

Shadow mode provides a validation environment with real production traffic fidelity that no staging environment can replicate. Load tests use synthetic traffic patterns; shadow mode uses the real request distribution, including all the edge cases, bursts, unusual inputs, and temporal patterns that only appear in actual production. A model that passes all integration tests and load tests but fails on a specific category of production inputs will be caught in shadow mode before any user sees a bad prediction.

The term "dark launch" emphasizes another important use case beyond model validation: you can test serving infrastructure changes in shadow mode. A new model serving framework (migrating from TorchServe to Triton), a new hardware configuration (moving from T4 to A100 GPUs), or a new container image with a dependency upgrade can all be validated in shadow mode against real production traffic before any traffic is shifted. In practice, shadow mode often catches infrastructure issues - not just model issues - that would be invisible in synthetic testing.`,
  },
  {
    heading: 'Shadow Mode vs. Canary vs. A/B Testing',
    body: `These three strategies answer different questions and expose users to different levels of risk. They are not alternatives to each other - they are sequential stages in a responsible deployment pipeline, each building on the validation from the previous stage.

Shadow mode: zero user impact. The new model sees real production traffic and generates predictions, but users never receive those predictions. Shadow mode validates technical correctness (does the model serve without errors?) and prediction similarity (does the new model produce predictions similar to the champion?). It cannot measure any business outcome because business outcomes require users to act on predictions. Use shadow mode for the highest-risk changes: new model architectures, different feature schemas, serving infrastructure migrations.

Canary release: 1–10% of real users receive the new model's actual predictions. Their responses - clicks, purchases, fraud flags, conversions - are observable business signals. Canary validates both technical quality and early business signals at real user scale. At 1M daily users, a 1% canary is 10,000 real users. Shadow mode first, then canary, ensures that the 1% of users exposed in canary are exposed to a model that has already been validated for technical correctness.

A/B testing: two statistically defined user cohorts receive different model versions in a controlled experiment designed for causal inference. The control group (champion) and treatment group (challenger) are randomly assigned, equal in size, and measured over a statistically powered observation window. The result is a causal estimate of the model's business impact. A/B testing requires more traffic and more time than canary but provides the definitive answer to "does this model change improve business outcomes?" for high-stakes decisions.

The recommended sequence is shadow → canary → A/B test → full rollout. Skipping shadow testing and going directly to canary saves days but risks exposing real users to infrastructure-level failures that shadow testing would have caught at zero user cost. Skipping A/B testing and promoting directly from canary is defensible for low-stakes models but inappropriate when the model drives significant revenue or user experience decisions.`,
  },
  {
    heading: 'Implementing Traffic Mirroring - Istio, Envoy, NGINX, SageMaker',
    body: `Four dominant implementation approaches exist, each with distinct operational characteristics and trade-offs.

Istio VirtualService with mirror and mirrorPercentage fields is the most widely used approach in Kubernetes-based ML serving. Istio performs mirroring at the connection level (Envoy proxy layer), making it truly fire-and-forget: the shadow backend's latency or availability has zero impact on the primary request path. Istio appends "-shadow" to the Host/Authority header on mirrored requests, enabling the shadow endpoint to identify and log shadow traffic separately from primary traffic. The mirrorPercentage field allows partial mirroring (10% or 20% of traffic) without modifying the primary routing rules. Critical operational detail: Istio discards all shadow responses - it does not perform any comparison. The comparison infrastructure must be built separately.

Envoy Proxy request_mirror_policies in route configuration provides similar behavior to Istio at a lower abstraction level. Useful for teams that run Envoy directly without the Istio service mesh layer. The runtime_fraction field controls sampling rate. Like Istio, Envoy mirroring is connection-level and truly asynchronous - the shadow path is independent of the primary path.

NGINX mirror directive is simpler to configure but has a documented production failure mode: NGINX can block or delay the primary request if the mirror backend is slow, creating latency coupling between the two paths. This violates the fire-and-forget requirement for shadow testing. Teams that discover unexpected P99 latency increases after enabling NGINX mirroring are experiencing this coupling. The fix is switching to Istio or Envoy mirroring, which are designed for true connection-level independence.

AWS SageMaker Shadow Testing is a first-class managed feature released in November 2022. It routes a copy of live inference requests to a shadow variant within the same SageMaker endpoint configuration, provides a built-in comparison dashboard for latency and error rate metrics, and handles the log collection and comparison plumbing automatically. For teams already running on SageMaker, this eliminates the need to build custom logging and comparison pipelines. The trade-off is that it only works within the SageMaker ecosystem - cross-cloud or self-managed clusters must use Istio or Envoy.`,
  },
  {
    heading: 'Divergence Metrics - Exact Match, NDCG, Prediction Delta',
    body: `Istio, Envoy, and SageMaker all discard or log shadow responses but do not compare them to champion responses automatically. Building the comparison pipeline - collecting both responses, joining them on a shared correlation ID, and computing divergence metrics - is the team's responsibility. The divergence metrics chosen must match the model's output type and the deployment's risk profile.

Exact match rate measures the percentage of requests where champion and shadow produce identical discrete predictions. For binary classification (fraud/not-fraud, click/no-click), exact match rate is the primary signal. A 97% exact match rate means the models disagree on 3% of predictions. At a service handling 1M daily fraud decisions, 3% disagreement is 30,000 predictions per day where the models differ - and the distribution of those disagreements matters more than their count. Disagreements concentrated on high-value transactions are far more concerning than disagreements uniformly distributed across transaction volumes.

Prediction delta distribution applies to regression and probabilistic output models. For each request, compute |shadow_score - champion_score|. Analyze the full distribution: mean delta (systematic bias), standard deviation (variance), and tail percentiles (P95, P99). A model with low mean delta but high P99 delta is producing similar average scores but occasional extreme disagreements. Alert thresholds should be set at P95 and P99 of the delta distribution, not the mean. The mean can look fine while the tail behavior is severely anomalous.

Rank correlation (NDCG, Spearman's rho, Kendall's tau) applies to ranking and recommendation models. NDCG@K measures whether the shadow model produces a similar ordering of the top K items, with position-weighted discounts that assign more importance to top-rank disagreements than lower-rank disagreements. A shadow recommendation model that agrees on the top-1 position but disagrees on positions 5-10 is producing a very different experience if users primarily interact with the first item. Spearman's rho and Kendall's tau are useful for comparing full ranking lists rather than top-K cutoffs.

The most important operational principle for divergence metrics: define thresholds before shadow testing begins, not after seeing the data. Pre-defined gates prevent post-hoc rationalization where teams adjust thresholds to match what the shadow data shows rather than what the model's risk profile requires.`,
  },
  {
    heading: 'What Shadow Mode Cannot Validate',
    body: `Understanding the limitations of shadow mode is as important as understanding its capabilities. Teams that rely on shadow mode to answer questions it cannot answer make promotion decisions on insufficient evidence, discovering missing validation only after a production regression.

Business outcome impact is the primary limitation. Shadow predictions are generated but never shown to users. No user ever clicks, converts, or churns in response to a shadow recommendation. This means click-through rate, purchase conversion, fraud detection revenue impact, and user retention are all invisible to shadow mode. Offline metrics computed from historical data (NDCG against historical click data, AUC against historical fraud labels) suffer from algorithmic confounding: the historical data was generated by the champion model's predictions, systematically biasing evaluation toward models similar to the champion that produced that history. Business impact can only be measured in an A/B test where real users actually receive and respond to the new model's predictions.

Stateful and side-effecting behavior is invisible in shadow mode. If the model's output triggers downstream writes (payment processing, database state updates, external API calls, user notifications), the shadow model must be isolated from all write paths via read-only credentials. This isolation means the shadow model is never tested in the full production environment it will eventually operate in. Write-path failures, cache contention under concurrent write load, and downstream API rate limiting triggered by writes are all failure modes that shadow mode cannot surface.

Feedback loop effects are a particularly subtle limitation for recommendation and personalization models. In production, the champion model's recommendations shape which items users see, click, and engage with. These interactions feed back into training data for future model versions. A shadow model that generates different recommendations would, if promoted, shift the distribution of user interactions, changing the training signal for future models. Shadow mode tests the model in isolation from this feedback loop, so it cannot validate how the model's deployment will affect the training data distribution over time. This is a known limitation acknowledged by teams at Twitter, YouTube, and Netflix in their published work on recommendation system feedback loops.

Distribution shift over time is also invisible to shadow mode. Shadow testing runs on current traffic. If the model is designed to operate three months from now after a new product feature launches or a user cohort shift, shadow mode on today's traffic may not be representative. This is particularly relevant for models trained on data from a different period than when shadow testing runs - the shadow results reflect current traffic, not the traffic distribution the model was trained to serve.`,
  },
  {
    heading: 'Handling Stateful Models in Shadow Mode',
    body: `When model outputs trigger downstream actions with side effects - authorizing payments, writing fraud decisions to a database, sending notifications, updating user state - the shadow model must operate in a strictly isolated, read-only mode. This isolation is enforced through several complementary mechanisms, each of which addresses a different failure mode if omitted.

Read-only IAM roles and service account credentials are the primary enforcement mechanism. Shadow model pods must be provisioned with service account credentials that permit only read operations: reads from feature stores, reads from model artifact stores, writes only to a dedicated shadow logging table or stream. No write access to production databases, message queues, external payment APIs, or any service that has business consequences for write operations. This is not a best-effort convention - it must be infrastructure-enforced. A shadow model that can write to production storage may write under certain code paths that are not anticipated during setup.

Separate feature store replicas prevent shadow model reads from affecting production cache metrics and read patterns. If the shadow model reads from the production feature store's primary serving path, its reads warm the cache with shadow traffic patterns, potentially evicting items that production traffic would have benefited from. More subtly, shadow model reads can create confounding in feature store performance metrics - elevated cache hit rates caused by shadow traffic may obscure genuine production degradation. The correct configuration uses a read-only replica of the feature store for shadow model requests.

No external API calls is a constraint that must be explicitly reviewed in the shadow model's code path. Even read operations on external APIs can have side effects: they consume API rate limit quota, create entries in audit logs, trigger billing, or cause the external service to update caches or rate limiting counters. For models that call third-party enrichment APIs (IP reputation, address validation, credit bureau lookups), shadow mode must either use a mock/replay implementation of those APIs or skip those enrichment calls and use default values.

The consequence of these isolation requirements is that shadow mode tests prediction logic in a controlled sandbox, not in the full stateful operational context the model will eventually operate in. This is an inherent limitation: the isolation that makes shadow mode safe is also what prevents it from testing the full production environment. Write-path behavior, operational side effects at scale, and interactions with downstream stateful systems can only be validated during canary, when the model is running in the real production environment at limited traffic scale.`,
  },
  {
    heading: 'Cost Implications of Shadow Testing',
    body: `Shadow mode doubles the compute cost of inference for the percentage of traffic being mirrored. This is not a small cost at production scale. A service handling 10M daily predictions at $0.50 per 1,000 inferences costs $5,000 per day for production serving. Running shadow at 100% traffic doubles this cost to $10,000 per day for the duration of the shadow test. At Uber's scale of 15M+ predictions per second at peak, 100% shadow mirroring is not operationally viable without a budget explicitly allocated for it.

Partial traffic mirroring (10–20%) is the standard mitigation and is statistically sufficient for the primary purpose of shadow testing. Shadow testing aims to detect systematic divergences - cases where the shadow model behaves differently from the champion model in a way that is consistent enough to be detectable. Systematic divergences (a model that consistently scores one user segment differently, a preprocessing bug that consistently produces wrong values for null inputs) are detectable at 10% traffic sampling because they appear consistently. Random noise in model outputs is not what shadow testing is designed to detect - that requires A/B testing with statistical power analysis.

Spot instance and preemptible compute for shadow inference is a natural fit because shadow inference has no latency SLA that users are waiting on. If a spot instance is preempted during shadow inference, the shadow request is simply lost (no retry needed - the user already received their response from the champion). This allows shadow infrastructure to run at spot pricing (typically 60-90% discount from on-demand pricing), dramatically reducing the incremental cost of shadow testing.

Queue-based asynchronous shadow processing decouples shadow compute from the real-time serving critical path entirely. Rather than duplicating requests inline and dispatching to a shadow endpoint immediately, the gateway writes request payloads to a message queue (Kafka topic, SQS queue) without waiting for acknowledgment. A separate shadow processing service reads from the queue, runs shadow inference on a separate compute fleet, and logs the comparison results. This architecture allows shadow compute to be shifted to off-peak hours, run on preemptible instances that may have latency variability, and independently scaled without affecting the production serving fleet.

Time-bounding shadow tests prevents open-ended compute spend. Define the observation window before the shadow test begins: "shadow test runs for 7 days or until we achieve 1M comparison examples, whichever comes first." At 10% of 500K daily requests, 7 days produces 350K shadow comparisons - sufficient for robust divergence detection on most production models. Indefinite shadow tests that run for weeks or months represent unmanaged compute spend and often indicate a shadow test that has not had a clear promotion decision process defined.`,
  },
  {
    heading: 'Building a Comparison Pipeline',
    body: `Istio and Envoy discard shadow responses. SageMaker Shadow Testing provides some built-in comparison, but for custom metrics and segment analysis, a purpose-built comparison pipeline is necessary. The pipeline has five components that must work together: correlation ID injection, response logging, stream joining, divergence computation, and alerting.

Correlation ID injection happens at the gateway layer before the request is split to champion and shadow. A unique request ID (UUID or a composite of session ID plus timestamp plus request sequence number) is injected into the HTTP headers of both the champion request and the shadow request. This ID is the join key that allows the downstream comparison job to match the champion's response to the corresponding shadow response. Without correlation ID propagation, the comparison pipeline has no basis for joining outputs and cannot produce per-request comparisons.

Response logging requires both the champion model serving code and the shadow model serving code to log their outputs asynchronously alongside the correlation ID. The log destination can be a Kafka topic, a BigQuery streaming insert, or an S3 bucket with time-partitioned Parquet files. The log record includes: correlation ID, model version ID (champion or shadow), timestamp, input feature hash (for debugging disagreements), output prediction or scores, and the request's feature segment labels if segment-level analysis is required. Logging must be asynchronous and non-blocking - adding synchronous logging overhead to the serving critical path defeats the purpose.

Stream joining processes champion and shadow log streams to produce comparison records. A streaming job (Flink, Spark Structured Streaming, or Dataflow) reads from both log streams, joins on correlation ID with a configurable time window (shadow responses may arrive slightly later than champion responses), and emits a comparison event containing both outputs. The comparison event is the atomic unit that downstream analysis consumes. Kafka Streams can perform this join efficiently for services where both streams are on the same Kafka cluster.

Divergence computation and alerting are the outputs of the comparison pipeline. A continuous job or scheduled batch job aggregates comparison events and computes divergence metrics per feature segment, per time window, and across the full traffic. When computed metrics breach pre-defined thresholds - exact match rate below X%, prediction delta P95 above Y, NDCG below Z - automated alerts fire to PagerDuty, Slack, or the team's incident management system. These alerts must also include context: which segment is breaching the threshold, how long the breach has been active, and whether the breach is worsening or stabilizing.`,
  },
  {
    heading: 'Shadow Mode for Batch and Offline Models',
    body: `Real-time serving models can be shadow tested by duplicating live inference requests. Batch models - those that run as scheduled jobs to score large populations (nightly churn prediction, weekly credit rescoring, daily recommendation precomputation) - require a different approach because there is no live request stream to mirror.

Parallel backtest or replay is the primary approach for batch models. Both the champion and shadow model are run against the same input dataset - typically the most recent production batch input snapshot or a historical batch from a known-good data window. Their outputs are compared offline: exact match rate, score delta distribution, rank correlation across user segments. This is straightforward to implement and costs approximately what a second training or scoring run would cost, since batch inference on optimized compute is much cheaper than real-time serving (typically 5-10× lower cost per prediction due to higher parallelism and no latency constraints).

The fundamental limitation of batch replay compared to real-time mirroring is feature freshness. A replay uses features computed at a fixed historical timestamp. If the batch model uses features that reflect near-real-time state - "user's spend in last 24 hours," "number of active sessions in last hour" - replay from a historical snapshot may not exercise the model in the conditions it will actually face at serve time. The shadow model in production would receive features at actual freshness; replay validation misses freshness-related behavioral differences. For slowly-changing features (historical spend, account age, demographic attributes), this limitation is minor. For rapidly-changing features, real-time comparison is preferable.

Load and concurrency behavior is another dimension that batch replay cannot test. Batch jobs typically run on isolated compute clusters. Shadow replay does not test how the new model performs when running in the production batch infrastructure alongside other jobs competing for I/O, memory, and compute resources. A model that takes 3 hours in isolation may take 5 hours when competing with other overnight batch jobs for the same Spark cluster resources. Staging environment validation is needed for this scenario.

Uber's Hue platform distinguishes between endpoint shadowing (real-time traffic duplication for high-stakes latency-sensitive models) and batch replay shadowing (for development validation of models where the primary output is a scored dataset). Teams at Airbnb use offline replay for the majority of their recommendation model validation but require real-time shadow testing for pricing models where serving infrastructure behavior and feature freshness are both critical to validate before promotion.`,
  },
  {
    heading: 'From Shadow to Canary - The Promotion Decision',
    body: `Shadow mode produces evidence for a promotion decision - it does not make the decision. The promotion decision process must be designed before shadow testing begins, not after the shadow data is collected. Post-hoc threshold adjustment to rationalize a promotion decision is the statistical equivalent of p-hacking: it produces confident-looking justifications for decisions that were made on intuition and then retroactively supported with data.

Shadow promotion gates are the pre-defined criteria that must be met for promotion to canary. The gate set for a given model should reflect the model's risk profile and what shadow testing is designed to validate. A set of common gates for a recommendation model: shadow P99 latency within 120% of champion P99 (allows for cold-start effects and shadow infrastructure variance without masking significant regressions), shadow error rate below 2× the champion's baseline error rate, NDCG@10 correlation between champion and shadow above 0.88 (a threshold set from retrospective analysis of models that succeeded and failed in previous canary deployments), and prediction delta P95 below 0.08 (calibrated from analysis of score distribution widths in stable models). All gates must pass simultaneously - a model with excellent NDCG but unacceptable error rate does not pass.

The observation window and sample volume requirements are distinct from the gate thresholds. Gates specify what constitutes a pass; the observation window specifies how long to collect data before evaluating the gates. The minimum observation window must include at least one instance of every significant traffic pattern: at least one weekly peak, at least one off-peak period, and at least one unusual traffic event if the service has regular unusual traffic patterns (end-of-month billing spikes, seasonal events). Statistical confidence in divergence metrics also requires sufficient sample volume - typically 500K to 1M comparison examples before divergence estimates are stable.

What shadow promotion does not mean is as important as what it does mean. Passing shadow gates certifies technical parity: the shadow model does not meaningfully degrade latency, error rate, or prediction distribution relative to the champion. It does not certify that the shadow model is better than the champion - that claim requires an A/B test. It does not certify that the shadow model will produce better business outcomes - that requires measuring real user responses in canary and A/B testing. Shadow promotion is permission to expose a small fraction of real users to the new model's predictions, not permission to declare the model an improvement.

Building organizational confidence through shadow mode is a valuable but underappreciated secondary outcome. When a product manager asks "how confident are we that this new recommendation model won't hurt user experience?", a shadow test result showing 97% exact match rate, sub-2% error rate, and P99 latency matching the champion provides concrete evidence that reduces the anxiety of canary exposure. Shadow mode serves as much an organizational communication function as a technical validation function: it makes the deployment risk visible and quantifiable before any user is affected.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is shadow mode deployment for ML models, and how does request mirroring work?',
    keyPoints: [
      'Shadow mode deploys a new model alongside production without returning its responses to users',
      'The gateway duplicates each incoming request: original goes synchronously to the champion (response returned to user), copy goes asynchronously to the shadow (response logged and discarded)',
      'The shadow path must be fire-and-forget - it must never block or delay the primary request path',
      'When implemented correctly, asynchronous mirroring adds < 2ms P99 overhead at the gateway',
    ],
    trap: 'Saying shadow mode is a type of canary release. They are fundamentally different: canary returns new model responses to a fraction of users; shadow mode never returns new model responses to any user.',
  },
  {
    difficulty: 'mid',
    question: 'A team deploys a shadow model and notices the gateway P99 increased from 85ms to 120ms. What likely went wrong?',
    keyPoints: [
      'The shadow path is not truly asynchronous - it is blocking the primary request path',
      'Common cause: using NGINX mirroring, which can delay the original request if the mirror backend is slow',
      'Fix: switch to Istio or Envoy mirroring (connection-level, truly fire-and-forget) or implement proper async queuing',
      'A correct shadow implementation should add < 2ms P99 overhead regardless of shadow model latency',
    ],
    trap: 'Blaming the shadow model\'s latency for the gateway increase. The shadow model\'s performance is irrelevant to gateway latency if the shadow path is correctly decoupled. The problem is architectural - the paths are coupled.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between shadow mode, canary release, and A/B testing? When do you use each?',
    keyPoints: [
      'Shadow mode: zero user impact, validates technical correctness and prediction similarity - cannot measure business outcomes',
      'Canary release: 1-10% of users receive new model responses - validates technical quality and early business signals at real scale',
      'A/B testing: two user cohorts receive different model versions in a statistically controlled experiment - measures true business impact',
      'Recommended sequence: shadow → canary → A/B test → full rollout. Each step builds on the previous.',
    ],
  },
  {
    difficulty: 'senior',
    question: 'A product manager argues that shadow mode is unnecessary since you can just start a canary at 1% traffic - which has very low blast radius. How do you respond?',
    keyPoints: [
      'Shadow mode and canary answer different questions: shadow validates technical correctness risk-free; canary exposes real users (even 1% = thousands of users at scale)',
      'Shadow mode is essential for major changes: new model architecture, different feature schema, new output format - where even 1% canary exposure could cause user-visible failures',
      'Shadow mode validates serving infrastructure separately from model quality - container changes, hardware migrations, and framework upgrades should be shadow-tested before any canary',
      'At 1M daily users, 1% canary = 10,000 users experiencing a potential regression. Shadow mode costs zero users.',
    ],
    trap: 'Agreeing that shadow is unnecessary. Shadow mode is the appropriate first step for high-risk changes precisely because it has zero blast radius - which no canary percentage can match.',
  },
  {
    difficulty: 'mid',
    question: 'Name two ways to implement traffic mirroring in a Kubernetes ML serving environment and compare their trade-offs.',
    keyPoints: [
      'Istio VirtualService with mirror and mirrorPercentage: connection-level fire-and-forget, does not affect primary path latency, requires service mesh setup',
      'Envoy request_mirror_policies: similar behavior, lower-level control, requires more configuration - used when not using Istio',
      'NGINX mirror directive: simpler to set up but known pitfall - can delay primary request if mirror backend is slow',
      'AWS SageMaker shadow testing: managed first-class support with built-in comparison dashboard - appropriate for teams on AWS infrastructure',
    ],
  },
  {
    difficulty: 'junior',
    question: 'You implement shadow mode using NGINX mirroring. Users start reporting increased latency. What is the likely cause?',
    keyPoints: [
      'NGINX mirroring can couple the primary request path to the mirror path - if the shadow backend is slow, NGINX may delay the original request',
      'This violates the fire-and-forget requirement for shadow mirroring',
      'Fix: switch to Istio or Envoy mirroring, which handle mirroring at the TCP connection level and are truly asynchronous',
      'Always load test shadow mirroring under production-like conditions before enabling in production',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Your champion and shadow fraud models have a 96% exact match rate. Can you confidently promote the shadow to canary? What additional analysis is needed?',
    keyPoints: [
      '96% exact match means they disagree on 4% of predictions - at high-stakes transaction volumes, this could be thousands of misclassified transactions per day',
      'Segment-level analysis is essential: disaggregate disagreements by transaction value tier, user segment, merchant category - the 4% may be concentrated on high-value transactions',
      'Analyze the direction of disagreement: is the shadow more aggressive (more false positives) or more permissive (more false negatives) than the champion?',
      'At minimum, review disagreement samples manually - understand whether disagreements represent improvements, regressions, or neutral differences',
    ],
    trap: 'Treating aggregate exact match rate as sufficient validation. High-value edge cases are often in the tail of the distribution - they require segment-level analysis, not aggregate statistics.',
  },
  {
    difficulty: 'senior',
    question: 'Design a divergence comparison pipeline for a recommendation model serving 500k users daily. What metrics would you compute, and what thresholds would you use to gate shadow promotion?',
    keyPoints: [
      'NDCG@10: rank correlation at top 10 recommendations - gate threshold ≥ 0.92 (shadow must produce similar top-10 lists)',
      'Exact match rate on position-1 recommendation (the item most users click first) - gate threshold ≥ 90%',
      'Prediction delta P95 for raw scores - gate threshold ≤ 0.05 (scores should not diverge dramatically)',
      'Segment-level NDCG disaggregated by user activity tier, platform (mobile/web), and geography - detect systematic regressions on specific cohorts',
      'Define gates before shadow testing begins - not after seeing the data - to prevent confirmation bias',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Why can\'t shadow mode validate the business impact of a new recommendation model, even if offline NDCG metrics look excellent?',
    keyPoints: [
      'Shadow predictions are never shown to users - no user ever clicks or not-clicks on a shadow recommendation',
      'Offline NDCG computed against historical click data is confounded by the champion model\'s historical policy - the data was generated by users responding to champion recommendations, not shadow recommendations',
      'This is algorithmic confounding: historical click data systematically favors models similar to the champion that produced that history',
      'Business impact (CTR, revenue, engagement) requires an A/B test where real users actually receive and act on the new model\'s recommendations',
    ],
    trap: 'Accepting that high offline NDCG means the model will produce better business outcomes. Shadow mode validates technical correctness; only A/B testing validates business value.',
  },
  {
    difficulty: 'senior',
    question: 'Your team has a payment authorization model. Shadow mode tests pass perfectly - latency is good, predictions look similar. A junior engineer proposes deploying directly to 100%. What risks is she missing?',
    keyPoints: [
      'Shadow mode ran the model in a read-only isolated sandbox - it was never tested with live write paths (payment processing, fraud database writes, account state updates)',
      'Stateful side effects at scale may differ from sandbox behavior - cache contention, write-path latency, database lock behavior under load',
      'Shadow mode cannot detect that the new model changes the approve/decline decision on a specific class of edge-case transactions at scale (rare inputs that appear more frequently at 100% traffic)',
      'Operational readiness is also missing: rollback procedures, alerting thresholds for the new model, runbooks - canary provides a low-blast-radius environment to validate these',
    ],
  },
  {
    difficulty: 'junior',
    question: 'What constraints must a shadow model satisfy when the production model\'s outputs trigger downstream database writes?',
    keyPoints: [
      'Shadow model must run with read-only credentials - no write access to production databases, message queues, or external APIs',
      'If the shadow model needs to store its predictions for comparison, it writes to a dedicated shadow results table, never to the production results table',
      'The shadow model must not call any external API that has side effects (payment processors, email services, inventory systems)',
      'Feature store reads should come from a read-only replica, not the production write path - to avoid polluting production cache metrics',
    ],
  },
  {
    difficulty: 'mid',
    question: 'What failure mode can shadow mode NOT catch for a stateful model, even with perfect shadow gate results?',
    keyPoints: [
      'Shadow model runs in a sandbox with read-only credentials and isolated caches - it is never tested in the full production stateful context',
      'Failures that only appear in the write path (database lock contention, cache invalidation race conditions, downstream API rate limiting triggered by writes) are invisible to shadow mode',
      'Once the model is promoted and starts actually writing to production systems, new failure modes can emerge that shadow testing never exposed',
      'This is why canary is still needed after shadow: canary runs the model in the real stateful environment at low traffic, catching write-path and operational issues that shadow never saw',
    ],
  },
  {
    difficulty: 'junior',
    question: 'True or false: shadow mode is a free validation technique with no additional compute cost. Explain.',
    keyPoints: [
      'False - shadow mode doubles compute for the percentage of traffic being mirrored',
      'At 100% mirroring, you pay for two model inference calls for every user request',
      'Mitigations: shadow only 10-20% of traffic (statistically sufficient for systematic divergence detection), use spot/preemptible instances for the shadow path, time-bound the shadow test',
      'Queue-based shadow (write requests to a queue, process asynchronously) allows shadow compute to run on spot instances during off-peak hours',
    ],
    trap: 'Thinking shadow mode is free because users see no impact. There is no user impact, but there is compute cost.',
  },
  {
    difficulty: 'senior',
    question: 'Design a cost-efficient shadow testing strategy for a service handling 2M requests per day at $0.50 per 1,000 inferences.',
    keyPoints: [
      'Shadow only 10% of traffic (200k requests/day) - sufficient statistical coverage at 1/10th the cost of 100% mirroring',
      'Route shadow requests through a queue (Kafka/SQS) and process asynchronously on spot/preemptible GPU instances during off-peak hours (2am-6am)',
      'Time-bound the shadow test: 7 days provides 1.4M shadow evaluations - sufficient for robust divergence detection',
      'Total incremental cost: 200k × 7 days × $0.0005 = $700 vs. $7,000 for 100% mirroring at full compute cost. Plus spot discounts reduce this further.',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Walk through the components needed to build a shadow mode comparison pipeline from gateway to alert.',
    keyPoints: [
      'Correlation ID injection at gateway: unique request ID injected into both champion and shadow requests before forwarding',
      'Response logging: both model endpoints log predictions + correlation ID to a shared streaming store (Kafka topic or BigQuery streaming insert)',
      'Streaming join job: Flink or Spark Streaming joins champion and shadow logs by correlation ID, computes divergence metrics in near-real-time',
      'Alert thresholds: automated gate checks (exact match rate, NDCG, delta P95) fire PagerDuty/Slack alerts when breached',
      'Dashboard: segment-level divergence metrics disaggregated by user tier, geography, input feature ranges',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Your ML model runs as a nightly batch job scoring 5M users. How would you implement shadow mode for this model?',
    keyPoints: [
      'Parallel backtest / replay: run champion and shadow models against the same input snapshot from the most recent production batch run',
      'Compare outputs offline: exact match rate, score delta distribution, rank correlation across user segments',
      'Cost advantage: batch inference on optimized GPU instances costs ~1/10th per prediction vs real-time serving',
      'Limitation: replay does not test feature freshness behavior or under-load behavior - but these matter less for a nightly batch job than for real-time models',
    ],
  },
  {
    difficulty: 'senior',
    question: 'When is batch replay shadow testing insufficient, and real-time traffic mirroring required? Give a concrete example.',
    keyPoints: [
      'Batch replay is insufficient when the model\'s behavior depends on real-time feature freshness - e.g., a fraud model using "transactions in the last 5 minutes" as a feature',
      'Real example: a real-time fraud model replay uses features computed at a fixed historical timestamp; in production, those features are computed at request time. The replay misses freshness-driven behavioral differences.',
      'Also insufficient when testing serving infrastructure: latency regressions, memory pressure under concurrent load, and cache behavior only appear under real production traffic patterns',
      'Rule of thumb: if the model is latency-sensitive, uses real-time features, or involves infrastructure changes - use real-time mirroring, not replay',
    ],
  },
  {
    difficulty: 'junior',
    question: 'Shadow mode tests all passed. What does this mean, and what is the next step?',
    keyPoints: [
      'Shadow gates passing means the new model shows technical parity: similar latency, error rate, and prediction similarity to the champion',
      'It does NOT mean the model is better - business impact (CTR, conversion, revenue) is unknown',
      'Next step: promote to canary at 1% traffic to begin measuring real user impact at low blast radius',
      'Shadow mode is the prerequisite for canary, not a replacement for it',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Define the gates you would set before starting shadow mode for a ranking model, and explain why each threshold was chosen.',
    keyPoints: [
      'Shadow P99 ≤ 120% of champion P99: shadow latency must not be dramatically worse; 20% headroom accounts for cold-start and jitter without masking real regressions',
      'Shadow error rate < 2%: double the champion\'s typical 1% error rate - allows some tolerance for shadow environment differences',
      'NDCG@10 ≥ 0.90: shadow rankings must correlate highly with champion at top positions; 0.90 threshold balances stability with allowing improvements',
      'Prediction delta P95 ≤ 0.08: absolute score difference at the 95th percentile must be small - detects systematic shifts in model confidence calibration',
      'All gates pre-defined before shadow testing begins to prevent post-hoc rationalization',
    ],
  },
];

export const AI_PROMPT_TEMPLATE = (
  mirrorPct: number,
  champP99: number, shadowP99: number,
  champErr: number, shadowErr: number,
  exactMatch: number,
  ndcg: number,
  fault: string,
) =>
  `I am running shadow mode with ${mirrorPct}% traffic mirrored. Champion P99: ${champP99}ms, Shadow P99: ${shadowP99}ms. Champion error rate: ${champErr}%, Shadow: ${shadowErr}%. Exact match rate: ${exactMatch.toFixed(1)}%. NDCG rank correlation: ${ndcg.toFixed(3)}.${fault !== 'none' ? ` Active fault: ${fault}.` : ''} In 2-3 sentences: should I promote to canary, hold and investigate, or abandon this shadow test? Be direct.`;
