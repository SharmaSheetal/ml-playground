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
    heading: 'Defining Skew in ML Systems',
    body: `Training-serving skew is a systematic difference between the data distribution seen during model training and the data distribution seen when the model makes predictions in production. It is distinct from data drift: drift is a change in production data over time, while skew is a structural mismatch between training and production pipelines that exists from day one.

Skew is silent. Infrastructure metrics remain healthy, model serving succeeds, but predictions are subtly wrong because the model is operating on a different data distribution than it was trained on. It is one of the most common causes of models that perform well offline but poorly in production.

The root cause is almost always a code or pipeline difference: training reads from a table, serving reads from a different table or computes the same quantity in a different way.`,
  },
  {
    heading: 'Feature Skew vs Label Skew vs Prediction Skew',
    body: `Feature skew: training and serving compute the same feature with different values. Example: "spend in last 30 days" is computed from a data warehouse at training time but from a streaming aggregate at serving time, and the two computations differ due to deduplication rules.

Label skew: the label distribution in training data does not match the actual outcome distribution in production. Caused by survivorship bias (only labeled outcomes you observed), biased sampling, or systematic data collection issues.

Prediction skew: the model's prediction distribution in production differs from what it produced on the held-out validation set. Often a downstream symptom of feature skew or label skew, but can also indicate model scoring bugs (wrong feature order, wrong preprocessing applied at serving).

Each type requires a different diagnosis and fix. Feature skew is a pipeline problem. Label skew is a data collection problem. Prediction skew can be any of the above plus model serving bugs.`,
  },
  {
    heading: 'Root Causes of Skew',
    body: `Pipeline divergence: training uses Spark with a daily batch job; serving uses Python with a REST API call. The same formula implemented in two languages with two engineers almost certainly produces different results for edge cases (null handling, integer overflow, rounding).

Data source divergence: training reads from a replicated data warehouse table that may be 24–48 hours stale. Serving reads from a real-time operational database. These two sources may differ significantly for volatile features.

Preprocessing bugs: a preprocessing step (normalization, tokenization, category encoding) is implemented correctly in the training pipeline but incorrectly in the serving pipeline. Example: training normalizes with training-set mean/std; serving normalizes with different values hardcoded during a refactor.

Time-based differences: training uses historical data where certain features behave differently (newer users were not yet users at training data cutoff). Serving encounters user behaviors that were not present in training data.

Feature selection differences: a feature used during training is dropped or replaced during serving due to availability constraints. The model expects a feature that is not always available in production.`,
  },
  {
    heading: 'Detecting Skew in Production',
    body: `Log both input features and predictions for a sample of production requests. Compare the logged feature distributions to the training feature distributions using statistical tests.

PSI (Population Stability Index): compute PSI for each feature between training distribution and serving distribution. PSI < 0.1 is negligible, 0.1–0.2 warrants investigation, > 0.2 is significant skew.

Chi-squared test for categorical features: tests whether the category distribution in production matches the training distribution.

Shadow mode comparison: run both the training pipeline and the serving pipeline on the same inputs, log both outputs, and compute the difference. If the difference exceeds a threshold, you have confirmed skew.

TensorFlow Data Validation (TFDV): generates schema and statistics from training data, validates serving data against that schema. Catches distribution anomalies, unexpected categorical values, null rate changes.`,
  },
  {
    heading: 'TensorFlow Data Validation (TFDV)',
    body: `TFDV is an open-source library for computing statistics from data, inferring schemas, and detecting anomalies. It is designed specifically for the ML data validation use case.

Workflow:
  1. Generate statistics from training data: tfdv.generate_statistics_from_dataframe(train_df)
  2. Infer schema: schema = tfdv.infer_schema(train_stats)
  3. Generate statistics from serving data: serving_stats = tfdv.generate_statistics_from_dataframe(serving_df)
  4. Validate: anomalies = tfdv.validate_statistics(serving_stats, schema)
  5. Display: tfdv.display_anomalies(anomalies)

TFDV detects: distribution drift per feature (schema drift, unexpected values, null rate changes), schema mismatches (missing features, type changes), and training-serving skew when you provide both datasets.

Limitation: TFDV is designed for batch validation, not continuous monitoring. For real-time skew detection, you need to stream features into a monitoring system and compute statistics over rolling windows.`,
  },
  {
    heading: 'PSI and Chi-Squared for Skew Measurement',
    body: `PSI (Population Stability Index) measures how much a feature's distribution has shifted between two datasets. Originally developed for credit scoring to detect population shift.

PSI formula: PSI = Σ (Actual% - Expected%) × ln(Actual% / Expected%) across buckets.

PSI thresholds:
  • < 0.1: distribution is stable, no action required
  • 0.1 – 0.2: minor shift, monitor closely
  • > 0.2: significant shift, investigate and likely retrain

PSI limitation: it does not indicate the direction or cause of the shift — only its magnitude. A PSI of 0.3 could be caused by a new user segment arriving, a data pipeline bug, or a genuine change in user behavior.

Chi-squared test: appropriate for categorical features with many categories. Tests whether observed category frequencies match expected frequencies from training data. A significant chi-squared statistic indicates skew, but chi-squared does not produce a single interpretable magnitude like PSI.

For numerical features: use PSI with 10–20 equal-frequency buckets (quantile-based). For categorical features with < 20 categories: use chi-squared or PSI directly on categories.`,
  },
  {
    heading: 'Shadow Mode for Skew Validation',
    body: `Shadow mode is the most direct technique for confirming and quantifying feature skew. You run both the training pipeline and the serving pipeline on the same live requests and compare their outputs.

Implementation: at serving time, after computing features via the production pipeline, also invoke the training pipeline logic (or an equivalent implementation) on the same raw inputs. Log both sets of feature values without using the shadow pipeline for actual predictions.

Comparison: for each feature, compute the difference between shadow (training-equivalent) and production values. A non-zero mean difference indicates systematic skew. A large standard deviation indicates inconsistent skew.

Advantage: shadow mode confirms skew at the exact point where it matters — on live production traffic with real production inputs, not on a held-out dataset that may not represent current traffic.

Operational consideration: running the training pipeline at serving time adds latency and compute cost. Limit shadow mode to a sample of traffic (1–5%) and run it asynchronously (log inputs, compute shadow features offline in a background job).`,
  },
  {
    heading: 'Fixing Skew — Aligning Pipelines',
    body: `The correct fix for feature skew is to unify the training and serving pipelines so that the same code runs in both contexts.

Option 1 — Feature store adoption: move feature computation to a feature store that provides a single computation definition. The feature store's SDK computes the feature identically whether called from a training job or a serving endpoint.

Option 2 — Shared transformation library: extract all feature transformations into a versioned library. Both the training pipeline and the serving API import the same library. Pin the same version in both.

Option 3 — Online-first training: instead of training on warehouse data, train on features logged from the production serving pipeline. This guarantees that training sees exactly what serving sees. Requires a feature logging infrastructure.

What not to do: fix skew by adjusting training data to match the serving distribution (post-hoc alignment). This masks the root cause and creates a fragile system where any serving change silently breaks training alignment.`,
  },
  {
    heading: 'Skew in NLP and Vision Models',
    body: `Skew is not limited to tabular models. NLP and vision models face their own forms of training-serving skew.

NLP tokenization skew: the tokenizer used at training time (with specific vocabulary and normalization rules) must be identical at serving time. Using different versions of the same tokenizer library (e.g., HuggingFace tokenizers across versions) can produce different token sequences and alter predictions.

Text preprocessing skew: lowercasing, Unicode normalization, whitespace handling applied inconsistently. Training strips leading/trailing whitespace; serving does not. The same sentence produces different embeddings.

Vision preprocessing skew: image resizing interpolation method (bilinear vs bicubic), normalization mean/std, channel order (RGB vs BGR — classic OpenCV vs PyTorch swap). A mean/std mismatch shifts all pixel values away from the training distribution, often causing dramatic accuracy drops.

Model input format: in TensorFlow/ONNX/TorchScript, the input tensor shape, dtype, and channel order must match exactly. Implicit type casting in serving that was not present in training can introduce numerical skew.`,
  },
  {
    heading: 'Skew vs Drift — Different Causes, Different Fixes',
    body: `Skew and drift are both mismatches between training and production, but their causes and fixes are different.

Skew: structural — the pipeline is computing features differently between training and serving. Exists from launch day. Does not change over time. The fix is engineering: align the pipelines.

Drift: temporal — the distribution of the world (users, products, events) has changed since training. Was not present at launch but develops over months. Does not require pipeline changes. The fix is model updates: retrain on recent data.

Diagnosis: if you observe degradation immediately after model launch, suspect skew. If you observe gradual degradation over weeks to months, suspect drift. If you observe both, you likely have both problems, which require separate interventions.

A common error: retraining a model to fix drift when the actual problem is skew. Retraining on more recent data does not fix a pipeline code difference. The model learns patterns on training-computed features but is still served production-computed features.

Monitoring: maintain separate detectors for skew (compare training distribution to serving distribution using PSI) and drift (compare serving distribution today to serving distribution last month using PSI).`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is training-serving skew and why is it dangerous?',
    keyPoints: [
      'Systematic difference between data distribution at training time vs serving time',
      'Dangerous because it is silent — infrastructure metrics look healthy while predictions are wrong',
      'Root cause: different code or data sources for the same feature in training vs serving',
      'Model performs well offline but degrades in production',
    ],
    trap: 'Confusing training-serving skew with data drift — skew is a pipeline structural mismatch that exists from launch, while drift is a temporal change in the real-world distribution.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between feature skew and prediction skew?',
    keyPoints: [
      'Feature skew: training and serving compute different values for the same feature',
      'Prediction skew: model predictions in production differ from validation set predictions',
      'Prediction skew is often a symptom of feature skew, but can also be caused by model serving bugs',
      'Diagnosis: log both input features and predictions; feature skew shows upstream, prediction skew shows downstream',
    ],
    trap: 'Assuming prediction skew is always caused by model code bugs — it is more commonly caused by feature skew upstream.',
  },
  {
    difficulty: 'junior',
    question: 'How would you detect skew between your training data and production data?',
    keyPoints: [
      'Log production feature values for a sample of requests',
      'Compute PSI per feature between training distribution and production distribution',
      'PSI > 0.2 indicates significant skew, 0.1–0.2 is minor, < 0.1 is negligible',
      'Use TFDV to generate schemas and anomaly reports comparing both datasets',
    ],
    trap: 'Only comparing mean values — mean can be identical while distribution shape differs significantly.',
  },
  {
    difficulty: 'junior',
    question: 'What are the most common root causes of training-serving skew?',
    keyPoints: [
      'Pipeline divergence: different code implementations of the same feature in training vs serving',
      'Data source divergence: training reads from warehouse, serving reads from operational database',
      'Preprocessing bugs: normalization mean/std hardcoded differently in serving vs training',
      'Feature availability: a feature present in training is not always available at serving time',
    ],
    trap: 'Assuming skew only comes from bugs — even two correct implementations of the same feature in different languages will diverge on edge cases.',
  },
  {
    difficulty: 'mid',
    question: 'How do you use PSI to detect feature skew? What are its limitations?',
    keyPoints: [
      'PSI = Σ(Actual% - Expected%) × ln(Actual%/Expected%) across feature distribution buckets',
      'PSI < 0.1: stable, 0.1–0.2: monitor, > 0.2: significant skew',
      'Limitation: does not indicate direction or cause of shift — requires investigation to diagnose',
      'Limitation: requires choosing bucket boundaries — use quantile-based for numerical features',
      'Works best with > 1000 samples per dataset — small samples produce unstable PSI estimates',
    ],
    trap: 'Using equal-width buckets for highly skewed numerical distributions — quantile-based buckets are more sensitive to distribution shift in the tails.',
  },
  {
    difficulty: 'mid',
    question: 'Describe how you would implement shadow mode to validate feature skew in production.',
    keyPoints: [
      'At serving time, compute features via production pipeline and log them',
      'Also run training-equivalent pipeline on same raw inputs (asynchronously)',
      'Log both feature sets, compute per-feature difference statistics',
      'Sample 1–5% of traffic to limit overhead — shadow computation is expensive',
      'Alert if mean difference or PSI between shadow and production features exceeds threshold',
    ],
    trap: 'Running shadow computation synchronously in the serving path — this doubles latency and defeats the purpose of low-latency serving.',
  },
  {
    difficulty: 'mid',
    question: 'How do you fix training-serving skew once it is detected?',
    keyPoints: [
      'Root cause fix: unify training and serving pipelines — single code path for feature computation',
      'Feature store adoption: single computation definition served identically in training and serving',
      'Shared transformation library: extract preprocessing into a versioned library imported by both',
      'Online-first training: train on features logged from the production serving pipeline',
      'Do not fix by adjusting training data to match serving distribution — masks root cause',
    ],
    trap: 'Treating the fix as retraining the model with different data — retraining does not fix a pipeline code difference and the skew will persist.',
  },
  {
    difficulty: 'mid',
    question: 'What is TFDV and how does it help with skew detection?',
    keyPoints: [
      'TensorFlow Data Validation: computes statistics, infers schemas, detects anomalies',
      'Workflow: generate training statistics → infer schema → validate serving statistics against schema',
      'Detects: distribution drift, schema mismatches, null rate changes, unexpected category values',
      'Designed for batch validation — not real-time streaming monitoring',
      'Output: structured anomaly report per feature with severity levels',
    ],
    trap: 'Treating TFDV as a real-time monitoring solution — it is a batch validation tool, not a streaming anomaly detector.',
  },
  {
    difficulty: 'mid',
    question: 'How does skew manifest differently in NLP models vs tabular models?',
    keyPoints: [
      'NLP: tokenizer version mismatch produces different token sequences from the same text',
      'NLP: text preprocessing differences (case normalization, Unicode, whitespace) alter inputs',
      'Vision: channel order (RGB vs BGR), normalization mean/std mismatch causes silent degradation',
      'Tabular: null handling, type casting, normalization parameters differ between pipelines',
      'All types: the model performs well on test set but fails in production due to input distribution mismatch',
    ],
    trap: 'Assuming skew is only a tabular data problem — NLP and vision models are equally susceptible, especially with tokenizer and preprocessing pipelines.',
  },
  {
    difficulty: 'mid',
    question: 'How do you distinguish skew from drift when diagnosing model degradation?',
    keyPoints: [
      'Timing: immediate degradation at launch = skew; gradual degradation over weeks = drift',
      'Compare training distribution (fixed) to serving distribution (changes over time)',
      'If serving distribution differs from training distribution on day 1 = skew',
      'If serving distribution was close on day 1 but diverges over time = drift',
      'Both can coexist — require separate fixes: pipeline alignment for skew, retraining for drift',
    ],
    trap: 'Triggering a retrain to fix skew — retraining on new data does not fix a pipeline code difference; the skew will persist after the retrain.',
  },
  {
    difficulty: 'senior',
    question: 'Design a skew detection system for 100 ML models across 15 teams at a large tech company.',
    keyPoints: [
      'Feature logging: stream 1% of serving requests with full feature vectors to a data lake',
      'Compute PSI per feature per model daily using Spark, comparing to training distribution',
      'Centralized skew dashboard: feature PSI heatmap per model, highlight > 0.2 in red',
      'Alerting: Slack/PagerDuty when any critical feature exceeds PSI 0.2 for 3 consecutive days',
      'Governance: model registry links each model to its training dataset for reference distribution retrieval',
    ],
    trap: 'Computing skew synchronously at serving time for every request — this is prohibitively expensive; log and compute asynchronously.',
  },
  {
    difficulty: 'senior',
    question: 'A new model launched last week and immediately underperformed the old model. Your offline metrics were better. Walk through your diagnosis.',
    keyPoints: [
      'First check for skew: compare production feature distributions to training distributions using logged features',
      'Check serving code for preprocessing differences: normalization constants, null handling, feature order',
      'Compare model output score distributions: if production scores cluster near 0 or 1, suspect input range issue',
      'Run shadow mode: invoke training preprocessing on live inputs and compare to production preprocessing',
      'Check model registry: verify the correct model version and artifact are deployed, not a stale version',
    ],
    trap: 'Concluding the offline evaluation was overly optimistic and triggering a new training run — the most likely cause of immediate underperformance is a serving pipeline bug, not model selection error.',
  },
  {
    difficulty: 'senior',
    question: 'How do you prevent skew from being introduced when multiple engineers are working on the same model\'s training and serving pipelines?',
    keyPoints: [
      'Shared transformation library: all feature logic lives in a versioned library, both pipelines import it',
      'Integration tests: automatically run both pipelines on identical inputs and compare outputs on every PR',
      'Code review requirements: any change to training preprocessing requires a reviewer who checks serving parity',
      'Shadow mode in CI: run shadow comparison on a sample of recent production requests as part of the test suite',
      'Feature store migration: long-term fix is to remove the dual pipeline entirely',
    ],
    trap: 'Relying on code reviews alone to catch skew — subtle numerical differences (floating point, null handling) are easy to miss in code review but easy to catch with automated comparison tests.',
  },
  {
    difficulty: 'senior',
    question: 'How would you handle skew in a model that uses both batch features and real-time features?',
    keyPoints: [
      'Batch features: compare training warehouse values to batch-materialized online store values at the same timestamp',
      'Real-time features: shadow mode — compute same aggregation offline from raw events and compare to streaming pipeline',
      'The join between batch and real-time features at serving time must match what was done at training time',
      'Monitor both independently: batch skew and real-time skew may have different root causes',
      'Point-in-time correctness: ensure batch features in training were joined with the correct as-of timestamp',
    ],
    trap: 'Treating batch and real-time feature skew with the same monitoring approach — real-time features require streaming comparison infrastructure, not just batch dataset comparison.',
  },
  {
    difficulty: 'junior',
    question: 'What is label skew and how can it affect a trained model?',
    keyPoints: [
      'Label skew: label distribution in training data does not match actual outcome distribution in production',
      'Caused by biased data collection, survivorship bias, or systematic exclusion of certain outcomes',
      'Example: training on only approved loan applications — never observing the outcomes of rejected ones',
      'Result: model is well-calibrated on the observed population but miscalibrated on the full population',
    ],
    trap: 'Treating label skew as a class imbalance problem — class imbalance is about frequency, label skew is about systematic bias in which outcomes are observed.',
  },
  {
    difficulty: 'mid',
    question: 'How do you set up monitoring to catch skew introduced by a pipeline refactor?',
    keyPoints: [
      'Before refactor: compute and store training feature distribution statistics as baseline',
      'During refactor: run old and new pipeline in parallel, log both outputs, compute per-feature difference',
      'After refactor: compare serving distribution to stored baseline for the first 7 days post-deploy',
      'Alert on any feature with PSI > 0.1 change relative to pre-refactor baseline',
      'Canary the refactored pipeline on 1% of traffic before full rollout to catch skew early',
    ],
    trap: 'Only comparing before/after mean values of features — distribution shape can change significantly while means remain similar.',
  },
  {
    difficulty: 'senior',
    question: 'Describe an end-to-end strategy to eliminate training-serving skew across an organization.',
    keyPoints: [
      'Feature store adoption: move all feature computation to a unified platform with a single code path',
      'Online-first training: log serving features to a data lake, train new models on logged features',
      'Automated skew CI gate: block model promotion if PSI between training and recent serving features exceeds threshold',
      'Preprocessing as code: all transformations in a tested, versioned library — no ad-hoc scripts',
      'Skew budget: treat acceptable PSI level as an organizational SLO, track in quarterly reliability reviews',
    ],
    trap: 'Treating skew elimination as a one-time project — without ongoing tooling, process, and monitoring, skew reintroduces itself with every pipeline refactor.',
  },
  {
    difficulty: 'junior',
    question: 'Why is skew harder to detect than model drift?',
    keyPoints: [
      'Skew produces no infrastructure alert — serving succeeds, latency is normal',
      'No direct comparison signal — you need to know what the training distribution was',
      'Offline metrics (on training-distribution data) may look fine while production degrades',
      'Requires explicit logging of production feature values for comparison — not set up by default',
    ],
    trap: 'Assuming model accuracy on validation set would catch skew — validation set is drawn from training distribution, which is exactly what is different from production.',
  },
];
