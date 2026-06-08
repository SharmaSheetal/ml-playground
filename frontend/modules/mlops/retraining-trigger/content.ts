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
    heading: 'Why Models Go Stale',
    body: `A model trained on historical data captures statistical patterns that existed at that point in time. The real world does not stay still. As user behavior, external events, and underlying data-generating processes shift, the model's learned patterns diverge from current reality — a phenomenon called model staleness.

Three distinct types of shift cause staleness:

  • Concept drift: the relationship between features and the label changes. A fraud model trained before a new attack vector emerges assigns low scores to the new attack pattern because it has never seen it.
  • Covariate shift (data drift): the distribution of input features changes while the feature-to-label relationship stays the same. A credit scoring model trained in 2019 saw a very different income and employment distribution than it sees today.
  • Label shift: the marginal distribution of the target variable changes. If 5% of transactions were fraudulent at training time and fraud rises to 12%, the model's calibration and threshold assumptions are violated even if its feature patterns are correct.

In practice, all three occur simultaneously and compound each other. The longer a model runs without retraining, the greater the staleness risk.`,
  },
  {
    heading: 'Scheduled Retraining',
    body: `Scheduled retraining triggers a new training run on a fixed calendar cadence — daily, weekly, or monthly — regardless of observed model performance. It is the simplest retraining policy to implement and reason about.

Advantages:
  • Predictable infrastructure load — training compute can be planned and reserved in advance.
  • No dependency on real-time monitoring — no drift detection infrastructure required.
  • Easy to audit — every deploy has a training date and a data window, making post-mortems straightforward.

Disadvantages:
  • Retrains when unnecessary (stable data distributions) — wastes compute.
  • May not retrain fast enough when drift is sudden — a weekly schedule means up to 7 days of degraded performance after an abrupt shift.
  • Cadence selection is arbitrary without empirical validation — choosing weekly vs. monthly is often a guess.

Cadence selection in practice: analyze historical data to find the typical lag between a distribution shift event and measurable performance degradation. That lag sets an upper bound on your cadence. A model serving trending social content may need daily retraining; a B2B pricing model may be stable for months.

Warm starts in scheduled retraining: rather than initializing from random weights, warm starts initialize the new training run from the current champion's weights. For neural networks this dramatically reduces training time and compute. For gradient-boosted trees, warm starts can mean incrementally adding trees to the existing ensemble rather than rebuilding from scratch.`,
  },
  {
    heading: 'Drift-Triggered Retraining',
    body: `Drift-triggered retraining replaces the calendar with observed data quality or performance metrics as the retraining signal. A retrain is triggered only when measured drift exceeds a threshold.

Three common trigger types:

  • PSI gates: Population Stability Index is computed between the current serving input distribution and the training baseline. PSI > 0.2 on a key feature triggers retraining.
  • Performance gates: when a monitored metric (accuracy on a labeled holdout, AUC on arriving ground-truth labels) drops below a floor, retraining triggers. This requires label availability, which introduces label lag.
  • Hybrid: PSI gates provide a fast leading signal (no labels required). Performance gates provide a lagging but more reliable signal. Most mature systems combine both.

Advantages of drift-triggered retraining:
  • Retrains only when needed — saves compute in stable periods.
  • Reacts faster than a schedule in periods of sudden shift.

Disadvantages:
  • Requires a monitoring pipeline that runs continuously in production.
  • PSI thresholds require calibration — too sensitive triggers needless retraining, too loose lets drift go unchecked.
  • Label lag means performance gates always trail actual degradation by the label collection delay.`,
  },
  {
    heading: 'The Data Flywheel',
    body: `The data flywheel is the virtuous cycle where a deployed model generates predictions, users interact with those predictions, and those interactions become labeled training data that improves the next model version.

A recommendation system is the canonical example: a user clicking a recommended item is an implicit positive label. Each click enriches the training dataset. A better model generates better recommendations, which generate more clicks, which produce more labels, which improve the model further. This is the flywheel in motion.

Label collection strategies:
  • Explicit feedback: users rate, like, or flag predictions. High signal quality but low volume — most users do not rate things.
  • Implicit feedback: user actions (click, dwell time, purchase, scroll-past) serve as proxy labels. High volume but noisy — a click is a weak positive signal.
  • Human-in-the-loop labeling: predictions are routed to human reviewers who provide ground truth. High quality, scalable cost.

Label lag is the critical challenge: the time between a prediction being made and a label becoming available. In fraud detection, a transaction flagged as fraudulent is confirmed or denied days or weeks later during dispute resolution. A model trained on only confirmed labels will always be missing recent data.

Feedback loop bias is a flywheel failure mode: if the model only learns from items it recommended, it never observes what would have happened with different recommendations. Counterfactual correction and exploration strategies (epsilon-greedy, explore/exploit) are used to break the bias.`,
  },
  {
    heading: 'Retraining Pipeline Architecture',
    body: `A production retraining pipeline is not just "run training again." It is a multi-stage workflow with validation gates at each step.

Canonical stages:

  • Data ingestion and validation: pull training data for the configured window. Run schema validation (expected columns, types) and statistical validation (TFDV or Great Expectations). Fail fast if data quality is below threshold.
  • Feature engineering: apply the same feature transformation logic used in serving. Any divergence here creates training-serving skew.
  • Model training: train on the validated dataset. Log hyperparameters, training duration, and data window metadata to the experiment tracker.
  • Offline evaluation: compute accuracy, AUC, RMSE, calibration, and fairness metrics on a held-out test set. Compare against the champion model's metrics on the same test set. Fail the pipeline if the retrained model is worse than champion.
  • Shadow deployment / A/B test: route live traffic through the retrained model in shadow mode or A/B test to measure online metrics before promotion.
  • Promotion: if all gates pass, promote the retrained model to champion in the model registry.
  • Rollback capability: the previous champion version remains registered and deployable at any time.

Orchestration tools: Kubeflow Pipelines and Argo Workflows are the dominant choices for Kubernetes-native environments. Airflow is common for data-heavy pipelines with complex scheduling requirements.`,
  },
  {
    heading: 'Warm Starts vs Cold Starts',
    body: `When a retraining run initializes, it must decide where to start in parameter space. This decision has significant impact on training time, compute cost, and the risk of catastrophic forgetting.

Cold start: the model is initialized from random weights (or default hyperparameters for tree models) and trained from scratch on the full dataset. Cold starts are reproducible, avoid any risk of inheriting artifacts from the previous model, and are required when the model architecture changes between versions.

Warm start: the retrained model begins from the champion's parameters rather than random initialization. For neural networks this means loading the champion's weights and continuing training. For gradient-boosted trees it means adding incremental trees to the existing ensemble.

Warm start advantages:
  • Faster convergence — fewer epochs needed to reach the same quality.
  • Lower compute cost for the same quality level.
  • Useful when training data changes incrementally (mostly new data, not a complete replacement).

Warm start risks:
  • Catastrophic forgetting: if the new data distribution is very different from the training distribution embedded in the current weights, the optimizer may oscillate or converge to a suboptimal local minimum.
  • Inherited bugs: if the champion model has a subtle training artifact (e.g., a data leakage issue that was later discovered), warm starts propagate that artifact into all future models until a cold start is forced.

When to force a cold start: model architecture change, new feature set, confirmed training data quality issue in any recent model, major distribution shift that renders the champion's weights misleading.`,
  },
  {
    heading: 'Validation Before Promotion',
    body: `A retrained model that passes offline evaluation is not automatically safe to promote. Offline metrics on a static holdout set do not capture all production failure modes. Validation before promotion in production traffic is the final quality gate.

Shadow deployment: the retrained model receives a copy of all production requests and generates predictions, but those predictions are not returned to users. The predictions from both champion and challenger are logged, and their outputs are compared. Shadow deployment reveals serving differences (preprocessing bugs, output format changes) without any user impact.

Champion/challenger A/B testing: a fraction of traffic (typically 5–10%) is split to the retrained model. Real users see the retrained model's predictions. Metrics are compared between the two groups using statistical significance testing. This is necessary for measuring business metrics (CTR, conversion) that cannot be evaluated in shadow mode because they require user interaction.

Key decisions before promotion:
  • Define evaluation metrics and thresholds before the experiment starts.
  • Decide the minimum traffic split duration and sample size required for statistical significance.
  • Specify which metrics trigger automatic rollback vs. require human review.

Common mistake: promoting a retrained model based solely on offline evaluation improvement. A retrained model can show better AUC on the test set and worse CTR in production because the holdout set does not represent the current user distribution.`,
  },
  {
    heading: 'Model Versioning and Rollback',
    body: `Every retrained model must be tracked as a distinct, reproducible artifact. Without versioning, a bad retrain has no recovery path and a good retrain cannot be reproduced.

Model registry: a model registry stores model artifacts alongside their metadata — training data window, hyperparameters, evaluation metrics, feature schema, and the pipeline run ID that produced them. MLflow Model Registry, W&B Artifacts, and Vertex AI Model Registry are common choices.

Experiment tracking: each retraining run should be recorded in an experiment tracker with the full training configuration, evaluation metrics, and a pointer to the data used. This makes comparing the retrained model against previous versions straightforward.

DVC (Data Version Control): DVC versions datasets and pipelines alongside code in git. A retraining run has a DVC pipeline that pins the exact data version used, making training fully reproducible.

Rollback mechanics: in a well-designed system, rolling back to a previous model version means:
  1. Identifying the previous champion version in the model registry.
  2. Updating the serving deployment to point to that version's artifact.
  3. This should take minutes, not hours.

Rollback triggers: automated rollback when production metrics breach thresholds. Manual rollback when an offline data quality issue is discovered post-promotion. The previous champion should remain registered and deployable for at least 30 days.`,
  },
  {
    heading: 'Cost of Retraining',
    body: `Retraining is not free. Treating it as free leads to over-retrain-heavy systems that burn compute budget without proportional quality improvement.

Compute cost: training cost scales with data volume, model complexity, and number of training runs (including hyperparameter search). A large neural network trained daily may cost thousands of dollars per month in GPU time alone.

Data pipeline cost: pulling, transforming, and validating training data requires storage I/O, CPU, and often a distributed compute cluster. For large datasets this can exceed the training cost itself.

Validation overhead: shadow deployment and A/B testing consume serving infrastructure capacity. Running a challenger model in shadow mode at full traffic doubles inference compute during the validation window.

Opportunity cost: engineering time spent managing retraining pipelines, debugging failures, and reviewing validation results cannot be spent building new models or features.

Cost reduction strategies:
  • Use drift-triggered retraining rather than fixed schedules to avoid unnecessary retrains.
  • Use warm starts to reduce training epochs.
  • Sample the training dataset for early-stage experiments, reserving full dataset training for final candidates.
  • Cache intermediate pipeline artifacts (feature engineering outputs) to avoid recomputing when only the model training step changes.

Cost vs. staleness trade-off: the right retraining frequency is the one where the marginal cost of more frequent retraining equals the marginal benefit in model performance. This is an empirical calculation, not a fixed rule.`,
  },
  {
    heading: 'Continual Learning vs Periodic Batch Retraining',
    body: `Periodic batch retraining is the dominant industry pattern: collect data over a window, run a training job, promote the result. This is simple, predictable, and auditable, but it always lags current data by at least one training cycle.

Continual learning (also called online learning or incremental learning) updates model parameters continuously as new data arrives, eliminating or reducing the batch retraining lag. The model is always trained on the most recent data.

Continual learning advantages:
  • Lowest possible latency to incorporate new information.
  • Enables models to track fast-changing distributions (e.g., trending topics in news ranking).
  • No training infrastructure scheduling — the model updates continuously in the serving path.

Continual learning challenges:
  • Catastrophic forgetting: updating on recent data erases patterns from older data unless explicit memory mechanisms (replay buffers, elastic weight consolidation) are used.
  • Harder to audit and reproduce: a model trained continuously has no single "training dataset" — versioning and rollback become significantly more complex.
  • Training-serving coupling: the model update logic runs in or adjacent to the serving path, increasing operational complexity and failure modes.
  • Label lag: continual learning on unlabeled data (using proxies) introduces noise into the parameter updates.

In practice, most production systems use periodic batch retraining with a well-tuned cadence, reserving continual learning for narrow use cases (click-stream personalization, real-time fraud) where the data flywheel is fast and label lag is low.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    id: 'rt-001',
    difficulty: 'junior',
    question: 'What is model staleness and what are the three types of distribution shift that cause it?',
    keyPoints: [
      'Model staleness: learned patterns diverge from current reality as the world changes',
      'Concept drift: the feature-to-label relationship changes (e.g., fraud patterns change)',
      'Covariate shift: input feature distribution changes while the relationship stays the same',
      'Label shift: the marginal distribution of the target variable changes',
    ],
    trap: 'Treating all shift as "concept drift." Concept drift specifically means the label relationship changed, not just that the input distribution changed — these have different remediation strategies.',
  },
  {
    id: 'rt-002',
    difficulty: 'junior',
    question: 'What is the difference between scheduled retraining and drift-triggered retraining? Name one advantage and one disadvantage of each.',
    keyPoints: [
      'Scheduled: fixed cadence regardless of observed drift — simple to implement but may retrain unnecessarily or not fast enough',
      'Drift-triggered: retrains when a monitored signal (PSI, performance metric) exceeds a threshold — more responsive but requires monitoring infrastructure',
      'Scheduled advantage: predictable compute load; drift-triggered advantage: reacts faster to sudden shifts',
      'Scheduled disadvantage: cadence is arbitrary; drift-triggered disadvantage: requires calibrated thresholds and label availability for performance gates',
    ],
    trap: 'Saying drift-triggered is always better. In low-traffic or resource-constrained systems, the monitoring infrastructure overhead of drift-triggered retraining can exceed the compute savings.',
  },
  {
    id: 'rt-003',
    difficulty: 'junior',
    question: 'What is a warm start in model retraining and when would you use it?',
    keyPoints: [
      'Warm start: initialize the new training run from the current champion weights rather than random initialization',
      'Reduces training time and compute by leveraging already-learned patterns',
      'Use when the new data is an incremental update to the existing distribution — not a major shift',
      'Avoid warm starts when model architecture changes, major distribution shift occurs, or a data quality issue was discovered in recent models',
    ],
    trap: 'Assuming warm starts are always better. Warm starts can propagate training artifacts or cause slow convergence when the data distribution has shifted significantly.',
  },
  {
    id: 'rt-004',
    difficulty: 'junior',
    question: 'What is label lag and why does it complicate drift-triggered retraining?',
    keyPoints: [
      'Label lag: the delay between a model prediction being made and the ground-truth label becoming available',
      'Performance-based drift triggers cannot fire until labels arrive — so there is always a detection lag equal to the label delay',
      'Fraud detection example: a transaction disputed weeks later creates weeks of label lag',
      'Workaround: use PSI on input features as a leading indicator that does not require labels, combined with performance gates as a lagging confirmation',
    ],
  },
  {
    id: 'rt-005',
    difficulty: 'mid',
    question: 'How would you design a drift-triggered retraining pipeline for a fraud detection model where labels arrive with a 2-week delay?',
    keyPoints: [
      'Use input feature PSI as the primary fast trigger — computable immediately, no label dependency',
      'Use proxy labels (rule-based flags, card network alerts) as a faster but noisier performance signal',
      'Maintain a confirmed-label evaluation set that updates weekly as disputes resolve — this drives the performance gate with a 2-week lag',
      'Combine: PSI gate triggers investigation; performance gate on confirmed labels triggers the actual retrain decision',
    ],
    trap: 'Waiting 2 weeks for labels before any retraining action. PSI-based triggers allow earlier intervention; confirmed labels provide the validation signal before promotion.',
  },
  {
    id: 'rt-006',
    difficulty: 'mid',
    question: 'Describe the stages of a production retraining pipeline. What happens if the retrained model performs worse than the current champion?',
    keyPoints: [
      'Stages: data ingestion and validation → feature engineering → model training → offline evaluation → shadow/A/B test → promotion',
      'Offline evaluation must compare retrained model against champion on the same holdout set',
      'If retrained model is worse: the pipeline should fail at the evaluation gate — no promotion happens automatically',
      'The current champion continues serving; the retrained model artifact is archived in the registry for debugging',
    ],
    trap: 'Assuming a retrained model is always better. Retraining on noisy or biased recent data, or with a preprocessing bug, can produce a worse model than the champion trained months ago.',
  },
  {
    id: 'rt-007',
    difficulty: 'mid',
    question: 'What is the data flywheel and what is feedback loop bias? How do you mitigate it?',
    keyPoints: [
      'Data flywheel: model predictions drive user interactions which become training labels which improve future models — a self-reinforcing loop',
      'Feedback loop bias: the model only learns from outcomes it influenced — items never recommended are never labeled, so the model cannot learn its own blind spots',
      'Mitigation: exploration strategies (epsilon-greedy, Thompson sampling) force a fraction of traffic to random or exploratory recommendations',
      'Counterfactual correction techniques (inverse propensity scoring) can adjust for selection bias in the logged data without requiring pure exploration',
    ],
    trap: 'Treating the data flywheel as purely beneficial. Without counterfactual correction or exploration, the flywheel amplifies existing biases rather than discovering new patterns.',
  },
  {
    id: 'rt-008',
    difficulty: 'mid',
    question: 'A retrained model shows better AUC on the offline holdout set but worse CTR in production. What is happening and how do you prevent it?',
    keyPoints: [
      'The holdout set is stale — it represents the distribution at training time, not the current serving distribution',
      'The retrained model may overfit to patterns in the holdout that are no longer representative of current user behavior',
      'Prevention: use a fresh holdout set captured close to the retraining trigger date, not the original model training date',
      'Always validate in production with shadow deployment or A/B test before final promotion — offline metrics are insufficient alone',
    ],
    trap: 'Trusting offline AUC improvement as sufficient evidence of production improvement. AUC on a stale holdout set can be positively misleading when the serving distribution has shifted.',
  },
  {
    id: 'rt-009',
    difficulty: 'mid',
    question: 'How do you use MLflow or W&B to track a retraining run and ensure it can be rolled back if promotion was a mistake?',
    keyPoints: [
      'Log training run: data window, hyperparameters, evaluation metrics, and a pointer to the training dataset version',
      'Register the model artifact in the model registry with a version number and link to the run ID',
      'Tag the previous champion version as "archive" but do not delete it — rollback means re-promoting that artifact',
      'Rollback: update the serving deployment to point to the previous champion artifact version — should complete in minutes',
    ],
    trap: 'Deleting or deregistering previous champion versions after promotion. Without an archived previous champion, rollback requires a full retraining run rather than an artifact swap.',
  },
  {
    id: 'rt-010',
    difficulty: 'mid',
    question: 'How do you select the right retraining cadence for a scheduled retraining policy? What data informs this decision?',
    keyPoints: [
      'Empirically measure the historical lag between a distribution shift event and measurable performance degradation',
      'Analyze historical model performance over time — how fast did AUC decay after the last training date?',
      'Compare the cost of unnecessary retrains (stable period) against the cost of delayed retrains (degraded performance window)',
      'The cadence should be shorter than the typical performance decay half-life, not an arbitrary weekly or monthly default',
    ],
    trap: 'Defaulting to weekly retraining as a universal best practice. A stable B2B pricing model may be fine with monthly retraining; a trending-content recommendation model may need daily.',
  },
  {
    id: 'rt-011',
    difficulty: 'mid',
    question: 'What is the difference between shadow deployment and champion/challenger A/B testing in the context of validating a retrained model?',
    keyPoints: [
      'Shadow deployment: retrained model receives copies of production requests and generates predictions, but predictions are not shown to users — zero user impact, detects serving-layer issues',
      'Champion/challenger A/B test: real users see the retrained model predictions — necessary to measure business metrics like CTR, conversion, and revenue',
      'Shadow deployment validates that the serving pipeline works correctly; A/B testing validates that the model actually improves user outcomes',
      'Correct sequence: shadow first to catch preprocessing bugs, then A/B test to measure business impact before full promotion',
    ],
    trap: 'Using shadow deployment alone as sufficient validation. Shadow mode cannot measure business impact because it requires real user responses to predictions.',
  },
  {
    id: 'rt-012',
    difficulty: 'senior',
    question: 'Your retraining pipeline is triggered by PSI > 0.2 on the primary feature. After retraining, the new model has PSI = 0.05 on the same feature but 15% worse AUC on the holdout set. What happened and what do you do?',
    keyPoints: [
      'The retrained model reduced feature distribution divergence but may have overfit to the shifted distribution or the training pipeline introduced a bug',
      '15% AUC regression means the new model is strictly worse for the classification task — do not promote',
      'Investigate: check training data quality for the new window, inspect feature transformations for changes, compare learning curves between the champion training run and this run',
      'The PSI trigger was correct to fire — the problem is in the retraining pipeline execution, not the trigger policy',
    ],
    trap: 'Promoting because PSI improved. PSI reduction means the model is now calibrated to the new distribution, but AUC regression means it learned the new distribution poorly — both signals matter.',
  },
  {
    id: 'rt-013',
    difficulty: 'senior',
    question: 'How does continual learning differ from periodic batch retraining in terms of auditability and rollback capability? Why does this matter for regulated industries?',
    keyPoints: [
      'Batch retraining: each model version is a distinct artifact trained on a documented data window — fully reproducible, fully rollbackable to any prior version',
      'Continual learning: model parameters update continuously — there is no single "training dataset" and model state at any point in time may not be reproducible',
      'Rollback in continual learning requires checkpointing model state at defined intervals — without checkpoints, rollback means reverting to the last checkpoint, not an arbitrary past moment',
      'In regulated industries (finance, healthcare), model governance requires that any decision made by the model can be reproduced and explained — this is nearly impossible with continual learning without extensive parameter checkpointing and data logging',
    ],
    trap: 'Treating continual learning as just "faster batch retraining." It fundamentally changes the auditability and reproducibility model — regulated industries must design governance infrastructure specifically for it.',
  },
  {
    id: 'rt-014',
    difficulty: 'senior',
    question: 'You have a recommendation model that requires daily retraining. Training takes 6 hours. How do you prevent the model from going stale during the training run, and how do you handle the transition to the new version without a serving gap?',
    keyPoints: [
      'The champion continues serving 100% of traffic during the 6-hour training window — no serving gap occurs during training',
      'Blue/green deployment: when training completes, deploy the new model as a green instance with zero traffic, run shadow validation, then shift traffic atomically',
      'If shadow validation takes 2 hours, the total retraining cycle is 8 hours — for a 24-hour cadence this is acceptable; for a 12-hour cadence you need to optimize training speed or parallelize validation',
      'Overlap training runs: start the next day\'s training run before the current day\'s run has finished promotion — maintain a pipeline queue to avoid compounding delays',
    ],
    trap: 'Stopping the champion from serving during training. The champion always serves until the new model is validated and promoted — training and serving are independent processes.',
  },
  {
    id: 'rt-015',
    difficulty: 'senior',
    question: 'Describe how a PSI gate should be calibrated. How do you set the PSI threshold, and what are the risks of setting it too high vs. too low?',
    keyPoints: [
      'Calibration: compute PSI between consecutive time windows during a stable period to establish the baseline variance of PSI under no-shift conditions',
      'The threshold should be set above the 99th percentile of stable-period PSI values — this minimizes false triggers from normal variance',
      'Too low (e.g., 0.05): frequent false triggers cause unnecessary retraining runs and degrade trust in the monitoring system',
      'Too high (e.g., 0.4): significant distribution shift can persist for days before triggering — acceptable for stable models, dangerous for fast-changing distributions like fraud',
    ],
    trap: 'Using 0.2 as a universal threshold without calibration. The standard PSI interpretation (0.1/0.2) was developed for credit scoring in specific contexts — different models and domains require empirical calibration.',
  },
  {
    id: 'rt-016',
    difficulty: 'senior',
    question: 'A model is promoted after retraining and performs well for the first week but degrades sharply in week 3. What patterns in the retraining process could explain this, and how would you detect it earlier?',
    keyPoints: [
      'Training data window too narrow: the model was trained only on very recent data and did not learn seasonality or slower-moving patterns — it performs well initially then degrades when those patterns return',
      'Feedback loop bias: the retrained model\'s own predictions from week 1 become training data for the next retrain, amplifying errors rather than correcting them',
      'Concept drift faster than the retraining cadence: the underlying distribution shifts within each 3-week window',
      'Detection: monitor performance metrics weekly with a rolling holdout set that is always fresh relative to the current date; set a performance floor that triggers earlier retraining if degradation begins',
    ],
    trap: 'Assuming a model that performs well at first will continue to perform well. Week-1 performance is not a sufficient predictor of week-3 performance — performance monitoring must be continuous, not just at promotion time.',
  },
  {
    id: 'rt-017',
    difficulty: 'senior',
    question: 'How would you estimate the cost of a retraining system that retrains daily, and what levers would you use to reduce cost without increasing staleness?',
    keyPoints: [
      'Cost components: training compute (GPU/CPU hours) + data pipeline I/O + validation infrastructure (shadow serving) + engineering on-call time',
      'Lever 1: warm starts — if data changes incrementally, warm starts can reduce training time by 60–80%',
      'Lever 2: cache feature engineering outputs — recomputing features daily when most data is unchanged wastes significant I/O',
      'Lever 3: drift-gated daily retraining — run data validation daily but only proceed to model training if drift exceeds threshold — avoids training cost on stable days',
    ],
    trap: 'Measuring only GPU compute cost. Data pipeline I/O and shadow serving infrastructure frequently exceed training compute cost at scale.',
  },
  {
    id: 'rt-018',
    difficulty: 'junior',
    question: 'Why might a retrained model be worse than the model it is replacing, even if the training data is newer?',
    keyPoints: [
      'Newer data may be noisier or contain a data quality issue (missing values, labeling errors, schema changes)',
      'If training data window is too short, the retrained model may not have seen enough rare events to generalize',
      'A preprocessing bug introduced in the retraining pipeline creates training-serving skew that degrades production performance',
      'Concept drift can mean recent data reflects a temporary anomaly (e.g., holiday spike) that should not be over-represented in training',
    ],
    trap: 'Assuming newer training data always means a better model. Data quality, data window selection, and pipeline correctness all affect whether retraining produces improvement.',
  },
  {
    id: 'rt-019',
    difficulty: 'mid',
    question: 'What is the champion/challenger pattern in the context of post-retrain validation, and how does it differ from a normal A/B test?',
    keyPoints: [
      'Champion/challenger: the currently deployed model (champion) competes against the candidate retrained model (challenger) on a split of live traffic',
      'In a normal A/B test, both variants may be experimental — in champion/challenger, the champion is the known-good baseline and the challenger must prove it is at least as good before promotion',
      'The decision asymmetry is key: challenger must beat or match champion to be promoted; in ambiguous cases, the champion wins by default (conservative bias)',
      'Statistical significance test required: declare a winner only when the performance difference is significant at a pre-specified alpha level, not based on point estimates alone',
    ],
    trap: 'Treating any positive metric trend as sufficient to promote the challenger. Without statistical significance testing, small observed improvements are often noise.',
  },
  {
    id: 'rt-020',
    difficulty: 'senior',
    question: 'How does DVC support reproducible retraining pipelines, and what does it provide that MLflow alone does not?',
    keyPoints: [
      'DVC versions datasets and intermediate pipeline outputs as code-linked artifacts — a git commit points to an exact data version, making any past training run fully reproducible',
      'MLflow tracks experiment results (metrics, parameters, artifacts) but does not version the input data or enforce pipeline step dependencies',
      'DVC pipelines define step dependencies declaratively — only steps whose inputs have changed are re-executed, avoiding redundant recomputation',
      'Together: DVC handles data and pipeline versioning; MLflow handles experiment tracking and model registry — they are complementary, not competitive',
    ],
    trap: 'Treating MLflow as a complete solution for reproducibility. MLflow tracks artifacts and metrics but does not version input data — without data versioning, a training run logged in MLflow may not be reproducible if the source data changes.',
  },
  {
    id: 'rt-021',
    difficulty: 'junior',
    question: 'What is catastrophic forgetting in the context of model retraining and when does it occur?',
    keyPoints: [
      'Catastrophic forgetting: updating a model on new data causes it to lose patterns learned from older data',
      'Most common with warm starts on neural networks when the new training data distribution is significantly different from the historical distribution embedded in the weights',
      'Causes degraded performance on older patterns that remain relevant in production',
      'Mitigation: replay buffers (include historical data samples in each retraining batch), elastic weight consolidation (regularize against large weight changes), or cold starts when distributions differ substantially',
    ],
    trap: 'Thinking catastrophic forgetting only applies to continual learning. It can occur with warm-start batch retraining whenever the new data window is too narrow or too different from the historical distribution.',
  },
  {
    id: 'rt-022',
    difficulty: 'mid',
    question: 'How should a retraining pipeline handle a training data validation failure? What should happen next?',
    keyPoints: [
      'The pipeline should stop immediately and not proceed to model training — training on invalid data produces an invalid model',
      'Alert the data engineering team with details of the validation failure (schema mismatch, unexpected null rate, statistical anomaly)',
      'The current champion continues serving unchanged until the data issue is resolved and a clean retrain completes',
      'Log the failed pipeline run in the experiment tracker with the validation failure details for post-mortem',
    ],
    trap: 'Continuing training despite data validation warnings. A model trained on corrupt or shifted data may appear to train successfully but will fail in production in ways that are hard to attribute.',
  },
];
