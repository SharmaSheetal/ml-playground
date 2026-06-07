// ─────────────────────────────────────────────────────────────────────────────
// Traffic Split — Study Guide & Interview Q&A
// Each module has its own content.ts that follows this shape.
// ─────────────────────────────────────────────────────────────────────────────

export interface StudySection {
  heading: string;
  body: string;
}

export interface InterviewQ {
  id?: string;
  difficulty: 'junior' | 'mid' | 'senior';
  question: string;
  answer?: string;
  modelAnswer?: string;
  keyPoints: string[];
  trap?: string;
}

// ── Study Guide ───────────────────────────────────────────────────────────────

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'What is Traffic Splitting?',
    body: `Traffic splitting routes a percentage of incoming requests to different model versions simultaneously. The load balancer acts as a policy engine — not just round-robin, but weighted routing based on deployment strategy. This lets you validate a new model on real production traffic without full exposure.`,
  },
  {
    heading: 'Blue/Green vs Canary',
    body: `Blue/Green: two identical environments, 100% traffic switches instantly. Zero-downtime but no gradual validation — if the new model is broken, all users are affected before you can roll back.

Canary: traffic shifts gradually (1% → 5% → 20% → 100%). You observe metrics at each stage. Rollback affects only the small canary slice. Preferred for ML models where behavioural regressions are subtle and only visible at scale.`,
  },
  {
    heading: 'Canary vs A/B Testing — Not the Same Thing',
    body: `Canary is a safety mechanism — you're asking "is it safe to roll this out?" Watch for regressions: latency spikes, error rate increases, prediction distribution shift. The goal is to reach 100% traffic.

A/B testing is an experiment — you're asking "which model produces better business outcomes?" Hold the split steady (50/50) long enough to reach statistical significance on your primary business metric. You're not trying to reach 100%; you're measuring a difference.

In practice you often do both: canary to safely ramp up, then hold at 50/50 for long enough to declare an A/B winner, then ramp to 100%.`,
  },
  {
    heading: 'Shadow Mode',
    body: `Shadow mode: your serving layer duplicates every request, sends it to both the champion and the shadow model, returns the champion's response to the user, and logs both outputs for offline comparison. The user never knows the shadow model exists.

Key limitation: you cannot measure business impact — since users never see the shadow model's responses, you get no signal on CTR, engagement, or revenue. Shadow mode tells you "the outputs look reasonable and latency is within budget." It cannot tell you "users prefer this model." That is what A/B testing is for.`,
  },
  {
    heading: 'What Metrics to Watch',
    body: `P50 (median latency): typical user experience. P95/P99: tail latency — what your worst 5% / 1% of users see. For ML, also watch: prediction distribution shift, null/error rate, and business metrics like CTR or conversion. A model can be technically fast but behaviorally wrong.`,
  },
  {
    heading: 'Degradation Signals & Automated Gates',
    body: `Set rollback thresholds before the canary starts — post-hoc threshold setting introduces confirmation bias. Typical gates:

  • P99 latency within 5% of baseline
  • Error rate below 1%
  • Business metric not degraded by more than 2% over 30 minutes

These gates should be automated — human-in-the-loop doesn't scale.`,
  },
  {
    heading: 'Rollback Mechanics',
    body: `Traffic shifting, not redeployment. In Kubernetes: the service routes 100% back to the previous ReplicaSet in seconds. The new model pod stays running at 0% traffic — never delete it until you understand what happened.

kubectl rollout undo deployment/model-server

Automated rollback (Argo Rollouts, Spinnaker): the monitoring stack watches SLO metrics and halts canary promotion before a human pages. MTTR bounded by pager latency when rollback is manual.`,
  },
  {
    heading: 'Why P99 Matters More Than P50',
    body: `In recommender systems and search, a slow response at the 99th percentile means 1 in 100 page loads is visibly broken. At 10k RPS, that is 100 bad requests per second. Optimize for P99 on user-facing models; P50 alone is misleading when latency distributions are long-tailed — which they almost always are under real load.`,
  },
  {
    heading: 'Champion/Challenger Pattern',
    body: `Different from A/B testing in operational intent. Champion/challenger is a continuous pattern — the champion always serves the majority of production traffic, and there is always a challenger being evaluated on a small slice (5–10%). When a challenger wins, it becomes the new champion, and immediately a new challenger goes into evaluation. It is an always-on improvement loop, common in fraud detection, credit scoring, and ad bidding.`,
  },

  // ── Extended: critical production ML concepts ─────────────────────────────

  {
    heading: 'Offline Good, Online Bad — Diagnostic Framework',
    body: `A model that scores well in offline evaluation but degrades in production is one of the most common and expensive ML failures. The root cause is almost never overfitting — it is usually one of four things:

Data Leakage: a feature contains future information at training time that is not available at serving time. For example, using total_purchases_ever to predict a purchase that is included in that total. Re-run eval with a strict temporal split — if offline metrics drop significantly, leakage was inflating your results.

Training-Serving Skew: preprocessing runs differently between your training pipeline and your serving pipeline. Feature values are stale (computed hours ago but the model expects fresh ones). Null/missing value handling differs. Fix: log actual serving feature values and compare their distribution against training data statistically.

Distribution Shift: production traffic P(X) differs from training distribution — new user cohorts, seasonality, a product change that altered behaviour. The model learned correctly; the world moved. Run PSI (Population Stability Index) on incoming features vs. training baseline. PSI > 0.2 means significant drift.

Feedback Loop / Exposure Bias: the model's own predictions change what data it sees next. Classic in recommendations — the model only surfaces items it scored highly, so it never gets feedback on items it ranked low. Offline eval does not capture this.

How to answer in an interview: "I would not assume overfitting. I enumerate hypotheses in order — leakage, skew, distribution shift, feedback loop — and run the cheapest diagnostic test to falsify each one."`,
  },
  {
    heading: 'Training-Serving Skew in Detail',
    body: `Training-serving skew is when the data your model sees at serving time is different from what it trained on — even if the model artifact is identical.

Common causes:
  • Preprocessing code divergence: the training pipeline applies feature engineering in Python/Spark; the serving pipeline re-implements it in Java/Go and misses an edge case
  • Feature staleness: user embedding computed at 2am served at 11pm — 21 hours of drift
  • Missing value strategy: training fills nulls with median; serving fills with 0
  • Data type mismatch: training reads age as float, serving casts it to int first

How to detect it: shadow mode is ideal here. Log the exact feature vector the model receives at serving time. Compare the distribution of each feature against the training distribution using KS test or PSI. A divergence in feature distributions without a model change means skew, not drift.

Prevention: define features once in a feature store. Both training and serving read from the same feature definitions. This is the core value proposition of platforms like Feast, Tecton, and Vertex AI Feature Store.`,
  },
  {
    heading: 'The SLA Budget — Where Does 100ms Go?',
    body: `A 100ms P99 SLA sounds tight but is achievable. Understanding where time is actually spent is essential — inference is usually not the bottleneck:

  Network (client → server)          ~10ms
  Feature lookup (Redis / feature store)  ~2–5ms
  Preprocessing / serialization       ~5ms
  Model inference (GPU)              ~10–20ms
  Post-processing + serialization     ~5ms
  Network (server → client)          ~10ms
  ──────────────────────────────────────────
  Total                              ~42–55ms  ← leaves headroom for spikes

The insight interviewers want to hear: inference is often not the bottleneck. Feature lookup, serialization, and network round trips eat most of the budget. Optimising the model while ignoring feature retrieval latency is a common and expensive mistake.

If you are over budget, profile first to find the actual bottleneck. Then: quantization on the model, connection pooling on feature store calls, co-locate model server with the feature store, batch multiple feature lookups into one round trip.`,
  },
  {
    heading: 'Prediction Distribution Monitoring',
    body: `Standard uptime monitoring (HTTP 200, latency) does not catch silent model failures. A model can return 200 OK with completely wrong predictions — the endpoint is "up" but broken.

What to monitor beyond latency:

Prediction distribution: track the histogram of model outputs over time. If your fraud model suddenly scores every transaction 0.0, the endpoint is up but useless. If your ranking model starts recommending the same 50 items to everyone, it is stuck in a feedback loop.

Output entropy: for classification models, track how confident the model is on average. Sudden spikes in confidence often indicate distribution shift — the model is extrapolating far outside its training distribution and is inappropriately certain.

Null/unknown rate: what percentage of requests result in a fallback or null prediction? A spike here usually means a schema change upstream broke feature ingestion.

Business metrics: CTR, conversion, session length. These are the ground truth. A model that is technically healthy but driving lower CTR has a problem that latency monitoring will never catch.

Rule: model-specific metrics should be in your primary oncall dashboard alongside P99 and error rate — not in a separate "model health" page that nobody checks.`,
  },
  {
    heading: 'Dynamic Batching and GPU Utilization',
    body: `Real-time requests arrive one at a time, but GPUs are most efficient when processing batches. Dynamic batching solves this: the model server waits a configurable few milliseconds to accumulate requests, groups them into a batch, runs one inference pass, then returns individual responses.

Why this matters: a single inference on GPU for batch size 1 vs. batch size 32 often takes nearly the same wall-clock time — the GPU has thousands of cores sitting idle for a batch-1 request. Dynamic batching turns that waste into throughput.

Triton Inference Server has this built in. Configure max_queue_delay_microseconds (how long to wait for more requests) and max_batch_size. The right values depend on your latency SLA and QPS:

  • Low QPS, tight SLA: disable batching or use max_queue_delay of 1–2ms
  • High QPS, looser SLA: queue delay of 10–20ms can give 10× throughput improvement

The tradeoff: batching adds latency to every individual request by the queue delay amount. Measure the P99 impact before enabling in production.`,
  },
  {
    heading: 'Caching in ML Serving — When It Hurts',
    body: `Caching model predictions seems like an obvious win, but it creates three serious failure modes that are easy to miss:

1. Stale predictions after a model update: you deploy a new model, but cached predictions from the old model keep being served for hours depending on your TTL. Worse — your monitoring shows a stable prediction distribution because you are measuring cache hits, not live model outputs. Drift detection is blind to this. Fix: namespace cache keys by model version and flush on every deploy.

2. Masking model drift: if 60% of traffic is served from cache, your model is barely being called. When you monitor for feature drift or prediction drift, you are only observing the uncached slice. You think the model is healthy; it is barely running.

3. Near-duplicate inputs: cache hit rate depends on exact input match. Slightly different inputs (extra whitespace, different capitalisation, minor rephrasing) produce cache misses with no benefit. Semantic caching using embedding similarity solves this but adds its own latency and complexity.

Caching is most safe for: identical repeated inputs (product IDs, user IDs in recommendation), immutable inputs (image hash → prediction), and outputs that are explicitly versioned.`,
  },
  {
    heading: 'Readiness vs Liveness Probes',
    body: `In Kubernetes, two probes control how traffic reaches your model server — most engineers only think about liveness.

Liveness probe: is the container alive? If it fails, Kubernetes restarts the pod. A model server that has deadlocked or crashed will fail this. Kubernetes handles recovery automatically.

Readiness probe: is the pod ready to serve traffic? If it fails, Kubernetes removes the pod from the load balancer's rotation. Traffic stops going to it until the probe passes again.

Why readiness is critical for ML: loading a large model into GPU memory takes 30–120 seconds. Without a readiness probe, Kubernetes routes traffic to a pod that has started but has not yet loaded the model — every request during that window gets a 500 error.

Implement the readiness endpoint to return 200 only after the model is fully loaded and a warm-up inference has completed. Configure initialDelaySeconds to give the container time to start before the first check.

Liveness: restart a broken pod.
Readiness: do not route traffic to a pod that is not ready.
Both are required in production. Neither is optional.`,
  },
  {
    heading: 'Feature Flags and Dark Launch',
    body: `A feature flag is a code-level toggle that enables or disables a new behaviour without a new deployment. In ML serving, this means the new model code path is deployed but controlled by a flag — not by traffic percentage.

When to use feature flags over canary:
  • The change is behavioural (new preprocessing logic, new feature engineering) rather than a new model artifact
  • You want to decouple deployment from exposure — ship the code on Tuesday, enable it for 1% of users on Thursday after validation
  • You need instant kill-switch capability without touching Kubernetes

Dark launch is a specific pattern: enable the new code path for a small internal cohort (employees, beta users) before any external traffic. You get real behaviour from real users with controlled blast radius.

The distinction from shadow mode: in a dark launch, the users are real and they see the new model's actual responses. In shadow mode, all users see the champion; the shadow output is never shown to anyone.

Feature flags require infrastructure: a flag service (LaunchDarkly, Unleash, custom Redis flags) that the serving code reads at request time. Hardcoded flags in config files defeat the purpose — you still need a deploy to change them.`,
  },
  {
    heading: 'Serving Patterns: When to Use Each',
    body: `Four patterns cover the full ML serving landscape. The right choice depends on latency requirements, data freshness needs, and throughput.

Online / Real-time: prediction in milliseconds. Synchronous request-response. The user or upstream system calls your endpoint and waits. Stack: FastAPI, Triton, TorchServe. Use for fraud detection at payment time, search ranking, real-time recommendations. Challenge: keeping P99 low under variable load.

Batch: pre-compute predictions on a schedule. No user is waiting in real time. You know the set of entities to score in advance. Stack: Spark, Ray, Airflow. Use for nightly churn scoring, weekly recommendation pre-computation, offline model evaluation. Advantage: 10× cheaper than online serving for the same volume.

Streaming: event-driven, near-real-time. Events arrive via Kafka; a consumer runs inference and writes results downstream. Latency is hundreds of milliseconds, not single-digit. Use for clickstream anomaly detection, post-hoc fraud flagging, IoT sensor scoring. Key difference from real-time: nobody is blocking on the response.

Edge / On-device: model runs on the device itself. Zero network latency, works offline. Requires aggressive model compression (quantization, pruning) to fit device constraints. Stack: TFLite, CoreML, ONNX Runtime. Use for mobile AR, in-vehicle systems, offline IoT sensors.

Hybrid is common in production: batch-precompute embeddings, store in feature store, do fast online lookup plus a lightweight model at serving time. Best of both — freshness of online serving without paying full compute cost on every request.`,
  },

  {
    heading: 'Model Registry — The Missing Metadata Layer',
    body: `Storing a model binary in S3 solves artifact storage. A model registry solves the harder problem: knowing what that artifact is, where it came from, and what it is doing in production.

Without a registry, six months of training runs produce dozens of model files with no answer to: which one is in production? What training data produced it? What were the eval metrics? Who approved it?

A registry stores the artifact alongside structured metadata:
  • Git commit of the training code
  • Hash of the training dataset (or a pointer to the data version)
  • All hyperparameters
  • Eval metrics on the held-out test set
  • Who trained it and when
  • Which stage it is in: staging → production → archived

That metadata enables real rollback — not just "redeploy the previous binary" but "redeploy the exact model trained on this data version with these hyperparameters that had these eval metrics." It also enables auditability, which is a hard requirement in regulated domains (credit scoring, healthcare, fraud).

Tools: MLflow (most common open-source), SageMaker Model Registry (AWS-native), Vertex AI Model Registry (GCP), Weights & Biases. The specific tool matters less than the discipline: always log metadata at training time. A registry full of untagged blobs is no better than raw S3.

Interview signal: candidates who say "we just store models in S3" vs. candidates who can explain full lineage tracing are at very different levels of production maturity.`,
  },

  {
    heading: 'ML-Specific SLOs — Beyond Infrastructure Metrics',
    body: `Standard infrastructure SLOs — uptime, latency, error rate — are necessary but insufficient for ML systems. A model can maintain 99.9% uptime and sub-100ms P99 while producing predictions that are silently wrong.

ML systems need two layers of SLOs:

Infrastructure SLOs (same as any service):
  • Availability: 99.9% (43.8 minutes downtime/month)
  • P99 latency: < Xms
  • Error rate: < 0.5%

Prediction quality SLOs (ML-specific):
  • Prediction distribution: output histogram must not shift more than PSI > 0.1 from baseline
  • Output entropy: model confidence must not spike (extrapolating outside training distribution)
  • Business metric SLOs: CTR not below baseline by more than 2%, conversion not degraded
  • Fairness SLOs: demographic parity metrics within defined bounds

Why this matters in a canary: your canary gates should include prediction quality SLOs, not just infrastructure SLOs. A new model can pass all latency and error rate gates while producing a completely different prediction distribution that drives lower conversion. Standard monitoring will never catch this.

Adaptive SLOs: emerging practice in 2025 is dynamic SLO targets that adjust for seasonality — a fraud model in December has different expected false positive rates than in July. Static thresholds set in January will either miss incidents or create false alarms by Q4.`,
  },

  {
    heading: 'Quantization: PTQ vs QAT',
    body: `Quantization reduces weight precision — typically from 32-bit float (FP32) to 8-bit integer (INT8) — cutting model size by 4× and accelerating inference significantly. It is the highest-leverage, lowest-effort latency optimization available.

Post-Training Quantization (PTQ):
Happens after training is complete. Run a calibration dataset through the model to determine the scaling factors, then quantize. Takes hours, not days. No retraining required. The downside: accuracy drop because the model was never exposed to quantization noise during training. In practice, PTQ to INT8 typically costs 0.5–2% accuracy on most tasks — acceptable for production.

Quantization-Aware Training (QAT):
Simulates quantization during the training forward pass. The model sees quantization noise while updating its weights, so it learns to be robust to it. You recover most of the accuracy that PTQ loses. The cost: you must retrain — or at minimum fine-tune — the model. Much more expensive. Use only when PTQ accuracy drop is unacceptable.

Rule of thumb:
  Start with PTQ. Run your eval suite immediately. If accuracy delta is acceptable — ship it. Only invest in QAT if PTQ degradation is unacceptable AND retraining is feasible.

Pipeline: Train → PTQ to INT8 → Export to ONNX → TensorRT compilation → Deploy
  Always run eval between PTQ and compilation — both can independently affect accuracy.

FP4/INT4 in 2025: now production-standard for large language models. A 70B parameter model that required two A100s in FP16 fits on a single H200 in INT4. Accuracy regression is more noticeable than for smaller models — always evaluate on your specific task, not just benchmarks.`,
  },

  {
    heading: 'Knowledge Distillation',
    body: `Distillation trains a small student model to mimic a large teacher — not just by training on the same hard labels, but by learning from the teacher's output probability distribution.

Why soft labels matter: hard labels throw away information. If the teacher predicts "cat" with 85%, "lynx" with 12%, "dog" with 3%, the hard label is just "cat." The soft labels tell the student that cats and lynxes are structurally similar. That structural knowledge is what makes distillation more effective than simply training a smaller model from scratch on the same data.

The temperature parameter softens the distribution further: dividing logits by T > 1 before softmax makes the distribution flatter, transferring more of the teacher's uncertainty. Typical values: T = 2 to 4.

Results: Google's DistilBERT achieves 97% of BERT's performance with 40% fewer parameters and 60% faster inference. This is the standard benchmark that made distillation mainstream.

When to use distillation vs. quantization:
  Quantization first — it is faster, requires no retraining, and often sufficient.
  Distillation when: the task requires a fundamentally smaller architecture (mobile/edge), or quantization accuracy loss is unacceptable and you have training compute available.
  Both combined: distil first to create a smaller base model, then quantize that smaller model. You get compounding efficiency gains.

Distillation requires the teacher to be available during training. If the teacher is a proprietary API (GPT-4, Claude), check the terms of service — many explicitly prohibit using API outputs to train competing models.`,
  },

  {
    heading: 'Production Readiness Gates Before Canary',
    body: `Canary deployment is not the first safety gate — it is one of several. Before any traffic reaches a new model version, a production readiness checklist should pass automatically in CI/CD.

Data validation:
  • Training and test distributions are from the same source (no temporal leakage)
  • Feature schema matches what the serving pipeline expects (no silent type mismatches)
  • Null rate and out-of-range rate on validation set matches production baseline

Model validation:
  • Accuracy/AUC/RMSE on held-out test set meets minimum threshold
  • Performance does not degrade on known edge case subsets (rare classes, sparse features)
  • Inference latency on representative batch sizes meets SLA headroom
  • Fairness metrics (if applicable) within defined bounds

Infrastructure validation:
  • Docker image builds and passes integration tests
  • Dependency versions locked and compatible with serving infrastructure
  • Readiness probe responds 200 within expected startup time
  • Shadow mode output distribution matches expectations vs. champion

Rollback validation:
  • Previous model version still exists in the registry and can be deployed in under 5 minutes
  • Rollback procedure is documented and tested (not just assumed)

Only after all gates pass should a canary start. The canary is the final production gate, not the first. Teams that skip pre-canary validation and rely entirely on the canary to catch problems are running a much higher blast-radius experiment.`,
  },

  {
    heading: 'Queue-Based Autoscaling — Why CPU Metrics Fail for ML',
    body: `Standard Kubernetes HPA scales on CPU utilization. For ML serving, CPU is a misleading signal:

  1. GPU inference does not consume much CPU — the GPU is doing the work. CPU utilization stays low while the model is saturated and users experience degraded latency. HPA sees low CPU and does nothing.
  2. CPU reacts to load after it has already hit you. By the time HPA scales up, users have already experienced a latency spike for 90+ seconds (default HPA evaluation window).

Better autoscaling signals for ML:
  • Request queue depth: if requests are piling up in the serving queue, scale immediately — before latency spikes
  • Time-in-queue (P99): how long is a request waiting before inference starts
  • GPU memory utilization: leading indicator of capacity exhaustion on GPU-bound workloads
  • Token generation rate per GPU (for LLMs): tracks actual throughput

Tools:
  KEDA (Kubernetes Event-Driven Autoscaler): scales deployments based on custom metrics from Prometheus, Kafka, SQS queue depth, or any custom source. Plugs directly into Kubernetes without replacing HPA.
  Triton Inference Server exposes queue depth and GPU utilization as Prometheus metrics — scrape these with KEDA for queue-depth-based scaling.

Scale-down is harder than scale-up: GPU nodes take 3–5 minutes to provision. Set scale-down cooldown windows to at least 10 minutes to avoid thrashing. Maintain a warm minimum replica count that covers your typical off-peak traffic without cold starts.

Self-hosted breakeven: 50%+ average GPU utilization for cost parity with cloud inference APIs for a 7B model. Below that, cloud APIs are cheaper when you factor in idle capacity.`,
  },

  {
    heading: 'Speculative Decoding — LLM Serving Optimization',
    body: `Standard autoregressive LLM inference generates one token at a time: each forward pass produces one token, which is fed back as input for the next. At 100 tokens per second, a 500-token response takes 5 seconds. The GPU is underutilized between tokens.

Speculative decoding solves this with a two-model approach:
  1. A small, fast draft model generates K candidate tokens in one forward pass
  2. The large target model verifies all K tokens in a single parallel forward pass
  3. Accepted tokens are kept; rejected tokens are discarded and regeneration continues from the rejection point

Why this works: the target model's parallel verification pass has similar latency to generating a single token, but it evaluates K tokens simultaneously. If even 3 of 5 draft tokens are accepted, you get 3 tokens for the cost of roughly 1.

Speedup: 2–4× token generation rate with identical output quality. The output distribution is mathematically equivalent to the target model running alone — there is no accuracy trade-off.

Draft model selection matters: the draft model must be fast (typically 7B vs. 70B) and must share vocabulary with the target. A bad draft model with a low acceptance rate actually slows things down (more rejections, more re-generations). Aim for a draft acceptance rate above 70%.

When to use: high-traffic production LLM endpoints where throughput is the primary bottleneck. Not useful for batch inference where throughput already saturates the GPU through conventional batching.`,
  },

  {
    heading: 'Multi-Armed Bandit vs A/B Testing for Model Selection',
    body: `A/B testing allocates traffic to variants in fixed proportions for a fixed duration, then picks a winner. This is simple but has a known cost: for the entire experiment duration, 50% of users are served by a potentially inferior model.

Multi-armed bandit (MAB) algorithms dynamically shift traffic toward the better-performing variant while the experiment is still running. The key trade-off is exploration vs. exploitation:
  Exploration: send some traffic to all variants to keep learning which is better
  Exploitation: send more traffic to the variant currently performing best

Common algorithms:
  Epsilon-greedy: send ε% of traffic randomly (explore), 1-ε% to the current best (exploit). Simple, widely used.
  Thompson Sampling: maintains a probability distribution over each variant's true reward rate; samples from these to make allocation decisions. Adapts faster than epsilon-greedy.
  Upper Confidence Bound (UCB): favors variants with high uncertainty — prefers to explore variants that have not been tested enough to be confident in their performance.

When to use MAB over A/B:
  • Business metric is directly observable at request time (click, purchase, immediate feedback)
  • The experiment will run long enough for MAB to converge
  • Regret (the cost of serving the inferior model during exploration) is meaningful in your domain

When A/B beats MAB:
  • Long feedback delays (a recommendation click happens now; the conversion happens in 3 days — MAB cannot adapt fast enough)
  • You need statistical rigor for product decisions and regulatory reporting
  • Experiment duration is short and you just need a clean p-value

In production ML: MAB is common for ad bidding models and pricing models where feedback is instant. A/B testing is more common for recommendation and ranking models where business impact takes days to measure.`,
  },

  {
    heading: 'Distributed Tracing for ML Pipelines',
    body: `A latency problem in ML serving can originate anywhere: the feature store, the preprocessing step, the model itself, the post-processing, or the network. Without distributed tracing, you are guessing.

Distributed tracing captures the complete journey of a single request as it flows through your system. Each service adds a trace span with a start time, end time, and metadata. A trace aggregator (Jaeger, Zipkin, Datadog APM) reconstructs the full call tree.

A complete ML serving trace looks like:
  [Gateway: 2ms] → [Feature Store lookup: 4ms] → [Preprocessing: 6ms]
    → [Model inference: 18ms] → [Post-processing: 3ms] → [Response: 1ms]
  Total: 34ms

Without tracing you see "34ms" — the breakdown is invisible. With tracing you see the 4ms feature store lookup hiding a 3ms network round trip, and can immediately target that for optimization.

Instrumentation: use OpenTelemetry — the 2025 industry standard for unified metrics, logs, and traces. One SDK, vendor-agnostic export to any backend. Add trace spans at: feature store calls, model inference (including queue wait time vs. actual GPU time), external API calls.

Critical for ML specifically:
  • Trace queue wait time separately from inference time — queue wait is scaling signal, inference time is model signal
  • Log the feature vector hash in the trace span — enables linking a slow request to the specific feature values that caused it
  • Correlate trace IDs with prediction outputs — enables finding all traces where the model returned a specific class or confidence band

Rule: if you cannot find the source of a latency spike within 5 minutes of an incident starting, your observability is insufficient. Distributed tracing is not optional in production ML.`,
  },
];

