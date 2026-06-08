export interface StudySection { heading: string; body: string; }
export interface InterviewQ {
  id?: string;
  difficulty: 'junior' | 'mid' | 'senior';
  question: string;
  keyPoints: string[];
  trap?: string;
}

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'What Is a Feature Store?',
    body: `A feature store is a centralized repository for defining, storing, and serving machine learning features. It decouples feature engineering from model training and serving, allowing features to be reused across models and teams.

Without a feature store, every team reimplements the same features (user age, spend in last 30 days, session length) with subtle differences in logic, creating inconsistency between models. A feature store provides a single source of truth.

The two core guarantees a feature store must provide: (1) training and serving use identical feature computation logic, and (2) when training, features are computed as of the time of the training label — no future information leaks in.`,
  },
  {
    heading: 'Online vs Offline Store',
    body: `A feature store typically has two storage backends with different purposes.

The offline store (e.g., BigQuery, Snowflake, S3/Parquet) stores historical feature values for training. It needs high throughput for batch reads and supports time-travel queries (point-in-time correct feature retrieval). It does not need low latency.

The online store (e.g., Redis, DynamoDB, Cassandra) stores the latest feature value per entity for low-latency serving. A recommendation model needs to look up a user's features in under 5ms. The online store provides this but typically stores only the most recent value — no history.

The gap: features computed in batch (offline) must be synchronized to the online store (materialization) before they are available for serving. Materialization lag is a key operational metric.`,
  },
  {
    heading: 'Training-Serving Skew',
    body: `Training-serving skew is one of the most common silent failures in production ML. It happens when the feature pipeline used at training time computes features differently from the pipeline used at serving time.

Example: the training pipeline computes "spend in last 30 days" by summing transactions from a data warehouse table. The serving pipeline computes the same feature from a real-time event stream. If the event stream has deduplication logic that the warehouse table lacks, the two values diverge.

The model learns patterns on training features, but at serving time receives subtly different values. This causes silent degradation — the model performs worse than expected, but nothing in infrastructure metrics indicates a problem.

A feature store prevents skew by providing a single computation definition that runs both offline and online. If you must use separate implementations, use shadow mode — run both and compare outputs on live traffic.`,
  },
  {
    heading: 'Point-in-Time Correctness',
    body: `Point-in-time correctness means that when you retrieve a feature value for a training example, you retrieve the value that was available at the time of the training event — not a future value.

Example: you are training a churn prediction model. A training example is: "user U on date D — did they churn in the next 30 days?" To compute the feature "number of sessions in last 7 days," you need the session count as of date D, not as of today.

A naive JOIN on user ID without time-awareness will pull in future session data, creating label leakage. The model learns to predict with information it would not have had at decision time, inflating offline metrics and failing badly in production.

Point-in-time correct joins are sometimes called "as-of joins" or "temporal joins." They require an event timestamp on every row and a cutoff time per entity. Most feature store platforms (Feast, Tecton) implement this natively.`,
  },
  {
    heading: 'Feature Freshness and Staleness',
    body: `Feature freshness is the time difference between when a feature value was computed and when it is used in a prediction. A user's "purchase count in last 7 days" computed 3 days ago is stale.

Freshness SLAs vary by feature tier:
  • Real-time features (user session, current cart): freshness target < 1 second
  • Near-real-time features (user engagement score, recent spend): freshness target < 5 minutes
  • Batch features (user lifetime value, historical patterns): freshness target < 24 hours

Stale features degrade model quality proportional to how much the feature value changes over time. High-volatility features (session activity, current location) suffer more from staleness than low-volatility features (account age, historical averages).

Monitor freshness as a first-class metric per feature. Alert when materialization lag exceeds the SLA. This is commonly the root cause of "the model performed fine in staging but degraded in production" issues.`,
  },
  {
    heading: 'Materialization Strategies',
    body: `Materialization is the process of computing feature values and writing them to the online store so they are available for serving.

Batch materialization: run a Spark or SQL job on a schedule (hourly, daily) to recompute features and write results to the online store. Simple and scalable but creates staleness — features are only as fresh as the last batch run.

Streaming materialization: use Flink, Spark Streaming, or Kafka Streams to continuously update feature values as events arrive. Very low latency but operationally complex — need to handle late events, out-of-order processing, and state management.

On-demand feature computation: compute features at serving time from raw events (no pre-computation). Zero staleness but adds latency to every prediction request. Only feasible for fast computations.

Hybrid approach: batch pre-compute slow features (historical aggregations), stream near-real-time features (last 5-minute activity), and compute simple transformations on-demand (age from birthdate).`,
  },
  {
    heading: 'Feature Sharing, Discovery, and Governance',
    body: `One of the primary value propositions of a feature store is feature reuse across teams. A feature computed by the fraud team (transaction velocity) may be directly useful to the credit risk team.

Feature discovery requires a catalog — a searchable index of feature definitions with descriptions, owners, consumers, and data lineage. Without discoverability, teams reinvent features instead of reusing them.

Feature versioning: when the definition of a feature changes, old models trained on version 1 should continue to receive version 1 at serving time, while new models use version 2. This prevents silent breaking changes.

Data lineage: the ability to trace a feature back to its source tables, transformations, and computation logic. Critical for debugging and auditing. Regulatory requirements (GDPR, model governance) often mandate lineage tracking.

Governance: who can create features, who can consume them, who is responsible when a feature pipeline breaks? Define ownership policies and SLAs per feature group.`,
  },
  {
    heading: 'Major Feature Store Platforms',
    body: `Feast (open source): lightweight, integrates with existing data infrastructure, supports offline (BigQuery, Redshift, S3) and online (Redis, DynamoDB) backends. Good for teams that want control and already have infrastructure. Less opinionated — requires more configuration.

Tecton: managed SaaS, strong streaming support, native Spark and Flink integration, automated materialization orchestration. Higher cost but significantly reduces operational burden for teams at scale.

Hopsworks: open source or managed, supports both online and offline with row-level security, built-in ML pipeline integration. Strong in European ML communities due to GDPR-first design.

Vertex AI Feature Store (Google Cloud), SageMaker Feature Store (AWS): tightly integrated with their respective cloud ecosystems. Easy to adopt if you are already on those platforms, but create vendor lock-in.

Build vs buy: most teams at < 10 models should not build a feature store from scratch. Use Feast or a cloud-native solution. At 100+ models with shared features, a managed platform like Tecton pays off.`,
  },
  {
    heading: 'Feature Engineering at Scale',
    body: `Feature engineering in production is a data engineering problem as much as a data science problem. The pipeline that computes features must be reliable, scalable, and observable.

Spark for batch features: large historical aggregations (30-day spend, 90-day activity) computed from data warehouse tables. Must be idempotent — re-runnable on the same time window without producing duplicates.

Flink or Spark Streaming for near-real-time features: continuous aggregation of event streams. Handles late arrivals with configurable watermarks. State must be checkpointed to recover from failures.

dbt for SQL-based features: transform warehouse data with SQL, version-controlled in Git, with data quality tests. Accessible to analysts, not just engineers. Good for batch features that fit in SQL.

Transformation testing: unit test feature logic with known inputs and expected outputs. Integration test the full pipeline in staging before production. Monitor feature value distributions in production to detect silent computation bugs.`,
  },
  {
    heading: 'Monitoring Features in Production',
    body: `Features can fail silently — the pipeline runs successfully but produces wrong values. This is the most dangerous failure mode because downstream models degrade without any infrastructure alarm.

What to monitor per feature:
  • Distribution statistics: mean, median, percentiles — alert on sudden shifts (PSI > threshold)
  • Null rate: missing values per feature per serving request
  • Freshness lag: time since last successful materialization
  • Cardinality: unexpected category values or range violations

Monitoring integration: run the same drift detection logic on features that you run on predictions. If a feature's distribution shifts, investigate before attributing degradation to the model.

Feature serving latency: online store lookup latency is a direct component of model serving P99. Monitor it separately from model inference latency. Redis latency spikes cause P99 degradations that look like model slowness.

Alerting: alert when freshness SLA is missed, when null rate exceeds threshold, or when distribution PSI exceeds 0.2. Route data quality alerts to the feature owner, not the model team.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is a feature store and what problem does it solve?',
    keyPoints: [
      'Centralized repository for ML feature definitions, storage, and serving',
      'Ensures consistent feature computation between training and serving',
      'Enables feature reuse across models and teams — avoids reimplementing the same logic',
      'Provides point-in-time correct feature retrieval for training',
    ],
    trap: 'Describing a feature store as just a data warehouse or a key-value store — it must also enforce point-in-time correctness and training-serving consistency.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between the online store and offline store in a feature store?',
    keyPoints: [
      'Offline store: historical feature values for training, high throughput, no latency requirement (BigQuery, S3)',
      'Online store: latest feature values for serving, low latency < 5ms (Redis, DynamoDB)',
      'Same computation definition, different storage backends',
      'Materialization: process of syncing computed values from offline to online store',
    ],
    trap: 'Forgetting that the online store typically stores only the latest value — it is not a historical store and cannot be used for point-in-time retrieval.',
  },
  {
    difficulty: 'junior',
    question: 'What is training-serving skew and how does a feature store prevent it?',
    keyPoints: [
      'Training-serving skew: features computed differently at training vs serving time',
      'Causes: separate code implementations, different data sources, different preprocessing logic',
      'Result: model learns patterns that do not match what it sees in production',
      'Feature store prevents by providing a single computation definition that runs both offline and online',
    ],
    trap: 'Assuming skew only comes from bugs — even correct separate implementations of the same feature (warehouse vs streaming) can diverge due to data pipeline differences.',
  },
  {
    difficulty: 'junior',
    question: 'What is point-in-time correctness in the context of feature stores?',
    keyPoints: [
      'Feature values retrieved for training must reflect what was known at training event time, not future values',
      'Prevents label leakage — using future information to predict past events',
      'Requires timestamp-aware joins (as-of joins) when building training datasets',
      'Feature stores implement this natively; naive table joins do not',
    ],
    trap: 'Using a naive JOIN on entity ID without time-awareness when building training data — this pulls in future feature values and creates label leakage.',
  },
  {
    difficulty: 'junior',
    question: 'What is feature freshness and why does it matter?',
    keyPoints: [
      'Time elapsed since a feature value was last computed',
      'Stale features degrade model quality proportional to feature volatility',
      'High-volatility features (session activity) need < 1 second freshness; low-volatility (account age) tolerate 24 hours',
      'Monitor freshness per feature and alert when materialization lag exceeds SLA',
    ],
    trap: 'Treating all features as requiring the same freshness SLA — a user\'s account creation date needs batch-level freshness, while a current session feature needs real-time freshness.',
  },
  {
    difficulty: 'mid',
    question: 'How would you design a feature store for a real-time fraud detection model?',
    keyPoints: [
      'Online store (Redis): transaction velocity, account age, device fingerprint — served in < 5ms',
      'Streaming materialization (Flink): real-time aggregations (spend in last 10 minutes) updated continuously',
      'Offline store (BigQuery): historical patterns, lifetime spend — batch materialized daily',
      'Point-in-time correct training: temporal joins when building fraud labels',
      'Freshness SLAs: real-time features < 10 seconds, batch features < 6 hours',
    ],
    trap: 'Using batch materialization for features like "spend in last 5 minutes" in a fraud context — hourly batch freshness is useless for detecting real-time fraud.',
  },
  {
    difficulty: 'mid',
    question: 'How do you detect training-serving skew in production when you do not have a feature store?',
    keyPoints: [
      'Shadow mode: run both training and serving pipelines on live requests, log and compare outputs',
      'Distribution comparison: collect feature distributions from training data and serving requests, compute PSI',
      'Log serving features alongside predictions and compare to training distribution weekly',
      'Unit tests: implement both pipelines and test with identical inputs — must produce identical outputs',
    ],
    trap: 'Relying on model accuracy metrics to detect skew — by the time accuracy degrades visibly, significant skew has usually been present for weeks.',
  },
  {
    difficulty: 'mid',
    question: 'Compare batch, streaming, and on-demand feature materialization. When do you use each?',
    keyPoints: [
      'Batch: hourly/daily Spark jobs — suitable for stable historical aggregations, low operational cost',
      'Streaming: Flink/Kafka Streams — suitable for near-real-time aggregations (< 5 min freshness), high complexity',
      'On-demand: compute at serving time — zero staleness, adds serving latency, only for fast computations',
      'Hybrid: batch for historical, streaming for recent activity, on-demand for simple transformations',
    ],
    trap: 'Using on-demand computation for complex aggregations over large windows — the latency cost makes the model serving unacceptably slow.',
  },
  {
    difficulty: 'mid',
    question: 'How do you handle feature versioning when a feature definition changes?',
    keyPoints: [
      'Maintain backward-compatible versions: feature_v1, feature_v2 coexist in the store',
      'Old models continue consuming v1 at serving time; new models use v2',
      'Deprecation policy: mark v1 deprecated, give consuming teams a migration window (e.g., 90 days)',
      'Backfill v2 values for historical training data when introducing new version',
      'Never silently change a feature in-place — downstream models see a silent distribution shift',
    ],
    trap: 'Modifying a feature definition in-place without versioning — causes silent distribution shift for all models consuming that feature.',
  },
  {
    difficulty: 'mid',
    question: 'What metrics would you monitor for a production feature store?',
    keyPoints: [
      'Feature freshness lag per feature group — alert when materialization SLA is missed',
      'Online store lookup latency (P99) — contributes directly to model serving P99',
      'Null rate per feature per serving request — spike indicates pipeline failure',
      'Distribution drift (PSI) per feature — unexpected shift may indicate source data change',
      'Materialization job success/failure rate and processing lag',
    ],
    trap: 'Only monitoring whether the materialization job succeeded — not whether the values produced are valid (correct distribution, expected null rate).',
  },
  {
    difficulty: 'mid',
    question: 'How does a feature store help with regulatory compliance and model governance?',
    keyPoints: [
      'Data lineage: trace each feature to its source table, transformation, and computation job',
      'Access control: RBAC policies on which teams/models can consume which features',
      'Audit log: record which feature versions were used in which model version at what time',
      'Feature deletion: GDPR right-to-erasure requires cascading deletion from feature store and retrained models',
      'Reproducibility: ability to reconstruct exact feature values used for a past prediction',
    ],
    trap: 'Treating governance as purely a technical concern — feature store governance requires cross-functional ownership policies and process, not just infrastructure.',
  },
  {
    difficulty: 'senior',
    question: 'Design a feature store architecture for a company with 50 ML models across 10 teams, processing 100k RPS.',
    keyPoints: [
      'Online store: Redis Cluster for low-latency serving, sharded by entity ID, read replicas for high RPS',
      'Offline store: BigQuery or Iceberg on S3 for training data, partitioned by date and entity type',
      'Streaming: Flink jobs per feature group for near-real-time materialization',
      'Feature registry: centralized catalog with ownership, SLAs, dependencies, deprecation policies',
      'Compute governance: shared Spark cluster for batch materialization, isolated Flink job slots per team',
    ],
    trap: 'Using a single Redis instance without sharding at 100k RPS — single-node Redis saturates at ~100k simple operations/second with no headroom for latency spikes.',
  },
  {
    difficulty: 'senior',
    question: 'A model\'s performance degraded after a feature pipeline update. How do you diagnose whether it is training-serving skew vs genuine drift?',
    keyPoints: [
      'Compare serving feature distributions before and after the pipeline update using logged feature values',
      'Run the old and new pipeline side-by-side on the same live requests, compare outputs',
      'Check if the degradation correlated with the pipeline deploy timestamp (skew) or started earlier (drift)',
      'Re-evaluate the model on held-out historical data with the new feature values — if offline metrics also dropped, it is skew',
      'Check feature null rates — a pipeline bug that introduces nulls causes skew, not drift',
    ],
    trap: 'Triggering a retrain immediately without diagnosing root cause — if the issue is pipeline skew, retraining on corrupted data will make the problem worse, not better.',
  },
  {
    difficulty: 'senior',
    question: 'How do you build a point-in-time correct training dataset at scale for 500 million training examples?',
    keyPoints: [
      'Use an as-of join: for each (entity, event_timestamp) pair, join the feature value that was most recent as of event_timestamp',
      'Partition features by entity and date to enable efficient temporal lookups',
      'Implement using Spark with windowed joins or dedicated feature store APIs (Feast, Tecton)',
      'Sort feature history by timestamp and binary search for the correct value at training time',
      'Validate with canary comparison: run point-in-time and naive joins, check for future leakage in holdout metrics',
    ],
    trap: 'Using a naive GROUP BY entity_id to get the latest value — this produces the latest value at query time, not at training event time.',
  },
  {
    difficulty: 'senior',
    question: 'How do you manage feature store costs as the number of features and models grows?',
    keyPoints: [
      'Online store cost: prune features not consumed by active models — online store is the most expensive tier',
      'Offline storage cost: partition pruning, compression (Parquet/Zstd), tiered storage (SSD → object storage)',
      'Compute cost: batch job consolidation — compute multiple features in a single Spark job over the same source table',
      'Freshness tiering: downgrade over-freshened features to batch materialization if model performance is not affected',
      'Feature deprecation policy: retire features with zero consumers within 30 days',
    ],
    trap: 'Materializing all features to the online store at the highest freshness SLA by default — this is extremely expensive and wasteful for batch-level features.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between feature engineering and feature serving?',
    keyPoints: [
      'Feature engineering: the process of defining and computing features from raw data (transformation logic)',
      'Feature serving: retrieving pre-computed feature values at prediction time with low latency',
      'Engineering is about correctness; serving is about latency and availability',
      'A feature store handles both: stores computation definitions and serves results to models',
    ],
    trap: 'Thinking feature serving is just a database read — it also involves consistency guarantees, versioning, and freshness tracking.',
  },
  {
    difficulty: 'mid',
    question: 'How do you migrate an existing model to a feature store without downtime?',
    keyPoints: [
      'Shadow mode: run existing and new feature pipeline in parallel, compare outputs for correctness',
      'Start with offline: use feature store for training new model version while production still uses old pipeline',
      'Gradually shift serving: blue/green deployment of feature retrieval — serve new features to a canary slice',
      'Monitor skew between old and new pipeline during cutover; alert on PSI > threshold',
      'Rollback plan: keep old pipeline active for 2 weeks post-migration before decommissioning',
    ],
    trap: 'Doing a hard cutover from the old pipeline to the feature store without a shadow validation period — silent skew can be present that only shows up after the full cutover.',
  },
  {
    difficulty: 'senior',
    question: 'Compare Feast, Tecton, and building a feature store in-house. What factors drive the decision?',
    keyPoints: [
      'Feast (open source): low cost, high control, requires significant operational investment, good < 20 models',
      'Tecton (managed): high cost, strong streaming/streaming backfill, fast time-to-value, good at 50+ models',
      'In-house: full control, highest cost (engineering time), only justified at extreme scale with unique requirements',
      'Key factors: team size, number of models, streaming vs batch requirements, existing data infrastructure, compliance',
      'Most teams should not build in-house — feature store infrastructure is a solved problem; spend engineering on ML differentiation',
    ],
    trap: 'Underestimating the operational cost of Feast — open source does not mean zero cost; you still need engineers to maintain, monitor, and evolve the infrastructure.',
  },
  {
    difficulty: 'junior',
    question: 'What is feature cardinality and why does it matter in a feature store?',
    keyPoints: [
      'Cardinality: the number of distinct values a feature can take',
      'High-cardinality features (user ID, product ID) require specific handling — one-hot encoding explodes dimension',
      'In a feature store: high cardinality = more storage keys in online store, more complex entity key design',
      'Monitor for unexpected cardinality changes — sudden new category values may indicate data quality issue',
    ],
    trap: 'Only thinking about cardinality as a modeling concern rather than also a storage and serving design concern.',
  },
];
