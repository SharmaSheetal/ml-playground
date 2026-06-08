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
    heading: 'Why CI/CD for ML Is Different',
    body: `Traditional software CI/CD validates code correctness through unit and integration tests. ML CI/CD must additionally validate data quality, model quality, and alignment between offline and online metrics.

Software code either works or it does not — tests are deterministic. Model quality is probabilistic and context-dependent. A model may pass all unit tests but still perform worse than its predecessor on a key business metric. This requires additional validation steps that have no equivalent in traditional CI/CD.

Three artifacts must be managed in ML CI/CD: code (training pipeline, serving code, feature transformations), data (training dataset, feature schemas), and models (serialized weights, metadata, evaluation results). Traditional CI/CD manages only code. The additional artifacts require model registries, data versioning tools, and evaluation frameworks.`,
  },
  {
    heading: 'The ML CI/CD Pipeline Stages',
    body: `A production ML CI/CD pipeline typically has 5 stages, each with its own validation gate before the next stage begins.

Stage 1 — Data validation: validate that the new training dataset meets schema expectations, has sufficient volume, and does not have excessive null rates or distribution anomalies. Tools: TFDV, Great Expectations, dbt tests.

Stage 2 — Model training: train the model on validated data, track hyperparameters and metrics to a model registry (MLflow, W&B, SageMaker experiments).

Stage 3 — Offline evaluation: evaluate the trained model against held-out test data and the current production model. Gate: new model must beat production model by a specified margin (e.g., AUC +0.5%).

Stage 4 — Staging / shadow: deploy the new model to a shadow environment, run a subset of production traffic through it, compare outputs to production model. Gate: prediction distribution similarity, latency SLO.

Stage 5 — Production canary: promote to canary (1–5% of traffic), evaluate using production metrics for an observation window. Gate: business metrics not degraded beyond threshold. On pass, promote to full traffic.`,
  },
  {
    heading: 'Model Validation Gates',
    body: `Gates are automated quality checks that must pass before the pipeline advances to the next stage. Well-designed gates prevent regressions from reaching production.

Accuracy gate: new model AUC must exceed champion model AUC on the same held-out test set. Percentage threshold (not absolute) prevents shipping a model that is marginally worse.

Fairness gate: model performance must not degrade beyond a specified threshold for protected demographic groups. Required for regulated industries (credit, hiring, housing).

Latency gate: model inference P99 latency must not exceed the serving SLO. Measured in a load test environment that mirrors production hardware.

Data quality gate: training data volume must be within expected range, null rate per critical feature below threshold, no unexpected schema changes.

Calibration gate: model predicted probabilities must be calibrated within expected error on the test set. Important for systems that use raw scores for downstream decision-making.

The number and strictness of gates should scale with the model's business impact. A recommendation model and a credit risk model should have very different gate configurations.`,
  },
  {
    heading: 'Automated Testing for ML',
    body: `ML pipelines require several layers of testing that go beyond traditional software testing.

Unit tests for feature transformations: given a specific input, a feature transformation should produce an expected output. Test edge cases: null inputs, out-of-range values, empty strings, Unicode. These tests run on every code change and must be fast.

Integration tests for the training pipeline: run the full training pipeline on a small (1%) sample of production data. Validate that the pipeline completes, the model file is created, and evaluation metrics are computed correctly.

Data quality tests: validate schema, null rates, value ranges, and referential integrity for training data before the pipeline runs. Great Expectations and dbt tests provide declarative data quality assertions.

Model output tests: validate that the served model returns outputs within expected ranges (no NaN outputs, no all-zeros predictions), accepts all feature combinations present in training, and handles null inputs gracefully.

Regression tests: maintain a golden dataset — a small set of examples with known expected outputs. Any model change that alters the golden dataset outputs by more than a threshold triggers a review.`,
  },
  {
    heading: 'Staging Environments for ML',
    body: `A staging environment mirrors production infrastructure but receives synthetic or replayed production traffic rather than live user traffic.

Shadow traffic staging: route a copy of production requests to the staging model. The staging model's predictions are logged but never shown to users. Evaluate prediction distribution, latency, and error rate in the staging environment before promoting to production canary.

Offline evaluation staging: replay recent production requests (without user-visible impact) through both the new and champion model, compare outputs side-by-side. Detects skew, schema changes, and behavioral regressions before any user exposure.

Challenges: staging environments are expensive to maintain at production scale. Many teams run staging at 1–5% of production capacity and hope that scale-dependent issues do not appear. GPU availability for staging inference is a common bottleneck.

Staging parity: the serving infrastructure (model server version, GPU type, batch size configuration, feature store connection) must match production exactly. Infrastructure differences between staging and production are a common source of regressions that only appear post-promotion.`,
  },
  {
    heading: 'Argo Workflows and Kubeflow Pipelines',
    body: `ML CI/CD pipelines are typically orchestrated using workflow engines rather than traditional CI tools like Jenkins or GitHub Actions, because ML pipelines have large computational steps, data dependencies, and caching requirements that generic CI tools handle poorly.

Argo Workflows: Kubernetes-native workflow engine that runs each pipeline step as a separate container. Supports DAG (directed acyclic graph) workflows, retry policies, artifact passing between steps, and conditional branching. Common in MLOps because it integrates natively with Kubernetes-based model serving.

Kubeflow Pipelines: Google's ML-specific workflow platform built on Argo. Provides a Python SDK for defining pipeline steps, a UI for tracking runs, and integration with Google Cloud AI Platform. Steps compile to Argo YAML under the hood.

Prefect and Dagster: Python-native orchestrators with richer observability, better local development experience, and stronger data lineage tracking than Argo. Better suited for teams that want Python-first workflow definitions.

Trade-off: Argo is the most Kubernetes-native option but requires YAML configuration expertise. Kubeflow provides more ML-specific abstractions but creates Google Cloud lock-in. Prefect/Dagster offer better developer experience but require more operational setup.`,
  },
  {
    heading: 'MLflow, W&B, and DVC in CI/CD',
    body: `Model registries and experiment tracking tools are the backbone of ML CI/CD because they provide the artifact store that gates compare against.

MLflow: open-source experiment tracking, model registry, and serving. In CI/CD, MLflow tracks hyperparameters, metrics, and model artifacts for every training run. The model registry stores staged, production, and archived model versions. Gates compare a new run's metrics against the current production model in the registry.

Weights & Biases (W&B): commercial experiment tracking with richer visualization, artifact management, and team collaboration. W&B Artifacts tracks model, dataset, and code versions with lineage. W&B Reports enable automated quality reports as part of CI/CD.

DVC (Data Version Control): Git-based versioning for large files (datasets, model weights). In CI/CD, DVC tracks which dataset version was used to train which model version, enabling reproducibility. DVC pipelines define training as a DAG of stages with input/output tracking.

Integration pattern: Git commit triggers a CI pipeline → DVC pulls the correct dataset version → training run tracked in MLflow → evaluation gate compares to MLflow production model → on pass, model registered as new staging version in MLflow → Argo Workflow handles canary deployment.`,
  },
  {
    heading: 'GitOps for Model Deployment',
    body: `GitOps applies the same principles to ML deployment that developers use for software deployment: the desired state of the production environment is declared in a Git repository, and an automated operator ensures the actual state matches the declared state.

For ML: model configuration (version, serving replicas, resource allocation, feature store connection) is declared in a YAML manifest in a Git repository. ArgoCD or Flux watches the repository and automatically applies changes when the manifest is updated.

Benefits: the Git repository is an audit log of all configuration changes. Rollback is as simple as reverting a commit — ArgoCD automatically reconciles the serving deployment to the previous state. Multiple environments (dev, staging, production) are managed by separate branches or directories in the same repository.

Model promotion workflow: a trained model passes all quality gates → a PR is automatically created in the GitOps repository updating the production model version → a human approves the PR → ArgoCD deploys the new model version.

Limitation: GitOps works best for configuration changes. It does not manage the model artifact itself (that lives in the model registry). The manifest just references the model registry URI.`,
  },
  {
    heading: 'Rollback Strategy in ML CI/CD',
    body: `ML rollbacks are more complex than software rollbacks because you may need to roll back the model, the serving code, the feature pipeline, or all three — and they may have been deployed at different times.

Model rollback: revert the model registry to the previous production version. In Kubernetes/Argo Rollouts, redirect traffic back to the previous model deployment. This is fast (seconds to minutes) and the most common rollback operation.

Code rollback: if the serving code (not just the model weights) contains a bug, roll back the container image. More invasive — requires redeployment of the serving infrastructure.

Feature pipeline rollback: if a feature pipeline change introduced skew, roll back the pipeline code. May require draining and recomputing cached feature values. Complex and slow — plan for this before deployment, not during an incident.

State: ML models are often stateful (feature stores have materialized values, predictions have been logged). Rollback does not undo logged predictions or materialized features. This is acceptable for most use cases but relevant for audit requirements.

Rollback vs fix-forward: for minor regressions, rolling back immediately may be safer than attempting a quick fix. For P1 outages, rollback first, diagnose second.`,
  },
  {
    heading: 'Human-in-the-Loop Gates',
    body: `Not every gate should be automated. Some decisions require human judgment, especially when the stakes are high or the metrics are ambiguous.

When to automate: performance gates with objective thresholds (AUC, latency, error rate), data quality gates, infrastructure health checks. Automation reduces MTTR and prevents bottlenecks.

When to require human approval: model changes in regulated domains (credit, hiring, healthcare), model changes that affect protected demographic groups, model changes with expected large business impact, first deployment of a new model type.

Human-in-the-loop workflow: automated gates pass → automated notification to model owner and approver → approval required before promotion to full production traffic. Approval includes review of evaluation report, fairness metrics, and risk assessment.

Tooling: GitHub Pull Requests work well for GitOps-based promotion. The "approval" is merging the PR that updates the production model version in the manifest. This provides a natural audit trail.

Avoiding approval theater: human gates are only valuable if the reviewer has the information and authority to actually reject a promotion. If approval is always given without review, the gate adds latency without safety.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are the main stages of an ML CI/CD pipeline?',
    keyPoints: [
      'Data validation → model training → offline evaluation → staging/shadow → production canary',
      'Each stage has automated gates that must pass before advancing',
      'Offline evaluation: new model vs champion model on held-out test set',
      'Staging: shadow traffic comparison before user exposure',
      'Canary: small traffic slice with business metric observation window',
    ],
    trap: 'Describing only training and deployment — ML CI/CD requires data validation, offline evaluation, and staged traffic promotion, not just code build and deploy.',
  },
  {
    difficulty: 'junior',
    question: 'What is a model validation gate and what types would you implement?',
    keyPoints: [
      'Automated quality check that must pass before pipeline advances to next stage',
      'Accuracy gate: new model AUC > champion model AUC on same held-out test set',
      'Latency gate: inference P99 must not exceed serving SLO',
      'Data quality gate: training data schema and volume must be valid',
      'Fairness gate: performance must not degrade for protected demographic groups',
    ],
    trap: 'Only implementing an accuracy gate — without latency, data quality, and fairness gates, a model can pass accuracy checks while introducing production regressions.',
  },
  {
    difficulty: 'junior',
    question: 'How is ML CI/CD different from software CI/CD?',
    keyPoints: [
      'Must manage 3 artifacts: code, data, and models — software CI/CD only manages code',
      'Quality gates are probabilistic (model performance), not deterministic (tests pass/fail)',
      'Requires experiment tracking, model registry, data versioning in addition to version control',
      'Staged traffic promotion (canary) is standard in ML; optional in software deployments',
    ],
    trap: 'Treating ML CI/CD as just adding a training step to a software pipeline — the data validation, offline evaluation, and multi-stage deployment are fundamentally new requirements.',
  },
  {
    difficulty: 'junior',
    question: 'What is a model registry and how does it fit into ML CI/CD?',
    keyPoints: [
      'Central store for trained model artifacts with versioning and lifecycle management',
      'Tracks model version, training metadata, evaluation metrics, and deployment history',
      'Stages: staging → production → archived',
      'CI/CD gates compare new model metrics against the current production model in the registry',
    ],
    trap: 'Treating a model registry as just a file storage system — it must also track lineage (which data and code produced this model) and lifecycle state.',
  },
  {
    difficulty: 'mid',
    question: 'How do you implement automated unit tests for feature transformation code?',
    keyPoints: [
      'Write tests for each transformation function with known input/output pairs',
      'Test edge cases: null inputs, empty strings, out-of-range values, Unicode',
      'Test idempotency: running the transformation twice should produce the same result',
      'Run on every code change in the CI pipeline — must be fast (< 2 minutes for full test suite)',
      'Include regression tests: golden examples that must produce specific outputs after any change',
    ],
    trap: 'Only testing the happy path — edge cases (null handling, numeric overflow, unexpected categories) are where production bugs actually occur.',
  },
  {
    difficulty: 'mid',
    question: 'How do you handle model rollback in a production ML system?',
    keyPoints: [
      'Model rollback: revert model registry to previous production version, redirect serving traffic',
      'Kubernetes/Argo Rollouts: instantly shift traffic to previous deployment — seconds to complete',
      'Separate concerns: model rollback, code rollback, and feature pipeline rollback may all be needed',
      'Do not delete old model deployments until incident is diagnosed — keep running at 0% traffic',
      'Maintain rollback SLO: target < 5 minutes from decision to completion for model rollback',
    ],
    trap: 'Conflating model rollback with code rollback — a model can be reverted without touching the serving infrastructure code.',
  },
  {
    difficulty: 'mid',
    question: 'Compare Argo Workflows and GitHub Actions for orchestrating ML pipelines.',
    keyPoints: [
      'GitHub Actions: simple CI/CD, good for light ML tasks, not designed for large compute jobs',
      'Argo Workflows: Kubernetes-native, runs each step as a separate container, supports DAG pipelines with caching and retries',
      'Argo handles GPU resources, artifact passing, and conditional branching natively',
      'GitHub Actions easier to set up but lacks ML-specific features and struggles with long-running training jobs',
      'Common pattern: GitHub Actions triggers Argo Workflow for heavy training/evaluation steps',
    ],
    trap: 'Using GitHub Actions for a full training run on large datasets — GitHub Actions has 6-hour time limits and limited GPU support.',
  },
  {
    difficulty: 'mid',
    question: 'How would you use DVC to version control training data and models?',
    keyPoints: [
      'DVC tracks large files (datasets, model weights) in object storage (S3, GCS), with small pointer files in Git',
      'dvc repro reruns only stages whose inputs changed — like make for ML pipelines',
      'dvc push/pull syncs data artifacts between team members without storing in Git',
      'CI pipeline: dvc pull to get correct dataset → train → dvc push to store new model',
      'Enables exact reproduction of any experiment: git checkout + dvc checkout',
    ],
    trap: 'Storing large datasets in Git itself — DVC stores pointers in Git and the actual data in remote storage.',
  },
  {
    difficulty: 'mid',
    question: 'What is GitOps for model deployment and what are its benefits?',
    keyPoints: [
      'Desired state (model version, replicas, resources) declared in Git, operator auto-applies',
      'Rollback: git revert → ArgoCD automatically reconciles serving to previous state',
      'Audit log: every configuration change is a Git commit with author and timestamp',
      'Model promotion: update model version in Git manifest → ArgoCD deploys',
      'Multiple environments managed by separate branches or directories',
    ],
    trap: 'Thinking GitOps replaces the model registry — GitOps manages configuration (what version to serve), while the model registry stores the actual model artifacts.',
  },
  {
    difficulty: 'mid',
    question: 'When should you require human approval in an ML CI/CD pipeline vs automate the gate?',
    keyPoints: [
      'Automate: objective threshold gates (AUC, latency, error rate, data quality)',
      'Human approval: regulated domains (credit, healthcare, hiring), fairness-sensitive changes, large business impact',
      'Human approval: first deployment of a new model type or architecture',
      'Avoid approval theater: only require human approval when the reviewer has the information to actually reject',
      'Tooling: GitHub PR merge as approval action with automated evaluation report attached',
    ],
    trap: 'Automating every gate for high-stakes regulated models — regulatory requirements and ethical considerations require human review, not just metric thresholds.',
  },
  {
    difficulty: 'senior',
    question: 'Design a complete ML CI/CD pipeline for a fraud detection model updated weekly.',
    keyPoints: [
      'Trigger: weekly data pipeline completes → GitHub Actions triggers Argo Workflow',
      'Data validation gate: TFDV checks schema, null rates, volume, and distribution vs last week',
      'Training: Spark feature pipeline → distributed XGBoost training on GPU cluster, tracked in MLflow',
      'Offline evaluation gate: new model AUC, precision@5%, calibration vs champion on holdout',
      'Shadow deployment: new model receives 10% of production traffic for 24 hours — compare prediction distribution, latency',
      'Canary: 5% traffic for 48 hours with fraud rate and false positive rate gates',
    ],
    trap: 'Using daily traffic for the canary observation window in fraud detection — fraud patterns can take 48–72 hours to manifest; shorter windows miss real regressions.',
  },
  {
    difficulty: 'senior',
    question: 'How do you test a training pipeline in CI without running a full expensive training run?',
    keyPoints: [
      'Smoke test: run pipeline on 1% of data — validates that all stages complete, not that the model is good',
      'Component tests: test each pipeline stage independently (data loading, feature computation, training step)',
      'Mock expensive steps: use a tiny model (2-layer network, 100 trees) for integration tests',
      'Deterministic test: fix random seed, use a tiny golden dataset, assert final metrics match expected values',
      'Separate fast tests (run in CI) from slow full training runs (triggered on schedule or manually)',
    ],
    trap: 'Running the full training pipeline in CI for every PR — this makes CI too slow and expensive, discouraging frequent commits.',
  },
  {
    difficulty: 'senior',
    question: 'How do you manage multiple model versions in production simultaneously (e.g., A/B test across model versions)?',
    keyPoints: [
      'Model registry: tag each version with its stage (production, canary, shadow, archived)',
      'Traffic routing: serving infrastructure routes requests to model versions based on percentage config',
      'Feature store: ensure both versions receive the same feature computation (no skew between versions)',
      'Logging: tag each prediction with model version ID for attribution in analysis',
      'Lifecycle: define maximum age for canary models — force promotion or rollback within 2 weeks',
    ],
    trap: 'Running A/B test between model versions without tagging predictions with version ID — makes it impossible to attribute metric differences to specific model versions.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle CI/CD for a model that requires 12 hours of training time?',
    keyPoints: [
      'Separate fast CI (unit tests, data validation, smoke test) from slow training runs (triggered weekly or on demand)',
      'Warm start: checkpoint and resume — CI validates that checkpointing works without running full training',
      'Parallel training: distribute training across multiple nodes to reduce wall clock time',
      'Early stopping: gate on validation metric improvement at each epoch — fail fast if model is not learning',
      'Staged pipeline: gate must pass at each stage before the next expensive stage runs',
    ],
    trap: 'Running 12-hour training jobs on every PR — this makes iteration speed prohibitively slow and creates CI bottlenecks.',
  },
  {
    difficulty: 'junior',
    question: 'What is the purpose of a staging environment in ML deployment?',
    keyPoints: [
      'Test the model in production-like infrastructure before any user exposure',
      'Shadow traffic: route copy of production requests to staging, compare predictions to champion',
      'Catch serving infrastructure issues: latency, schema mismatches, OOM errors',
      'Catch behavioral regressions: prediction distribution shifts that offline tests missed',
    ],
    trap: 'Skipping staging and going directly from offline evaluation to production canary — staging catches infrastructure issues and behavioral regressions that offline tests miss.',
  },
  {
    difficulty: 'mid',
    question: 'How do you handle data validation failures in your ML CI/CD pipeline?',
    keyPoints: [
      'Fail the pipeline early and block training until data issues are resolved',
      'Alert the data engineering team with specific anomaly details (which feature, which assertion failed)',
      'Do not retrain on invalid data — results will be unpredictable and hard to debug',
      'Maintain a data quality dashboard to track failure patterns over time',
      'For minor issues: allow override with human approval and explicit acknowledgment',
    ],
    trap: 'Treating data validation failures as warnings rather than blocking errors — a model trained on invalid data is worse than no update at all.',
  },
  {
    difficulty: 'senior',
    question: 'How do you measure the ROI of investing in ML CI/CD infrastructure?',
    keyPoints: [
      'MTTR reduction: time from model regression detection to rollback, tracked before and after CI/CD maturity',
      'Deployment frequency: number of model updates per month — higher frequency means faster iteration',
      'Failed production deployments rate: regressions caught by gates vs slipping to production',
      'Engineering time: hours per model update before vs after CI/CD automation',
      'Incident count: production ML incidents per quarter, attributed to CI/CD improvements',
    ],
    trap: 'Measuring only deployment speed — a fast pipeline that ships more regressions does not improve ROI. Balance deployment frequency with production incident rate.',
  },
  {
    difficulty: 'mid',
    question: 'How does Kubeflow Pipelines differ from Argo Workflows for ML use cases?',
    keyPoints: [
      'Kubeflow Pipelines: ML-specific abstractions, Python SDK for pipeline definition, integrates with ML metadata store',
      'Argo Workflows: general-purpose Kubernetes workflow engine, YAML-first, more flexible but less ML-specific',
      'Kubeflow provides built-in experiment tracking and pipeline versioning; Argo requires external tracking (MLflow)',
      'Kubeflow is opinionated about structure — faster setup for standard ML workflows, harder to customize',
      'Argo is used by Kubeflow Pipelines internally — Kubeflow is a higher-level abstraction over Argo',
    ],
    trap: 'Treating Kubeflow and Argo as competing alternatives — Kubeflow Pipelines uses Argo as its execution engine.',
  },
];
