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

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'What Is Data Drift?',
    body: `Data drift is a change in the statistical properties of your model's inputs or outputs over time compared to the distribution seen during training. It is the primary reason a model that performed well at launch degrades quietly in production without any code change.

Three distinct types of drift matter in production:

  • Covariate shift: the distribution of input features P(X) changes, but the relationship between features and labels P(Y|X) stays the same. Example: a loan model trained mostly on urban applicants starts receiving rural applicants. The features have shifted but the underlying credit relationship is unchanged.
  • Concept drift: P(Y|X) changes — the relationship between features and the correct label shifts. Example: fraud patterns evolve after a new attack vector. The same transaction features now map to a different fraud probability. Retraining on fresh data is the only real fix.
  • Label drift: the marginal distribution of labels P(Y) changes. Example: seasonality causes the fraction of fraudulent transactions to spike in December. The model's prior assumptions no longer match reality.

Each type requires a different detection approach and a different response. Treating all three as the same "drift problem" leads to incorrect remediation.`,
  },
  {
    heading: 'Population Stability Index (PSI)',
    body: `PSI measures how much a feature distribution has shifted between a reference period (usually training data or a recent baseline window) and a current production window. It is the most widely used drift statistic in industry.

Formula:

  PSI = sum over bins of (Actual% - Expected%) * ln(Actual% / Expected%)

Where bins are fixed buckets computed on the reference distribution. For categorical features, each category is a bin.

Standard thresholds:
  • PSI < 0.10: negligible drift, no action needed
  • 0.10 <= PSI < 0.20: moderate drift, investigate
  • PSI >= 0.20: significant drift, likely retraining required

Limitations of PSI:
  • Sensitive to bin count and bin boundaries chosen on the reference data — different binning strategies produce very different PSI scores for the same underlying shift
  • Undefined when a bin has zero observations in either distribution (requires smoothing: add a small constant like 0.001 to all bin counts)
  • Measures marginal distributions of individual features only — does not capture multivariate distribution shifts or feature interaction changes
  • No statistical hypothesis test — PSI is a heuristic index, not a p-value. You cannot state a Type I error rate for a PSI threshold`,
  },
  {
    heading: 'KL Divergence and JS Divergence',
    body: `KL divergence (Kullback-Leibler) measures how much one probability distribution diverges from another. In drift detection, you compute KL(P_production || P_training) to quantify how far the current feature distribution has moved from the training baseline.

KL divergence formula:

  KL(P || Q) = sum of P(x) * ln(P(x) / Q(x))

Critical properties that determine when to use it:
  • Asymmetric: KL(P||Q) is not equal to KL(Q||P). For drift detection this matters — the direction of comparison affects the magnitude.
  • Undefined when Q(x) = 0 for any x where P(x) > 0. Smoothing required.
  • Unbounded: no natural upper threshold to compare across features or time periods.

Jensen-Shannon (JS) divergence solves most of these problems. It is defined as the average of KL(P||M) and KL(Q||M) where M is the midpoint distribution (P+Q)/2.

  • Symmetric: JS(P||Q) = JS(Q||P)
  • Always bounded between 0 and 1 (using log base 2, or 0 and ln(2) using natural log)
  • Always defined — no division by zero risk

When to use each:
  • Use PSI when you need a widely understood industry standard with easy thresholds and stakeholder communication
  • Use KL divergence when you need to measure surprise from a reference perspective and asymmetry is acceptable
  • Use JS divergence when you need a symmetric, bounded, stable metric — preferred for automated monitoring pipelines where unbounded values cause threshold calibration problems`,
  },
  {
    heading: 'Covariate Shift vs Concept Drift — Detection and Response',
    body: `Covariate shift and concept drift are both data distribution problems but they require fundamentally different responses.

Detecting covariate shift:
  Run PSI or KS tests on input features. If input distributions diverge from the training baseline, you have covariate shift. Crucially, you can detect covariate shift without labels — you just compare feature distributions. This makes it detectable in real time.

Response to covariate shift:
  If P(Y|X) has not changed (only inputs shifted), the model's learned function is still correct — you just need to retrain with data from the new input distribution so the model covers the new region of feature space. Alternatively, importance weighting techniques can re-weight training samples to match the new input distribution without full retraining.

Detecting concept drift:
  Requires labels, which may arrive with a delay (hours for clicks, days for conversions, weeks for healthcare outcomes). You compare model predictions against actual outcomes over a sliding window. A stable feature distribution with degrading prediction accuracy is the signature of concept drift.

Response to concept drift:
  Retraining on recent data is necessary because the underlying relationship has changed. The previous training data may now be misleading — data weighting or forgetting strategies are used to de-emphasize historical data that no longer reflects current patterns.

The dangerous case in production: covariate shift and concept drift can co-occur. Covariate shift is detectable immediately; concept drift may not surface until labeled data arrives days later. Monitoring both independently prevents confounding one for the other.`,
  },
  {
    heading: 'Feature Monitoring at Scale',
    body: `A production ML system with 500 features cannot have a human reviewing every feature's drift dashboard daily. Prioritization and automation are required.

Which features to monitor first:
  • High-importance features: features with the highest SHAP or permutation importance — drift in these causes the largest downstream prediction shift
  • Features with known instability: features derived from external data sources (third-party APIs, real-time market data) that have historically varied
  • Features with business meaning: features tied to user behavior changes (time-since-last-purchase, engagement score) that naturally shift with product changes
  • Features flagged by training-serving skew analysis: any feature whose serving distribution previously diverged from training

Sampling strategies:
  Computing exact PSI over all features in real time on every request is expensive. Common approaches:
  • Reservoir sampling: maintain a rolling sample of fixed size (e.g., 10,000 observations) and compute statistics hourly
  • Time-window aggregation: bucket feature values into 15-minute or hourly windows and compute drift metrics against the reference window
  • Triggered monitoring: run detailed drift analysis only when a lightweight proxy metric (prediction distribution shift, error rate change) crosses a threshold

At very large scale (billions of features in embedding-based models), monitoring individual features is impractical. Monitor embedding centroids, intra-cluster variance, and cosine distance from training centroid instead.`,
  },
  {
    heading: 'Alert Threshold Selection',
    body: `Choosing PSI = 0.20 as a universal alert threshold treats all features as equally important and all alert costs as symmetric. In practice, neither is true.

False positive cost: alerting when no meaningful degradation has occurred wastes engineering time, erodes trust in monitoring, and eventually causes oncall engineers to ignore alerts — the very outcome you are trying to prevent.

False negative cost: failing to detect drift that causes prediction degradation results in a silent quality regression. In a fraud model, this means real fraud goes undetected. In a recommendation model, this means degraded user experience that quietly costs revenue.

Calibration approaches:

  • Percentile-based thresholds: set the threshold at the 99th percentile of PSI observed during a stable reference period (e.g., last 30 days with no known model changes). Anything above that is anomalous by historical standards.
  • Feature-importance-weighted thresholds: apply tighter thresholds (lower PSI) to high-importance features and looser thresholds to low-importance features. Drift in a top-5 feature deserves a lower trigger than drift in rank-200 feature.
  • Business-impact-linked thresholds: back-test PSI values against historical periods where model quality degraded. Find the PSI level at which performance regression became measurable and set the threshold slightly below that.

The general principle: thresholds should be calibrated empirically on your specific model and data, not set from a generic industry rulebook. PSI = 0.20 is a starting point, not a law.`,
  },
  {
    heading: 'Drift vs Degradation — Drift Is a Proxy',
    body: `This is one of the most important conceptual distinctions in ML monitoring: drift is a signal, not proof of performance degradation.

A model can show significant feature drift (PSI > 0.20) while continuing to perform correctly — because the model's learned function generalizes well to the new region of input space. Conversely, a model can show no feature drift while experiencing silent performance degradation due to concept drift (the relationship between features and labels changed, not the features themselves).

Drift detection is a proxy metric. Its usefulness is proportional to the strength of its historical correlation with actual performance drops.

What drift monitoring actually buys you:
  • Early warning: drift is detectable without labels, which may arrive days later. PSI on features is available in real time; accuracy is not.
  • Debugging signal: when performance does drop and labels arrive, drift data tells you which features changed and when, narrowing root cause investigation.

What drift monitoring does not tell you:
  • Whether the model is still making correct predictions — you need labeled feedback for that.
  • Whether the drift is large enough to matter — only performance metrics on outcomes can answer this.

The production-mature approach is a two-layer monitoring system: drift metrics as leading indicators that trigger investigation, and performance metrics on outcomes (when labels are available) as the authoritative measure of model health. Never use drift as a substitute for outcome monitoring.`,
  },
  {
    heading: 'Monitoring Pipelines in Production',
    body: `Several tools have become standard for ML monitoring in production. Understanding what each does and does not do is essential for system design decisions.

Evidently AI:
  Open-source Python library for computing data and model quality metrics. Generates HTML reports or JSON output with drift metrics (PSI, KS test, Wasserstein distance), data quality statistics, and model performance metrics when labels are available. Integrates into Airflow and Prefect pipelines. Strong for offline/batch monitoring and generating per-run reports. Less suited for real-time streaming monitoring.

WhyLogs (by WhyLabs):
  Profiling library that computes statistical summaries (sketches) of data streams in real time with very low memory overhead. Profiles can be sent to the WhyLabs platform for visualization and alerting. The key design decision: WhyLogs computes approximate statistics (using datasketches) rather than storing all data, making it feasible to run inline in a serving pipeline.

Arize AI:
  Commercial platform focused on real-time model observability. Strong integration with production serving stacks. Provides embedding monitoring, prediction monitoring, and SHAP-based feature importance drift. Particularly well-suited for NLP and vision models where embedding drift is the meaningful signal.

Fiddler AI:
  Enterprise platform with explainability, monitoring, and fairness capabilities. Strong in regulated industries (financial services, healthcare) where audit trails and compliance reporting are required.

Design principle: most production teams combine a lightweight inline profiler (WhyLogs or a custom sketch) for real-time alerting with a richer offline analysis tool (Evidently) for scheduled reporting and deep-dive investigations.`,
  },
  {
    heading: 'Responding to Drift — Investigate vs Retrain vs Rollback',
    body: `Not every drift alert warrants the same response. A tiered decision framework prevents both under-reaction (ignoring real problems) and over-reaction (retraining on noise).

Step 1 — Investigate:
  Before any action, confirm the drift is real and understand its source.
  • Is it a data pipeline issue? A schema change upstream, a feature store outage, or a null-handling bug can cause apparent drift that disappears when the pipeline is fixed.
  • Is it seasonal or expected? A retail model in December seeing higher purchase volume is not a problem. PSI will spike — you want to know this in advance and suppress the alert or adjust the threshold.
  • Is it localized? Drift in one low-importance feature with no change in prediction distribution is unlikely to require retraining.

Step 2 — Assess performance impact:
  If labeled feedback is available, compute model performance on the drifted data slice. If accuracy, AUC, or calibration has not degraded, the model is generalizing — no retraining needed yet.

Step 3 — Retrain:
  Required when: performance has degraded on labeled data, the model's training distribution no longer covers the production distribution, or upstream data has permanently changed (product change, new user cohort, new market).
  Retrain with data from the new distribution. Use a sliding window or time-weighted sampling to avoid over-indexing on recent data for models that need temporal stability.

Step 4 — Rollback:
  Rollback is appropriate when: drift is caused by a bad deployment (model update, feature engineering change), the previous model version was better on current data, and retraining cannot happen fast enough. Rollback is not a fix for concept drift — rolling back to the old model does not fix a changed world.`,
  },
  {
    heading: 'Drift in NLP and Vision Models',
    body: `In tabular models, drift is measured on individual feature columns. In NLP and vision models, the "features" are high-dimensional embedding vectors or raw tokens — individual feature monitoring does not apply.

Embedding drift:
  The meaningful signal is how much the distribution of embedding vectors has shifted in embedding space. Common approaches:

  • Centroid distance: compute the mean embedding vector for each production window and measure cosine distance from the training centroid. A large centroid shift indicates the model is receiving systematically different inputs.
  • Intra-cluster variance: if the variance of production embeddings increases, inputs are becoming more diverse than training data. If variance decreases, inputs may be narrowing to a specific subspace.
  • Dimensionality reduction + distribution test: project embeddings to 2D with UMAP or PCA and apply a distribution test on the projected coordinates.

CLIP distance for vision:
  For image models, CLIP embeddings provide a semantically meaningful representation space. Measuring cosine distance between production image embeddings and training image embeddings in CLIP space detects semantic shifts — changes in the types of images being submitted — rather than just pixel-level distribution differences.

Prediction confidence as a proxy:
  When embedding monitoring is expensive, monitor the model's output confidence distribution instead. Inputs far outside the training distribution tend to produce anomalous confidence scores — either unusually high (overconfident extrapolation) or unusually low (the model does not know what to do with the input). A sustained shift in the confidence histogram is a practical early warning signal for embedding drift.

Tooling: Arize AI has native embedding monitoring. For custom implementations, Facebook AI Similarity Search (FAISS) enables efficient nearest-neighbor comparison of production embeddings against a training reference index.`,
  },
  {
    heading: 'Kolmogorov-Smirnov Test and Other Statistical Tests',
    body: `The KS test and related statistical tests complement PSI by providing a formal hypothesis test with a p-value rather than a heuristic index.

Kolmogorov-Smirnov (KS) test:
  Measures the maximum absolute difference between two empirical cumulative distribution functions (CDFs). The null hypothesis is that both samples come from the same distribution.
  • Works for continuous features without requiring binning
  • Provides a p-value — statistically interpretable as Type I error rate
  • Sensitive to shifts anywhere in the distribution, not just the mean
  • Can be overpowered at large sample sizes — with millions of observations, trivially small shifts become statistically significant

Chi-squared test:
  Appropriate for categorical features. Tests whether the observed category frequencies in production differ from expected frequencies from training.

Wasserstein distance (Earth Mover's Distance):
  Measures the minimum "work" needed to transform one distribution into another. Unlike KS, it is sensitive to the magnitude of shifts, not just their existence. No significance threshold — used as a relative metric for comparing drift across features or time periods.

Population consideration: all statistical tests become hyper-sensitive at production scale. With 10 million observations, a PSI of 0.001 may be statistically significant. Statistical significance does not equal practical significance. Always pair statistical tests with effect size measures and business impact assessment before escalating an alert.`,
  },
  {
    heading: 'Upstream Data Source Monitoring',
    body: `Drift in model inputs often originates in upstream data pipelines before reaching the model. Monitoring only at the model input layer misses problems early enough to act.

What to monitor upstream:
  • Schema: column names, data types, and cardinality of categorical features. Schema changes from upstream ETL jobs are a leading cause of sudden drift spikes.
  • Volume: row counts and event rates per time window. A 30% drop in feature store write volume indicates missing data, not real user behavior change.
  • Freshness: the age of data when it arrives at the model. A feature that should be refreshed hourly but is 8 hours stale is causing serving skew regardless of what the value says.
  • Source-level statistics: if your feature store aggregates from an events database, monitor the raw events for distribution shifts before they propagate to features.

Great Expectations and dbt tests:
  These tools run data quality checks at the pipeline level — null rates, value ranges, referential integrity — and can block feature materialization jobs when checks fail. This prevents bad data from silently reaching the model.

The monitoring stack architecture:
  Source events → raw data checks (Great Expectations) → feature store writes → feature distribution monitoring (WhyLogs) → model input PSI (Evidently) → prediction distribution monitoring → outcome metrics (when labels arrive).

Each layer catches a different class of failure. Teams that monitor only the final layer (model inputs) are blind to pipeline failures that look like drift.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    id: 'drift-001',
    difficulty: 'junior',
    question: 'What is data drift, and why does it cause models to degrade over time?',
    keyPoints: [
      'Drift is a change in statistical properties of inputs or outputs compared to training distribution',
      'Models learn a function fitted to training distribution — when inputs change, the learned function may no longer apply',
      'Three types: covariate shift (P(X) changes), concept drift (P(Y|X) changes), label drift (P(Y) changes)',
      'Detecting drift early is a proxy for catching performance degradation before labels confirm it',
    ],
    trap: 'Conflating all three drift types as "the data changed." Each requires a different detection method and a different response.',
  },
  {
    id: 'drift-002',
    difficulty: 'junior',
    question: 'What is PSI and how do you interpret its value?',
    keyPoints: [
      'PSI measures how much a feature distribution has shifted between a reference baseline and a current window',
      'PSI < 0.10: no significant drift; 0.10-0.20: moderate, investigate; > 0.20: significant drift',
      'Formula sums (Actual% - Expected%) * ln(Actual%/Expected%) over bins',
      'PSI is a heuristic index, not a p-value — no Type I error rate can be stated',
    ],
    trap: 'Treating PSI thresholds as hard rules. They are industry starting points that must be calibrated to your specific model and use case.',
  },
  {
    id: 'drift-003',
    difficulty: 'junior',
    question: 'What is the difference between covariate shift and concept drift? Give a concrete example of each.',
    keyPoints: [
      'Covariate shift: input distribution P(X) changes, but P(Y|X) stays the same — detectable without labels',
      'Concept drift: the relationship P(Y|X) changes — only detectable when labels arrive',
      'Covariate shift example: a model trained on desktop users starts receiving mobile users (features shift, relationship unchanged)',
      'Concept drift example: a fraud model faces a new attack pattern — same transaction features now predict differently',
    ],
    trap: 'Saying covariate shift always requires retraining. If the model generalizes to the new input region, no retraining is needed.',
  },
  {
    id: 'drift-004',
    difficulty: 'junior',
    question: 'Name three open-source or commercial tools used for ML monitoring in production.',
    keyPoints: [
      'Evidently AI: generates drift reports with PSI, KS test, data quality metrics — strong for batch/offline analysis',
      'WhyLogs (WhyLabs): real-time probabilistic sketches with low memory overhead — suitable for inline serving monitoring',
      'Arize AI: commercial platform with embedding monitoring and real-time observability',
      'Fiddler AI: enterprise platform with explainability and compliance reporting for regulated industries',
    ],
    trap: 'Describing all monitoring tools as equivalent. Evidently is batch-oriented; WhyLogs is designed for real-time streams — choosing the wrong tool adds latency to serving or misses real-time drift.',
  },
  {
    id: 'drift-005',
    difficulty: 'mid',
    question: 'Your PSI alert fires for a feature with value 0.25. Walk me through your investigation before deciding to retrain.',
    keyPoints: [
      'First check: is this a data pipeline issue (schema change, null handling bug, feature store outage)?',
      'Second: is the drift seasonal or expected (e.g., December retail volume spike)?',
      'Third: check if prediction distribution has shifted — drift without prediction shift may not require action',
      'Fourth: if labels are available, compute performance on drifted data slice. Degradation confirms action is needed.',
    ],
    trap: 'Immediately scheduling a retrain on a PSI alert. Drift is a proxy signal; many PSI spikes are pipeline artifacts that disappear when the bug is fixed.',
  },
  {
    id: 'drift-006',
    difficulty: 'mid',
    question: 'Why is PSI undefined when a bin has zero observations, and how do you handle this in practice?',
    keyPoints: [
      'PSI formula includes ln(Actual%/Expected%) — if either is zero, you get division by zero or log of zero',
      'Standard fix: add a small smoothing constant (e.g., 0.001) to all bin counts before computing percentages',
      'Alternative: merge zero-count bins with adjacent bins to ensure all bins have observations',
      'This is an implementation detail that causes silent failures when overlooked — production PSI implementations must handle it explicitly',
    ],
    trap: 'Ignoring the zero-bin problem. Real production data frequently produces sparse bins for rare categories or edge values, making this a common cause of NaN or Inf PSI values.',
  },
  {
    id: 'drift-007',
    difficulty: 'mid',
    question: 'Explain the difference between KL divergence and JS divergence. When would you prefer JS in a production monitoring pipeline?',
    keyPoints: [
      'KL divergence is asymmetric and unbounded — KL(P||Q) != KL(Q||P), and can be infinite',
      'JS divergence is symmetric and bounded [0, 1] — always defined, makes threshold calibration stable',
      'JS = average of KL(P||M) and KL(Q||M) where M = (P+Q)/2',
      'Prefer JS in automated pipelines where unbounded metrics cause threshold calibration problems; use KL when asymmetric surprise from reference perspective is semantically meaningful',
    ],
    trap: 'Treating KL and JS as interchangeable. The asymmetry and unboundedness of KL make it poorly suited for automated alerting pipelines without careful normalization.',
  },
  {
    id: 'drift-008',
    difficulty: 'mid',
    question: 'You have 500 features in your model. How do you prioritize which features to monitor for drift?',
    keyPoints: [
      'Monitor high-importance features first (top features by SHAP or permutation importance) — drift here has largest prediction impact',
      'Monitor features from unstable external sources (third-party APIs, real-time market data) that historically vary',
      'Monitor features previously identified in training-serving skew analysis',
      'For the long tail: use lightweight proxy monitoring (prediction distribution, output entropy) rather than per-feature PSI on all 500',
    ],
    trap: 'Running PSI on all 500 features in real time with equal priority. This is computationally expensive and produces too many low-signal alerts that cause alert fatigue.',
  },
  {
    id: 'drift-009',
    difficulty: 'mid',
    question: 'Your model shows no feature drift (all PSI < 0.05) but model accuracy has dropped 8% over the last month. What is happening?',
    keyPoints: [
      'This is the signature of concept drift: P(Y|X) changed while P(X) stayed stable',
      'The features look the same but the correct labels have changed — the world moved, not the inputs',
      'Feature drift monitoring cannot detect this — labels are required',
      'Detection requires comparing model predictions against actual outcomes over a sliding window using ground truth labels',
    ],
    trap: 'Concluding the monitoring system is broken. No-drift plus accuracy degradation is specifically the concept drift signature — the monitoring worked correctly, it just cannot detect this type of drift.',
  },
  {
    id: 'drift-010',
    difficulty: 'mid',
    question: 'When is drift without performance degradation acceptable, and when should it still trigger investigation?',
    keyPoints: [
      'Acceptable: drift in low-importance features, seasonal drift that was present in training data, drift within the model\'s demonstrated generalization range',
      'Still investigate: drift in top-5 features by importance, any drift concurrent with a business metric change, drift that exceeds historical maximums',
      'The principle: drift is a proxy — correlate it with labeled performance data to calibrate whether your specific model\'s performance is sensitive to this type of drift',
      'Document your finding: a drift-without-degradation event is valuable data for calibrating future thresholds',
    ],
    trap: 'Automatically dismissing drift because performance looks stable. Drift may not have caused degradation yet, but the model is now extrapolating outside its training distribution — future degradation risk is elevated.',
  },
  {
    id: 'drift-011',
    difficulty: 'mid',
    question: 'How does WhyLogs differ from Evidently for production drift monitoring? When would you use each?',
    keyPoints: [
      'WhyLogs: computes probabilistic sketches inline in the serving path with very low overhead — designed for real-time monitoring at high throughput',
      'Evidently: computes exact statistics on batched data and generates rich HTML reports — designed for scheduled reporting and deep-dive analysis',
      'Use WhyLogs inline for real-time alerting; use Evidently in a daily/hourly batch job for comprehensive drift reports and debugging',
      'Many teams combine both: WhyLogs for low-latency alerting, Evidently for the scheduled detailed analysis that runs after the alert fires',
    ],
    trap: 'Choosing Evidently for inline monitoring. Its computation model is batch-oriented — adding Evidently to the serving path adds significant latency.',
  },
  {
    id: 'drift-012',
    difficulty: 'mid',
    question: 'Describe how you would monitor a text classification model for input drift in production.',
    keyPoints: [
      'Embedding drift: compute sentence embeddings for production inputs, track centroid distance and intra-cluster variance vs training embeddings',
      'Vocabulary/token distribution: track out-of-vocabulary token rate, top-N term frequency distribution shifts',
      'Prediction confidence histogram: track distribution of output probabilities — shifts indicate inputs moving outside training distribution',
      'Downstream: track label distribution in predictions as a label drift proxy when ground truth is unavailable',
    ],
    trap: 'Trying to apply tabular PSI to individual token counts. High-dimensional sparse feature monitoring does not generalize from tabular approaches — embedding-space monitoring is the appropriate method.',
  },
  {
    id: 'drift-013',
    difficulty: 'senior',
    question: 'You are designing a drift monitoring pipeline for a fraud detection model with 48-hour label delay. How do you structure leading vs lagging indicators?',
    answer: `The 48-hour label delay means you cannot use accuracy as a real-time signal. You need a layered system where leading indicators fire immediately and lagging indicators confirm or deny the severity once labels arrive.

Leading indicators (available in real time):
  • Feature PSI on high-importance features — flags input distribution shifts immediately
  • Prediction score distribution monitoring — if fraud scores collapse to a narrow range, the model is no longer discriminating
  • Upstream data quality checks — schema changes, volume drops, freshness violations trigger before predictions are even made

Lagging indicators (available after 48-hour delay):
  • Precision, recall, AUC on labeled transactions in the past 48-hour window
  • Calibration curve drift — are predicted probabilities still aligned with actual fraud rates?
  • False negative rate on confirmed fraud cases — the most business-critical metric

The key design decision: leading indicators trigger investigation, not immediate action. Only lagging performance indicators on labeled data justify retraining or rollback. Retraining based solely on PSI alerts without label confirmation wastes compute and risks model instability.

For the pipeline: WhyLogs inline for real-time feature sketches, alert on centroid distance or PSI thresholds; Evidently scheduled report daily using labeled data from the 48-hour lag window; page oncall when both leading and lagging indicators agree there is a problem.`,
    keyPoints: [
      'Leading indicators (real-time): feature PSI, prediction distribution, upstream data quality',
      'Lagging indicators (post-label-delay): accuracy, AUC, calibration, FNR on confirmed fraud',
      'Design rule: leading indicators trigger investigation; lagging indicators justify retraining',
      'Never retrain based solely on PSI without label confirmation — risk of training on a transient data artifact',
    ],
    trap: 'Designing a monitoring system that only uses labeled performance metrics. In fraud with 48-hour delay, you are blind for two days without leading indicators.',
  },
  {
    id: 'drift-014',
    difficulty: 'senior',
    question: 'How do you detect concept drift in a model where ground truth labels take 90 days to arrive (e.g., loan default prediction)?',
    keyPoints: [
      'Proxy labels with shorter lag: use early behavioral signals (first payment missed, delinquency notices) as leading indicators of eventual default',
      'Population-level surrogate: track macroeconomic indicators (unemployment rate, credit index) that correlate with default rates — concept drift often precedes a macro shock',
      'Cohort analysis: segment predictions by approval month and track their eventual default rates — a month-over-month shift in default rate for similar predicted-risk cohorts indicates concept drift',
      'Self-consistency check: compare predictions on identical inputs submitted at different times — if the same input gets systematically different scores over time when the input features are unchanged, concept drift is present',
    ],
    trap: 'Waiting 90 days for labels to confirm concept drift. By then, 3 months of loans have been underwritten with a degraded model. Proxy signals and population-level indicators are necessary for long-lag domains.',
  },
  {
    id: 'drift-015',
    difficulty: 'senior',
    question: 'Drift thresholds set at PSI = 0.20 globally are firing alerts constantly. Most are false positives. How do you redesign the alert system?',
    answer: `A global PSI threshold is treating all features equally and ignoring historical variance. The fix is a multi-dimensional calibration.

Feature-importance-weighted thresholds: apply a tighter threshold (e.g., PSI = 0.10) for top-10 features by SHAP importance, and a looser threshold (PSI = 0.35) for rank 100+ features. Drift in a low-importance feature does not need to page anyone.

Historical percentile calibration: compute PSI for each feature over a 30-day "stable" reference period. Set the alert threshold at the 99th percentile of what was observed. This defines "anomalous by this feature's historical standards" rather than an arbitrary absolute value.

Suppress expected seasonality: for features with known seasonal patterns, compute separate reference baselines per week-of-year or month. Comparing December to January baselines will always fire.

Correlation guard: before paging, check whether prediction distribution has also shifted. If feature drift is high but the model's output distribution is stable, suppress the alert and log for investigation rather than paging oncall.

MTTD vs false positive tradeoff: document the new false positive rate and the estimated detection latency. A stricter threshold catches drift faster but pages more often. That tradeoff should be an explicit business decision, not a default.`,
    keyPoints: [
      'Feature-importance-weighted thresholds: tight for high-impact features, loose for low-impact',
      'Historical percentile calibration: threshold = 99th percentile of observed PSI during stable period',
      'Suppress expected seasonality by using period-matched reference baselines',
      'Add a correlation guard: only page when both feature drift and prediction distribution shift co-occur',
    ],
    trap: 'Raising the global threshold from 0.20 to 0.30 to reduce false positives. This just shifts the false positive/negative tradeoff uniformly, losing important signals on high-impact features.',
  },
  {
    id: 'drift-016',
    difficulty: 'senior',
    question: 'How do you monitor drift in a model that uses embeddings from a large language model as input features?',
    keyPoints: [
      'Individual embedding dimensions have no independent meaning — tabular PSI on dimensions is noise',
      'Monitor centroid shift: compute mean embedding vector per production window and measure cosine distance from training centroid',
      'Monitor distributional geometry: track intra-cluster variance and nearest-neighbor distance distributions to detect when production embeddings are entering new regions of embedding space',
      'Monitor prediction confidence distribution as a proxy: LLM-derived embeddings that represent out-of-distribution inputs tend to produce anomalous confidence patterns in downstream classifiers',
    ],
    trap: 'Applying PSI to each of the 768 or 1536 embedding dimensions independently. Embedding dimensions are not independent features — this produces thousands of uncorrelated alerts with no actionable interpretation.',
  },
  {
    id: 'drift-017',
    difficulty: 'senior',
    question: 'A PSI alert fires on a feature. Investigation shows the upstream ETL job changed the null handling from -1 to 0 for missing values. Is this drift? What do you do?',
    keyPoints: [
      'This is training-serving skew, not drift — the real-world signal has not changed, only the encoding convention has',
      'Immediate action: fix the ETL job to restore -1 null encoding, or update the model to expect 0 if forward-compatible',
      'Critically: do NOT retrain on this data — retraining would teach the model to expect 0 for nulls, making it incorrect if the ETL is fixed back',
      'Root cause prevention: schema-validate feature encoding conventions at the ETL output level using Great Expectations or dbt tests to catch this before it reaches the model',
    ],
    trap: 'Retraining the model because PSI > 0.20. This encodes the ETL bug into the model. Fix the pipeline first; retrain only if the encoding change is intentional and permanent.',
  },
  {
    id: 'drift-018',
    difficulty: 'senior',
    question: 'Describe a production-ready architecture for monitoring a model serving 500k requests per second for drift. What are the computational constraints?',
    keyPoints: [
      'At 500k RPS, storing all feature values for PSI computation is infeasible — use probabilistic sketches (KLL sketches, t-digest, CountMin sketch) that compute distributional statistics in O(1) space',
      'WhyLogs or Apache DataSketches inline in the serving path: sub-millisecond overhead, merged hourly for drift computation',
      'Tiered alerting: lightweight proxy metrics (prediction mean, variance, null rate) computed every minute; full PSI computed hourly from accumulated sketches',
      'Separate drift computation from serving path entirely using async logging: serving writes feature samples to a Kafka topic, a separate consumer aggregates and runs drift analysis without adding latency to serving',
    ],
    trap: 'Describing a system that computes exact PSI on every request. At 500k RPS, this requires storing and comparing tens of millions of data points per minute — computationally infeasible without sampling or sketching.',
  },
  {
    id: 'drift-019',
    difficulty: 'senior',
    question: 'Your model is retrained weekly. After each retrain, PSI always spikes on several features. Is this a problem?',
    keyPoints: [
      'Not necessarily — PSI compares the new model\'s training data to the previous model\'s training data. If the training window slides forward weekly, the reference distribution also changes, causing expected PSI fluctuation',
      'The real question: does PSI spike against a fixed long-term reference baseline (e.g., the original launch data), or only against the immediately previous week?',
      'Set a fixed holdout reference window that does not move with retraining, and monitor PSI against that. Week-over-week comparisons confound expected weekly variation with genuine drift',
      'If PSI against the fixed reference is steadily increasing over months, that is a meaningful long-term drift signal. If it oscillates around a stable value, it reflects normal production variance.',
    ],
    trap: 'Treating every PSI spike after retraining as a problem requiring investigation. The baseline for PSI comparison must be chosen carefully — comparing against last week\'s training data will always show change because you added a week of new data.',
  },
  {
    id: 'drift-020',
    difficulty: 'senior',
    question: 'How do you separate drift caused by a genuine world change from drift caused by your own model\'s feedback loop?',
    keyPoints: [
      'Feedback loop drift: model predictions influence future inputs — a recommender that only shows pop items gets less diverse clicks, reducing diversity in training data for the next model',
      'Detection: hold out a random sample of traffic on a policy-free or random-action baseline. Compare that distribution to your model-influenced traffic distribution over time.',
      'Genuine world drift: occurs independently of what the model predicts — external events, seasonality, user cohort changes. Visible even in the baseline holdout traffic.',
      'Fix for feedback loop drift: counterfactual evaluation, off-policy correction, or explicit exploration budget to ensure training data covers the full input space',
    ],
    trap: 'Assuming all drift is exogenous. In recommendation, ranking, and content delivery systems, the model actively shapes the data distribution it will be trained on next — ignoring feedback loop drift leads to progressive model narrowing.',
  },
  {
    id: 'drift-021',
    difficulty: 'mid',
    question: 'What is the Kolmogorov-Smirnov test and how does it compare to PSI for drift detection?',
    keyPoints: [
      'KS test: measures maximum absolute difference between two empirical CDFs. Provides a p-value — statistically interpretable with a defined Type I error rate',
      'PSI: a heuristic index with fixed industry thresholds but no formal p-value. Requires binning, sensitive to bin choice.',
      'KS works on continuous features without binning; PSI requires discretization and handles categorical features naturally',
      'At large sample sizes, KS test is overpowered — trivially small shifts become statistically significant. Pair with effect size measures.',
    ],
    trap: 'Using p-values from KS tests directly as thresholds at production scale. With 10M observations, a drift of 0.001 CDF units is statistically significant but practically irrelevant.',
  },
  {
    id: 'drift-022',
    difficulty: 'mid',
    question: 'Your model has been in production for 6 months and PSI on the income feature has increased from 0.05 to 0.18 over that period. Prediction performance has not degraded. What is your recommendation?',
    keyPoints: [
      'Performance has not degraded, so no immediate action is required — the model is generalizing to the shifted distribution',
      'Document the drift trajectory and set a watchlist: if PSI crosses 0.20, immediately check labeled performance',
      'Consider whether the training data from 6 months ago should be refreshed — models trained on outdated distributions are more fragile going forward even if currently stable',
      'Investigate root cause of income feature drift: is it a real demographic shift, a product change affecting which users apply, or a data pipeline change?',
    ],
    trap: 'Retraining immediately because PSI is approaching 0.20. Without performance degradation, retraining is premature and may introduce regression if recent data contains noise.',
  },
  {
    id: 'drift-023',
    difficulty: 'junior',
    question: 'What is label drift and why is it harder to detect than covariate shift?',
    keyPoints: [
      'Label drift: the marginal distribution of the target variable P(Y) changes over time',
      'Covariate shift is detectable without labels by monitoring feature distributions in real time',
      'Label drift requires ground truth labels to compute — if labels have a 7-day lag, you cannot detect label drift until the lag has passed',
      'Example: a churn model trained when churn rate was 5% is now operating at 12% seasonal churn — the prior has shifted and the model is under-predicting churn',
    ],
    trap: 'Assuming label drift is always detectable in real time. Without labeled data, you can only observe prediction distribution shifts as a proxy, which conflates label drift with other causes.',
  },
  {
    id: 'drift-024',
    difficulty: 'mid',
    question: 'What upstream monitoring should you put in place to catch drift before it reaches your model\'s inputs?',
    keyPoints: [
      'Schema validation at ETL output: catch column additions, deletions, type changes before they propagate to features',
      'Volume monitoring: row count and event rate per window — sudden drops indicate missing data rather than distribution shift',
      'Feature freshness monitoring: timestamp of last update for each feature in the feature store — staleness causes serving skew',
      'Source-level statistics: monitor raw event distributions upstream of feature computation so you see drift as it enters the system, not only after it has propagated to model inputs',
    ],
    trap: 'Monitoring only at the model input layer. By the time a schema change or volume drop appears as PSI drift on model inputs, the bad data has already been fed to the model for hours.',
  },
  {
    id: 'drift-025',
    difficulty: 'senior',
    question: 'Design a rollback decision policy for a fraud model that detects drift. When do you rollback vs retrain vs do nothing?',
    keyPoints: [
      'Do nothing: PSI < 0.20 on all important features AND no change in labeled performance metrics — drift is within normal variance',
      'Investigate: PSI 0.10-0.20 on important features OR prediction distribution shift without labeled confirmation — root cause analysis only, no model change',
      'Retrain: labeled performance has degraded AND root cause is distribution shift (new user cohort, seasonal change) — retrain on data from new distribution',
      'Rollback: performance degraded AND root cause is a bad model deployment or feature pipeline change — rollback to previous model version and fix the pipeline',
    ],
    trap: 'Using rollback as the default response to drift. Rollback is only correct when the previous model version was better on current data — if the world changed, rolling back to the old model is wrong.',
  },
];
