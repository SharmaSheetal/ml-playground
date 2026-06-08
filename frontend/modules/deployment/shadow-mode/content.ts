export interface StudySection {
  heading:  string;
  body:     string;
  keyTerms: string[];
  quiz:     { q: string; a: string }[];
  practice: string[];
}

export interface InterviewQ {
  difficulty: 'junior' | 'mid' | 'senior';
  question:   string;
  keyPoints:  string[];
  trap?:      string;
}

// ── Study Content ──────────────────────────────────────────────────────────────

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'What is Shadow Mode and Request Mirroring',
    body: `Shadow mode (also called dark launch, mirroring, or shadowing) deploys a new model alongside the production model without returning its results to users. The infrastructure layer — a gateway, sidecar proxy, or load balancer — duplicates every incoming request: the original flows synchronously to the champion model, whose response is returned to the caller. A copy is dispatched asynchronously (fire-and-forget) to the shadow model, whose response is logged and discarded.\n\nThe critical design constraint is that mirroring must be fully out-of-band. The shadow path must never block, delay, or degrade the critical request path. When implemented correctly, asynchronous mirroring adds less than 2ms P99 latency overhead at the gateway. Shadow mode provides risk-free validation: the new model sees real production traffic at full fidelity — real users, real inputs, real timing — without ever affecting a single user's experience.`,
    keyTerms: ['Request mirroring', 'Champion model', 'Shadow model', 'Asynchronous fire-and-forget', 'Dark launch', 'Out-of-band shadow path'],
    quiz: [
      { q: 'What happens to the shadow model\'s response in a correctly implemented shadow deployment?', a: 'It is logged for offline comparison and discarded — it is never returned to the user.' },
      { q: 'What is the most critical design constraint for the shadow path?', a: 'It must be fully asynchronous and out-of-band — it must never block, delay, or degrade the primary request path.' },
    ],
    practice: [
      'Draw the request flow for shadow mode: user → gateway → champion (sync, returns to user) + shadow (async, logged only).',
      'Explain to a non-technical PM why shadow mode users "never know" the new model is running.',
    ],
  },
  {
    heading: 'Shadow Mode vs. Canary vs. A/B Testing',
    body: `These three strategies are not interchangeable — they answer different questions and expose users to different levels of risk.\n\nShadow mode: zero user impact, validates technical correctness and prediction similarity. Cannot measure business outcomes. Use when you need to validate a major model change (new architecture, different feature schema) with zero risk tolerance.\n\nCanary release: exposes 1–10% of real users to the new model's actual responses. Validates both technical quality and early business signals (error rate, latency). Cannot validate full business metric impact (CTR, conversion) at small traffic fractions. Use when shadow testing has already validated prediction quality.\n\nA/B testing: routes two user cohorts to different model versions for a statistically powered experiment. Measures true business impact. Requires large traffic and long duration for statistical significance. Use when you need to prove business value before full rollout.\n\nThe recommended sequence is shadow → canary → A/B test → full rollout. Shadow mode is not a replacement for canary; it is the step before it.`,
    keyTerms: ['Shadow mode', 'Canary release', 'A/B testing', 'User impact', 'Business metric validation', 'Deployment sequence'],
    quiz: [
      { q: 'Which deployment strategy can validate business impact (CTR, conversion) — shadow, canary, or A/B test?', a: 'Only A/B testing (and to some extent canary at meaningful traffic percentages). Shadow mode and early canary stages cannot measure business outcomes because users never act on the shadow/canary predictions in the same statistically controlled way.' },
      { q: 'In what order should these strategies be used for a major ML model upgrade?', a: 'Shadow → canary → A/B test → full rollout. Shadow validates technical correctness, canary validates at real user scale, A/B test proves business value.' },
    ],
    practice: [
      'A team is replacing their fraud detection model with a new architecture. They have zero tolerance for false negative increase. Which deployment strategy should they use first and why?',
      'Explain why high shadow mode exact-match rate alone is insufficient justification to skip canary.',
    ],
  },
  {
    heading: 'Implementing Traffic Mirroring — Istio, Envoy, NGINX, SageMaker',
    body: `Four dominant implementation approaches:\n\nIstio (most common in Kubernetes ML serving): Configured via VirtualService with a mirror and mirrorPercentage field. The mirrorPercentage field controls what fraction of traffic is shadowed — you can shadow 100% initially then reduce. Istio appends -shadow to the Host/Authority header on mirrored requests. Critical limitation: Istio performs no response comparison — it discards shadow responses. You must build your own logging and comparison pipeline.\n\nEnvoy Proxy: Uses request_mirror_policies in route config. Same -shadow hostname suffix behavior. The runtime_fraction field controls sampling rate. Raw Envoy gives lower-level control but requires more configuration.\n\nNGINX: Uses the mirror directive. Known production pitfall: NGINX can delay the original request if the mirror backend is slow, violating the fire-and-forget requirement. Istio/Envoy handle this at the connection level and do not have this problem.\n\nAWS SageMaker: First-class shadow testing support. Routes a copy of live inference requests to a shadow variant within the same endpoint, provides a built-in comparison dashboard for latency and error rates, and lets you discard or log shadow responses. Productized in November 2022.`,
    keyTerms: ['Istio VirtualService', 'mirrorPercentage', 'Envoy request_mirror_policies', 'NGINX mirror directive', 'SageMaker shadow testing', '-shadow hostname suffix'],
    quiz: [
      { q: 'What is the key pitfall of NGINX mirroring compared to Istio or Envoy mirroring?', a: 'NGINX can delay the original request if the mirror backend is slow, creating latency coupling between primary and shadow paths. Istio and Envoy handle mirroring at the connection level and are truly fire-and-forget.' },
      { q: 'After configuring Istio traffic mirroring, where do shadow responses go?', a: 'They are discarded by Istio. You must build your own logging and comparison pipeline to capture and compare shadow responses.' },
    ],
    practice: [
      'Write a conceptual Istio VirtualService configuration that mirrors 20% of traffic to a shadow model endpoint.',
      'Explain what the -shadow suffix on Istio mirrored requests enables in your comparison pipeline.',
    ],
  },
  {
    heading: 'Divergence Metrics — Exact Match, NDCG, Prediction Delta',
    body: `Istio, Envoy, and NGINX discard shadow responses by default. To compare outputs, you must log both champion and shadow responses with a shared correlation ID (injected at the gateway) and run comparison offline or in a streaming pipeline.\n\nKey divergence metrics:\n\nExact match rate: The percentage of requests where champion and shadow produce identical predictions. Used for classification models. Low exact match is not always a problem — it depends on whether disagreements are systematic or isolated to edge cases.\n\nPrediction delta distribution: For regression models, the distribution of |shadow_score - champion_score|. Alert thresholds are typically set at P95 and P99 of this distribution. A shift in the mean indicates systematic bias; a widening of the distribution indicates increased variance.\n\nRank correlation (NDCG, Spearman's rho): For ranking and recommendation models. NDCG@K measures whether the shadow model produces a similar ordering of items at the top K positions, with position-weighted discount for top-rank disagreements.\n\nKL divergence / Jensen-Shannon divergence: For probabilistic outputs. Detects distribution shift in model output across a population.\n\nCritical insight: high exact match rate does not mean models are equivalent. Two models can have 98% exact match but systematically disagree on your highest-value users or highest-stakes edge cases. Segment-level analysis is essential.`,
    keyTerms: ['Exact match rate', 'Prediction delta P95', 'NDCG rank correlation', 'KL divergence', 'Correlation ID', 'Segment-level analysis'],
    quiz: [
      { q: 'Your champion and shadow models have 97% exact match rate. Can you safely promote the shadow model?', a: 'Not necessarily. 97% exact match means the models disagree on 3% of predictions. If those disagreements are concentrated on your highest-value users or most fraud-sensitive transactions, it could be a critical problem. You need segment-level analysis, not just aggregate match rate.' },
      { q: 'What metric would you use to compare a recommendation model\'s shadow vs champion outputs?', a: 'NDCG (Normalized Discounted Cumulative Gain) at K — it measures ranking quality at the top positions with position-weighted discounts, capturing whether top recommendations agree.' },
    ],
    practice: [
      'Design a comparison pipeline for a fraud scoring model: what metrics would you compute, at what granularity, and what thresholds would trigger an alert?',
      'Explain the purpose of injecting a correlation ID at the gateway layer.',
    ],
  },
  {
    heading: 'What Shadow Mode Cannot Validate',
    body: `This is where most interview candidates lose points. Shadow mode has fundamental limitations that practitioners must understand.\n\nFeedback loops: In recommender systems, shadow model predictions are never shown to users. Therefore you cannot observe whether users would have clicked, purchased, or engaged with shadow recommendations. Offline metrics (NDCG computed against historical data) suffer from algorithmic confounding — the historical data was generated by the champion model, so it systematically biases evaluation toward models similar to the champion. Shadow mode cannot solve this; only A/B testing can.\n\nStateful and side-effecting models: If the model's output triggers a downstream action (send email, write to database, update user state, issue a payment), the shadow model must not trigger those actions. This forces shadow models into a read-only, isolated sandbox with separate caches and read-only credentials — meaning the shadow model is never tested in the full production environment it will eventually operate in.\n\nBusiness metric validation: Revenue, retention, NPS — any metric that requires users to actually receive and act on predictions is invisible to shadow mode. Shadow mode validates technical correctness and prediction similarity, not business impact.\n\nCold-start and distribution shift: Shadow mode tests the model on today's traffic. If the model is intended to operate in a different traffic regime or is deployed months after testing, shadow results may not generalize.`,
    keyTerms: ['Feedback loop', 'Algorithmic confounding', 'Stateful side effects', 'Business metric validation', 'Read-only shadow constraint', 'Cold-start gap'],
    quiz: [
      { q: 'Why can\'t shadow mode validate a recommendation model\'s business impact (CTR)?', a: 'Shadow predictions are never shown to users, so users never click or not-click on them. The feedback loop that generates click data is broken. Historical click data is confounded by the champion model\'s policy.' },
      { q: 'A payment authorization model outputs "approve" or "decline." What special constraint must the shadow version of this model satisfy?', a: 'It must never actually process payments or update any financial state. It must run with read-only credentials and be isolated from all write paths — approval decisions must not propagate downstream.' },
    ],
    practice: [
      'List three categories of models where shadow mode alone is insufficient for validation, and explain why for each.',
      'A team says "we ran shadow mode for 2 weeks and NDCG matched perfectly — we don\'t need A/B testing." What is wrong with this argument?',
    ],
  },
  {
    heading: 'Handling Stateful Models in Shadow Mode',
    body: `When model outputs trigger downstream writes, the shadow model must be isolated from all write paths. This is enforced through several mechanisms:\n\nRead-only IAM roles/service accounts: Shadow model pods run with credentials that only permit reads — no writes to databases, message queues, caches, or external APIs.\n\nSeparate feature caches and replicas: The shadow model reads from a read-only replica or snapshot of the feature store — never from the primary write path. This prevents shadow model reads from warming the production cache in a way that pollutes cache hit rate metrics.\n\nNo external API calls: Shadow model code must not call any transactional external API — payment processors, email services, push notification systems, CRM systems, or inventory systems.\n\nMock write path: For models that normally write predictions back to a results store (offline scoring pipelines), the shadow version writes to a dedicated shadow results table, never to the production results table.\n\nThe consequence: shadow mode tests prediction logic in a controlled sandbox, never in the full stateful operational context it will eventually run in. This is a fundamental limitation — it means some failure modes (such as cache contention, write-path latency, or side-effect sequencing bugs) can only be caught during canary.`,
    keyTerms: ['Read-only IAM roles', 'Feature store replica', 'Write path isolation', 'Shadow results table', 'Stateful operational context'],
    quiz: [
      { q: 'Why does the shadow model need to read from a feature store replica rather than the production feature store?', a: 'Reading from production would warm the cache in a way that affects production cache hit rates and could confound metrics. A replica keeps shadow model reads isolated from production I/O patterns.' },
      { q: 'A shadow model\'s prediction code calls an external inventory API to check stock levels. Why is this a problem?', a: 'Even read calls to external APIs can have side effects (rate limiting, caching, logging) and create load. More critically, if the API has any write behavior or the call triggers downstream actions, shadow isolation is violated.' },
    ],
    practice: [
      'Design the IAM permission set for a shadow model deployment of a fraud scoring service that normally writes decisions to a database.',
      'Explain why perfect shadow mode validation does not guarantee the model will behave identically once fully deployed.',
    ],
  },
  {
    heading: 'Cost Implications of Shadow Testing',
    body: `Shadow mode is not free. It doubles compute for the percentage of traffic being shadowed. At scale, this is a significant budget line.\n\nUber runs real-time ML at 15M+ predictions per second at peak. Doubling compute for 100% shadow traffic would be prohibitive. Three common cost mitigations:\n\n1. Shadow only a fraction of traffic (10–20% is statistically sufficient to detect systematic divergence at production scale). 10% shadow coverage with 1 million daily requests = 100,000 shadow evaluations — sufficient for robust divergence detection.\n\n2. Use cheaper instance types for the shadow path. Shadow predictions have no latency SLA (the user is not waiting), so you can run shadow on spot/preemptible instances, batch shadow requests, or use lower-tier hardware.\n\n3. Time-bound shadow tests. Run for days or weeks, not indefinitely. Once you have sufficient comparison data, shut down the shadow endpoint.\n\n4. Shadow asynchronously from a queue. Rather than inline request duplication, write requests to a queue and process them asynchronously. This decouples shadow compute from the critical path entirely and allows shadow workloads to be run on preemptible spot instances during off-peak hours.`,
    keyTerms: ['Shadow compute cost', 'Partial mirroring', 'Spot instances for shadow', 'Queue-based shadow', 'Time-bounded shadow testing'],
    quiz: [
      { q: 'Does 100% traffic mirroring always produce better validation than 10% mirroring?', a: 'Not at production scale. 10-20% mirroring is statistically sufficient to detect systematic divergence and avoids doubling compute costs. Over-shadowing is wasteful unless you specifically need full coverage for rare input patterns.' },
      { q: 'Why can shadow model compute use spot/preemptible instances when the champion serving compute cannot?', a: 'Shadow model latency has no SLA — the user is never waiting on it. If a spot instance is preempted, a shadow request is simply lost (or retried from queue). For champion serving, a preemption would cause a user-visible timeout or error.' },
    ],
    practice: [
      'Calculate the approximate daily cost impact of adding shadow mode if your service handles 500k requests/day, each costs $0.001 to serve, and you mirror 20% of traffic.',
      'Design a queue-based shadow architecture that runs shadow compute during off-peak hours to minimize cost.',
    ],
  },
  {
    heading: 'Building a Comparison Pipeline',
    body: `Istio/Envoy/NGINX discard shadow responses. To actually compare champion and shadow outputs, you need a purpose-built comparison pipeline:\n\nStep 1 — Correlation ID injection: The gateway injects a unique request ID into both the champion and shadow requests. This ID is logged with both responses, enabling you to join them for comparison.\n\nStep 2 — Response logging: Both champion and shadow model serving code log their outputs (predictions, scores, rankings) with the correlation ID to a shared data store (Kafka topic, BigQuery table, S3 bucket).\n\nStep 3 — Comparison job: A streaming job (Flink, Spark Streaming, Dataflow) or batch job joins champion and shadow logs by correlation ID and computes divergence metrics: exact match rate, prediction delta distribution, NDCG.\n\nStep 4 — Alerting: Automated thresholds fire alerts when divergence exceeds pre-defined gates (e.g., exact match rate < 80%, NDCG < 0.85, prediction delta P95 > 0.10).\n\nStep 5 — Segment analysis: Disaggregate divergence metrics by user segment, geography, device type, and input feature ranges. Aggregate metrics can hide systematic failures on high-value segments.`,
    keyTerms: ['Correlation ID', 'Response logging', 'Streaming join', 'Divergence alerting', 'Segment-level disaggregation'],
    quiz: [
      { q: 'What happens if you cannot join champion and shadow responses because the correlation ID was not propagated?', a: 'You cannot compare outputs — you have shadow traffic running but no comparison data. The shadow test produces no signal. Correlation ID propagation is a prerequisite for shadow mode to be useful.' },
      { q: 'Why should divergence metrics be disaggregated by user segment rather than reported as aggregate averages?', a: 'Aggregate metrics can hide systematic failures on specific segments. A model with 97% overall exact match may have 60% exact match on your premium tier users or a specific geographic region. Disaggregation reveals these hidden failures.' },
    ],
    practice: [
      'Sketch a streaming comparison pipeline architecture: what components are needed between the gateway and the alert dashboard?',
      'Define three divergence gate thresholds you would set for a content recommendation model before starting shadow mode.',
    ],
  },
  {
    heading: 'Shadow Mode for Batch and Offline Models',
    body: `For real-time serving, shadow mode duplicates requests inline or via queue. Batch and offline models require a different approach.\n\nParallel backtest / replay: Run both champion and shadow models against the same historical input dataset (or a recent production batch snapshot), compare outputs offline. This costs far less than doubling real-time compute — batch inference on optimized GPU instances runs at roughly 1/10th the per-prediction cost of real-time serving.\n\nLimitations of replay vs. real-time mirroring: Batch replay does not expose timing-sensitive behaviors. Models that depend on feature freshness at request time, or that behave differently under production load patterns (memory pressure, cache contention, concurrent request interference), are not fully exercised. True shadow mode on live traffic is required to catch latency regressions and feature freshness issues.\n\nFeature freshness gap: A batch replay uses features computed at a fixed historical timestamp. The shadow model in production would receive features at real-time freshness. If the model is sensitive to feature freshness (for example, a user's activity in the last 5 minutes), replay validation may miss freshness-related regressions entirely.\n\nUber's approach: Hue platform supports both endpoint shadowing (real-time traffic duplication for high-stakes models) and batch replay (for model development and lower-stakes validation). Target is 100% shadow coverage for all retraining pipelines.`,
    keyTerms: ['Parallel backtest', 'Batch replay', 'Feature freshness gap', 'Timing-sensitive behavior', 'Endpoint shadowing vs. batch replay'],
    quiz: [
      { q: 'What does batch replay shadow testing miss that real-time mirroring catches?', a: 'Timing-sensitive behaviors: feature freshness effects, memory pressure and cache contention under production load, and concurrent request interference patterns that only appear at real production traffic rates.' },
      { q: 'When is batch replay shadow testing sufficient instead of real-time mirroring?', a: 'When the model does not depend on real-time feature freshness, when the primary concern is prediction logic correctness rather than serving infrastructure behavior, and when the cost savings of batch replay outweigh the reduced coverage.' },
    ],
    practice: [
      'A batch recommendation model runs nightly to pre-compute rankings for 10M users. Design a shadow validation approach that tests the new model version before it is promoted.',
      'Explain why a real-time fraud model requires real-time traffic mirroring rather than batch replay for shadow validation.',
    ],
  },
  {
    heading: 'From Shadow to Canary — The Promotion Decision',
    body: `Shadow mode exits with one of two outcomes: promote to canary or reject. The promotion decision should be governed by pre-defined gates, not subjective review.\n\nShadow promotion gates (defined before shadow testing begins):\n- Shadow P99 latency within X% of champion (e.g., ≤ 120%)\n- Shadow error rate below Y% (e.g., < 2%)\n- Divergence rate (exact match or NDCG) within acceptable range\n- Prediction delta P95 below Z threshold\n\nIf all gates pass after sufficient observation (enough volume across traffic patterns, including at least one traffic peak), the shadow model is ready for canary at 1% traffic.\n\nWhat shadow promotion does NOT mean: The model is better, or that it will produce better business outcomes. Shadow mode proves technical parity, not business improvement. Business improvement must be measured by A/B testing at meaningful traffic scale.\n\nUber's insight: shadow testing is used to build organizational consensus before canary exposure. Showing product managers and business analysts shadow output comparisons builds confidence without any user risk. Shadow mode has been used to invalidate experiment ideas and kill bad models before any canary exposure — saving both user experience and engineering time.`,
    keyTerms: ['Shadow promotion gates', 'Technical parity', 'Business improvement gap', 'Organizational consensus building', 'Pre-defined gate thresholds'],
    quiz: [
      { q: 'Shadow mode gates have all passed. Does this mean you should skip canary and promote directly to 100%?', a: 'No. Shadow gates prove technical parity — similar latency, error rate, and prediction similarity. They say nothing about business impact (CTR, conversion, revenue). Canary and eventually A/B testing are still required to validate business outcomes.' },
      { q: 'What is the minimum observation requirement before making a shadow promotion decision?', a: 'Enough volume to have statistical confidence in divergence metrics, AND coverage across at least one traffic peak (since peak traffic has different characteristics than off-peak). There is no fixed time — it is volume + traffic pattern coverage.' },
    ],
    practice: [
      'Write a shadow mode promotion checklist with 5 specific gates and the rationale for each threshold.',
      'Explain to a product manager why "shadow mode passed" is not the same as "the new model is better."',
    ],
  },
];

