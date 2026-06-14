// ─────────────────────────────────────────────────────────────────────────────
// Traffic Split - Study Guide & Interview Q&A
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
    body: `Traffic splitting routes a percentage of incoming requests to different model versions simultaneously. The load balancer acts as a policy engine - not just round-robin, but weighted routing based on deployment strategy. This lets you validate a new model on real production traffic without full exposure.

The mechanism lives at the infrastructure layer, not the application layer. Common implementations include Istio VirtualService with weighted destination rules (specifying, for example, 95% to v1 and 5% to v2 as separate subsets), AWS Application Load Balancer weighted target groups, NGINX upstream weight directives, and Kubernetes-native controllers like Argo Rollouts or Flagger. Each approach has different semantics: Istio operates at the Layer-7 HTTP level and can route on headers and paths, while ALB weighted groups operate at the request level without requiring a service mesh.

A critical property of infrastructure-layer traffic splitting is that it is transparent to both models: neither model knows its traffic share. This matters for observability - you can compare metric histograms between the two versions and be confident the differences are attributable to the model, not to different request distributions. At Uber, the Michelangelo platform processes thousands of model updates weekly using exactly this property: each new model version gets a small slice, metrics are compared, and the system auto-promotes or auto-rolls back based on pre-defined gates. The traffic split itself is the experiment control.

One subtlety that teams frequently miss: sticky sessions. If you are using cookies or user-ID-based session affinity, the same user may always land on the same model version regardless of the configured weight. This is desirable for A/B testing (you want consistent user experiences within the experiment window) but undesirable for canary validation where you want a random sample of all users on the canary. Make sure your traffic splitting strategy aligns with whether you need session affinity.`,
  },
  {
    heading: 'Blue/Green vs Canary',
    body: `Blue/Green deployments maintain two complete, independent environments. The "blue" environment runs the current production model; the "green" environment runs the new version. When green is ready, a single DNS or load-balancer change flips 100% of traffic from blue to green in seconds. Rollback is equally instant - flip back. The appeal is operational simplicity: no gradual ramp logic, no monitoring gates, just a switch.

The failure mode of blue/green for ML is severe. The instant 100% cutover means that if the new model has a subtle behavioral regression - a prediction distribution shift, a specific input class that causes timeouts, or a silent accuracy drop - every user is exposed before any automated monitoring can fire. ML behavioral regressions are often invisible in the first 30 seconds of traffic. By the time your alerting catches a CTR drop or a shift in prediction distribution, all 100% of users have already seen the degraded model. The rollback is fast, but the blast radius of the initial exposure was total.

Canary is the correct pattern for ML model updates precisely because behavioral regressions are subtle and only become statistically detectable at scale with some time to accumulate data. Traffic shifts gradually: 1% to 5% to 20% to 50% to 100%. At each stage, you observe metrics for a minimum observation window (typically 30 minutes). A regression at 1% traffic affects 1% of users, not 100%. Rollback from 1% canary traffic back to 0% takes seconds in Argo Rollouts and returns the impacted slice to the champion immediately.

The practical guideline: use blue/green for infrastructure-level changes that have been pre-validated in shadow mode (hardware migrations, framework upgrades, container OS changes) where you have already confirmed output correctness and just need the cutover to be atomic. Use canary for model updates, feature engineering changes, preprocessing logic changes, and any other modification that can affect model behavior in ways that require statistical accumulation to detect.`,
  },
  {
    heading: 'Canary vs A/B Testing - Not the Same Thing',
    body: `Canary is a safety mechanism - you are asking "is it safe to roll this out?" The traffic split is temporary, the goal is to reach 100%, and the metrics you watch are regression signals: P99 latency increases, error rate spikes, prediction distribution shift. The moment you detect a regression, you halt the rollout. The canary split is not held steady; it marches forward toward full rollout as long as gates pass.

A/B testing is an experiment - you are asking "which model produces better business outcomes?" The split is held deliberately steady (often 50/50) long enough to accumulate statistical power on your primary business metric. You are not trying to reach 100%; you are measuring a difference between variants with enough confidence to make a product decision. The experiment ends when you have reached statistical significance, not when one variant "wins" a safety check.

In practice the two are often combined in a deployment pipeline. The first phase is a canary: ramp from 1% to 25% watching infrastructure and prediction quality gates. Once you are at 25% with no regressions, hold the split steady for 48 hours to accumulate business metric data. That hold period is your embedded A/B test. Once the business metrics show the new model is at least as good as the champion, proceed to 50%, then 100%.

The failure mode when teams confuse the two: they run a canary, watch latency and error rate, declare victory at 25%, and ramp to 100% - never waiting to measure CTR or conversion. Two weeks later, conversion metrics show a 5% regression that the canary gates completely missed because those gates only checked infrastructure health. Business metric gates require a different time horizon and a different experiment design. A fast canary ramp that skips business metric observation is not a complete validation.`,
  },
  {
    heading: 'Shadow Mode',
    body: `Shadow mode deploys a new model alongside the production champion without returning its results to users. The infrastructure layer - typically an Istio gateway or a custom serving proxy - duplicates every incoming request. The original flows synchronously to the champion, whose response is returned to the caller. A copy is dispatched asynchronously to the shadow model, whose response is logged for comparison and then discarded. The user never interacts with the shadow output.

The critical engineering constraint is that the shadow path must be fully out-of-band. Asynchronous mirroring at the gateway adds less than 2ms P99 overhead when implemented correctly in Istio or Envoy. A common production mistake is implementing mirroring in NGINX, which can delay the original response if the shadow backend is slow - because NGINX does not decouple the mirror path from the primary request path at the connection level. Uber's production implementation, which covers over 75% of critical online ML use cases, shows that at 40,000 requests per second with 4KB payloads, full mirroring adds 1.3 Gbps of internal traffic. Sampling 25% of traffic reduces this to 325 Mbps and is statistically sufficient to detect systematic divergence.

The core value of shadow mode is risk-free production validation. The shadow model sees real production traffic at full fidelity - real users, real input distributions, real timing - without any user exposure. You can validate that the new model's prediction distribution matches the champion, that its latency is within budget, and that it does not crash under real load. This is precisely the validation that staging environments cannot provide: staging traffic is synthetic, staging data scale is smaller, and staging request timing does not replicate the bursty, correlated nature of real production load.

Key limitation: shadow mode cannot measure business impact. Since users never see or interact with shadow model outputs, you have no signal on CTR, engagement, conversion, or revenue. A shadow model with perfect output similarity to the champion might still produce worse business outcomes if the few differences happen to be in high-value edge cases. Shadow mode tells you "the outputs look similar and latency is within budget." It cannot tell you "users prefer this model." That is what A/B testing is for. Shadow mode is the safety gate before canary, not a replacement for it.`,
  },
  {
    heading: 'What Metrics to Watch',
    body: `P50 (median latency) represents the typical user experience but is a deeply misleading primary metric for ML systems. Google's research on fan-out architectures shows that a service with P99 of 10ms produces roughly 140ms of user-visible latency when a single user request triggers 100 parallel backend model calls - the user waits for the slowest call, not the median. At 10,000 RPS, a P99 of 500ms means 100 requests per second are experiencing that slow tail. Optimize for P95 or P99 on user-facing paths, not P50.

For ML specifically, infrastructure latency metrics are necessary but not sufficient. A model can maintain P99 within budget and zero HTTP 5xx errors while being completely broken. The most important ML-specific metrics are: prediction distribution (track the histogram of model outputs over time - if your fraud model suddenly scores every transaction near 0.0, the endpoint is "up" but useless), output entropy (sudden spikes in average model confidence often indicate the model is extrapolating far outside its training distribution), null or fallback rate (a spike usually means a schema change upstream broke feature ingestion), and feature distribution shift measured by PSI (Population Stability Index) against the training baseline.

Business metrics are the ground truth. CTR, conversion rate, session length, and revenue per user are what ultimately determine whether your model is working. A model that is technically healthy but drives lower CTR has a problem that latency monitoring will never catch. These metrics must be in your primary oncall dashboard alongside P99 and error rate - not in a separate "model health" page that nobody checks during an incident. The challenge is that business metrics have delayed feedback: a recommendation click might happen 30 seconds after the prediction, but a downstream purchase conversion might happen 3 days later. Design your monitoring system to account for this lag, and do not declare a deployment successful until you have observed at least one full feedback cycle for your most important downstream metrics.`,
  },
  {
    heading: 'Degradation Signals & Automated Gates',
    body: `Set rollback thresholds before the canary starts - post-hoc threshold setting introduces confirmation bias. Under deadline pressure to ship, teams subconsciously adjust thresholds to rationalize the data they have already seen. Pre-defined thresholds force stakeholder alignment before any shipping pressure exists and are a requirement for automated gate systems like Argo Rollouts AnalysisTemplates.

Typical production gate thresholds fall into three layers. Infrastructure gates fire fast (minutes): P99 latency within 5% of the champion baseline, HTTP 5xx error rate below 1%, throughput not degraded below 95% of expected. These are the trip-wire gates that catch severe failures immediately. Model quality gates evaluate on a slightly longer window (15–30 minutes): PSI on prediction outputs below 0.1 (above 0.2 is a major distribution shift requiring investigation), null or fallback prediction rate not elevated, confidence distribution not significantly shifted. Business metric gates require the longest window (hours to days for some metrics): CTR not degraded by more than 2%, conversion rate within statistical confidence interval, revenue per user within 3% of champion.

Automated gate execution in Argo Rollouts uses AnalysisTemplates - declarative Prometheus (or Datadog, CloudWatch, New Relic) queries evaluated on a schedule at each traffic step. A Rollout spec defines steps: set weight to 5%, run analysis, pause for 30 minutes, set weight to 25%, run analysis again. If any AnalysisRun fails, the Rollout automatically halts promotion and optionally triggers rollback. The critical discipline: AnalysisTemplates should query ML-specific Prometheus metrics (prediction entropy, output PSI, business CTR) alongside infrastructure metrics. Gates that only check P99 and error rate will happily promote a model with a 4% CTR regression because those metrics look fine. Netflix's Kayenta platform and Spinnaker implement the same concept: automated metric-gated promotion where a canary must prove itself better than - or at least not worse than - the champion before advancing.`,
  },
  {
    heading: 'Rollback Mechanics',
    body: `In Kubernetes, rollback is a pointer swap, not a redeployment. The kubectl rollout undo command instructs the Deployment controller to switch the active ReplicaSet from the current version back to the previous one. Because the old ReplicaSet definition (container image, resource specs, environment variables) is already stored in the cluster, Kubernetes does not need to pull a new image or wait for new pod initialization - the old pods are scaled back up from existing definitions. The Service's selector shifts to the old ReplicaSet, and traffic routing updates in seconds. This is why rollback in Kubernetes is measured in tens of seconds rather than minutes.

Critically, the failed new-version ReplicaSet remains in the cluster at zero replicas - it is not deleted. This is intentional. The failed pod is the primary evidence for root cause analysis. Deleting it destroys your ability to: reproduce the failure by replaying production traffic logs against it in staging, run profiling to find memory leaks or CPU hotspots, inspect logs with the exact state at failure time, and diff the container configuration against the champion. A common 2am oncall mistake is cleaning up failed pods to "simplify" the environment. The correct process: keep the failed version at 0% traffic, schedule a post-mortem, investigate while the evidence is intact, and delete only after root cause is documented.

Automated rollback through Argo Rollouts or Spinnaker closes the gap between gate failure and remediation. When an AnalysisRun detects a threshold breach - say P99 spiking 15% above baseline - the controller immediately halts the canary and shifts traffic back to the previous weight. If the system is configured for auto-rollback on hard gate failures (error rate above 5%, P99 above 2x baseline), no human needs to be paged for the rollback itself. The page is informational: "canary rolled back automatically, investigate root cause." This distinction matters for MTTR: manual rollback is bounded by human pager response time (minutes to tens of minutes), while automated rollback executes in seconds. At Uber's scale of thousands of model updates weekly, manual rollback is not operationally viable.`,
  },
  {
    heading: 'Why P99 Matters More Than P50',
    body: `In recommender systems and search, a slow response at the 99th percentile means 1 in 100 page loads is visibly broken. At 10,000 RPS, that is 100 bad requests per second - a constant stream of degraded user experiences that aggregate metrics make invisible. The mean and P50 can look perfectly healthy while hundreds of users per second experience timeouts or stale pages.

The amplification effect in fan-out architectures makes this worse. Google's canonical analysis shows that if a single user request triggers N parallel backend calls and each call has P99 latency of T milliseconds, the probability that the user's response is delayed beyond T milliseconds is 1 minus (0.99)^N. For N=100 parallel scoring calls - common in ad ranking and search - this probability is approximately 63%. The "P99 outlier" becomes a near-certain event for the user. Optimizing P50 in this context is not just inadequate - it is actively misleading, because every improvement to the median is invisible to users under fan-out.

Latency distributions for ML inference are heavily right-skewed due to events that the median cannot capture: garbage collection pauses in JVM-based serving frameworks (which can add 50–200ms), cold GPU kernel starts on the first request to a new pod, cache misses in the feature store that force a full database lookup, and batch formation delays in dynamic batching servers. These events are rare individually but occur constantly at scale. At 10,000 RPS, even a 1-in-10,000 event (P9999) hits your system once per second. SLOs for user-facing ML models should be set at P99 at minimum, with P99.9 targets for the most latency-sensitive paths like fraud detection at payment time and real-time bidding.`,
  },
  {
    heading: 'Champion/Challenger Pattern',
    body: `The champion/challenger pattern is an always-on evaluation loop: the champion model serves the majority of production traffic (typically 90–95%), and a challenger model is continuously evaluated on a small slice (5–10%). When a challenger accumulates sufficient statistical evidence that it outperforms the champion on the primary business metric, it is promoted to champion - and immediately a new challenger begins evaluation against the new champion. There is no end state; the loop runs continuously.

This is distinct from A/B testing in operational intent. An A/B test is a bounded, time-limited experiment that ends with a winner declaration. Champion/challenger is a continuous operational steady-state. In A/B testing, neither variant is designated as the incumbent; both are treated as experimental. In champion/challenger, the champion is always the production default with the full safety guarantees of battle-tested serving, and the challenger bears the risk of the small traffic slice.

Champion/challenger is standard in domains where models must continuously improve without production pauses: fraud detection systems at financial institutions, credit scoring models, and programmatic ad bidding. In these domains, the cost of not continuously improving is measurable in dollars and fraud losses. At 5% challenger traffic, a bad challenger affects only 5% of users - an acceptable blast radius for the continuous improvement benefit. The challenger traffic slice is large enough to accumulate statistically meaningful signal within days to weeks, but small enough that a challenger regression causes minimal harm before the champion automatically resumes full serving.

A subtle production gotcha: if challenger training uses identical features and architecture as the champion, the system tends to converge to the same model repeatedly and provide no improvement signal. Effective champion/challenger requires explicit diversity requirements - the challenger must differ on at least one axis: different algorithm family, different feature set, different training time window, or different optimization objective. Some teams run two or three simultaneous challengers at different small traffic slices to maintain competitive pressure and accelerate the improvement loop.`,
  },

  // ── Extended: critical production ML concepts ─────────────────────────────

  {
    heading: 'Offline Good, Online Bad - Diagnostic Framework',
    body: `A model that scores well in offline evaluation but degrades in production is one of the most common and expensive ML failures in any organization. The root cause is almost never overfitting - it is usually one of four structural problems, each with a specific diagnostic test that falsifies or confirms it.

Data Leakage: a feature contains future information at training time that is not available at serving time. The classic example is using total_purchases_ever to predict a purchase where that purchase is included in the total. Another common form is using a row-level identifier as a feature when the model will never see that identifier at serving time, allowing the model to memorize labels. Diagnostic: re-run evaluation with a strict temporal split - train on data before date T, evaluate on data after T, with no features derived from post-T data. If offline AUC drops significantly, leakage was inflating the offline numbers. Models with leakage can achieve near-perfect offline AUC (0.99+) while being near-random in production.

Training-Serving Skew: preprocessing runs differently between your training pipeline and your serving pipeline. Feature values are stale (a user embedding computed at 2am that the model receives at 11pm with 21 hours of drift). Null handling differs (training fills nulls with the training set median; serving fills with 0). Data type mismatches (age trained as float, served as int, causing unexpected quantization of the feature space). Diagnostic: shadow mode is ideal here - log the exact feature vector the model receives at serving time and compare the distribution of each feature against the training distribution using KS test or PSI. Divergence in feature distributions without any model change confirms skew rather than drift. Prevention: define features once in a feature store (Feast, Tecton, Vertex AI Feature Store), ensuring training and serving pipelines read from the same feature definitions and never re-implement preprocessing logic separately.

Distribution Shift: production traffic P(X) differs from training distribution - new user cohorts, seasonality, a product UI change that altered user behavior, a competitor event that shifted demand. The model learned its training distribution correctly; the world moved. Diagnostic: run PSI on incoming feature distributions versus the training baseline. PSI above 0.2 indicates significant drift; above 0.25 requires retraining. KS tests on individual feature distributions identify which specific features shifted most.

Feedback Loop / Exposure Bias: the model's own predictions change what data is available for the next training run. Classic in recommendations - the model only surfaces items it scored highly, so users only interact with those items, and the next training dataset contains only interactions with high-scored items. The model never gets feedback on items it ranked low, and over time it becomes increasingly confident in a narrowing set of recommendations. Offline evaluation does not capture this because the historical data does not reflect counterfactual outcomes for items the previous model suppressed.

Interview answer structure: "I would not assume overfitting. I enumerate these four hypotheses in order of diagnostic cheapness - leakage is fastest to check with a temporal split, skew requires logging feature vectors, drift requires feature distribution monitoring, and feedback loop requires counterfactual analysis. I run the cheapest test first to falsify each hypothesis before moving to the next."`,
  },
  {
    heading: 'Training-Serving Skew in Detail',
    body: `Training-serving skew is when the data your model sees at serving time is different from what it trained on - even if the model artifact is completely identical and deployment went smoothly. It is insidious precisely because everything appears correct at the deployment level while silent errors propagate at the feature level.

The most dangerous form of skew is preprocessing code divergence. The training pipeline applies feature engineering in Python/Pandas or PySpark with specific edge case handling - log-transforming zeros with a small epsilon offset, encoding rare categories as "OTHER", clipping outliers at the 99th percentile of training data. The serving pipeline re-implements the same logic in a different language (Java, Go, C++) for performance, and misses an edge case. The resulting model receives features that differ systematically from what it trained on. The model does not error - it just produces subtly wrong predictions that only become visible in aggregate monitoring over days to weeks.

Another high-frequency cause is feature staleness. A user's embedding vector might be computed in a nightly batch job, persisted to a feature store, and then read at serving time up to 23 hours later. The model was trained treating these embeddings as representing the user's state at prediction time, but the serving embedding represents the user's state from yesterday night. For users whose behavior changes rapidly - a new user making their first purchase, a user whose account is compromised, a user who just searched for a very different category - this staleness creates systematic prediction errors precisely when the model should be most alert.

Detection strategy: log the exact feature vector (as a structured record, not a hash) that the model receives at serving time. Store these serving feature logs alongside training feature logs in the same data warehouse. Run automated PSI comparisons on a daily schedule: for each feature, compute PSI between the training distribution and the past 24 hours of serving distributions. A PSI above 0.1 for a feature that has not been intentionally changed is almost always skew, not drift - drift develops over weeks, skew appears immediately after a deployment or pipeline change.

The architectural solution is a unified feature store. Both training and serving read from the same feature definitions and the same computation logic. Platforms like Tecton, Hopsworks, and Vertex AI Feature Store enforce this by design - you define a feature transformation once and the platform applies it identically for both historical training retrieval and real-time serving lookup. The core value is not low-latency caching (though they provide that too) - it is eliminating the opportunity for "same logic, different language" bugs that produce training-serving skew.`,
  },
  {
    heading: 'The SLA Budget - Where Does 100ms Go?',
    body: `A 100ms P99 SLA is achievable for most ML serving workloads, but only if engineers understand where time is actually spent across the full request path. The most common mistake is optimizing model inference - which is often not the bottleneck - while leaving the actual bottleneck untouched.

A representative budget for a user-facing recommendation endpoint on a well-tuned stack:

  Network (client to gateway, same region)     ~8ms
  Gateway processing and auth                  ~3ms
  Feature lookup (Redis or feature store)       ~5–15ms
  Preprocessing and feature serialization       ~4–8ms
  Model inference (GPU, batch size 1–4)         ~10–25ms
  Post-processing and business rules            ~4ms
  Response serialization                        ~2ms
  Network (gateway to client)                   ~8ms
  Buffer for variance and GC pauses             ~20ms
  Total P99 budget                              ~64–93ms - within the 100ms target

The inference step consumes 10–25ms of this budget. Feature lookup and network collectively consume roughly the same or more. Optimizing the model by 5ms through quantization while feature lookup still takes 15ms over a high-latency connection leaves you net-neutral. Pinterest discovered this pattern when profiling GPU recommendation inference: CPU-to-GPU data copying was costing 10ms per inference call, and batching hundreds of individual tensor transfers into a single contiguous buffer transfer reduced it to under 1ms - a 10x improvement achieved without touching the model.

The diagnostic discipline: always instrument the full end-to-end request path with distributed tracing (OpenTelemetry is the 2025 standard) before any optimization work. A trace that shows [Feature lookup: 42ms] [Inference: 12ms] means you spend optimization time on feature retrieval (connection pooling, co-location with the model server, batching feature lookups, switching from a remote feature store to a local cache), not on the model. A trace that shows [Feature lookup: 3ms] [Inference: 67ms] means you go to model optimization first. Profile first, optimize second - the order matters enormously for engineering efficiency.

Additional budget considerations that teams consistently underestimate: (1) Feature store cold-start - the first request after a cache eviction pays the full database round-trip cost, which can be 50–200ms. (2) GC pauses - JVM-based serving frameworks (TorchServe is partially JVM-backed) experience GC pauses that produce P99.9 latency spikes completely invisible at P99. (3) Connection establishment - if the feature store connection pool is exhausted at peak traffic, new requests wait for a connection, adding latency invisible to model profiling. All three require measurement at P99 and P999, not just P50.`,
  },
  {
    heading: 'Prediction Distribution Monitoring',
    body: `Standard uptime monitoring catches infrastructure failures: pod restarts, HTTP 5xx spikes, memory exhaustion. It is completely blind to the class of failures that are most damaging for ML systems: the model returns HTTP 200 with predictions that are subtly or completely wrong. The endpoint is "up" in every infrastructure sense while producing predictions that harm the business.

The most acute version of this is a silent total failure. A schema change upstream breaks feature ingestion - the feature store receives malformed input and returns zeros or nulls for all features. The model still runs inference (it does not know its features are wrong) and returns scores near its prior distribution for all-zero input, which for a fraud model might be "not fraud" for every transaction. The endpoint returns 200, P99 is normal, error rate is 0%, and fraud is flowing through undetected. This failure mode has caused material financial losses at financial institutions and requires prediction-level monitoring to detect.

What to monitor at the prediction level: the output score histogram, tracked as a rolling time-windowed distribution and compared against a baseline window (the previous 24 hours of champion traffic). If your fraud model's average score shifts from 0.12 to 0.02, something has broken even if latency is fine. Output entropy for classification models measures average model confidence - sudden spikes in confidence often indicate the model is extrapolating outside its training distribution and is inappropriately certain, a symptom of distribution shift or feature corruption. The null or fallback prediction rate (what percentage of requests return a default rather than a live prediction) spikes when feature ingestion breaks. Each of these metrics has a different root cause and a different remediation.

Population Stability Index computed on model outputs is particularly useful during canary: comparing the canary model's prediction distribution against the champion's distribution on the same incoming traffic slice. A PSI below 0.1 indicates the two models are behaviorally similar. PSI between 0.1 and 0.2 is moderate shift requiring investigation. PSI above 0.2 indicates major behavioral divergence - the canary gate should fail here regardless of whether latency and error rate look healthy, because a model with a dramatically different prediction distribution is making fundamentally different decisions than the champion.

Implementation guidance: push prediction histograms to Prometheus as pre-bucketed counters (using the histogram metric type, not gauge). Define alerting rules in Prometheus or Datadog that compare the current window's bucket distribution against the rolling baseline. Set these alerts to page at the same severity as P99 latency alerts - not lower. Silent model failures that go undetected for 4–8 hours because the monitoring team was focused on infrastructure dashboards have caused multi-million dollar losses in fraud, ad bidding, and pricing domains.`,
  },
  {
    heading: 'Dynamic Batching and GPU Utilization',
    body: `Real-time requests arrive individually, but GPUs achieve peak efficiency processing large batches. The mismatch between individual request arrival patterns and GPU batch efficiency is the central throughput challenge in ML serving. Dynamic batching is the primary mechanism for bridging this gap in production.

The physics of why batching matters: a GPU has thousands of CUDA cores designed to execute the same operation in parallel across many data points simultaneously. A single inference request at batch size 1 leaves the vast majority of these cores idle - the computation completes in, say, 8ms, but used only a small fraction of available parallelism. Processing 32 requests in a single batch on the same GPU might take 9ms - nearly the same wall-clock time - but produces 32 outputs instead of 1. Throughput improves 32x for a 1ms latency increase. This is why GPU utilization (reported by NVIDIA DCGM as SM active percentage) is the correct throughput metric: a GPU at 15% SM utilization is mostly wasting its capacity, and batch size increase directly increases this percentage.

Triton Inference Server implements dynamic batching through two configuration parameters. max_batch_size sets the upper limit on batch formation. max_queue_delay_microseconds controls how long the batcher waits to accumulate requests before dispatching a batch regardless of size - this directly translates to added per-request latency. In practice, a production configuration for a high-throughput ranking model might set preferred_batch_size to 16 and max_queue_delay_microseconds to 5000 (5ms). The batcher dispatches a batch when either 16 requests have accumulated or 5ms have elapsed since the first request arrived, whichever comes first. At 1000 RPS, batches fill in roughly 16ms (16 requests / 1000 per second), so the queue delay rarely triggers. At 100 RPS, batches fill in 160ms - far exceeding the delay threshold - so the batcher dispatches at 5ms regardless of batch size.

The critical production gotcha: dynamic batching adds latency to every individual request by exactly the queue delay amount. A max_queue_delay of 20ms means every request waits up to 20ms before inference even begins. If your SLA is P99 < 100ms and inference takes 30ms, that 20ms queue delay consumes 50% of your budget before the model runs. The throughput gains from batching are real but come directly at the cost of tail latency. The correct tuning process: start with max_queue_delay at 1ms, measure P99 and GPU utilization, increase delay by 2ms increments until either GPU utilization reaches target (typically 70–85%) or P99 approaches SLA budget. The optimal setting is the maximum delay that keeps P99 within budget while maximizing GPU utilization.`,
  },
  {
    heading: 'Caching in ML Serving - When It Hurts',
    body: `Prediction caching delivers enormous latency benefits when applicable: a cache hit serving a stored prediction in under 1ms versus 50–200ms of full model inference is a 50–200x latency improvement for that request. At 70–80% cache hit rates (achievable for recommendation workloads with returning users querying the same item sets), caching effectively reduces serving costs by 70–80%. These benefits are real and significant. The problem is a set of failure modes that are subtle, hard to detect, and have caused serious production incidents.

The most dangerous failure mode is post-deployment cache staleness. You deploy a new model version. The cache is not flushed. Over the next several hours, 80% of traffic is served from cached predictions generated by the old model. Your monitoring shows a stable prediction distribution - because you are measuring cache hits from the old model, not live inference from the new model. Your canary analysis reports green across the board. But 80% of your users are still seeing predictions from the pre-deployment model. You believe the deployment was successful; it has barely taken effect. The fix requires two disciplines: namespace all cache keys by model version (so old and new model cache entries never collide) and flush the version-specific cache on every deployment. This guarantees post-deployment traffic flows through the new model, even at the cost of a temporary cache cold-start period.

The second failure mode is monitoring blindness. At high cache hit rates, your model is only actually running inference on a fraction of traffic. Drift monitoring and prediction distribution monitoring observe only the uncached slice - the requests the cache missed. If the feature distribution is shifting dramatically in the cached slice, your monitoring is blind to it. The cached predictions are from a historical snapshot of the model, not from running the current model on current features. The model could be severely drifted for 80% of traffic, and your drift detectors (which only see the 20% cache-miss traffic) would show healthy distributions. Mitigation: track cache hit rate as a first-class metric and alert when it is unusually high (above expected). Periodically force-bypass the cache for a random sample of traffic to run live inference and verify distribution health on a representative sample.

The third failure mode applies specifically to the use of semantic caching - embedding-similarity-based caches that serve cached predictions for "similar" but not identical inputs. Semantic caches can produce silent correctness errors when inputs are judged semantically similar by the cache lookup model but should produce meaningfully different predictions. A product description that changed since the embedding was cached, a user whose preferences shifted since their embedding was generated, or two items that are semantically close but belong to different categories can all produce incorrect cache hits. Semantic caches require regular invalidation strategies tied to data freshness, not just model version.`,
  },
  {
    heading: 'Readiness vs Liveness Probes',
    body: `In Kubernetes, two probe mechanisms control pod lifecycle in ways that have very different implications for ML serving. Most engineers configure only liveness probes and encounter preventable 500 error storms every time they deploy a new model version.

The liveness probe answers the question: "is this container still alive and running?" If a liveness probe fails, Kubernetes kills and restarts the pod. This catches deadlocks, memory-exhaustion-induced hangs, and crashes. For ML serving, a liveness probe that runs a trivial health check (returning 200 if the process is running) is usually straightforward and rarely the source of incidents.

The readiness probe answers a different question: "is this pod ready to accept traffic?" If a readiness probe fails, Kubernetes removes the pod from the load balancer's endpoint list - no traffic is routed to it, but the pod is not killed. The pod continues running; it is simply excluded from serving until the readiness probe passes again. This distinction is critical for ML: the pod can be running (liveness passes) while the model has not yet loaded (readiness should fail). Without a readiness probe, Kubernetes routes traffic to a pod that has started but has not finished loading a 15GB model into GPU memory - every request during that window gets an immediate error because the model serving endpoint does not yet exist.

Loading a large model into GPU memory takes time that scales with model size and storage I/O speed: a 7B parameter model in FP16 (14GB) takes 30–60 seconds to load from network-attached storage and another 15–30 seconds for the first GPU warm-up inference to populate kernel caches. Without a readiness probe with appropriate initialDelaySeconds, Kubernetes starts routing traffic before the model is ready. The resulting 500 errors during the first 1–2 minutes of pod startup are often interpreted as a model bug when the real cause is missing readiness configuration.

The correct readiness probe implementation for ML: the readiness endpoint returns HTTP 503 until the model is fully loaded (model.load() has returned), a warm-up inference batch has been executed successfully (confirming GPU memory is allocated and kernels are compiled), and any required connections (feature store, downstream APIs) have been established. It then switches to returning 200. Set initialDelaySeconds to your measured startup time plus a 20% buffer. Set periodSeconds to 5 and failureThreshold to 3 - this means a pod that fails three consecutive readiness checks is removed from serving for up to 15 seconds while you investigate. Both probes are required in production and neither is optional.`,
  },
  {
    heading: 'Feature Flags and Dark Launch',
    body: `A feature flag is a runtime toggle that enables or disables a code path without deploying new code. In ML serving, this decouples two activities that are often conflated: deploying code (making the new model code path available in the serving binary) and exposing traffic to that code path. Deployment happens on Tuesday; traffic exposure happens on Thursday after internal validation. The flag controls the traffic routing, not the deployment.

When to use feature flags rather than Kubernetes traffic splitting: the change is behavioral at the code level (new preprocessing logic, different feature engineering, changed model loading approach) rather than a different model artifact at the same code path. Feature flags are also the right tool when you need instant kill-switch capability - setting a flag to zero traffic takes effect at the next request (within seconds) without requiring any Kubernetes operation, which might take minutes for a rollout change to propagate. LaunchDarkly, Unleash, and custom Redis-backed flag services all support sub-second flag evaluation at request time, enabling near-instant rollback without infrastructure operations.

Dark launch is a specific application of feature flags where the new code path is exposed to a controlled internal cohort before any external traffic. At Google, dark launches typically start with employee traffic (Googlers using the product internally), then expand to trusted external beta users, then to a geographic region, then to the general population. Each stage is controlled by a flag targeting rule, not by traffic percentage at the load balancer. The key distinction from shadow mode: in a dark launch, the targeted users actually see the new model's responses and their behavior is observable. In shadow mode, all users always see the champion; shadow predictions are never exposed to anyone.

The infrastructure requirement that teams frequently underestimate: feature flags stored in static config files require a redeployment to change, which completely defeats their purpose as a rapid exposure control. Effective feature flag infrastructure requires a flag evaluation service that the serving code calls at request time. The serving code reads the flag value on every request (with local caching for performance, typically sub-millisecond from a local Redis cache). This architecture enables targeting rules by user ID, geographic region, traffic percentage, device type, or any other request attribute - and enables instant changes that take effect within seconds, not minutes. Without this infrastructure, you have the illusion of a feature flag but none of the operational flexibility it should provide.`,
  },
  {
    heading: 'Serving Patterns: When to Use Each',
    body: `Four core patterns address the full ML serving landscape. The right choice is a function of latency requirements, data freshness needs, throughput, and cost constraints. Using the wrong pattern is a primary source of ML infrastructure cost overruns.

Online real-time serving: synchronous request-response with millisecond-level latency requirements. The user or upstream system calls your endpoint and waits for the result before continuing. Stack: Triton Inference Server (NVIDIA), TorchServe, FastAPI with GPU inference. Use cases: fraud detection at payment authorization time (the transaction cannot complete until the fraud decision is made), search ranking (the page cannot render until results are ranked), real-time ad bidding (the bid must be placed within 100ms of the auction opening). The challenge is keeping P99 low under variable load - GPU serving at P99 requires KEDA queue-depth-based autoscaling, readiness probes, and careful capacity planning for burst traffic.

Batch serving: predictions are pre-computed on a schedule and stored in a low-latency key-value store. No user waits in real time. Use cases: nightly churn scoring for all active users, weekly recommendation pre-computation for email campaigns, offline model evaluation. Batch inference is 5–10x cheaper per prediction than online serving because you can use spot or preemptible GPU instances, schedule for off-peak hours, and run at high batch sizes with maximum GPU utilization. The limitation is staleness - batch predictions may be hours old when served, which is acceptable for churn scoring but not for real-time fraud detection.

Streaming near-real-time serving: event-driven inference where events arrive via Kafka or Kinesis, a consumer runs inference, and results are written downstream within seconds to minutes. No synchronous response required; the caller does not wait. Latency is hundreds of milliseconds to a few seconds, not single-digit milliseconds. Use cases: clickstream anomaly detection, content moderation of uploaded posts, IoT sensor scoring, post-hoc fraud flagging. The key architectural distinction from real-time serving: nobody is blocking on the response, so higher latency is acceptable and the system can absorb traffic bursts via the queue.

Edge on-device serving: the model runs on the user's device with zero network latency and offline capability. Requires aggressive model compression to meet device memory constraints: a mobile phone has 4–8GB RAM; a typical embedding model might need to fit in under 100MB. Stack: TFLite, CoreML, ONNX Runtime for mobile and edge hardware. Compression pipeline: knowledge distillation (to reduce architecture size) followed by INT8 post-training quantization. Use cases: mobile AR features that cannot tolerate network round-trip latency, in-vehicle driver assistance systems, offline-capable industrial IoT sensors.

The hybrid pattern that large-scale recommendation systems use: batch-compute deep user and item embeddings nightly (expensive but high-quality representations), store in a fast vector database (FAISS, Pinecone, Weaviate), and at serving time do a fast ANN retrieval of the top 100 candidates plus a lightweight online re-ranking model that incorporates real-time context signals (current session, time of day, recent interactions). This separates the expensive embedding computation (batch, cheap) from the real-time ranking (online, fast and cheap because the model is small). Meta's recommendation stack and Airbnb's search ranking system both use variants of this hybrid.`,
  },

  {
    heading: 'Model Registry - The Missing Metadata Layer',
    body: `Storing a model binary in S3 solves exactly one problem: artifact storage. A model registry solves the harder operational problem: knowing what that artifact is, where it came from, what data produced it, what it is currently doing in production, and how to reproduce or roll back to any previous version.

Without a registry, six months of training runs produce dozens of model files in S3 with names like model_v3_final_final2.pkl - no answer to: which one is in production right now? What training dataset produced it? What were the evaluation metrics? Who approved it for production? If a production incident requires rolling back to "the model we used before the Q3 feature engineering change," the team has no way to identify which S3 object corresponds to that state without manually searching through training logs, Slack messages, and git history.

A registry stores the artifact alongside structured, queryable metadata: the git commit SHA of the training code (enabling exact reproduction of the training run), the hash or versioned pointer to the training dataset (linking the model to the exact data it was trained on), all hyperparameters as a structured record (required to understand training decisions and reproduce runs), evaluation metrics on the held-out test set (the canonical performance reference for rollback decisions), the training run timestamp and the identity of who triggered it, and the deployment stage (staging, canary, production, deprecated) controlled by a formal promotion workflow. The stage field is the gating mechanism: only models in "staging" can be promoted to canary; only models in "canary" can be promoted to production. This prevents accidental deployment of untested artifacts.

The operational payoff of this metadata layer is real rollback versus fake rollback. Fake rollback is "redeploy the previous container image." Real rollback is "redeploy the exact model trained on the pre-Q3-feature-engineering training data, with these specific hyperparameters, that achieved AUC 0.847 on the October 15th holdout set." The registry metadata makes this choice explicit and auditable. In regulated domains - credit scoring, insurance underwriting, healthcare risk prediction, fraud detection - auditability is a hard compliance requirement. A model that influenced a credit denial must be traceable to the exact training data and code that produced it.

Common tools: MLflow Model Registry (most widely adopted open-source option, supports stage transitions and metadata logging), SageMaker Model Registry (AWS-native with built-in approval workflows), Vertex AI Model Registry (GCP, integrates with Vertex Pipelines), Weights and Biases (excellent experiment tracking, model registry is newer). The specific tool matters less than the discipline: log metadata at training time, enforce stage-transition gates before deployment, and treat registry metadata as first-class production data that must be retained and queryable.`,
  },

  {
    heading: 'ML-Specific SLOs - Beyond Infrastructure Metrics',
    body: `Standard infrastructure SLOs - uptime percentage, P99 latency, and HTTP error rate - are necessary conditions for a healthy ML system but are not sufficient. A model can achieve 99.9% uptime, sub-50ms P99, and 0.1% error rate while producing predictions that are silently wrong in ways that damage the business. Infrastructure SLOs measure whether the serving stack is functioning; they say nothing about whether the model's predictions are correct, calibrated, or useful.

ML systems require two distinct SLO layers. The infrastructure layer (identical to any microservice): availability of 99.9% (which translates to 43.8 minutes of allowed downtime per month), P99 latency below the defined budget, HTTP error rate below 0.5%, and throughput within expected bounds. These are measured by standard APM tooling and alert immediately. The prediction quality layer is ML-specific and requires custom instrumentation: output distribution bounds (PSI on model outputs compared to the training baseline must remain below 0.1), output entropy bounds (average model confidence must stay within historical norms - spikes indicate out-of-distribution inputs), business metric SLOs (CTR not degraded by more than 2% from the champion baseline, conversion rate within statistical confidence bounds), and fairness SLOs for models making decisions that affect individuals (demographic parity and equalized odds metrics must remain within defined bounds per regulatory or policy requirements).

The specific failure mode that prediction SLOs catch and infrastructure SLOs miss: a new model is deployed in a canary at 10% traffic. P99 latency is within 3% of the champion. Error rate is 0.2%. Both infrastructure SLOs are passing. The canary gates evaluate these infrastructure metrics and auto-promote the model from 10% to 25%. But the model's output distribution has shifted: PSI is 0.22, indicating major behavioral change. The model has learned to recommend a narrower set of popular items, boosting short-term CTR slightly while degrading long-term diversity metrics and user retention. Without prediction quality SLOs in the canary gate, this regression ships to 100% of traffic and is not detected for two weeks, after which recovery requires a full retraining cycle.

The emerging practice in 2025 is adaptive SLO thresholds that adjust for seasonality and known distribution shifts. A fraud detection model in December (holiday shopping surge) has a naturally higher expected false positive rate than in July. Static thresholds set in January will either generate excessive false alerts in December or be too loose in July. Adaptive SLOs use a rolling baseline (comparing current performance to the same period in the previous week or the same period last year) rather than a fixed absolute threshold.`,
  },

  {
    heading: 'Quantization: PTQ vs QAT',
    body: `Quantization reduces model weight and activation precision from 32-bit float (FP32) to lower bit representations. The efficiency gains come from two sources: reduced memory bandwidth requirements (INT8 weights transfer 4x less data from GPU HBM than FP32 weights, and memory bandwidth is the primary bottleneck in transformer inference) and hardware acceleration (NVIDIA Tensor Cores process INT8 operations at 4x the throughput of FP32 on Ampere and Hopper architectures). TensorRT achieves up to 18x speedup over unoptimized TensorFlow inference when combining FP16 quantization with kernel fusion, with each optimization stage contributing cumulatively: GPU execution provides 5.4x, graph optimization adds 1.5x, and FP16 precision adds another 1.9x.

Post-Training Quantization (PTQ) happens after training is complete. The process: assemble a calibration dataset (1,000–10,000 representative samples from production traffic), run the dataset through the FP32 model to collect activation statistics, compute per-layer scaling factors that map the FP32 activation range to INT8 range, then apply these scaling factors to convert weights and configure activation quantization. The entire process takes hours, not days, and requires no retraining. Accuracy cost: PTQ to INT8 typically degrades task performance by 0.5–2% on standard NLP and vision benchmarks, which is acceptable for most production use cases. TensorRT's INT8 calibration, PyTorch's torch.quantization module, and ONNX Runtime's quantization tools all implement PTQ with similar results.

Quantization-Aware Training (QAT) simulates the effect of quantization during the training forward pass. Fake quantization nodes are inserted into the computational graph - they round activations and weights to their quantized values during the forward pass, but gradients still flow through them in FP32 during backpropagation. The model's weights adapt to minimize error in the presence of quantization noise. The result is a model that is robust to INT8 quantization and recovers most of the accuracy that PTQ loses - typically achieving within 0.1% of FP32 baseline where PTQ might cost 1.5%. The cost: you must retrain or fine-tune the model, which takes days and requires GPU compute. QAT is the right choice only when PTQ accuracy degradation is unacceptable for the use case and retraining compute is available.

FP4 and INT4 quantization have become production-standard for large language models in 2025, driven by NVIDIA's FP4 support in Hopper and Blackwell architectures and quantization methods including GPTQ, AWQ, and GGUF. A 70B parameter model requires 140GB in FP32, 70GB in FP16, 35GB in INT8, and approximately 35GB in INT4 - the last fitting on a single H100 80GB GPU or H200. Accuracy regression at INT4 is more pronounced than at INT8 and is highly task-dependent: coding and mathematical reasoning tasks degrade more than summarization and classification tasks. Always evaluate quantized models on your specific task distribution rather than relying on published benchmark numbers, which typically use tasks that do not represent production workloads.`,
  },

  {
    heading: 'Knowledge Distillation',
    body: `Knowledge distillation trains a smaller student model to mimic a larger teacher model's outputs - not just its hard class predictions, but its full output probability distribution. The mechanism that makes distillation more effective than simply training a smaller model from scratch is the information content of the teacher's soft labels. If the teacher predicts "cat" with probability 0.85, "lynx" with 0.12, and "dog" with 0.03, the hard label for training is simply "cat" - which discards the structural information that cats and lynxes are similar while cats and dogs are less similar. The teacher's soft probability distribution encodes these inter-class relationships, and the student learns them implicitly.

The temperature parameter controls how much of this structural information is transferred. At temperature T=1, the teacher's softmax output is used directly - high-confidence predictions produce near-one-hot distributions with little inter-class information. At T=4, dividing logits by 4 before softmax flattens the distribution dramatically, making the inter-class relationships much more visible. The student trained on T=4 teacher outputs learns that cats and lynxes are similar to a much greater degree than a student trained on T=1 outputs. Practical values: T=2 to T=5 for most tasks, chosen by validation on a held-out set. The temperature is used only during training and dropped for deployment.

The landmark results that established distillation as a standard technique: Google's DistilBERT achieves 97% of BERT-base's performance on GLUE benchmarks with 40% fewer parameters and 60% faster inference. TinyBERT achieves 96.8% of BERT's performance with 7.5x fewer parameters and 9.4x faster inference. These numbers made distillation mainstream as the preferred approach for deploying BERT-class models on resource-constrained infrastructure.

Distillation versus quantization as optimization strategies: they are complementary, not alternatives. Quantization operates on the deployed model's numerical precision - it does not change the model architecture. Distillation changes the architecture - it produces a fundamentally smaller model that happens to be a good approximation of the teacher. The correct pipeline for maximum compression: train the full-size teacher, distil to a smaller student architecture, then apply PTQ to the student. The compounding effect can be dramatic: a BERT-large model (336M parameters) distilled to a 4-layer student (14M parameters) and then INT8-quantized can run at 6–8ms P99 on a modern CPU, making CPU serving viable and eliminating GPU cost entirely for modest-traffic applications.

One critical legal and contractual consideration: if the teacher model is a proprietary third-party API - Claude, GPT-4, Gemini - the terms of service for most commercial LLM providers explicitly prohibit using their outputs to train competing models. Distillation using API outputs from these providers is a terms-of-service violation. This is enforceable and has resulted in legal action. Distillation from open-weight teachers (LLaMA 3, Mistral, Gemma) does not have this constraint.`,
  },

  {
    heading: 'Production Readiness Gates Before Canary',
    body: `Canary deployment is the final production validation gate - not the first. A model that reaches the canary stage should already have passed a comprehensive pre-canary checklist enforced automatically in the CI/CD pipeline. Teams that skip pre-canary validation and rely entirely on the canary to catch problems are running a dramatically higher blast-radius experiment: even 1% canary traffic at a service handling 1 million requests per day means 10,000 users experience whatever the canary exposes.

The data validation layer checks that the model was trained on clean, correctly split data. This includes verifying that the temporal split is correctly implemented (no future information leaks into training features), that the feature schema in the training data matches the schema the serving pipeline will provide (a type mismatch between training float32 and serving int32 for an age feature silently corrupts predictions for users with age in certain ranges), and that null rates and out-of-range rates on the validation set match production baseline distributions. Many teams automate this with tools like Great Expectations or custom schema validation steps in their training pipeline.

The model validation layer enforces performance floors before the model is ever registered in the production staging stage. Minimum accuracy, AUC, or RMSE thresholds prevent regressions from being deployed. Performance on known hard subsets - rare classes, sparse feature users, edge-case input ranges - should be checked separately from aggregate metrics, because a model can improve aggregate AUC while degrading on specific valuable subpopulations. Inference latency on representative batch sizes must meet SLA headroom: if the deployed model will face P99 inference latency of 45ms on the hardware it will run on, that needs to be measured before canary, not discovered during canary.

The infrastructure validation layer confirms that the serving stack works correctly. The Docker image must build successfully and pass integration tests against a staging environment. Dependency version pinning must be verified - a serving framework version mismatch between training and deployment has caused silent numerical precision differences. The readiness probe must respond 200 within the expected startup time window. Shadow mode output distribution (if a shadow phase was run before canary) should match expectations from offline analysis. The rollback validation step - often skipped - confirms that the previous model version still exists in the registry and can be deployed in under 5 minutes. Rollback procedures should be tested, not assumed to work based on documentation.`,
  },

  {
    heading: 'Queue-Based Autoscaling - Why CPU Metrics Fail for ML',
    body: `Kubernetes Horizontal Pod Autoscaler (HPA) in its default configuration scales on CPU utilization, which is the correct signal for CPU-bound web services and API servers. For GPU-bound ML inference workloads, CPU utilization is a deeply misleading signal that systematically fails to scale at the right time.

The structural problem: GPU inference does not consume CPU proportionally. When a Triton Inference Server pod is serving 1,000 inference requests per second with the GPU running at 95% SM utilization, the CPU on the same pod is typically at 20–30% utilization - busy handling request dispatching, batching, and response encoding, but not saturated. The HPA sees CPU at 30%, compares it to the scale-up threshold of 70%, and does nothing. Meanwhile, incoming requests are queuing behind the saturated GPU, P99 latency is climbing, and users are experiencing degraded service. By the time CPU reaches 70% - if it ever does before the system degrades sufficiently to show other symptoms - users have experienced minutes of elevated latency.

The correct primary autoscaling signals for GPU ML inference are request queue depth and average request wait time in queue. These are leading indicators: when requests start queuing, the system is approaching capacity and needs more replicas before latency degrades significantly. Triton Inference Server exposes both metrics as Prometheus metrics (nv_inference_queue_duration_us for queue latency, nv_inference_pending_request_count for queue depth). KEDA (Kubernetes Event-Driven Autoscaler) consumes these Prometheus metrics via its Prometheus scaler and drives HPA scale-up decisions. The SuperSONIC project (used in production at CERN and several research institutions) demonstrates this pattern: KEDA monitors average request queue latency across Triton instances and launches additional Triton replicas when the metric exceeds a threshold.

GPU memory utilization via NVIDIA DCGM (Data Center GPU Manager) is the secondary autoscaling signal and a useful capacity planning metric. When GPU memory utilization exceeds 80%, the risk of OOM errors and batch overflow increases. KEDA's DCGM scaler can trigger scale-up based on GPU memory pressure, providing an early warning before queue depth rises.

Scale-down requires different tuning than scale-up. GPU nodes take 3–5 minutes to provision (requesting a new GPU node from the cloud provider, scheduling pods, pulling images, loading the model into GPU memory). If you scale down too aggressively during a traffic trough and then a burst arrives 10 minutes later, the system needs 3–5 minutes to recover - during which requests queue or drop. The correct configuration: set KEDA's cooldown period to at least 10–15 minutes for scale-down, maintain a minimum replica count sufficient to absorb typical off-peak traffic without cold-starts, and accept the cost of some idle GPU capacity as insurance against burst traffic that would otherwise create prolonged latency spikes.`,
  },

  {
    heading: 'Speculative Decoding - LLM Serving Optimization',
    body: `Standard autoregressive LLM generation is inherently sequential: each forward pass through the full model produces exactly one output token, which is appended to the context and fed back as input for the next pass. At 50 tokens per second for a 70B parameter model, a 500-token response takes 10 seconds. The GPU is processing the full model for every single token, but the computation per token is tiny relative to the model's total capacity - the hardware is underutilized in a way that cannot be fixed by batching alone when sequence generation is strictly sequential.

Speculative decoding changes the generation protocol using a two-model system. A small, fast draft model (typically 7B parameters for a 70B target) generates K candidate tokens in a single forward pass. The full target model then verifies all K draft tokens in a single parallel forward pass - because verification is a parallel operation (the target model evaluates all K positions simultaneously with the draft tokens as context), not sequential. Tokens that the target model agrees with are accepted; the first rejected token triggers regeneration from that position. Mathematically, the output distribution is provably identical to running the target model alone - rejected tokens ensure no quality degradation. The speedup comes purely from the acceptance rate: if 4 of 5 draft tokens are accepted, you got 4 tokens for roughly the cost of 1 target forward pass.

Production results as of 2025: NVIDIA's benchmarks show 3.6x throughput improvement on H200 GPUs for Llama 3.1 70B using a Llama 3.1 8B draft model. The EAGLE-3 speculative decoding variant achieves approximately 4.8x speedup on coding tasks (HumanEval benchmark with LLaMA 3.3 70B), where draft acceptance rates approach 85% because code generation is highly predictable. For general-purpose chat, speedups of 2–3x with acceptance rates of 60–75% are typical. vLLM and TensorRT-LLM both include native speculative decoding support and can be configured with a few parameters.

The most critical tuning decision is draft model selection. The draft model must share vocabulary with the target (same tokenizer, same token IDs for all tokens) and must be architecturally compatible. A draft acceptance rate below 50% causes speculative decoding to underperform standard decoding: you pay for two model forward passes (draft and target verification) but accept fewer tokens per cycle than standard generation. The break-even is approximately 50–55% acceptance rate. Below this threshold, disable speculative decoding and use standard generation. EAGLE and Medusa are specialized draft architectures that use auxiliary heads on the target model instead of a separate draft model, achieving higher acceptance rates (80–90%) by directly learning from the target's internal representations. These outperform generic smaller draft models for most use cases but require additional training of the auxiliary heads.`,
  },

  {
    heading: 'Multi-Armed Bandit vs A/B Testing for Model Selection',
    body: `Standard A/B testing allocates traffic to variants in fixed proportions - typically 50/50 - for a pre-determined duration, then performs a statistical significance test and declares a winner. This design is statistically clean and produces interpretable p-values suitable for product decisions and regulatory reporting. Its known cost: for the entire experiment duration, 50% of users receive the potentially inferior model. If the experiment runs for 14 days and one variant is genuinely 10% better, users served by the inferior variant during the 14-day window represent the regret of the experiment - the business value foregone due to exploration.

Multi-armed bandit algorithms minimize this regret by dynamically shifting traffic toward the better-performing variant while the experiment is still running. Epsilon-greedy is the simplest implementation: with probability epsilon (say 10%), route the request to a randomly chosen variant (exploration); otherwise route to the current best-performing variant (exploitation). Thompson Sampling maintains a Beta distribution over the conversion rate of each variant (updated as Bayesian posterior with each observation) and allocates traffic by sampling from these distributions - naturally concentrating traffic on variants with high conversion estimates while continuing to explore variants with high uncertainty. Upper Confidence Bound (UCB) algorithms prefer variants that have been explored less, maintaining explicit uncertainty estimates and exploring variants where the confidence interval is still wide.

The hard constraint for MAB algorithms is feedback latency. Bandit allocation decisions require observed rewards to update the allocation policy. Thompson Sampling's posterior updates depend on receiving the outcome of a given user's interaction relatively quickly. For ad click prediction, the click arrives within seconds of the ad being shown - ideal for bandits. For recommendation systems where the relevant business outcome is a 7-day retention metric, the bandit cannot observe the reward for 7 days, making its allocation decisions based on stale or incomplete information. Under delayed feedback, bandits often underperform fixed A/B splits because they shift traffic away from a good variant before the positive rewards from its earlier traffic have been observed.

In production ML: MAB is the standard approach for ad bidding, pricing optimization, and push notification timing - domains where rewards are immediate and regret is directly measurable in revenue. A/B testing remains dominant for search ranking, recommendation systems, and content personalization - domains where the most valuable business metrics have delayed feedback and where product teams need interpretable statistical evidence (rather than dynamic allocation curves) to make feature decisions. The choice is ultimately a function of feedback delay relative to experiment duration: if feedback arrives within 10% of the experiment window, MAB is viable; if feedback delay is 50%+ of the experiment window, stick with A/B testing.`,
  },

  {
    heading: 'Distributed Tracing for ML Pipelines',
    body: `A latency regression in ML serving can originate at any layer: the feature store, the preprocessing step, the request batching queue, the model inference itself, the post-processing business logic, or any of the network hops between these components. Without distributed tracing, diagnosing which layer is responsible requires either guessing or adding temporary instrumentation under pressure, which introduces errors and costs time during an active incident. The standard expectation for production ML systems is that the source of a latency spike should be identifiable within 5 minutes of an alert firing, using pre-existing instrumentation.

Distributed tracing captures the complete journey of every request as a tree of timestamped spans. Each service or component that handles the request adds a span with a start time, end time, and structured metadata. A trace aggregation backend (Jaeger, Zipkin, Datadog APM, Honeycomb) reconstructs the complete tree from spans correlated by a propagated trace ID. A complete trace for an ML serving request reveals exactly where time is being spent:

  [Gateway auth: 2ms] → [Feature store lookup: 38ms] → [Feature serialization: 4ms]
    → [Queue wait: 15ms] → [GPU inference: 22ms] → [Post-processing: 5ms]
  Total end-to-end: 86ms

Without tracing, you see "86ms" - the breakdown is invisible and you have no idea that 38ms is disappearing in the feature store. With tracing, you immediately see that the feature store is the bottleneck and target optimization there (connection pooling, batching lookups, co-locating the model server with the feature store, caching frequently accessed features locally).

OpenTelemetry is the instrumentation standard as of 2025: a vendor-neutral SDK for metrics, traces, and logs that exports to any backend through a standard protocol. Adding spans to a Python-based ML serving endpoint takes less than 10 lines of code with the opentelemetry-sdk and an appropriate exporter. The critical ML-specific spans to add beyond basic HTTP instrumentation: separate spans for queue wait time versus GPU inference time (queue wait is a scaling signal - add replicas; GPU inference time is a model signal - quantize or optimize the model); feature store lookup with tags for cache hit vs. miss (cache misses pay the full database round-trip, hits take sub-millisecond); and model version tag on the inference span (enables filtering all traces for a specific model version to diagnose version-specific regressions).

The ML-specific tracing practice that most teams miss: log the input feature vector hash in the inference span. This enables correlation between slow traces and specific input feature values - critical for diagnosing whether latency regressions are due to specific input patterns (very long input sequences, rare feature value combinations that exercise slow code paths) versus general load issues. With the feature vector hash, you can retrieve a sample of slow traces and identify whether they share common input characteristics within minutes, rather than spending hours designing diagnostic queries after the fact.`,
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
      'Load balancer acts as a policy engine - weighted routing, not just round-robin',
      'Validates a new model on real production traffic without full exposure',
      'Enables gradual rollout: catch regressions before they affect all users',
    ],
    trap: 'Thinking traffic splitting is just a Kubernetes feature - it is a deployment strategy that can be implemented at the load balancer, service mesh (Istio), or API gateway level.',
  },
  {
    difficulty: 'mid',
    question: 'You need to route 5% of traffic to a new model without Kubernetes native support. What infrastructure options exist and what are the trade-offs?',
    keyPoints: [
      'Nginx / Envoy upstream weights: simple, no external dependency, but requires config reload to change percentage',
      'Istio VirtualService: declarative, dynamic, integrates with canary controllers - adds service mesh complexity',
      'Application-level routing: client library reads a flag and routes - fragile, bypasses infrastructure',
      'API Gateway (AWS ALB weighted target groups): managed, supports gradual shifts without restarts',
    ],
    trap: 'Proposing application-level routing as the primary solution - it is brittle and bypasses observability infrastructure.',
  },

  // ── Blue/Green vs Canary ──────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through the deployment strategies you would use to ship a new ML model safely.',
    answer: `Think of this as a progression of risk reduction. Before touching production at all, run the new model in shadow mode - it receives a copy of live traffic, you compare its outputs against the champion, but users always get the incumbent's response. Zero risk, full signal on output distribution and latency.

Once confident in shadow, do a canary release - start at 1%, watch P99 latency, error rate, and business metrics for 30 minutes, then step up to 10%, 50%, 100%. If anything degrades at any step, cut traffic back automatically.

A/B testing sits alongside canary but serves a different purpose - it measures business impact statistically. Canary tells you "is this model safe?", A/B tells you "is this model better for the business?"

Blue/green is for when you need an instant cutover - say a major infrastructure change - and you have already validated the model through shadow and canary. It is expensive because you run two full environments, but rollback is a single traffic flip.`,
    keyPoints: [
      'Shadow mode → Canary → A/B → Blue/Green is the risk-reduction progression',
      'Canary = safety check, A/B = business impact measurement',
      'Blue/green rollback is a single traffic flip - seconds, not minutes',
      'Never start canary without pre-defined rollback thresholds',
    ],
  },
  {
    difficulty: 'mid',
    question: 'A team argues blue/green is safer than canary because rollback is instant. What is the flaw in this reasoning for ML specifically?',
    keyPoints: [
      'Blue/green switches 100% of traffic instantly - if the new model has a subtle behavioral regression, every user is affected before you can react',
      'ML behavioral regressions (prediction distribution shift, bias toward certain outputs) are invisible until you see aggregate metrics - which takes minutes',
      'Canary limits blast radius: a regression at 5% traffic affects 5% of users, not 100%',
      'Instant rollback is only valuable if you catch the problem fast - blue/green gives you no early warning',
    ],
    trap: 'Agreeing that blue/green is safer. The instant rollback capability does not compensate for the 100% traffic exposure during the window before you detect the problem.',
  },

  // ── Canary vs A/B Testing ─────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: "What's the difference between canary and A/B testing? Aren't they the same thing?",
    answer: `Canary is a safety mechanism - you are asking "is it safe to roll this out?" You watch for regressions: latency spikes, error rate increases, prediction distribution shift. The goal is to reach 100% traffic.

A/B testing is an experiment - you are asking "which model produces better business outcomes?" You hold the split steady - say 50/50 - long enough to reach statistical significance on your primary business metric. You are not trying to reach 100%; you are trying to measure a difference.

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
      'Canary gates typically watch short-window metrics - P99, error rate, immediate CTR. They miss slow-burn effects',
      'A 5% regression visible after 2 weeks is a long-feedback-loop business metric - subscription conversion, 7-day retention, LTV',
      'Missing: a holdback group - keep 5% of traffic on the old model permanently as a control to detect regressions that appear over weeks',
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

Key limitation: you cannot measure business impact - since users never see the shadow model's responses, you get no signal on CTR, engagement, or revenue. Shadow mode tells you "the outputs look reasonable and latency is within budget." It cannot tell you "users prefer this model." That is what A/B testing is for.

The other limitation is cost - you are running two inference stacks and paying for both.`,
    keyPoints: [
      'Zero user risk - champion always responds, shadow output is logged only',
      'Cannot measure business impact (no user sees shadow output)',
      'Runs two inference stacks - 2× compute cost',
      'Use before first deploy or before major architecture changes',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Shadow mode shows your new model produces identical outputs to the champion 99% of the time. Your PM says ship it. What are you still not confident about?',
    keyPoints: [
      'You have not measured business impact - users never saw the shadow output, so no CTR, conversion, or engagement signal',
      '1% output divergence at production scale can be millions of different predictions - you do not know if those divergences are better or worse',
      'Latency under sustained load: shadow mode adds load to your serving stack, real production traffic patterns may differ',
      'Feature freshness: shadow mode may have used cached features; production at peak hours may have higher feature staleness',
    ],
    trap: 'Saying "99% identical is good enough to ship." The 1% divergence is unknown in direction - those predictions could be systematically worse.',
  },

  // ── What Metrics to Watch ─────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'How do you know your serving infrastructure is healthy?',
    answer: `Five things to monitor:

Latency: P50, P95, P99 - not just mean. Mean hides tail issues.

Error rate: 4xx vs 5xx separately. 4xx is client error, 5xx is your problem.

Throughput: requests/sec - a sudden drop means an upstream issue even if latency looks fine.

Model-specific: prediction distribution - if your fraud model suddenly scores everything 0.0, the endpoint is "up" but completely broken. Standard uptime monitors will not catch this.

Saturation: queue depth, GPU memory usage - leading indicators before latency degrades. By the time P99 spikes, you are already in an incident. Watch saturation to act before that.`,
    keyPoints: [
      'P50/P95/P99 - never just mean latency',
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
      'P99 spike with stable P50 means a subset of requests is experiencing extreme latency - classic long-tail problem',
      'Check if the slow requests share a pattern: specific feature values, larger input sizes, a particular user cohort',
      'Look at the serving trace breakdown: is the spike in feature retrieval, preprocessing, or inference itself?',
      'Check for cold-start requests hitting pods that just started, or batching behavior causing some requests to wait longer',
    ],
    trap: 'Immediately assuming the model is the problem. P99 spikes with stable P50 are often infrastructure issues - cold pods, feature store cache misses, batch wait time.',
  },

  // ── Degradation Signals & Automated Gates ────────────────────────────────
  {
    difficulty: 'senior',
    question: 'Your canary deploy just showed a 15% increase in P99 latency at 10% traffic. What do you do?',
    answer: `First, stop the rollout immediately - do not proceed to 50%. Route traffic back to 0% on the new model so the 10% of affected users go back to the champion.

Then diagnose before doing anything else. Is it the model itself - did you deploy a heavier architecture? Is it a cold start issue - were the new pods still warming up? Is it a feature pipeline issue - is the new model calling a slower feature store query? Look at the latency breakdown: feature lookup time, inference time, serialization time separately.

Critically - do not delete the canary deployment. Keep it running at 0% traffic so you can reproduce the issue, run profiling, and compare against the champion.

Once you understand the root cause, fix it, re-validate in shadow mode, and start the canary process again from 1%.`,
    keyPoints: [
      'Stop rollout first, then diagnose - never diagnose while users are affected',
      'Do not delete the bad pod - keep at 0% for debugging',
      'Break down latency by component: feature lookup, inference, serialization',
      'After fixing: shadow mode first, then restart canary from 1%',
    ],
    trap: 'Jumping to "I would roll back and redeploy a fix." The interviewer wants to see you keep the bad version around for diagnosis, and that you restart from shadow/1% rather than jumping back to 10%.',
  },
  {
    difficulty: 'mid',
    question: 'How do you decide when to promote a canary to the next traffic percentage?',
    answer: `You need specific, pre-defined gates - not just "monitor metrics." Specific gates I would use:

  • P99 latency within 5% of the champion baseline
  • Error rate below 1% (and not trending upward)
  • Prediction distribution not significantly shifted (PSI < 0.1 on key outputs)
  • Business metric (CTR, conversion) not degraded by more than 2% over a minimum observation window (30 minutes at each step)

These gates should be automated - tools like Argo Rollouts can pause canary promotion and wait for these conditions before proceeding. Human-in-the-loop doesn't scale when you're deploying multiple times a day.

The observation window matters as much as the thresholds. A model can look fine for 5 minutes then degrade - minimum 15–30 minutes at each step before promoting.`,
    keyPoints: [
      'Gates: P99 within 5% of baseline, error rate < 1%, PSI < 0.1 on predictions',
      'Observation window: minimum 15–30 minutes at each traffic percentage',
      'Automate gates with Argo Rollouts or Spinnaker - manual promotion does not scale',
      'Set thresholds before the canary starts, not after you see the data',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Why should rollback thresholds be defined before the canary starts, not after you see the data?',
    keyPoints: [
      'Post-hoc threshold setting introduces confirmation bias - you subconsciously set the threshold to justify the decision you already want to make',
      'Pre-defined thresholds force alignment with stakeholders before pressure to ship exists',
      'Automated rollback gates require thresholds baked in before the canary starts - you cannot automate on thresholds defined mid-experiment',
      'Regulatory and audit requirements in some domains require pre-specified evaluation criteria',
    ],
    trap: 'Thinking thresholds can be adjusted mid-experiment to account for "context." This is how bad models get shipped under pressure.',
  },

  // ── Rollback Mechanics ────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through exactly what happens in Kubernetes when you roll back a model deployment. What is preserved and what changes?',
    keyPoints: [
      'kubectl rollout undo switches the Deployment to the previous ReplicaSet - the old pods are already defined, no new image pull needed',
      'Takes seconds - Kubernetes just shifts which ReplicaSet is active, does not rebuild containers',
      'The bad ReplicaSet stays in cluster history at 0 replicas - not deleted',
      'Service DNS and load balancer remain unchanged - traffic routing is seamless to clients',
    ],
    trap: 'Saying rollback involves redeploying or rebuilding the old image. Kubernetes ReplicaSet-based rollback is a pointer swap, not a redeploy.',
  },
  {
    difficulty: 'senior',
    question: 'You just rolled back a model at 2am. The on-call engineer deletes the canary pod to "clean up." Why is this a mistake?',
    keyPoints: [
      'The bad pod is your evidence - it is the only place you can reproduce the failure, run profiling, and inspect logs with the exact state at failure time',
      'Deleting it means you lose the ability to diff against the champion and understand the root cause',
      'Without understanding root cause, you will deploy the same problem again',
      'Correct process: keep bad version at 0% traffic, schedule a post-mortem, investigate while the evidence is intact',
    ],
    trap: '"The rollback already happened so the pod is no longer needed." The rollback is not the end of the incident - the diagnosis is.',
  },

  // ── Why P99 Matters More Than P50 ────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Your model serves 50k RPS. P99 latency is 800ms. How many users per second are experiencing 800ms+ responses, and why does this matter for SLO design?',
    keyPoints: [
      '50,000 × 0.01 = 500 users per second experiencing 800ms+ latency',
      'At this scale, P99 "edge cases" are not edge cases - they are a constant stream of bad experiences',
      'SLOs set at P50 would look healthy while 500 users/sec have degraded UX',
      'This is why SLOs for user-facing ML should be set at P99 or P95, not mean or P50',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Your team is debating P95 vs P99 as the SLO target. What factors determine the right choice?',
    keyPoints: [
      'P99 is appropriate when tail latency causes visible UX degradation - synchronous, user-facing, blocking requests',
      'P95 may be acceptable for async or batch-adjacent flows where users are less sensitive to individual request latency',
      'Consider the business cost of the tail: in checkout flows, P99 latency directly maps to abandoned carts',
      'Tighter SLOs require more headroom (over-provisioning) - cost vs. quality trade-off that depends on domain',
    ],
    trap: 'Always recommending P99 without considering cost. Setting P99 SLOs requires provisioning for the worst case, which can be significantly more expensive.',
  },

  // ── Champion/Challenger Pattern ───────────────────────────────────────────
  {
    difficulty: 'senior',
    question: "What's the difference between champion/challenger and A/B testing?",
    answer: `They look similar but have different operational contexts.

A/B testing is a bounded experiment - you run it for a fixed period, reach statistical significance, declare a winner, and end the test. It is event-driven.

Champion/challenger is a continuous operational pattern - the champion always serves the majority of production traffic, and there is always a challenger being evaluated on a small slice, say 5–10%. When a challenger wins, it becomes the new champion, and immediately a new challenger goes into evaluation. It is an always-on improvement loop.

It is common in domains where models need continuous improvement and you cannot pause production to run experiments - fraud detection, credit scoring, ad bidding. The challenger slice is small enough to limit risk, but it is always there.`,
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
      'If challenger training uses the same data and features as champion, it will converge to the same model - need explicit architectural or data diversity',
      'Challenger should differ on at least one axis: different algorithm, different feature set, different training window, or different objective',
      'Promotion criteria must include a minimum improvement threshold - not just "not worse" but meaningfully better by some delta',
      'Some teams run multiple challengers simultaneously at different slices - ensures competitive pressure',
    ],
    trap: 'Thinking any new model version qualifies as a challenger. Without explicit diversity requirements, champion/challenger degenerates into perpetual A/B testing of incremental retrains.',
  },

  // ── Offline Good, Online Bad ──────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'Walk me through the 4 root cause hypotheses for a model that performs well offline but degrades in production. How do you investigate each?',
    keyPoints: [
      'Data leakage: a feature contains future information at training time not available at serving. Test: re-run eval with strict temporal split - if offline metrics drop, leakage was inflating results',
      'Training-serving skew: preprocessing runs differently between pipelines. Test: log actual serving feature vectors and compare distribution against training data with KS test / PSI',
      'Distribution shift: production P(X) differs from training distribution. Test: run PSI on incoming features vs. training baseline. PSI > 0.2 means significant drift',
      'Feedback loop / exposure bias: model predictions change what data is available for next training. Test: compare offline eval on full corpus vs. only items the model would have surfaced',
    ],
    trap: 'Assuming the problem is overfitting. Overfitting is rarely the cause of offline-online discrepancy in production ML - the four above are far more common.',
  },
  {
    difficulty: 'senior',
    question: 'How do you distinguish training-serving skew from distribution shift? They can look identical in production dashboards.',
    keyPoints: [
      'Skew: your model is correct for its training distribution, but serving features are computed differently - same world, different preprocessing',
      'Shift: the world itself changed - new user cohorts, product changes, seasonality - model learned correctly but input distribution moved',
      'Key diagnostic: compare serving feature distributions against training distribution feature-by-feature. If individual feature statistics (mean, std) diverge without a clear external event, skew is more likely',
      'Temporal pattern: skew often appears immediately after a deployment or pipeline change; shift develops gradually over weeks',
    ],
  },

  // ── Training-Serving Skew ─────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Your training pipeline fills null features with the median value. Your serving pipeline fills nulls with 0. The model was trained 6 months ago and has been in production for 3 weeks. When did the skew begin?',
    keyPoints: [
      'The skew began at deployment 3 weeks ago - the model was always trained with median imputation, but serving was never using it',
      'The 6-month training date is a red herring - the model artifact itself is fine, the serving pipeline is the source of skew',
      'Null-heavy features will have systematically wrong inputs - model will produce wrong predictions for any request with missing values',
      'Detection: log serving feature vectors, compare null-feature distribution to training. A 0 where median was expected is immediately visible',
    ],
    trap: 'Saying the skew started 6 months ago when the model was trained. The model is correct for its training distribution. The skew is in the serving pipeline, which was only deployed 3 weeks ago.',
  },
  {
    difficulty: 'senior',
    question: 'How does a feature store eliminate training-serving skew at the architectural level?',
    keyPoints: [
      'Feature definitions live in one place - training pipeline and serving pipeline both call the same feature computation logic',
      'No code duplication means no opportunity for "same logic, different language" bugs',
      'Point-in-time correct feature retrieval for training - training sees exactly the features that would have been available at each historical serving time',
      'Platforms: Feast, Tecton, Vertex AI Feature Store, Hopsworks - all enforce single definition of truth',
    ],
    trap: 'Thinking a feature store is just a Redis cache. The core value is feature definition reuse and point-in-time correctness, not low-latency retrieval.',
  },

  // ── The SLA Budget ────────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Walk me through how you would decompose a 100ms P99 SLA across a typical ML serving stack. Where does inference fit in the budget?',
    keyPoints: [
      'Typical breakdown: network ~10ms each way, feature lookup ~2-5ms, preprocessing ~5ms, inference ~10-20ms, post-processing ~5ms - total ~42-55ms',
      'Inference is often NOT the bottleneck - feature retrieval and serialization eat more of the budget than most engineers expect',
      'Key insight: optimizing the model while ignoring feature retrieval is a common and expensive mistake',
      'Profile first - find the actual bottleneck before optimizing. Measure, then act.',
    ],
    trap: 'Assuming model inference dominates the latency budget. Engineers who go straight to model optimization without profiling routinely find the bottleneck is in feature lookup or serialization.',
  },
  {
    difficulty: 'senior',
    question: 'Latency is 150ms P99 and you need to hit 100ms. A junior engineer suggests quantizing the model first. What is wrong with this approach?',
    keyPoints: [
      'Without profiling, you do not know where the 150ms is spent - quantization only helps inference latency',
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
      'A silent failure: the model returns HTTP 200, P99 is healthy, error rate is 0% - but predictions are wrong or degenerate',
      'Standard monitoring checks infrastructure health, not prediction health',
      'Example: fraud model scores every transaction 0.0 after a schema change upstream broke feature ingestion - endpoint looks healthy',
      'Prevention: monitor prediction distribution histogram, output entropy, null/fallback rate alongside infrastructure metrics',
    ],
    trap: 'Thinking "if the endpoint is up and returning 200, the model is working." The model can be returning the wrong answer for every single request.',
  },
  {
    difficulty: 'senior',
    question: 'Your fraud model returns 200 OK on every request but fraud rate is spiking. What prediction-level monitoring would have caught this?',
    keyPoints: [
      'Prediction distribution histogram: track the histogram of fraud scores over time - if scores suddenly cluster near 0.0, the model stopped predicting',
      'Output entropy: for classification, track average model confidence. A sudden spike (all high confidence) or collapse (all low confidence) signals drift',
      'Null/fallback rate: what percentage of requests used a default or fallback prediction - a spike means feature ingestion is broken',
      'Business metric SLOs: fraud rate itself as an SLO - if actual fraud incidents spike while model looks healthy, it is a silent failure',
    ],
  },

  // ── Dynamic Batching ──────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Explain dynamic batching. Why can a GPU process batch size 32 in nearly the same wall-clock time as batch size 1?',
    keyPoints: [
      'Dynamic batching: model server waits a configurable delay to accumulate requests, groups them into a batch, runs one inference pass, returns individual responses',
      'GPUs have thousands of CUDA cores - a batch-size-1 request leaves most cores idle, wasting the hardware',
      'Matrix multiplications in neural networks scale near-linearly in FLOPS but the overhead (kernel launch, data transfer) is amortized across the batch',
      'Result: batch-32 can have 10-20× higher throughput at similar or only slightly higher per-request latency',
    ],
    trap: 'Thinking batching is free. It adds latency equal to the queue delay to every request. The trade-off is throughput vs. tail latency.',
  },
  {
    difficulty: 'senior',
    question: 'You enable dynamic batching with 20ms queue delay. P99 latency increased 18ms but throughput improved 8×. Your SLA is P99 < 100ms and you are currently at 85ms. Is this acceptable?',
    keyPoints: [
      'New P99 would be ~103ms - breaking the SLA. Not acceptable without renegotiation',
      'The throughput gain is real but SLA compliance is binary - 100ms is the contract',
      'Options: reduce queue delay to 5-10ms and measure the trade-off, or negotiate a looser SLA given the throughput benefit',
      'Correct decision framework: measure throughput needed at your current QPS. If you are not throughput-constrained, disable or reduce the queue delay',
    ],
    trap: 'Accepting the change because throughput improved 8×. Throughput improvement does not override an SLA breach.',
  },

  // ── Caching in ML Serving ─────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'You deploy a new model and check your monitoring - prediction distribution looks completely stable. A colleague points out 60% of requests are cache hits. What is the problem?',
    keyPoints: [
      'Cache hits return predictions from the old model - your monitoring is showing the old model distribution, not the new one',
      'The new model is only being called for 40% of requests - your canary validation is based on 40% of intended traffic',
      'Drift detection is blind to cached traffic - you could have full feature drift in the live 40% while cached 60% masks it',
      'Fix: namespace cache keys by model version, flush cache on every deploy',
    ],
    trap: 'Saying "stable distribution means the deploy was successful." Stability from cache hits is false confidence.',
  },
  {
    difficulty: 'senior',
    question: 'What are the three ways caching can mask problems in ML serving, and how do you architect around each?',
    keyPoints: [
      '1. Stale predictions after model update: fix by namespacing cache keys with model version + flush on deploy',
      '2. Masking model drift: high cache hit rate means drift monitoring only sees uncached slice - fix by monitoring cache hit rate as a metric and sampling from live predictions specifically',
      '3. Near-duplicate input misses: slight input variation (whitespace, capitalisation) creates cache misses with no benefit - semantic caching using embedding similarity solves this but adds latency',
      'General rule: cache is safest for immutable inputs (image hash, stable product IDs) and must be explicitly versioned for mutable model state',
    ],
  },

  // ── Readiness vs Liveness Probes ─────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is the difference between a readiness probe and a liveness probe in Kubernetes? When does each matter for ML serving?',
    keyPoints: [
      'Liveness: is the container alive? Failure restarts the pod. Catches deadlocks, crashes, hung processes',
      'Readiness: is the pod ready to serve traffic? Failure removes it from load balancer rotation - traffic stops going to it',
      'For ML: a large model takes 30-120 seconds to load into GPU memory. Without readiness probe, Kubernetes routes traffic to a started-but-not-loaded pod - every request gets a 500',
      'Both are required. Liveness restarts broken pods; readiness prevents routing to unready pods',
    ],
    trap: 'Configuring only a liveness probe. The liveness probe does not stop traffic from reaching a pod that is starting up but has not loaded the model yet.',
  },
  {
    difficulty: 'mid',
    question: 'You deploy a 15GB model. 10% of requests fail immediately after deploy despite the liveness probe passing. What is happening and what is the fix?',
    keyPoints: [
      'The pod has started (liveness passing) but the model has not finished loading into GPU memory - readiness probe is missing or has too short an initialDelaySeconds',
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
      'Shadow mode: users always see the champion response - shadow output is logged but never shown to anyone',
      'Dark launch: a specific cohort (employees, beta users) actually receives the new model\'s responses - they see the new output',
      'Dark launch measures real user behavior on a controlled group; shadow mode measures output quality with zero user exposure',
      'Shadow before dark launch in the risk progression - shadow validates output distribution, dark launch validates user response',
    ],
    trap: 'Using the terms interchangeably. The key difference is whether any user ever sees the new model\'s output.',
  },
  {
    difficulty: 'senior',
    question: 'Why are feature flags stored in config files insufficient for production ML systems? What infrastructure is actually required?',
    keyPoints: [
      'Config file flags require a redeployment to change - defeating the purpose of decoupling deployment from exposure',
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
      'Batch: when you know the set of entities to score in advance and nobody is waiting in real time - weekly churn scoring, nightly recommendation pre-computation, offline eval',
      'Real-time: when a user or system is blocking on the prediction - fraud detection at payment time, search ranking, real-time ad bidding',
      'Cost difference: batch is 5-10× cheaper per prediction because you can use spot instances and schedule for off-peak hours',
      'Latency difference: batch is scheduled (minutes/hours delay acceptable); real-time requires millisecond response',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Your recommendation model does real-time serving and infrastructure costs are 10× over budget. What architectural change do you evaluate first?',
    keyPoints: [
      'Hybrid pattern: pre-compute embeddings and candidate sets in batch (nightly), store in a low-latency key-value store, serve predictions by fast lookup + lightweight re-ranking online',
      'Most of the compute cost in real-time recommendation is candidate generation - moving this to batch eliminates the expensive online computation',
      'The online model becomes lightweight: read pre-computed candidates, run a fast re-ranking model with fresh context signals',
      'Trade-off: pre-computed candidates are stale by up to 24 hours - acceptable for most recommendation use cases where interest changes slowly',
    ],
    trap: 'Going straight to "scale down the fleet." That addresses symptoms, not architecture. The right question is whether real-time serving is necessary for every component of the pipeline.',
  },

  // ── Model Registry ────────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'What metadata should a model registry store beyond just the model artifact, and why does each piece matter?',
    keyPoints: [
      'Training code commit SHA - enables exact reproduction of the training run',
      'Dataset version / hash - links the model to the exact data it was trained on',
      'Hyperparameters - required to reproduce and understand training decisions',
      'Evaluation metrics on a held-out benchmark - canonical performance reference',
      'Deployment stage (Staging / Production / Deprecated) - gating mechanism before canary',
    ],
    trap: 'Treating the registry as just a binary store (S3 + model.pkl) without capturing the provenance metadata needed for debugging or rollback',
  },
  {
    difficulty: 'senior',
    question: 'Six months of training runs are stored in S3 as model_v1.pkl through model_v47.pkl. A production incident requires rolling back to before last quarter\'s feature engineering change. What information do you lack?',
    keyPoints: [
      'No link between model files and the training code commit that produced them - you cannot identify which file corresponds to which feature engineering version',
      'No dataset version metadata - even if you find the right model, you cannot confirm it was trained on the pre-change data',
      'No evaluation metrics per file - you cannot verify the target model was actually better before the change',
      'This is the exact problem a model registry solves: every model artifact is linked to code commit, dataset version, and eval metrics at training time',
    ],
  },

  // ── ML-Specific SLOs ──────────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Standard infrastructure SLOs are necessary but insufficient for ML systems. What layer is missing and why?',
    keyPoints: [
      'Infrastructure SLOs catch endpoint health but not prediction health - a model can have 99.9% uptime while producing wrong outputs',
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
      'Requires a holdback/control group - some users stay on champion throughout so you have a baseline to compare against',
      'Challenge: conversion has delayed feedback (user converts hours after the recommendation) - need to use a leading metric proxy or extend observation window',
    ],
    trap: 'Saying "add business metrics to dashboards." Dashboards are for humans. The fix is automated gates that halt canary promotion when business metrics degrade.',
  },

  // ── Quantization: PTQ vs QAT ──────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: "What's the difference between PTQ and QAT, and when would you choose one over the other?",
    keyPoints: [
      'PTQ: calibrate scaling factors on a representative dataset after training - no retraining needed, takes hours. Typically costs 0.5-2% accuracy for INT8',
      'QAT: simulate quantization noise during training forward pass - model learns to be robust to it, recovers most accuracy. Requires retraining',
      'Decision: always try PTQ first. Only pay QAT retraining cost if PTQ accuracy loss is unacceptable',
      'For LLMs, INT4 PTQ (GPTQ, AWQ) is production-standard; INT8 KV cache quantization is almost always safe',
    ],
    trap: 'Jumping to QAT without trying PTQ - QAT costs days of retraining for what might be an unnecessary investment',
  },
  {
    difficulty: 'mid',
    question: 'Walk me through the pipeline from a trained FP32 model to a deployed quantized model. What validation step do engineers most often skip?',
    keyPoints: [
      'Pipeline: Train (FP32) → PTQ calibration → Export to ONNX → TensorRT/CoreML compilation → Integration test → Deploy',
      'Most skipped step: eval between PTQ and compilation - both independently affect accuracy, and TensorRT layer fusion can introduce additional precision changes',
      'Also skipped: benchmarking on representative production traffic, not just a held-out test set - quantization can affect rare input distributions disproportionately',
      'Always run your full eval suite after each transformation step, not just at the end',
    ],
  },

  // ── Knowledge Distillation ────────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: "Explain knowledge distillation. What's the key insight behind using soft labels from a teacher model?",
    keyPoints: [
      'Student trained to match teacher\'s output probability distribution, not just hard class labels',
      'Soft labels carry structural knowledge - if teacher gives 85% cat, 12% lynx, 3% dog, the student learns cats and lynxes are similar. Hard label "cat" discards this',
      'Temperature T > 1 softens the distribution further - higher T transfers more of the teacher\'s uncertainty and similarity structure',
      'Result: DistilBERT achieves 97% of BERT performance with 40% fewer parameters and 60% faster inference',
    ],
    trap: 'Describing distillation as just training a smaller model on the same data. The soft labels are the mechanism - without them it is just training a smaller architecture.',
  },
  {
    difficulty: 'senior',
    question: 'You need to deploy a model on a mobile device with a 512MB RAM limit. The base model is 7GB. In what order do you apply optimization techniques?',
    keyPoints: [
      '1. Knowledge distillation: create a smaller student architecture that fits the constraint - this is architectural compression, not just numerical precision',
      '2. PTQ on the student: quantize INT8 or INT4 to further reduce size and speed up inference on mobile hardware',
      '3. Pruning: remove weights below a magnitude threshold - reduces parameter count but requires careful fine-tuning to maintain accuracy',
      '4. ONNX export + mobile runtime: TFLite or CoreML for hardware-accelerated inference on device NPU/GPU',
    ],
    trap: 'Starting with quantization. INT8 quantization of a 7GB model gives ~1.75GB - still 3× over budget. Architecture compression (distillation) must come first.',
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
      'Missing: shadow mode output distribution check as a pre-canary gate - compare new model output histogram against champion on a 24h sample',
      'Also missing: feature schema validation between training and serving - distribution shift often starts as a schema mismatch that CI tests cannot catch',
      'Root cause is likely: new model trained on different feature distribution, or preprocessing pipeline changed between training and serving',
    ],
  },

  // ── Queue-Based Autoscaling ───────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Why is CPU utilization a bad autoscaling signal for ML serving, and what should you use instead?',
    keyPoints: [
      'ML workloads are GPU-bound - CPU stays low while GPU is saturated. HPA sees low CPU and does not scale',
      'CPU reacts after load has already hit - by the time HPA scales, users have experienced 90+ seconds of degraded latency',
      'Better signals: request queue depth (scale when requests pile up), GPU utilization via DCGM metrics, time-in-queue P99',
      'KEDA: extends Kubernetes HPA to scale on custom metrics from Prometheus, Kafka, SQS - enables queue-depth-based scaling',
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
      'Scale-down cooldown: set to at least 10 minutes to prevent thrashing - GPU nodes take 3-5 minutes to provision, aggressive scale-down wastes that investment',
    ],
  },

  // ── Speculative Decoding ──────────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'Explain speculative decoding. How does it achieve 2-4× throughput improvement with identical output quality?',
    keyPoints: [
      'A small draft model generates K candidate tokens in one pass; the large target model verifies all K in one parallel forward pass',
      'Target model verification of K tokens has similar wall-clock time to generating 1 token - so accepting 3 of 5 draft tokens gives 3× speedup',
      'Output is mathematically identical to target model running alone - rejected tokens trigger regeneration from the rejection point',
      'Speedup depends on draft acceptance rate: aim for > 70%. Below ~50%, speculative decoding is slower than standard decoding due to rejections',
    ],
    trap: 'Thinking there is an accuracy trade-off. When implemented correctly, the output distribution is provably identical to the target model.',
  },
  {
    difficulty: 'senior',
    question: 'Your draft model has a 35% token acceptance rate. Will speculative decoding help or hurt throughput, and why?',
    keyPoints: [
      'At 35% acceptance, most draft tokens are rejected - you pay for the draft model pass and the verification pass but accept fewer tokens per cycle',
      'Break-even is typically around 50-60% acceptance rate depending on draft-to-target size ratio',
      'At 35%, you are generating extra computation (draft) and accepting fewer tokens - net throughput is likely worse than standard decoding',
      'Fix: choose a draft model that shares vocabulary with the target and is stylistically similar - a 7B model as draft for a 70B target of the same family works well',
    ],
  },

  // ── Multi-Armed Bandit vs A/B ─────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'When would you use a multi-armed bandit instead of a standard A/B test for model selection? What are the trade-offs?',
    keyPoints: [
      'MAB continuously shifts traffic toward the better-performing variant - minimizes regret vs. fixed A/B splits',
      'MAB requires immediate feedback: click, purchase, immediate reward. Delayed feedback (3-day conversion) breaks most bandit algorithms',
      'A/B gives cleaner statistical inference and is better for regulated domains or when you need a p-value for a business decision',
      'Thompson Sampling adapts faster than epsilon-greedy; UCB favors variants with high uncertainty to reduce under-exploration',
    ],
    trap: 'Using a bandit when feedback is delayed - incomplete reward signals cause poor allocation decisions',
  },
  {
    difficulty: 'mid',
    question: 'Explain the exploration-exploitation trade-off in multi-armed bandits. How does epsilon-greedy implement it, and what is its main weakness?',
    keyPoints: [
      'Exploration: send traffic to all variants to keep learning which is better. Exploitation: send traffic to the current best-performing variant',
      'Epsilon-greedy: ε% of requests go to a random variant (explore), (1-ε)% go to the current best (exploit)',
      'Weakness: fixed ε means exploration rate does not decrease as confidence grows - still exploring at 10% when you have 10,000 samples and high confidence',
      'Thompson Sampling improves on this: exploration naturally decreases as posterior variance shrinks with more data',
    ],
  },

  // ── Distributed Tracing ───────────────────────────────────────────────────
  {
    difficulty: 'senior',
    question: 'How do you implement distributed tracing for an ML prediction pipeline, and what ML-specific spans would you add?',
    keyPoints: [
      'Use OpenTelemetry SDK - vendor-neutral, 2025 standard. Add spans for every ML-specific step',
      'ML spans: feature_fetch (store name + latency + cache hit/miss), preprocessing, inference (model_version + device + batch_size), post-processing',
      'Tag every span with model_version - enables filtering traces by version to correlate latency changes with deploys',
      'For async pipelines (Kafka), inject trace context into message headers to maintain trace continuity across service boundaries',
    ],
    trap: 'Only instrumenting the HTTP layer and missing inference internals - you see slow requests but cannot identify whether the bottleneck is feature lookup, batching, or GPU inference',
  },
  {
    difficulty: 'senior',
    question: 'Why should queue wait time and GPU inference time be traced as separate spans? What different actions does each metric trigger?',
    keyPoints: [
      'Queue wait time is a scaling signal: if queue wait is high, you need more replicas - this is an infrastructure/capacity problem',
      'GPU inference time is a model signal: if inference is slow per token, the model architecture or batch configuration needs optimization',
      'Combining them into one "inference" span hides which problem you actually have - leading to wrong remediation',
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
