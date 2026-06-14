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
    body: `Training-serving skew is a systematic difference between the statistical distribution of data that a model was trained on and the distribution of data that arrives when the model makes predictions in production. The word "systematic" is important: skew is not random noise around the training distribution, it is a structural, persistent mismatch caused by pipeline differences that existed from the moment of deployment. This distinguishes skew from data drift, which is a temporal change in the production distribution that develops after deployment as the real world evolves. Skew is present on day one. Drift arrives on day 100.

Skew is silent in the most operationally damaging sense. Every layer of infrastructure reports healthy: the model server returns predictions with normal latency and a 200 status code, the feature pipeline completes without exceptions, the data warehouse query runs without error. The only signal of a problem is that predictions are subtly wrong in a way that is indistinguishable from legitimate model limitations without careful comparison to the training distribution. Monitoring dashboards built around infrastructure health metrics - error rates, latency, throughput - provide no signal at all. The degradation only surfaces in business metrics or in explicit model monitoring that compares the serving distribution to the training distribution.

Google's machine learning engineering guide "Rules of Machine Learning," published internally and later widely cited in the industry, lists training-serving skew as one of the most important failure modes to design against in production ML systems. The guide notes that in several Google product teams, fixing training-serving skew after it was detected produced larger performance gains than improving the model architecture, because the skew had been silently suppressing model quality for months before detection. The key lesson from Google's experience is that skew is structural, not stochastic - it does not fluctuate, it does not go away on its own, and it does not improve with more training data until the root cause (the pipeline difference) is addressed. Retraining a model that suffers from skew produces a model that still suffers from skew, because the same pipeline executes training and the same different pipeline executes serving.

The magnitude of skew impact is not always small. The Nubank engineering team documented a case where transaction velocity features were inflated by 15-30% at serving time due to streaming deduplication differences, causing significant misclassification of legitimate transactions as high-risk. Google Play found features systematically missing from serving data, and fixing the skew improved app install rate on the main landing page by 2 percentage points. In high-stakes applications like credit scoring or fraud detection, skew can cause systematic fairness violations: if a demographic group is underrepresented in training data in a way that affects how their features are computed versus how the production system computes those features, the model may be well-calibrated in training evaluation but systematically miscalibrated for that group in production.`,
  },
  {
    heading: 'Feature Skew vs Label Skew vs Prediction Skew',
    body: `Skew manifests in three distinct forms that require different diagnostic approaches and different remediation strategies. Conflating them leads to applying the wrong fix, which either fails to resolve the problem or introduces new problems. Understanding the causal chain - feature skew causes prediction skew, label skew causes calibration failures - is essential for efficient root-cause analysis.

Feature skew is the most common and most technically tractable form. It occurs when the same named feature is computed differently between the training pipeline and the serving pipeline, producing systematically different numerical or categorical values for the same underlying entity state. The canonical example is a "spend in last 30 days" feature computed in training via a SQL window function over a data warehouse table, and in serving via a Python function aggregating records from an operational database with different deduplication logic. Both implementations are correct in isolation and both pass code review, but they produce different values for edge cases: users with transactions at precisely the 30-day boundary, users with duplicate transaction records that the warehouse deduplicated but the operational database did not, users whose transaction amounts are stored in different currency representations in the two systems. Each individual difference is small, but across millions of users the aggregate effect on model behavior is significant. Feature skew is always a pipeline engineering problem - the fix is always to unify or synchronize the computation.

Label skew is less intuitive but equally damaging. It occurs when the distribution of training labels does not represent the distribution of outcomes the model will encounter in production. The most common cause is survivorship bias in data collection: if you can only observe outcomes for the population that was selected by some prior filter, your labels are only representative of that filtered population. The textbook example is a loan approval model trained on historical applicants: the training data contains only applicants who were approved (because only their repayment outcomes are observable). The model never sees applicants who would have been declined; its labels are drawn from a systematically selected population. When deployed as a pre-approval screener that scores all applicants, the model encounters the full population, but its internal calibration was developed on the approved-only subset. The result is systematic overcalibration for applicant profiles that historically received approval and poorly calibrated scores for applicant profiles that were typically rejected.

Prediction skew is the downstream manifestation that is typically detected first: the statistical distribution of model prediction scores in production differs significantly from the distribution observed on the validation set. Prediction score distributions shifting toward extreme values (most predictions near 0 or near 1) are a common pattern that indicates the model is receiving inputs outside its training distribution. A model trained on features with values in [0, 100] receiving serving features in [0, 10,000] due to a normalization bug will produce confidently wrong extreme predictions. Prediction skew is a symptom, not a root cause. Attributing it correctly requires comparing the model's input feature distribution at serving time to the training feature distribution - if those diverge, feature skew is the cause. If inputs look correct but outputs are skewed, the problem is in the model scoring code itself (wrong feature order passed to the model, incorrect model artifact loaded, quantization artifacts in the deployed model).`,
  },
  {
    heading: 'Root Causes of Skew',
    body: `Root causes of training-serving skew cluster into five categories, each with its own diagnostic signature and remediation path. Production skew investigations are most efficient when engineers know which category they are looking for, because each category leaves a different empirical trace in feature distribution comparisons and pipeline logs.

Pipeline divergence is the most common root cause at scale and the most consistently underestimated in initial system design. When training and serving are implemented by different engineers, at different times, in different programming languages or frameworks, identical logic will diverge on edge cases regardless of code review rigor. A Python training pipeline and a Java serving microservice implementing the same rolling window aggregation will handle null values differently (Python's pandas treats NaN distinctly from 0, Java's typed arithmetic may default null to 0), will handle timestamp rounding differently (Python's datetime module and Java's LocalDateTime handle microseconds and timezone edge cases differently), and will produce slightly different floating-point results for operations like logarithm and exponential when the underlying numerical libraries use different precision. Each divergence is individually small; cumulatively they can shift feature distributions enough to produce meaningful model degradation.

Data source divergence is a structurally distinct problem that looks like pipeline divergence in its symptoms but requires a different fix. Training reads from a data warehouse table (BigQuery, Redshift, Snowflake) that is built by a batch ETL job and may be 12-24 hours stale relative to the operational transaction database. Serving reads from the operational database (PostgreSQL, MySQL, DynamoDB) which reflects the current real-time state. For slowly-changing features - account age, historical spend, demographic attributes - the difference between 24-hour-old warehouse data and real-time operational data is negligible. For rapidly-changing features - "last login timestamp," "current session count," "transactions in last hour" - the difference can be a complete reversal of the feature's signal. The fix is not to unify the code but to unify the data source, either by making the serving pipeline read from the same warehouse with appropriate staleness tolerance, or by making the training pipeline read from logged serving features.

Preprocessing bugs are the most immediately impactful cause of skew because they affect every feature simultaneously rather than one feature at a time. The most common preprocessing bug is normalization parameter mismatch: the training pipeline computes the normalization mean and standard deviation from the training dataset and applies z-score normalization, while the serving pipeline applies z-score normalization using hardcoded constants that were copied from the training run but were subsequently updated in training without being updated in serving. Every numerical feature is then shifted by a constant offset. The model's learned decision boundaries, which were calibrated on the original normalization, are now systematically wrong for every prediction. Another common preprocessing bug is feature encoding inconsistency: training one-hot encodes a categorical feature with a fixed vocabulary, but serving encounters new category values (a new product category, a new country code) that were absent from training and handles them by dropping the feature entirely rather than encoding them as the unknown token that training used.

Feature availability differences at serving time represent a category of skew that is often discovered late in deployment. A training feature may be computed from a data source that is not consistently available in production: a third-party API that has occasional outages, a database that is accessible from the training environment but firewalled from the serving environment, or a feature that requires a user attribute that is present in the training cohort (users with complete profiles) but missing for a significant fraction of production traffic (users who signed up before the profile completion flow existed). When these features are absent at serving time, the serving code must handle them with a default value. If the default value is different from how the training pipeline handled nulls (which may have imputed the training cohort mean rather than a static default), skew results for all entities that would have had missing values.`,
  },
  {
    heading: 'Detecting Skew in Production',
    body: `Detection of training-serving skew requires explicit infrastructure investment because it does not surface through standard production monitoring. The fundamental requirement is a comparison between two distributions: the training distribution of each feature (captured at training time and stored as a reference) and the serving distribution of each feature (captured from a sample of production prediction requests). Without logging production feature values alongside predictions, this comparison is impossible, and skew remains invisible until it degrades model performance enough to appear in business metrics.

The operational implementation of feature logging should be designed for sampling rather than comprehensive capture. Logging all feature values for every production prediction is expensive at scale: a model serving 10,000 requests per second with 200 features per request generates 2 million feature values per second, which quickly saturates storage and introduces logging latency into the serving critical path. The standard approach is to log a stratified 1-5% sample of requests asynchronously - writing feature values to a message queue (Kafka) or object store (S3) without waiting for the write to complete before returning the prediction response. The sample rate is sufficient for statistical distribution comparison and can be increased temporarily during incident investigation. Uber's Michelangelo platform uses this pattern, logging a configurable sample of serving features to a distributed store that feeds the drift detection pipeline.

PSI (Population Stability Index) is the primary continuous metric for quantifying skew magnitude per feature. Originated in credit scoring, PSI measures distributional shift by comparing binned frequency distributions between two datasets. For numerical features, the standard approach is to use quantile-based bins (10-20 bins with equal mass from the training distribution) rather than equal-width bins, because quantile bins are more sensitive to shifts in the tails of the distribution where fraud signals and anomalies often live. PSI below 0.1 is generally treated as stable, 0.1-0.2 warrants investigation, and above 0.2 is conventionally significant. TFDV (TensorFlow Data Validation) uses L-infinity norm for categorical features and approximate Jensen-Shannon divergence for numerical features rather than PSI, providing standardized output through the Anomalies proto format that integrates with TFX pipelines. Evidently AI's open-source library provides a broader set of statistical tests - Kolmogorov-Smirnov for small samples (under 1,000 observations), Wasserstein distance for larger numerical samples, Jensen-Shannon divergence for categorical features - and generates HTML monitoring reports that can be integrated into any workflow orchestrator as a validation step.

Shadow mode comparison is the most direct and highest-confidence method for confirming skew, as opposed to inferring it from distribution statistics. In shadow mode, both the production serving pipeline and an equivalent training-pipeline implementation are invoked on the same raw request inputs, and both sets of computed feature values are logged. The comparison is direct: for each feature and each request, what is the difference between what the training pipeline would have computed and what the serving pipeline actually computed? A nonzero systematic mean difference confirms skew. A large standard deviation suggests inconsistent or conditional skew (edge cases). The practical challenge is that running the full training pipeline logic synchronously in the serving path is expensive; the recommended implementation is asynchronous shadow computation on a sample of raw inputs, captured from the serving layer and processed in a background job within 60 seconds. Netflix uses shadow evaluation extensively as a pre-A/B-test gate, comparing new model candidates against production on replayed traffic in a shadow environment before any user exposure.`,
  },
  {
    heading: 'TensorFlow Data Validation (TFDV)',
    body: `TensorFlow Data Validation (TFDV) is an open-source library developed by Google as part of the TFX (TensorFlow Extended) ecosystem for computing dataset statistics, inferring data schemas, and detecting anomalies when data deviates from expected patterns. It was designed specifically for the ML data validation use case - validating training data before model training and detecting distribution drift between training and serving data - rather than being adapted from a general-purpose data quality tool. This design focus makes TFDV more precise for ML-specific validation scenarios than general tools like Great Expectations, which requires more manual configuration to cover temporal and distributional anomalies.

TFDV's workflow proceeds in four stages. First, compute statistics from the reference (training) dataset: TFDV generates a DatasetFeatureStatisticsList proto containing per-feature statistics including mean, standard deviation, quantile buckets, histogram, top values for categoricals, missing value rate, and unique count. For large datasets, TFDV uses an Apache Beam backend for distributed computation - the same statistics generation can run on a billion-row training dataset without modification. Second, infer a schema from the training statistics: TFDV's infer_schema function produces a Schema proto containing expected types, value ranges, required features, category vocabularies, and allowed missing rates. This inferred schema is the reference contract for what valid data looks like. Third, generate statistics from the serving data (or a new batch of training data from a different time period). Fourth, validate the serving statistics against the schema: validate_statistics produces an Anomalies proto that enumerates every feature where serving data violates the schema expectations.

TFDV provides specific support for training-serving skew detection through its skew_comparator feature on FeatureComparator configuration. When both training and serving statistics are passed to validate_statistics with a skew_comparator defined per feature, TFDV computes the L-infinity norm between the normalized histograms of the two datasets for each configured feature and flags any feature where this distance exceeds the specified threshold. This is equivalent to computing PSI but with different binning and distance metric choices tuned for TFX pipeline integration. TFDV also supports drift detection separately - comparing the serving distribution today to the serving distribution from the previous period - using the drift_comparator configuration. The distinction between skew (training vs serving) and drift (serving over time) maps to two different comparator configurations in the same TFDV validation step.

The primary limitation of TFDV is that it was designed for batch validation, not continuous real-time monitoring. A TFDV validation run computes statistics over a batch of data (a file, a BigQuery table, a DataFrame), produces an Anomalies report, and exits. It does not maintain streaming state or produce alerts from a running process. For production monitoring where skew must be detected as it develops in an ongoing serving workload, TFDV is used in a scheduled batch pattern: every hour, collect the logged serving features from the previous hour, compute TFDV statistics, validate against the training schema, and alert if anomalies are detected. This pattern introduces up to an hour of detection latency, which is acceptable for most use cases but insufficient for high-velocity applications where a data pipeline bug could corrupt thousands of predictions per minute before detection. Real-time skew monitoring requires streaming alternatives - Evidently AI's streaming integration or custom PSI computation over Kafka-consumed feature logs - that add operational complexity TFDV intentionally avoids.`,
  },
  {
    heading: 'PSI and Chi-Squared for Skew Measurement',
    body: `PSI (Population Stability Index) and chi-squared tests are the two most widely used statistical instruments for quantifying feature distribution shift between training and serving data. Both measure whether two datasets are drawn from the same underlying distribution, but they differ in their assumptions, sensitivity characteristics, and interpretability. Understanding when to use each and what their outputs mean requires engaging with the statistical properties rather than treating them as interchangeable drift metrics.

PSI was developed in the 1980s by credit scoring practitioners to detect when a credit scorecard's population had shifted enough that the card's score-to-default relationship could no longer be trusted. Its formula computes the sum over bins of (Actual_percentage - Expected_percentage) times the natural log of the ratio Actual_percentage divided by Expected_percentage. This is equivalent to a symmetrized KL divergence between the two distributions, which measures information-theoretic distance. The conventional thresholds - PSI below 0.1 for stable, 0.1 to 0.2 for minor shift, above 0.2 for major shift - were empirically derived from credit scoring populations and are widely adopted across industries as a starting point, but they require calibration for specific use cases. A fraud model monitoring rapidly evolving attack patterns may use 0.1 as the action threshold; a stable supply chain model may treat 0.35 as the action threshold after calibrating against stable-period baseline variance.

The binning strategy for PSI on numerical features significantly affects its sensitivity and stability. Equal-width bins (dividing the value range into N equal-sized intervals) are simple but produce unstable PSI when the value distribution is skewed, because most observations cluster in a few bins and the tail bins have very low expected percentages. Dividing by a near-zero expected percentage produces large PSI contributions from statistical noise rather than genuine shift. Quantile-based bins (dividing by quantiles of the training distribution so each bin has approximately equal expected percentage) are more stable and more sensitive to shifts in the tails because every bin contributes roughly equally to the total PSI. The standard practice is 10-20 quantile bins; fewer than 10 bins may miss subtle distributional shape changes, and more than 20 bins introduces noise from small sample sizes in individual bins. PSI requires a minimum of approximately 2,000-5,000 samples per dataset to produce stable estimates; smaller samples produce PSI values with high variance that generate false alerts.

Chi-squared tests are the appropriate choice for categorical features with a large number of categories. The chi-squared statistic tests whether the observed category frequency distribution matches the expected frequency distribution derived from training data. Unlike PSI, which produces an interpretable magnitude (a PSI of 0.25 is meaningful), chi-squared produces a test statistic that must be interpreted relative to a critical value determined by degrees of freedom and the chosen significance level. For a feature with 50 categories, the chi-squared statistic at significance level 0.05 needs to exceed the 95th percentile of the chi-squared distribution with 49 degrees of freedom to reject the null hypothesis of no distribution shift. The chi-squared test is powerful for detecting that a shift occurred but does not directly quantify how large the shift is or which specific categories shifted most - additional diagnostics are required after a significant chi-squared result. For categorical features with fewer than 20 categories, PSI applied directly to category proportions is often more interpretable than chi-squared because it quantifies shift magnitude rather than just significance.

A production failure mode to be aware of: both PSI and chi-squared can show significant shifts due to legitimate population growth rather than problematic skew. If the serving population grows by adding a new geographic market or demographic segment, PSI on geographic features and language features will spike above the alert threshold. This is a real distributional shift but not a skew problem - it reflects new users who genuinely were not represented in training. Distinguishing population expansion from pipeline skew requires segmented analysis: compute PSI separately for the existing user population and the new user population. If PSI is high in the existing population, the shift is likely pipeline-related; if PSI is high only in the new population, it is expansion-related and the appropriate response is retraining on data that includes the new population, not pipeline debugging.`,
  },
  {
    heading: 'Shadow Mode for Skew Validation',
    body: `Shadow mode is the highest-confidence technique for confirming and quantifying training-serving skew because it compares the two pipelines directly on the same inputs rather than inferring differences from distribution statistics. While PSI and chi-squared can tell you that the serving distribution differs from the training distribution, shadow mode can tell you exactly which pipeline produces which values for each specific request, enabling precise attribution of the difference to specific code paths, specific edge cases, and specific data sources.

The implementation of shadow mode for skew validation requires a request fan-out at the point where raw inputs are first available. At serving time, the production feature computation pipeline processes the raw request and produces the feature vector used for prediction. Simultaneously, a shadow pipeline - an equivalent implementation of the training-time feature computation logic - processes the same raw inputs and produces its own feature vector. Both feature vectors are logged to an async comparison store (Kafka topic, S3 prefix, BigQuery streaming insert) along with the request ID, and the production feature vector is used for the actual prediction. The shadow pipeline's output is never used for predictions; it exists only for comparison. Because the shadow computation runs asynchronously and its output does not block the prediction response, the latency impact is limited to the overhead of capturing the raw input and emitting it to the shadow pipeline trigger, typically under 1 millisecond.

The analysis of shadow mode logs quantifies skew with precision that distribution statistics cannot match. For each feature across a sample of requests, compute: the mean difference between shadow value and production value (systematic bias), the standard deviation of the difference (conditional or inconsistent skew), and the fraction of requests where the difference exceeds a threshold (prevalence). A mean difference of 0 with high standard deviation indicates conditional skew - the pipelines agree most of the time but diverge on specific edge cases. A non-zero mean difference indicates systematic skew that affects every prediction. Segmenting the analysis by entity attributes (user cohort, geographic region, account age) identifies whether skew is uniform or concentrated in specific subpopulations.

Operational constraints limit shadow mode to a sample of production traffic, typically 1-5%. At 5,000 requests per second, running shadow computation on all requests would double the serving infrastructure cost and add significant engineering complexity to the hot path. The sampling rate should be increased temporarily during incident investigation or following a pipeline change - running shadow comparison at 20% for 24 hours after a serving pipeline deployment provides high-confidence validation that no skew was introduced. The shadow comparison infrastructure should be treated as a permanent production monitoring component, not a one-time debugging tool: new pipeline deployments, library version updates, and infrastructure migrations should all trigger a shadow validation window.

A common mistake is implementing shadow mode by running the training pipeline code in the serving environment. Training pipeline code often has dependencies - large library imports, database connections with different credentials, access to data sources not available in production - that make it impractical to run directly in the serving environment. The correct approach is to extract the pure transformation logic (functions that take raw inputs and produce feature values) into a shared library that both pipelines import, and implement the shadow comparison as a test against that shared library running offline on sampled request inputs. This separation cleanly defines what "the training computation" means in isolation and makes the shadow comparison testable independent of the serving infrastructure.`,
  },
  {
    heading: 'Fixing Skew - Aligning Pipelines',
    body: `Fixing training-serving skew requires changing the pipeline structure, not the model. This is a point that teams frequently miss when first encountering skew: the intuitive response to a model performing poorly is to retrain it with more or better data. But if the root cause is a pipeline code difference, retraining produces a new model that still trains on the training pipeline's features and still serves against the serving pipeline's different features. The skew persists, and the retrained model is not better. The root cause is the pipeline difference, and the fix must be at the pipeline level.

The most robust fix is adopting a feature store that provides a single computation definition that runs identically in both training and serving contexts. When a FeatureView in Feast or a Feature Pipeline in Tecton defines "user spend in last 30 days," that definition is the single source of truth. The platform executes it against the offline store for training dataset generation and against the online store for prediction serving, using the same transformation logic in both cases. Pipeline divergence is architecturally impossible: there is only one pipeline. The trade-off is the investment required to migrate existing features to the feature store, build the online materialization infrastructure, and change model training code to use the feature store SDK. For organizations with many independently-developed models and feature pipelines, this migration is a multi-month engineering project. For new models and new feature implementations, the feature store path is strongly preferred.

Where feature store adoption is not yet complete, a shared transformation library is the next best approach. All feature transformation functions - normalization, encoding, aggregation, imputation - are extracted into a Python package (or language-appropriate module) version-controlled in Git, with a locked dependency pinned in both the training pipeline and the serving endpoint. Both pipelines import the same package at the same version, guaranteeing identical execution of the transformation logic. The failure mode to design against is version drift: the serving endpoint is deployed with library version 1.3.2 and not updated when the training pipeline updates to 1.4.0 with a bug fix to null handling. Strict pinning in both dependency manifests and automated dependency update PRs that test both pipelines against the same library version help manage this risk.

Online-first training is a conceptually elegant approach that eliminates skew by inverting the data collection model: instead of running a training pipeline that replicates what the serving pipeline does, train on features that the serving pipeline actually logged. Every prediction request through the serving pipeline logs the feature vector that was used alongside the prediction. These logged feature vectors become the training dataset. By construction, the training data reflects exactly what the serving pipeline produces - not what a separate training pipeline would have produced - because it is the serving pipeline's actual output. Online-first training requires a feature logging infrastructure (typically a Kafka consumer that writes to a data lake) and a data pipeline that assembles training examples from logged feature vectors joined with their eventual labels. The operational complexity is real, but the skew guarantee is absolute: you cannot have training-serving skew when training data is the serving pipeline's output.

What not to do is equally important. A tempting but incorrect response to detected skew is to adjust the training data to match the serving distribution - for example, if serving features are inflated by 20% due to a deduplication difference, applying a 20% inflation to the training features to match. This approach masks the root cause and creates a fragile implicit dependency: the adjustment factor is not captured in the pipeline definition but in a transformation parameter that must be updated manually whenever the serving pipeline changes. The next serving pipeline update - fixing the deduplication bug, updating the aggregation window, changing the data source - requires updating the adjustment factor simultaneously, and if that coordination fails, the artificially induced skew is worse than the original natural skew.`,
  },
  {
    heading: 'Skew in NLP and Vision Models',
    body: `Training-serving skew is often discussed in the context of tabular feature pipelines, but it applies with equal force and sometimes greater severity to NLP and vision models. The preprocessing steps for these modalities are more complex, less standardized, and more likely to differ between offline and online implementations. The consequences of skew in NLP and vision are also harder to detect from prediction outputs, because model quality for these modalities is often evaluated with coarse metrics (accuracy, BLEU score) that mask the fine-grained distributional differences that skew introduces.

NLP tokenization skew is the most common and most insidious form of skew in language model deployments. A tokenizer is not a simple function: it applies Unicode normalization, handles special characters and control sequences, manages vocabulary OOV (out-of-vocabulary) behavior, and applies language-specific rules for word boundary detection. Differences in tokenizer behavior between training and serving produce different token sequences from the same raw text, which are then embedded into different vector representations. Even using the same tokenizer library (HuggingFace tokenizers, for example) at different versions can produce different tokenizations: tokenizer library releases between 4.20 and 4.30 changed handling of Unicode boundary normalization in specific edge cases, causing different token counts for text with certain Unicode characters. A model trained with tokenizer version 4.20 and deployed with version 4.30 sees slightly different token sequences for Unicode-rich text, with effects that are small per example but significant across the long tail of diverse text inputs. The fix is explicit tokenizer versioning: pin the exact tokenizer library version in both training and serving requirements, and treat a tokenizer version upgrade as a major change requiring shadow mode validation and potentially retraining.

Text preprocessing skew encompasses the transformations applied to raw text before tokenization: lowercasing, Unicode normalization form (NFC, NFD, NFKC, NFKD), whitespace normalization, HTML entity unescaping, punctuation handling, and language detection. A model trained on lowercase-normalized English text with punctuation stripped may receive serving inputs that are mixed-case with emoji and Unicode punctuation that were not stripped in production. The model's learned representations for words are based on lowercase forms; receiving "Apple" instead of "apple" produces different embedding lookups in the vocabulary. In practice, text preprocessing pipelines are frequently written as ad-hoc Python scripts in training notebooks and reimplemented as string processing in serving microservices, with subtle differences in every edge case. The standard remedy is the same as for tabular features: extract preprocessing into a shared library that handles all edge cases identically.

Vision model skew is most acute in image resizing and normalization. Image resizing using different interpolation algorithms (bilinear, bicubic, nearest-neighbor, Lanczos) produces different pixel value distributions from the same source image, particularly at high resize ratios. A model trained on images resized with bicubic interpolation will see subtly different pixel value histograms at serving time if the production image processing pipeline uses bilinear interpolation, which is the default in many libraries including PIL and scikit-image. The normalization mean and standard deviation used for pixel-wise normalization are computed from the training dataset (ImageNet statistics are commonly used: mean [0.485, 0.456, 0.406], std [0.229, 0.224, 0.225] in RGB channel order) and must be applied identically at serving time. A classic error is channel order mismatch: OpenCV loads images in BGR order, while PyTorch and TensorFlow assume RGB order. A model trained on RGB-normalized images receiving BGR-ordered pixels at serving time sees a systematic channel swap that affects all spatial feature representations, typically causing dramatic accuracy drops on color-sensitive tasks while leaving performance on luminance-based features relatively intact.`,
  },
  {
    heading: 'Skew vs Drift - Different Causes, Different Fixes',
    body: `Skew and drift are both forms of mismatch between the distribution a model was trained on and the distribution it encounters in production, but their causes, trajectories, and remediation strategies are fundamentally different. Treating them as interchangeable - or applying the wrong fix because they were not distinguished - is one of the most common diagnostic errors in production ML. Specifically, retraining a model to fix skew (which is a pipeline engineering problem) is a recurring mistake that costs time, compute, and further delays actual remediation.

Skew is structural and time-invariant. It is present from the first prediction the model makes in production, caused by a difference in how training and serving pipelines compute the same feature. It does not change over time (unless the pipeline changes), and it does not go away through any amount of waiting. If you plot model performance from launch to three months later, skew appears as a depression in performance that is present at launch and maintains a consistent level - you see a step down at launch relative to offline evaluation, not a gradual decline after launch. Skew is diagnosed by comparing the training distribution to the day-one serving distribution: if those differ, skew is present. The fix is always a pipeline change: adopting a feature store, extracting a shared transformation library, or correcting a specific bug in either pipeline.

Drift is temporal and progressive. It is typically not present (or not significant) at model launch, because the model was recently trained on data that closely approximates current reality. It develops as the real world changes after training - user behavior shifts seasonally, fraud patterns evolve, competitor products change market dynamics, new user segments arrive. Model performance plots for a model experiencing drift show good initial performance that gradually degrades over weeks to months. Drift is diagnosed by comparing the serving distribution from day one to the serving distribution from today: if those differ, drift is occurring. The fix is always a model update: retraining on recent data, adjusting the training window, or incorporating new features that capture the changed dynamics.

The diagnostic confusion arises because both produce the same observable symptoms - production model performance worse than offline evaluation predicted - but at different timescales and with different patterns. Immediate performance gap at launch: suspect skew first. Gradual performance erosion over weeks: suspect drift first. The empirical test is distribution comparison over time: compute PSI between training distribution and serving distribution at launch and at month three. If PSI at launch is high, skew is present regardless of whether drift also develops later. If PSI at launch is low but high at month three, drift is the dominant issue.

Both can coexist - and frequently do. A model with skew and drift suffers from two simultaneous problems with different root causes and different fixes. Applying only the drift fix (retraining) while skew persists produces a model that trains on one distribution, serves on a skewed version of the current distribution, and accumulates both sources of degradation. The systematic approach is to address skew first (fix the pipeline) because skew affects every retrain while drift only affects the gap between training and current reality. A retrain that runs on a skewed pipeline produces a new model that will still be skewed. Fix the pipeline, then assess whether drift-driven retraining is necessary, then apply that retrain to the corrected pipeline.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is training-serving skew and why is it dangerous?',
    keyPoints: [
      'Systematic difference between data distribution at training time vs serving time',
      'Dangerous because it is silent - infrastructure metrics look healthy while predictions are wrong',
      'Root cause: different code or data sources for the same feature in training vs serving',
      'Model performs well offline but degrades in production',
    ],
    trap: 'Confusing training-serving skew with data drift - skew is a pipeline structural mismatch that exists from launch, while drift is a temporal change in the real-world distribution.',
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
    trap: 'Assuming prediction skew is always caused by model code bugs - it is more commonly caused by feature skew upstream.',
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
    trap: 'Only comparing mean values - mean can be identical while distribution shape differs significantly.',
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
    trap: 'Assuming skew only comes from bugs - even two correct implementations of the same feature in different languages will diverge on edge cases.',
  },
  {
    difficulty: 'mid',
    question: 'How do you use PSI to detect feature skew? What are its limitations?',
    keyPoints: [
      'PSI = Σ(Actual% - Expected%) × ln(Actual%/Expected%) across feature distribution buckets',
      'PSI < 0.1: stable, 0.1–0.2: monitor, > 0.2: significant skew',
      'Limitation: does not indicate direction or cause of shift - requires investigation to diagnose',
      'Limitation: requires choosing bucket boundaries - use quantile-based for numerical features',
      'Works best with > 1000 samples per dataset - small samples produce unstable PSI estimates',
    ],
    trap: 'Using equal-width buckets for highly skewed numerical distributions - quantile-based buckets are more sensitive to distribution shift in the tails.',
  },
  {
    difficulty: 'mid',
    question: 'Describe how you would implement shadow mode to validate feature skew in production.',
    keyPoints: [
      'At serving time, compute features via production pipeline and log them',
      'Also run training-equivalent pipeline on same raw inputs (asynchronously)',
      'Log both feature sets, compute per-feature difference statistics',
      'Sample 1–5% of traffic to limit overhead - shadow computation is expensive',
      'Alert if mean difference or PSI between shadow and production features exceeds threshold',
    ],
    trap: 'Running shadow computation synchronously in the serving path - this doubles latency and defeats the purpose of low-latency serving.',
  },
  {
    difficulty: 'mid',
    question: 'How do you fix training-serving skew once it is detected?',
    keyPoints: [
      'Root cause fix: unify training and serving pipelines - single code path for feature computation',
      'Feature store adoption: single computation definition served identically in training and serving',
      'Shared transformation library: extract preprocessing into a versioned library imported by both',
      'Online-first training: train on features logged from the production serving pipeline',
      'Do not fix by adjusting training data to match serving distribution - masks root cause',
    ],
    trap: 'Treating the fix as retraining the model with different data - retraining does not fix a pipeline code difference and the skew will persist after the retrain.',
  },
  {
    difficulty: 'mid',
    question: 'What is TFDV and how does it help with skew detection?',
    keyPoints: [
      'TensorFlow Data Validation: computes statistics, infers schemas, detects anomalies',
      'Workflow: generate training statistics → infer schema → validate serving statistics against schema',
      'Detects: distribution drift, schema mismatches, null rate changes, unexpected category values',
      'Designed for batch validation - not real-time streaming monitoring',
      'Output: structured anomaly report per feature with severity levels',
    ],
    trap: 'Treating TFDV as a real-time monitoring solution - it is a batch validation tool, not a streaming anomaly detector.',
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
    trap: 'Assuming skew is only a tabular data problem - NLP and vision models are equally susceptible, especially with tokenizer and preprocessing pipelines.',
  },
  {
    difficulty: 'mid',
    question: 'How do you distinguish skew from drift when diagnosing model degradation?',
    keyPoints: [
      'Timing: immediate degradation at launch = skew; gradual degradation over weeks = drift',
      'Compare training distribution (fixed) to serving distribution (changes over time)',
      'If serving distribution differs from training distribution on day 1 = skew',
      'If serving distribution was close on day 1 but diverges over time = drift',
      'Both can coexist - require separate fixes: pipeline alignment for skew, retraining for drift',
    ],
    trap: 'Triggering a retrain to fix skew - retraining on new data does not fix a pipeline code difference; the skew will persist after the retrain.',
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
    trap: 'Computing skew synchronously at serving time for every request - this is prohibitively expensive; log and compute asynchronously.',
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
    trap: 'Concluding the offline evaluation was overly optimistic and triggering a new training run - the most likely cause of immediate underperformance is a serving pipeline bug, not model selection error.',
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
    trap: 'Relying on code reviews alone to catch skew - subtle numerical differences (floating point, null handling) are easy to miss in code review but easy to catch with automated comparison tests.',
  },
  {
    difficulty: 'senior',
    question: 'How would you handle skew in a model that uses both batch features and real-time features?',
    keyPoints: [
      'Batch features: compare training warehouse values to batch-materialized online store values at the same timestamp',
      'Real-time features: shadow mode - compute same aggregation offline from raw events and compare to streaming pipeline',
      'The join between batch and real-time features at serving time must match what was done at training time',
      'Monitor both independently: batch skew and real-time skew may have different root causes',
      'Point-in-time correctness: ensure batch features in training were joined with the correct as-of timestamp',
    ],
    trap: 'Treating batch and real-time feature skew with the same monitoring approach - real-time features require streaming comparison infrastructure, not just batch dataset comparison.',
  },
  {
    difficulty: 'junior',
    question: 'What is label skew and how can it affect a trained model?',
    keyPoints: [
      'Label skew: label distribution in training data does not match actual outcome distribution in production',
      'Caused by biased data collection, survivorship bias, or systematic exclusion of certain outcomes',
      'Example: training on only approved loan applications - never observing the outcomes of rejected ones',
      'Result: model is well-calibrated on the observed population but miscalibrated on the full population',
    ],
    trap: 'Treating label skew as a class imbalance problem - class imbalance is about frequency, label skew is about systematic bias in which outcomes are observed.',
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
    trap: 'Only comparing before/after mean values of features - distribution shape can change significantly while means remain similar.',
  },
  {
    difficulty: 'senior',
    question: 'Describe an end-to-end strategy to eliminate training-serving skew across an organization.',
    keyPoints: [
      'Feature store adoption: move all feature computation to a unified platform with a single code path',
      'Online-first training: log serving features to a data lake, train new models on logged features',
      'Automated skew CI gate: block model promotion if PSI between training and recent serving features exceeds threshold',
      'Preprocessing as code: all transformations in a tested, versioned library - no ad-hoc scripts',
      'Skew budget: treat acceptable PSI level as an organizational SLO, track in quarterly reliability reviews',
    ],
    trap: 'Treating skew elimination as a one-time project - without ongoing tooling, process, and monitoring, skew reintroduces itself with every pipeline refactor.',
  },
  {
    difficulty: 'junior',
    question: 'Why is skew harder to detect than model drift?',
    keyPoints: [
      'Skew produces no infrastructure alert - serving succeeds, latency is normal',
      'No direct comparison signal - you need to know what the training distribution was',
      'Offline metrics (on training-distribution data) may look fine while production degrades',
      'Requires explicit logging of production feature values for comparison - not set up by default',
    ],
    trap: 'Assuming model accuracy on validation set would catch skew - validation set is drawn from training distribution, which is exactly what is different from production.',
  },
];