// ── Interview Q&A ──────────────────────────────────────────────────────────────

export const INTERVIEW_QA: InterviewQ[] = [
  // ── Section 1: What is Shadow Mode ────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is shadow mode deployment for ML models, and how does request mirroring work?',
    keyPoints: [
      'Shadow mode deploys a new model alongside production without returning its responses to users',
      'The gateway duplicates each incoming request: original goes synchronously to the champion (response returned to user), copy goes asynchronously to the shadow (response logged and discarded)',
      'The shadow path must be fire-and-forget — it must never block or delay the primary request path',
      'When implemented correctly, asynchronous mirroring adds < 2ms P99 overhead at the gateway',
    ],
    trap: 'Saying shadow mode is a type of canary release. They are fundamentally different: canary returns new model responses to a fraction of users; shadow mode never returns new model responses to any user.',
  },
  {
    difficulty: 'mid',
    question: 'A team deploys a shadow model and notices the gateway P99 increased from 85ms to 120ms. What likely went wrong?',
    keyPoints: [
      'The shadow path is not truly asynchronous — it is blocking the primary request path',
      'Common cause: using NGINX mirroring, which can delay the original request if the mirror backend is slow',
      'Fix: switch to Istio or Envoy mirroring (connection-level, truly fire-and-forget) or implement proper async queuing',
      'A correct shadow implementation should add < 2ms P99 overhead regardless of shadow model latency',
    ],
    trap: 'Blaming the shadow model\'s latency for the gateway increase. The shadow model\'s performance is irrelevant to gateway latency if the shadow path is correctly decoupled. The problem is architectural — the paths are coupled.',
  },

  // ── Section 2: Shadow vs Canary vs A/B Testing ────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is the difference between shadow mode, canary release, and A/B testing? When do you use each?',
    keyPoints: [
      'Shadow mode: zero user impact, validates technical correctness and prediction similarity — cannot measure business outcomes',
      'Canary release: 1-10% of users receive new model responses — validates technical quality and early business signals at real scale',
      'A/B testing: two user cohorts receive different model versions in a statistically controlled experiment — measures true business impact',
      'Recommended sequence: shadow → canary → A/B test → full rollout. Each step builds on the previous.',
    ],
  },
  {
    difficulty: 'senior',
    question: 'A product manager argues that shadow mode is unnecessary since you can just start a canary at 1% traffic — which has very low blast radius. How do you respond?',
    keyPoints: [
      'Shadow mode and canary answer different questions: shadow validates technical correctness risk-free; canary exposes real users (even 1% = thousands of users at scale)',
      'Shadow mode is essential for major changes: new model architecture, different feature schema, new output format — where even 1% canary exposure could cause user-visible failures',
      'Shadow mode validates serving infrastructure separately from model quality — container changes, hardware migrations, and framework upgrades should be shadow-tested before any canary',
      'At 1M daily users, 1% canary = 10,000 users experiencing a potential regression. Shadow mode costs zero users.',
    ],
    trap: 'Agreeing that shadow is unnecessary. Shadow mode is the appropriate first step for high-risk changes precisely because it has zero blast radius — which no canary percentage can match.',
  },

  // ── Section 3: Implementing Traffic Mirroring ──────────────────────────────
  {
    difficulty: 'mid',
    question: 'Name two ways to implement traffic mirroring in a Kubernetes ML serving environment and compare their trade-offs.',
    keyPoints: [
      'Istio VirtualService with mirror and mirrorPercentage: connection-level fire-and-forget, does not affect primary path latency, requires service mesh setup',
      'Envoy request_mirror_policies: similar behavior, lower-level control, requires more configuration — used when not using Istio',
      'NGINX mirror directive: simpler to set up but known pitfall — can delay primary request if mirror backend is slow',
      'AWS SageMaker shadow testing: managed first-class support with built-in comparison dashboard — appropriate for teams on AWS infrastructure',
    ],
  },
  {
    difficulty: 'junior',
    question: 'You implement shadow mode using NGINX mirroring. Users start reporting increased latency. What is the likely cause?',
    keyPoints: [
      'NGINX mirroring can couple the primary request path to the mirror path — if the shadow backend is slow, NGINX may delay the original request',
      'This violates the fire-and-forget requirement for shadow mirroring',
      'Fix: switch to Istio or Envoy mirroring, which handle mirroring at the TCP connection level and are truly asynchronous',
      'Always load test shadow mirroring under production-like conditions before enabling in production',
    ],
  },

  // ── Section 4: Divergence Metrics ─────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Your champion and shadow fraud models have a 96% exact match rate. Can you confidently promote the shadow to canary? What additional analysis is needed?',
    keyPoints: [
      '96% exact match means they disagree on 4% of predictions — at high-stakes transaction volumes, this could be thousands of misclassified transactions per day',
      'Segment-level analysis is essential: disaggregate disagreements by transaction value tier, user segment, merchant category — the 4% may be concentrated on high-value transactions',
      'Analyze the direction of disagreement: is the shadow more aggressive (more false positives) or more permissive (more false negatives) than the champion?',
      'At minimum, review disagreement samples manually — understand whether disagreements represent improvements, regressions, or neutral differences',
    ],
    trap: 'Treating aggregate exact match rate as sufficient validation. High-value edge cases are often in the tail of the distribution — they require segment-level analysis, not aggregate statistics.',
  },
  {
    difficulty: 'senior',
    question: 'Design a divergence comparison pipeline for a recommendation model serving 500k users daily. What metrics would you compute, and what thresholds would you use to gate shadow promotion?',
    keyPoints: [
      'NDCG@10: rank correlation at top 10 recommendations — gate threshold ≥ 0.92 (shadow must produce similar top-10 lists)',
      'Exact match rate on position-1 recommendation (the item most users click first) — gate threshold ≥ 90%',
      'Prediction delta P95 for raw scores — gate threshold ≤ 0.05 (scores should not diverge dramatically)',
      'Segment-level NDCG disaggregated by user activity tier, platform (mobile/web), and geography — detect systematic regressions on specific cohorts',
      'Define gates before shadow testing begins — not after seeing the data — to prevent confirmation bias',
    ],
  },

  // ── Section 5: What Shadow Mode Cannot Validate ────────────────────────────
  {
    difficulty: 'mid',
    question: 'Why can\'t shadow mode validate the business impact of a new recommendation model, even if offline NDCG metrics look excellent?',
    keyPoints: [
      'Shadow predictions are never shown to users — no user ever clicks or not-clicks on a shadow recommendation',
      'Offline NDCG computed against historical click data is confounded by the champion model\'s historical policy — the data was generated by users responding to champion recommendations, not shadow recommendations',
      'This is algorithmic confounding: historical click data systematically favors models similar to the champion that produced that history',
      'Business impact (CTR, revenue, engagement) requires an A/B test where real users actually receive and act on the new model\'s recommendations',
    ],
    trap: 'Accepting that high offline NDCG means the model will produce better business outcomes. Shadow mode validates technical correctness; only A/B testing validates business value.',
  },
  {
    difficulty: 'senior',
    question: 'Your team has a payment authorization model. Shadow mode tests pass perfectly — latency is good, predictions look similar. A junior engineer proposes deploying directly to 100%. What risks is she missing?',
    keyPoints: [
      'Shadow mode ran the model in a read-only isolated sandbox — it was never tested with live write paths (payment processing, fraud database writes, account state updates)',
      'Stateful side effects at scale may differ from sandbox behavior — cache contention, write-path latency, database lock behavior under load',
      'Shadow mode cannot detect that the new model changes the approve/decline decision on a specific class of edge-case transactions at scale (rare inputs that appear more frequently at 100% traffic)',
      'Operational readiness is also missing: rollback procedures, alerting thresholds for the new model, runbooks — canary provides a low-blast-radius environment to validate these',
    ],
  },

  // ── Section 6: Handling Stateful Models ───────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What constraints must a shadow model satisfy when the production model\'s outputs trigger downstream database writes?',
    keyPoints: [
      'Shadow model must run with read-only credentials — no write access to production databases, message queues, or external APIs',
      'If the shadow model needs to store its predictions for comparison, it writes to a dedicated shadow results table, never to the production results table',
      'The shadow model must not call any external API that has side effects (payment processors, email services, inventory systems)',
      'Feature store reads should come from a read-only replica, not the production write path — to avoid polluting production cache metrics',
    ],
  },
  {
    difficulty: 'mid',
    question: 'What failure mode can shadow mode NOT catch for a stateful model, even with perfect shadow gate results?',
    keyPoints: [
      'Shadow model runs in a sandbox with read-only credentials and isolated caches — it is never tested in the full production stateful context',
      'Failures that only appear in the write path (database lock contention, cache invalidation race conditions, downstream API rate limiting triggered by writes) are invisible to shadow mode',
      'Once the model is promoted and starts actually writing to production systems, new failure modes can emerge that shadow testing never exposed',
      'This is why canary is still needed after shadow: canary runs the model in the real stateful environment at low traffic, catching write-path and operational issues that shadow never saw',
    ],
  },

  // ── Section 7: Cost Implications ─────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'True or false: shadow mode is a free validation technique with no additional compute cost. Explain.',
    keyPoints: [
      'False — shadow mode doubles compute for the percentage of traffic being mirrored',
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
      'Shadow only 10% of traffic (200k requests/day) — sufficient statistical coverage at 1/10th the cost of 100% mirroring',
      'Route shadow requests through a queue (Kafka/SQS) and process asynchronously on spot/preemptible GPU instances during off-peak hours (2am-6am)',
      'Time-bound the shadow test: 7 days provides 1.4M shadow evaluations — sufficient for robust divergence detection',
      'Total incremental cost: 200k × 7 days × $0.0005 = $700 vs. $7,000 for 100% mirroring at full compute cost. Plus spot discounts reduce this further.',
    ],
  },

  // ── Section 8: Comparison Pipeline ────────────────────────────────────────
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

  // ── Section 9: Batch vs Real-Time ─────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Your ML model runs as a nightly batch job scoring 5M users. How would you implement shadow mode for this model?',
    keyPoints: [
      'Parallel backtest / replay: run champion and shadow models against the same input snapshot from the most recent production batch run',
      'Compare outputs offline: exact match rate, score delta distribution, rank correlation across user segments',
      'Cost advantage: batch inference on optimized GPU instances costs ~1/10th per prediction vs real-time serving',
      'Limitation: replay does not test feature freshness behavior or under-load behavior — but these matter less for a nightly batch job than for real-time models',
    ],
  },
  {
    difficulty: 'senior',
    question: 'When is batch replay shadow testing insufficient, and real-time traffic mirroring required? Give a concrete example.',
    keyPoints: [
      'Batch replay is insufficient when the model\'s behavior depends on real-time feature freshness — e.g., a fraud model using "transactions in the last 5 minutes" as a feature',
      'Real example: a real-time fraud model replay uses features computed at a fixed historical timestamp; in production, those features are computed at request time. The replay misses freshness-driven behavioral differences.',
      'Also insufficient when testing serving infrastructure: latency regressions, memory pressure under concurrent load, and cache behavior only appear under real production traffic patterns',
      'Rule of thumb: if the model is latency-sensitive, uses real-time features, or involves infrastructure changes — use real-time mirroring, not replay',
    ],
  },

  // ── Section 10: Shadow to Canary Promotion ────────────────────────────────
  {
    difficulty: 'junior',
    question: 'Shadow mode tests all passed. What does this mean, and what is the next step?',
    keyPoints: [
      'Shadow gates passing means the new model shows technical parity: similar latency, error rate, and prediction similarity to the champion',
      'It does NOT mean the model is better — business impact (CTR, conversion, revenue) is unknown',
      'Next step: promote to canary at 1% traffic to begin measuring real user impact at low blast radius',
      'Shadow mode is the prerequisite for canary, not a replacement for it',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Define the gates you would set before starting shadow mode for a ranking model, and explain why each threshold was chosen.',
    keyPoints: [
      'Shadow P99 ≤ 120% of champion P99: shadow latency must not be dramatically worse; 20% headroom accounts for cold-start and jitter without masking real regressions',
      'Shadow error rate < 2%: double the champion\'s typical 1% error rate — allows some tolerance for shadow environment differences',
      'NDCG@10 ≥ 0.90: shadow rankings must correlate highly with champion at top positions; 0.90 threshold balances stability with allowing improvements',
      'Prediction delta P95 ≤ 0.08: absolute score difference at the 95th percentile must be small — detects systematic shifts in model confidence calibration',
      'All gates pre-defined before shadow testing begins to prevent post-hoc rationalization',
    ],
  },
];

// ── AI Prompt ──────────────────────────────────────────────────────────────────

export const AI_PROMPT_TEMPLATE = (
  mirrorPct: number,
  champP99: number, shadowP99: number,
  champErr: number, shadowErr: number,
  exactMatch: number,
  ndcg: number,
  fault: string,
) =>
  `I am running shadow mode with ${mirrorPct}% traffic mirrored. Champion P99: ${champP99}ms, Shadow P99: ${shadowP99}ms. Champion error rate: ${champErr}%, Shadow: ${shadowErr}%. Exact match rate: ${exactMatch.toFixed(1)}%. NDCG rank correlation: ${ndcg.toFixed(3)}.${fault !== 'none' ? ` Active fault: ${fault}.` : ''} In 2-3 sentences: should I promote to canary, hold and investigate, or abandon this shadow test? Be direct.`;