// ── Interview Q&A ─────────────────────────────────────────────────────────────

export const INTERVIEW_QA: InterviewQ[] = [

  // ── What is Traffic Splitting? ────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is traffic splitting in ML deployment and why does it matter?',
    keyPoints: [
      'Routes a percentage of requests to different model versions simultaneously',
      'Load balancer acts as a policy engine — weighted routing, not just round-robin',
      'Validates a new model on real production traffic without full exposure',
      'Enables gradual rollout: catch regressions before they affect all users',
    ],
    trap: 'Thinking traffic splitting is just a Kubernetes feature — it is a deployment strategy that can be implemented at the load balancer, service mesh (Istio), or API gateway level.',
  },
  {
    difficulty: 'mid',
    question: 'You need to route 5% of traffic to a new model without Kubernetes native support. What infrastructure options exist and what are the trade-offs?',
    keyPoints: [
      'Nginx / Envoy upstream weights: simple, no external dependency, but requires config reload to change percentage',
      'Istio VirtualService: declarative, dynamic, integrates with canary controllers — adds service mesh complexity',
      'Application-level routing: client library reads a flag and routes — fragile, bypasses infrastructure',
      'API Gateway (AWS ALB weighted target groups): managed, supports gradual shifts without restarts',
    ],
    trap: 'Proposing application-level routing as the primary solution — it is brittle and bypasses observability infrastructure.',
  },

  // ── Blue/Green vs Canary ──────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through the deployment strategies you would use to ship a new ML model safely.',
    answer: `Think of this as a progression of risk reduction. Before touching production at all, run the new model in shadow mode — it receives a copy of live traffic, you compare its outputs against the champion, but users always get the incumbent's response. Zero risk, full signal on output distribution and latency.

Once confident in shadow, do a canary release — start at 1%, watch P99 latency, error rate, and business metrics for 30 minutes, then step up to 10%, 50%, 100%. If anything degrades at any step, cut traffic back automatically.

A/B testing sits alongside canary but serves a different purpose — it measures business impact statistically. Canary tells you "is this model safe?", A/B tells you "is this model better for the business?"

Blue/green is for when you need an instant cutover — say a major infrastructure change — and you have already validated the model through shadow and canary. It is expensive because you run two full environments, but rollback is a single traffic flip.`,
    keyPoints: [
      'Shadow mode → Canary → A/B → Blue/Green is the risk-reduction progression',
      'Canary = safety check, A/B = business impact measurement',
      'Blue/green rollback is a single traffic flip — seconds, not minutes',
      'Never start canary without pre-defined rollback thresholds',
    ],
  },
  {
    difficulty: 'mid',
    question: 'A team argues blue/green is safer than canary because rollback is instant. What is the flaw in this reasoning for ML specifically?',
    keyPoints: [
      'Blue/green switches 100% of traffic instantly — if the new model has a subtle behavioral regression, every user is affected before you can react',
      'ML behavioral regressions (prediction distribution shift, bias toward certain outputs) are invisible until you see aggregate metrics — which takes minutes',
      'Canary limits blast radius: a regression at 5% traffic affects 5% of users, not 100%',
      'Instant rollback is only valuable if you catch the problem fast — blue/green gives you no early warning',
    ],
    trap: 'Agreeing that blue/green is safer. The instant rollback capability does not compensate for the 100% traffic exposure during the window before you detect the problem.',
  },

  // ── Canary vs A/B Testing ─────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: "What's the difference between canary and A/B testing? Aren't they the same thing?",
    answer: `Canary is a safety mechanism — you are asking "is it safe to roll this out?" You watch for regressions: latency spikes, error rate increases, prediction distribution shift. The goal is to reach 100% traffic.

A/B testing is an experiment — you are asking "which model produces better business outcomes?" You hold the split steady — say 50/50 — long enough to reach statistical significance on your primary business metric. You are not trying to reach 100%; you are trying to measure a difference.

In practice you often do both: canary to safely ramp up, then hold at 50/50 for long enough to declare an A/B winner, then ramp to 100%.`,
    keyPoints: [
      'Canary: safety mechanism, goal is 100% rollout',
      'A/B: experiment, goal is statistical significance on a business metric',
      'Canary watches infrastructure metrics; A/B watches business metrics',
      'They are complementary, not alternatives',
    ],
    trap: 'Saying they are the same thing. The interviewer is testing whether you understand the different questions they answer.',
  },
  {
    difficulty: 'senior',
    question: 'Your canary passed all gates at 10%, 25%, and 50% and you fully deployed. Two weeks later, business metrics show a 5% regression. Was your canary sufficient? What was missing?',
    keyPoints: [
      'Canary gates typically watch short-window metrics — P99, error rate, immediate CTR. They miss slow-burn effects',
      'A 5% regression visible after 2 weeks is a long-feedback-loop business metric — subscription conversion, 7-day retention, LTV',
      'Missing: a holdback group — keep 5% of traffic on the old model permanently as a control to detect regressions that appear over weeks',
      'Also missing: business metric SLOs in the canary gates, not just infrastructure SLOs',
    ],
    trap: 'Saying the canary was sufficient because it passed all gates. The gates were measuring the wrong things for slow-feedback metrics.',
  },

  // ── Shadow Mode ───────────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'When would you use shadow mode, and what are its limitations?',
    answer: `Shadow mode is ideal in two situations: before the very first production deploy of a new model, and when you are making a significant architecture change and want to validate outputs without any user exposure.

The mechanics: your serving layer duplicates every request, sends it to both the champion and the shadow, returns the champion's response to the user, and logs both outputs for offline comparison.

Key limitation: you cannot measure business impact — since users never see the shadow model's responses, you get no signal on CTR, engagement, or revenue. Shadow mode tells you "the outputs look reasonable and latency is within budget." It cannot tell you "users prefer this model." That is what A/B testing is for.

The other limitation is cost — you are running two inference stacks and paying for both.`,
    keyPoints: [
      'Zero user risk — champion always responds, shadow output is logged only',
      'Cannot measure business impact (no user sees shadow output)',
      'Runs two inference stacks — 2× compute cost',
      'Use before first deploy or before major architecture changes',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Shadow mode shows your new model produces identical outputs to the champion 99% of the time. Your PM says ship it. What are you still not confident about?',
    keyPoints: [
      'You have not measured business impact — users never saw the shadow output, so no CTR, conversion, or engagement signal',
      '1% output divergence at production scale can be millions of different predictions — you do not know if those divergences are better or worse',
      'Latency under sustained load: shadow mode adds load to your serving stack, real production traffic patterns may differ',
      'Feature freshness: shadow mode may have used cached features; production at peak hours may have higher feature staleness',
    ],
    trap: 'Saying "99% identical is good enough to ship." The 1% divergence is unknown in direction — those predictions could be systematically worse.',
  },

  // ── What Metrics to Watch ─────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'How do you know your serving infrastructure is healthy?',
    answer: `Five things to monitor:

Latency: P50, P95, P99 — not just mean. Mean hides tail issues.

Error rate: 4xx vs 5xx separately. 4xx is client error, 5xx is your problem.

Throughput: requests/sec — a sudden drop means an upstream issue even if latency looks fine.

Model-specific: prediction distribution — if your fraud model suddenly scores everything 0.0, the endpoint is "up" but completely broken. Standard uptime monitors will not catch this.

Saturation: queue depth, GPU memory usage — leading indicators before latency degrades. By the time P99 spikes, you are already in an incident. Watch saturation to act before that.`,
    keyPoints: [
      'P50/P95/P99 — never just mean latency',
      'Monitor prediction distribution, not just HTTP status codes',
      'Throughput drop can indicate upstream issues even when latency looks fine',
      'Saturation metrics (queue depth, GPU memory) are leading indicators',
    ],
    trap: 'Saying "I would check if the endpoint returns 200." The model can return 200 with completely wrong predictions.',
  },
  {
    difficulty: 'mid',
    question: "Your model's P50 is unchanged but P99 has doubled. Error rate is flat. Walk me through your investigation.",
    keyPoints: [
      'P99 spike with stable P50 means a subset of requests is experiencing extreme latency — classic long-tail problem',
      'Check if the slow requests share a pattern: specific feature values, larger input sizes, a particular user cohort',
      'Look at the serving trace breakdown: is the spike in feature retrieval, preprocessing, or inference itself?',
      'Check for cold-start requests hitting pods that just started, or batching behavior causing some requests to wait longer',
    ],
    trap: 'Immediately assuming the model is the problem. P99 spikes with stable P50 are often infrastructure issues — cold pods, feature store cache misses, batch wait time.',
  },

  // ── Degradation Signals & Automated Gates ────────────────────────────────
  {
    difficulty: 'senior',
    question: 'Your canary deploy just showed a 15% increase in P99 latency at 10% traffic. What do you do?',
    answer: `First, stop the rollout immediately — do not proceed to 50%. Route traffic back to 0% on the new model so the 10% of affected users go back to the champion.

Then diagnose before doing anything else. Is it the model itself — did you deploy a heavier architecture? Is it a cold start issue — were the new pods still warming up? Is it a feature pipeline issue — is the new model calling a slower feature store query? Look at the latency breakdown: feature lookup time, inference time, serialization time separately.

Critically — do not delete the canary deployment. Keep it running at 0% traffic so you can reproduce the issue, run profiling, and compare against the champion.

Once you understand the root cause, fix it, re-validate in shadow mode, and start the canary process again from 1%.`,
    keyPoints: [
      'Stop rollout first, then diagnose — never diagnose while users are affected',
      'Do not delete the bad pod — keep at 0% for debugging',
      'Break down latency by component: feature lookup, inference, serialization',
      'After fixing: shadow mode first, then restart canary from 1%',
    ],
    trap: 'Jumping to "I would roll back and redeploy a fix." The interviewer wants to see you keep the bad version around for diagnosis, and that you restart from shadow/1% rather than jumping back to 10%.',
  },
  {
    difficulty: 'mid',
    question: 'How do you decide when to promote a canary to the next traffic percentage?',
    answer: `You need specific, pre-defined gates — not just "monitor metrics." Specific gates I would use:

  • P99 latency within 5% of the champion baseline
  • Error rate below 1% (and not trending upward)
  • Prediction distribution not significantly shifted (PSI < 0.1 on key outputs)
  • Business metric (CTR, conversion) not degraded by more than 2% over a minimum observation window (30 minutes at each step)

These gates should be automated — tools like Argo Rollouts can pause canary promotion and wait for these conditions before proceeding. Human-in-the-loop doesn't scale when you're deploying multiple times a day.

The observation window matters as much as the thresholds. A model can look fine for 5 minutes then degrade — minimum 15–30 minutes at each step before promoting.`,
    keyPoints: [
      'Gates: P99 within 5% of baseline, error rate < 1%, PSI < 0.1 on predictions',
      'Observation window: minimum 15–30 minutes at each traffic percentage',
      'Automate gates with Argo Rollouts or Spinnaker — manual promotion does not scale',
      'Set thresholds before the canary starts, not after you see the data',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Why should rollback thresholds be defined before the canary starts, not after you see the data?',
    keyPoints: [
      'Post-hoc threshold setting introduces confirmation bias — you subconsciously set the threshold to justify the decision you already want to make',
      'Pre-defined thresholds force alignment with stakeholders before pressure to ship exists',
      'Automated rollback gates require thresholds baked in before the canary starts — you cannot automate on thresholds defined mid-experiment',
      'Regulatory and audit requirements in some domains require pre-specified evaluation criteria',
    ],
    trap: 'Thinking thresholds can be adjusted mid-experiment to account for "context." This is how bad models get shipped under pressure.',
  },

  // ── Rollback Mechanics ────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through exactly what happens in Kubernetes when you roll back a model deployment. What is preserved and what changes?',
    keyPoints: [
      'kubectl rollout undo switches the Deployment to the previous ReplicaSet — the old pods are already defined, no new image pull needed',
      'Takes seconds — Kubernetes just shifts which ReplicaSet is active, does not rebuild containers',
      'The bad ReplicaSet stays in cluster history at 0 replicas — not deleted',
      'Service DNS and load balancer remain unchanged — traffic routing is seamless to clients',
    ],
    trap: 'Saying rollback involves redeploying or rebuilding the old image. Kubernetes ReplicaSet-based rollback is a pointer swap, not a redeploy.',
  },
  {
    difficulty: 'senior',
    question: 'You just rolled back a model at 2am. The on-call engineer deletes the canary pod to "clean up." Why is this a mistake?',
    keyPoints: [
      'The bad pod is your evidence — it is the only place you can reproduce the failure, run profiling, and inspect logs with the exact state at failure time',
      'Deleting it means you lose the ability to diff against the champion and understand the root cause',
      'Without understanding root cause, you will deploy the same problem again',
      'Correct process: keep bad version at 0% traffic, schedule a post-mortem, investigate while the evidence is intact',
    ],
    trap: '"The rollback already happened so the pod is no longer needed." The rollback is not the end of the incident — the diagnosis is.',
  },

  // ── Why P99 Matters More Than P50 ────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Your model serves 50k RPS. P99 latency is 800ms. How many users per second are experiencing 800ms+ responses, and why does this matter for SLO design?',
    keyPoints: [
      '50,000 × 0.01 = 500 users per second experiencing 800ms+ latency',
      'At this scale, P99 "edge cases" are not edge cases — they are a constant stream of bad experiences',
      'SLOs set at P50 would look healthy while 500 users/sec have degraded UX',
      'This is why SLOs for user-facing ML should be set at P99 or P95, not mean or P50',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Your team is debating P95 vs P99 as the SLO target. What factors determine the right choice?',
    keyPoints: [
      'P99 is appropriate when tail latency causes visible UX degradation — synchronous, user-facing, blocking requests',
      'P95 may be acceptable for async or batch-adjacent flows where users are less sensitive to individual request latency',
      'Consider the business cost of the tail: in checkout flows, P99 latency directly maps to abandoned carts',
      'Tighter SLOs require more headroom (over-provisioning) — cost vs. quality trade-off that depends on domain',
    ],
    trap: 'Always recommending P99 without considering cost. Setting P99 SLOs requires provisioning for the worst case, which can be significantly more expensive.',
  },

  // ── Champion/Challenger Pattern ───────────────────────────────────────────
  {
    difficulty: 'senior',
    question: "What's the difference between champion/challenger and A/B testing?",
    answer: `They look similar but have different operational contexts.

A/B testing is a bounded experiment — you run it for a fixed period, reach statistical significance, declare a winner, and end the test. It is event-driven.

Champion/challenger is a continuous operational pattern — the champion always serves the majority of production traffic, and there is always a challenger being evaluated on a small slice, say 5–10%. When a challenger wins, it becomes the new champion, and immediately a new challenger goes into evaluation. It is an always-on improvement loop.

It is common in domains where models need continuous improvement and you cannot pause production to run experiments — fraud detection, credit scoring, ad bidding. The challenger slice is small enough to limit risk, but it is always there.`,
    keyPoints: [
      'A/B: bounded, time-limited, declares a winner then stops',
      'Champion/challenger: continuous loop, always one challenger in evaluation',
      'Champion/challenger is standard in fraud, credit, ad bidding',
      'Challenger slice (5–10%) limits risk while enabling constant improvement',
    ],
  },
  {
    difficulty: 'senior',
    question: 'In a champion/challenger system, what prevents the system from always selecting the same champion? How do you ensure the challenger is genuinely different?',
    keyPoints: [
      'If challenger training uses the same data and features as champion, it will converge to the same model — need explicit architectural or data diversity',
      'Challenger should differ on at least one axis: different algorithm, different feature set, different training window, or different objective',
      'Promotion criteria must include a minimum improvement threshold — not just "not worse" but meaningfully better by some delta',
      'Some teams run multiple challengers simultaneously at different slices — ensures competitive pressure',
    ],
    trap: 'Thinking any new model version qualifies as a challenger. Without explicit diversity requirements, champion/challenger degenerates into perpetual A/B testing of incremental retrains.',
  },

  // ── Offline Good, Online Bad ──────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'Walk me through the 4 root cause hypotheses for a model that performs well offline but degrades in production. How do you investigate each?',
    keyPoints: [
      'Data leakage: a feature contains future information at training time not available at serving. Test: re-run eval with strict temporal split — if offline metrics drop, leakage was inflating results',
      'Training-serving skew: preprocessing runs differently between pipelines. Test: log actual serving feature vectors and compare distribution against training data with KS test / PSI',
      'Distribution shift: production P(X) differs from training distribution. Test: run PSI on incoming features vs. training baseline. PSI > 0.2 means significant drift',
      'Feedback loop / exposure bias: model predictions change what data is available for next training. Test: compare offline eval on full corpus vs. only items the model would have surfaced',
    ],
    trap: 'Assuming the problem is overfitting. Overfitting is rarely the cause of offline-online discrepancy in production ML — the four above are far more common.',
  },
  {
    difficulty: 'senior',
    question: 'How do you distinguish training-serving skew from distribution shift? They can look identical in production dashboards.',
    keyPoints: [
      'Skew: your model is correct for its training distribution, but serving features are computed differently — same world, different preprocessing',
      'Shift: the world itself changed — new user cohorts, product changes, seasonality — model learned correctly but input distribution moved',
      'Key diagnostic: compare serving feature distributions against training distribution feature-by-feature. If individual feature statistics (mean, std) diverge without a clear external event, skew is more likely',
      'Temporal pattern: skew often appears immediately after a deployment or pipeline change; shift develops gradually over weeks',
    ],
  },

  // ── Training-Serving Skew ─────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Your training pipeline fills null features with the median value. Your serving pipeline fills nulls with 0. The model was trained 6 months ago and has been in production for 3 weeks. When did the skew begin?',
    keyPoints: [
      'The skew began at deployment 3 weeks ago — the model was always trained with median imputation, but serving was never using it',
      'The 6-month training date is a red herring — the model artifact itself is fine, the serving pipeline is the source of skew',
      'Null-heavy features will have systematically wrong inputs — model will produce wrong predictions for any request with missing values',
      'Detection: log serving feature vectors, compare null-feature distribution to training. A 0 where median was expected is immediately visible',
    ],
    trap: 'Saying the skew started 6 months ago when the model was trained. The model is correct for its training distribution. The skew is in the serving pipeline, which was only deployed 3 weeks ago.',
  },
  {
    difficulty: 'senior',
    question: 'How does a feature store eliminate training-serving skew at the architectural level?',
    keyPoints: [
      'Feature definitions live in one place — training pipeline and serving pipeline both call the same feature computation logic',
      'No code duplication means no opportunity for "same logic, different language" bugs',
      'Point-in-time correct feature retrieval for training — training sees exactly the features that would have been available at each historical serving time',
      'Platforms: Feast, Tecton, Vertex AI Feature Store, Hopsworks — all enforce single definition of truth',
    ],
    trap: 'Thinking a feature store is just a Redis cache. The core value is feature definition reuse and point-in-time correctness, not low-latency retrieval.',
  },

  // ── The SLA Budget ────────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through how you would decompose a 100ms P99 SLA across a typical ML serving stack. Where does inference fit in the budget?',
    keyPoints: [
      'Typical breakdown: network ~10ms each way, feature lookup ~2-5ms, preprocessing ~5ms, inference ~10-20ms, post-processing ~5ms — total ~42-55ms',
      'Inference is often NOT the bottleneck — feature retrieval and serialization eat more of the budget than most engineers expect',
      'Key insight: optimizing the model while ignoring feature retrieval is a common and expensive mistake',
      'Profile first — find the actual bottleneck before optimizing. Measure, then act.',
    ],
    trap: 'Assuming model inference dominates the latency budget. Engineers who go straight to model optimization without profiling routinely find the bottleneck is in feature lookup or serialization.',
  },
  {
    difficulty: 'senior',
    question: 'Latency is 150ms P99 and you need to hit 100ms. A junior engineer suggests quantizing the model first. What is wrong with this approach?',
    keyPoints: [
      'Without profiling, you do not know where the 150ms is spent — quantization only helps inference latency',
      'If feature lookup is 80ms of your budget, quantization saves maybe 5-10ms and leaves you at ~140ms',
      'First step is always: add distributed tracing and identify the dominant span',
      'Common non-model solutions: connection pooling for feature store, batching feature lookups, co-locating model server with feature store, response compression',
    ],
    trap: 'Agreeing that quantization is a good first step. It is a reasonable optimization but profiling is always step 1.',
  },

  // ── Prediction Distribution Monitoring ───────────────────────────────────
  {
    difficulty: 'mid',
    question: 'What is a "silent model failure" and why does standard uptime monitoring miss it?',
    keyPoints: [
      'A silent failure: the model returns HTTP 200, P99 is healthy, error rate is 0% — but predictions are wrong or degenerate',
      'Standard monitoring checks infrastructure health, not prediction health',
      'Example: fraud model scores every transaction 0.0 after a schema change upstream broke feature ingestion — endpoint looks healthy',
      'Prevention: monitor prediction distribution histogram, output entropy, null/fallback rate alongside infrastructure metrics',
    ],
    trap: 'Thinking "if the endpoint is up and returning 200, the model is working." The model can be returning the wrong answer for every single request.',
  },
  {
    difficulty: 'senior',
    question: 'Your fraud model returns 200 OK on every request but fraud rate is spiking. What prediction-level monitoring would have caught this?',
    keyPoints: [
      'Prediction distribution histogram: track the histogram of fraud scores over time — if scores suddenly cluster near 0.0, the model stopped predicting',
      'Output entropy: for classification, track average model confidence. A sudden spike (all high confidence) or collapse (all low confidence) signals drift',
      'Null/fallback rate: what percentage of requests used a default or fallback prediction — a spike means feature ingestion is broken',
      'Business metric SLOs: fraud rate itself as an SLO — if actual fraud incidents spike while model looks healthy, it is a silent failure',
    ],
  },

  // ── Dynamic Batching ──────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Explain dynamic batching. Why can a GPU process batch size 32 in nearly the same wall-clock time as batch size 1?',
    keyPoints: [
      'Dynamic batching: model server waits a configurable delay to accumulate requests, groups them into a batch, runs one inference pass, returns individual responses',
      'GPUs have thousands of CUDA cores — a batch-size-1 request leaves most cores idle, wasting the hardware',
      'Matrix multiplications in neural networks scale near-linearly in FLOPS but the overhead (kernel launch, data transfer) is amortized across the batch',
      'Result: batch-32 can have 10-20× higher throughput at similar or only slightly higher per-request latency',
    ],
    trap: 'Thinking batching is free. It adds latency equal to the queue delay to every request. The trade-off is throughput vs. tail latency.',
  },
  {
    difficulty: 'senior',
    question: 'You enable dynamic batching with 20ms queue delay. P99 latency increased 18ms but throughput improved 8×. Your SLA is P99 < 100ms and you are currently at 85ms. Is this acceptable?',
    keyPoints: [
      'New P99 would be ~103ms — breaking the SLA. Not acceptable without renegotiation',
      'The throughput gain is real but SLA compliance is binary — 100ms is the contract',
      'Options: reduce queue delay to 5-10ms and measure the trade-off, or negotiate a looser SLA given the throughput benefit',
      'Correct decision framework: measure throughput needed at your current QPS. If you are not throughput-constrained, disable or reduce the queue delay',
    ],
    trap: 'Accepting the change because throughput improved 8×. Throughput improvement does not override an SLA breach.',
  },

  // ── Caching in ML Serving ─────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'You deploy a new model and check your monitoring — prediction distribution looks completely stable. A colleague points out 60% of requests are cache hits. What is the problem?',
    keyPoints: [
      'Cache hits return predictions from the old model — your monitoring is showing the old model distribution, not the new one',
      'The new model is only being called for 40% of requests — your canary validation is based on 40% of intended traffic',
      'Drift detection is blind to cached traffic — you could have full feature drift in the live 40% while cached 60% masks it',
      'Fix: namespace cache keys by model version, flush cache on every deploy',
    ],
    trap: 'Saying "stable distribution means the deploy was successful." Stability from cache hits is false confidence.',
  },
  {
    difficulty: 'senior',
    question: 'What are the three ways caching can mask problems in ML serving, and how do you architect around each?',
    keyPoints: [
      '1. Stale predictions after model update: fix by namespacing cache keys with model version + flush on deploy',
      '2. Masking model drift: high cache hit rate means drift monitoring only sees uncached slice — fix by monitoring cache hit rate as a metric and sampling from live predictions specifically',
      '3. Near-duplicate input misses: slight input variation (whitespace, capitalisation) creates cache misses with no benefit — semantic caching using embedding similarity solves this but adds latency',
      'General rule: cache is safest for immutable inputs (image hash, stable product IDs) and must be explicitly versioned for mutable model state',
    ],
  },

  // ── Readiness vs Liveness Probes ─────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is the difference between a readiness probe and a liveness probe in Kubernetes? When does each matter for ML serving?',
    keyPoints: [
      'Liveness: is the container alive? Failure restarts the pod. Catches deadlocks, crashes, hung processes',
      'Readiness: is the pod ready to serve traffic? Failure removes it from load balancer rotation — traffic stops going to it',
      'For ML: a large model takes 30-120 seconds to load into GPU memory. Without readiness probe, Kubernetes routes traffic to a started-but-not-loaded pod — every request gets a 500',
      'Both are required. Liveness restarts broken pods; readiness prevents routing to unready pods',
    ],
    trap: 'Configuring only a liveness probe. The liveness probe does not stop traffic from reaching a pod that is starting up but has not loaded the model yet.',
  },
  {
    difficulty: 'mid',
    question: 'You deploy a 15GB model. 10% of requests fail immediately after deploy despite the liveness probe passing. What is happening and what is the fix?',
    keyPoints: [
      'The pod has started (liveness passing) but the model has not finished loading into GPU memory — readiness probe is missing or has too short an initialDelaySeconds',
      'Kubernetes routes traffic to all running pods regardless of model load state when readiness is not configured',
      'Fix: implement a readiness endpoint that returns 200 only after model is loaded and a warm-up inference has completed',
      'Set initialDelaySeconds based on measured startup time + buffer. Also configure a warmup request to ensure GPU memory is fully allocated',
    ],
  },

  // ── Feature Flags and Dark Launch ────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'What is the difference between a dark launch and shadow mode for ML model deployment?',
    keyPoints: [
      'Shadow mode: users always see the champion response — shadow output is logged but never shown to anyone',
      'Dark launch: a specific cohort (employees, beta users) actually receives the new model\'s responses — they see the new output',
      'Dark launch measures real user behavior on a controlled group; shadow mode measures output quality with zero user exposure',
      'Shadow before dark launch in the risk progression — shadow validates output distribution, dark launch validates user response',
    ],
    trap: 'Using the terms interchangeably. The key difference is whether any user ever sees the new model\'s output.',
  },
  {
    difficulty: 'senior',
    question: 'Why are feature flags stored in config files insufficient for production ML systems? What infrastructure is actually required?',
    keyPoints: [
      'Config file flags require a redeployment to change — defeating the purpose of decoupling deployment from exposure',
      'No dynamic targeting: config flags apply to all traffic, cannot segment by user cohort, region, or percentage',
      'No audit trail: who changed the flag, when, and why is untracked in config files',
      'Required: a flag service (LaunchDarkly, Unleash, custom Redis-backed service) that serving code reads at request time, with targeting rules, rollout percentages, and audit logs',
    ],
  },

  // ── Serving Patterns ──────────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'When would you choose batch over real-time serving for an ML model? Give a concrete example of each.',
    keyPoints: [
      'Batch: when you know the set of entities to score in advance and nobody is waiting in real time — weekly churn scoring, nightly recommendation pre-computation, offline eval',
      'Real-time: when a user or system is blocking on the prediction — fraud detection at payment time, search ranking, real-time ad bidding',
      'Cost difference: batch is 5-10× cheaper per prediction because you can use spot instances and schedule for off-peak hours',
      'Latency difference: batch is scheduled (minutes/hours delay acceptable); real-time requires millisecond response',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Your recommendation model does real-time serving and infrastructure costs are 10× over budget. What architectural change do you evaluate first?',
    keyPoints: [
      'Hybrid pattern: pre-compute embeddings and candidate sets in batch (nightly), store in a low-latency key-value store, serve predictions by fast lookup + lightweight re-ranking online',
      'Most of the compute cost in real-time recommendation is candidate generation — moving this to batch eliminates the expensive online computation',
      'The online model becomes lightweight: read pre-computed candidates, run a fast re-ranking model with fresh context signals',
      'Trade-off: pre-computed candidates are stale by up to 24 hours — acceptable for most recommendation use cases where interest changes slowly',
    ],
    trap: 'Going straight to "scale down the fleet." That addresses symptoms, not architecture. The right question is whether real-time serving is necessary for every component of the pipeline.',
  },

  // ── Model Registry ────────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'What metadata should a model registry store beyond just the model artifact, and why does each piece matter?',
    keyPoints: [
      'Training code commit SHA — enables exact reproduction of the training run',
      'Dataset version / hash — links the model to the exact data it was trained on',
      'Hyperparameters — required to reproduce and understand training decisions',
      'Evaluation metrics on a held-out benchmark — canonical performance reference',
      'Deployment stage (Staging / Production / Deprecated) — gating mechanism before canary',
    ],
    trap: 'Treating the registry as just a binary store (S3 + model.pkl) without capturing the provenance metadata needed for debugging or rollback',
  },
  {
    difficulty: 'senior',
    question: 'Six months of training runs are stored in S3 as model_v1.pkl through model_v47.pkl. A production incident requires rolling back to before last quarter\'s feature engineering change. What information do you lack?',
    keyPoints: [
      'No link between model files and the training code commit that produced them — you cannot identify which file corresponds to which feature engineering version',
      'No dataset version metadata — even if you find the right model, you cannot confirm it was trained on the pre-change data',
      'No evaluation metrics per file — you cannot verify the target model was actually better before the change',
      'This is the exact problem a model registry solves: every model artifact is linked to code commit, dataset version, and eval metrics at training time',
    ],
  },

  // ── ML-Specific SLOs ──────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Standard infrastructure SLOs are necessary but insufficient for ML systems. What layer is missing and why?',
    keyPoints: [
      'Infrastructure SLOs catch endpoint health but not prediction health — a model can have 99.9% uptime while producing wrong outputs',
      'Prediction quality SLOs needed: output distribution bounds (PSI < 0.1), output entropy bounds, business metric SLOs (CTR, conversion)',
      'Canary gates should include prediction SLOs alongside latency and error rate gates',
      'Without prediction SLOs, a model that passes all infrastructure gates but produces a shifted distribution ships silently',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Your canary passed all latency and error rate gates but conversion dropped 3% after full deploy. What SLO would have caught this, and how do you implement it as a canary gate?',
    keyPoints: [
      'A business metric SLO: conversion must not degrade by more than 2% vs. champion over a 60-minute observation window',
      'Implementation: measure conversion rate on canary traffic slice vs. champion slice in real time using an A/B framework alongside the canary',
      'Requires a holdback/control group — some users stay on champion throughout so you have a baseline to compare against',
      'Challenge: conversion has delayed feedback (user converts hours after the recommendation) — need to use a leading metric proxy or extend observation window',
    ],
    trap: 'Saying "add business metrics to dashboards." Dashboards are for humans. The fix is automated gates that halt canary promotion when business metrics degrade.',
  },

  // ── Quantization: PTQ vs QAT ──────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: "What's the difference between PTQ and QAT, and when would you choose one over the other?",
    keyPoints: [
      'PTQ: calibrate scaling factors on a representative dataset after training — no retraining needed, takes hours. Typically costs 0.5-2% accuracy for INT8',
      'QAT: simulate quantization noise during training forward pass — model learns to be robust to it, recovers most accuracy. Requires retraining',
      'Decision: always try PTQ first. Only pay QAT retraining cost if PTQ accuracy loss is unacceptable',
      'For LLMs, INT4 PTQ (GPTQ, AWQ) is production-standard; INT8 KV cache quantization is almost always safe',
    ],
    trap: 'Jumping to QAT without trying PTQ — QAT costs days of retraining for what might be an unnecessary investment',
  },
  {
    difficulty: 'mid',
    question: 'Walk me through the pipeline from a trained FP32 model to a deployed quantized model. What validation step do engineers most often skip?',
    keyPoints: [
      'Pipeline: Train (FP32) → PTQ calibration → Export to ONNX → TensorRT/CoreML compilation → Integration test → Deploy',
      'Most skipped step: eval between PTQ and compilation — both independently affect accuracy, and TensorRT layer fusion can introduce additional precision changes',
      'Also skipped: benchmarking on representative production traffic, not just a held-out test set — quantization can affect rare input distributions disproportionately',
      'Always run your full eval suite after each transformation step, not just at the end',
    ],
  },

  // ── Knowledge Distillation ────────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: "Explain knowledge distillation. What's the key insight behind using soft labels from a teacher model?",
    keyPoints: [
      'Student trained to match teacher\'s output probability distribution, not just hard class labels',
      'Soft labels carry structural knowledge — if teacher gives 85% cat, 12% lynx, 3% dog, the student learns cats and lynxes are similar. Hard label "cat" discards this',
      'Temperature T > 1 softens the distribution further — higher T transfers more of the teacher\'s uncertainty and similarity structure',
      'Result: DistilBERT achieves 97% of BERT performance with 40% fewer parameters and 60% faster inference',
    ],
    trap: 'Describing distillation as just training a smaller model on the same data. The soft labels are the mechanism — without them it is just training a smaller architecture.',
  },
  {
    difficulty: 'senior',
    question: 'You need to deploy a model on a mobile device with a 512MB RAM limit. The base model is 7GB. In what order do you apply optimization techniques?',
    keyPoints: [
      '1. Knowledge distillation: create a smaller student architecture that fits the constraint — this is architectural compression, not just numerical precision',
      '2. PTQ on the student: quantize INT8 or INT4 to further reduce size and speed up inference on mobile hardware',
      '3. Pruning: remove weights below a magnitude threshold — reduces parameter count but requires careful fine-tuning to maintain accuracy',
      '4. ONNX export + mobile runtime: TFLite or CoreML for hardware-accelerated inference on device NPU/GPU',
    ],
    trap: 'Starting with quantization. INT8 quantization of a 7GB model gives ~1.75GB — still 3× over budget. Architecture compression (distillation) must come first.',
  },

  // ── Production Readiness Gates ────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through the production readiness checklist that should pass before a canary starts. What are the four categories?',
    keyPoints: [
      'Data validation: temporal split correctness, feature schema match, null rate within baseline bounds',
      'Model validation: accuracy/AUC meets threshold, edge case subsets pass, inference latency meets SLA headroom, fairness metrics in bounds',
      'Infrastructure validation: Docker image passes integration tests, readiness probe responds within expected startup time, shadow mode output distribution matches expectations',
      'Rollback validation: previous version exists in registry, rollback procedure tested end-to-end and documented',
    ],
    trap: 'Thinking the canary IS the production readiness gate. The canary is the last gate, not the first. Skipping pre-canary validation increases blast radius.',
  },
  {
    difficulty: 'senior',
    question: 'Your CI says all tests pass. Your canary at 5% traffic immediately shows prediction distribution shift. What pre-canary gate was missing?',
    keyPoints: [
      'Shadow mode comparison: running the new model against live traffic in shadow mode would have surfaced the distribution shift before any canary traffic',
      'Missing: shadow mode output distribution check as a pre-canary gate — compare new model output histogram against champion on a 24h sample',
      'Also missing: feature schema validation between training and serving — distribution shift often starts as a schema mismatch that CI tests cannot catch',
      'Root cause is likely: new model trained on different feature distribution, or preprocessing pipeline changed between training and serving',
    ],
  },

  // ── Queue-Based Autoscaling ───────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Why is CPU utilization a bad autoscaling signal for ML serving, and what should you use instead?',
    keyPoints: [
      'ML workloads are GPU-bound — CPU stays low while GPU is saturated. HPA sees low CPU and does not scale',
      'CPU reacts after load has already hit — by the time HPA scales, users have experienced 90+ seconds of degraded latency',
      'Better signals: request queue depth (scale when requests pile up), GPU utilization via DCGM metrics, time-in-queue P99',
      'KEDA: extends Kubernetes HPA to scale on custom metrics from Prometheus, Kafka, SQS — enables queue-depth-based scaling',
    ],
    trap: 'Assuming default Kubernetes HPA works for all workloads. It is designed for CPU-bound web services, not GPU-bound inference.',
  },
  {
    difficulty: 'senior',
    question: 'Your model server pods are at 100% GPU utilization but Kubernetes HPA shows 20% CPU and is not scaling. New requests are timing out. What is the full fix?',
    keyPoints: [
      'Problem: HPA is using CPU as the scaling metric, which is low because GPU is doing the work',
      'Fix: install KEDA and define a ScaledObject targeting GPU utilization (via DCGM exporter + Prometheus) or request queue depth',
      'Also: set a minimum replica count that handles typical off-peak traffic to avoid cold-start scaling delays during sudden spikes',
      'Scale-down cooldown: set to at least 10 minutes to prevent thrashing — GPU nodes take 3-5 minutes to provision, aggressive scale-down wastes that investment',
    ],
  },

  // ── Speculative Decoding ──────────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'Explain speculative decoding. How does it achieve 2-4× throughput improvement with identical output quality?',
    keyPoints: [
      'A small draft model generates K candidate tokens in one pass; the large target model verifies all K in one parallel forward pass',
      'Target model verification of K tokens has similar wall-clock time to generating 1 token — so accepting 3 of 5 draft tokens gives 3× speedup',
      'Output is mathematically identical to target model running alone — rejected tokens trigger regeneration from the rejection point',
      'Speedup depends on draft acceptance rate: aim for > 70%. Below ~50%, speculative decoding is slower than standard decoding due to rejections',
    ],
    trap: 'Thinking there is an accuracy trade-off. When implemented correctly, the output distribution is provably identical to the target model.',
  },
  {
    difficulty: 'senior',
    question: 'Your draft model has a 35% token acceptance rate. Will speculative decoding help or hurt throughput, and why?',
    keyPoints: [
      'At 35% acceptance, most draft tokens are rejected — you pay for the draft model pass and the verification pass but accept fewer tokens per cycle',
      'Break-even is typically around 50-60% acceptance rate depending on draft-to-target size ratio',
      'At 35%, you are generating extra computation (draft) and accepting fewer tokens — net throughput is likely worse than standard decoding',
      'Fix: choose a draft model that shares vocabulary with the target and is stylistically similar — a 7B model as draft for a 70B target of the same family works well',
    ],
  },

  // ── Multi-Armed Bandit vs A/B ─────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'When would you use a multi-armed bandit instead of a standard A/B test for model selection? What are the trade-offs?',
    keyPoints: [
      'MAB continuously shifts traffic toward the better-performing variant — minimizes regret vs. fixed A/B splits',
      'MAB requires immediate feedback: click, purchase, immediate reward. Delayed feedback (3-day conversion) breaks most bandit algorithms',
      'A/B gives cleaner statistical inference and is better for regulated domains or when you need a p-value for a business decision',
      'Thompson Sampling adapts faster than epsilon-greedy; UCB favors variants with high uncertainty to reduce under-exploration',
    ],
    trap: 'Using a bandit when feedback is delayed — incomplete reward signals cause poor allocation decisions',
  },
  {
    difficulty: 'mid',
    question: 'Explain the exploration-exploitation trade-off in multi-armed bandits. How does epsilon-greedy implement it, and what is its main weakness?',
    keyPoints: [
      'Exploration: send traffic to all variants to keep learning which is better. Exploitation: send traffic to the current best-performing variant',
      'Epsilon-greedy: ε% of requests go to a random variant (explore), (1-ε)% go to the current best (exploit)',
      'Weakness: fixed ε means exploration rate does not decrease as confidence grows — still exploring at 10% when you have 10,000 samples and high confidence',
      'Thompson Sampling improves on this: exploration naturally decreases as posterior variance shrinks with more data',
    ],
  },

  // ── Distributed Tracing ───────────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'How do you implement distributed tracing for an ML prediction pipeline, and what ML-specific spans would you add?',
    keyPoints: [
      'Use OpenTelemetry SDK — vendor-neutral, 2025 standard. Add spans for every ML-specific step',
      'ML spans: feature_fetch (store name + latency + cache hit/miss), preprocessing, inference (model_version + device + batch_size), post-processing',
      'Tag every span with model_version — enables filtering traces by version to correlate latency changes with deploys',
      'For async pipelines (Kafka), inject trace context into message headers to maintain trace continuity across service boundaries',
    ],
    trap: 'Only instrumenting the HTTP layer and missing inference internals — you see slow requests but cannot identify whether the bottleneck is feature lookup, batching, or GPU inference',
  },
  {
    difficulty: 'senior',
    question: 'Why should queue wait time and GPU inference time be traced as separate spans? What different actions does each metric trigger?',
    keyPoints: [
      'Queue wait time is a scaling signal: if queue wait is high, you need more replicas — this is an infrastructure/capacity problem',
      'GPU inference time is a model signal: if inference is slow per token, the model architecture or batch configuration needs optimization',
      'Combining them into one "inference" span hides which problem you actually have — leading to wrong remediation',
      'High queue wait + low inference time → scale out. Low queue wait + high inference time → optimize model or increase batch size',
    ],
  },
];

// ── AI Prompt ─────────────────────────────────────────────────────────────────

export const AI_PROMPT_TEMPLATE = (
  v1Traffic: number,
  v1p50: number, v2p50: number,
  v1err: number, v2err: number
) =>
  `I am running a canary deployment. v1 (stable) is receiving ${v1Traffic}% of traffic with P50 latency ${v1p50}ms and error rate ${v1err}%. v2 (canary) is receiving ${100 - v1Traffic}% with P50 ${v2p50}ms and error rate ${v2err}%. In 3 sentences: should I increase canary traffic, hold, or roll back? Be direct.`;
