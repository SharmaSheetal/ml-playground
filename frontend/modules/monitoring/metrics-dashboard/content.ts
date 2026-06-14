export interface StudySection { heading: string; body: string; }
export interface InterviewQ {
  id?: string;
  difficulty: 'junior' | 'mid' | 'senior';
  question: string;
  answer?: string;
  keyPoints: string[];
  trap?: string;
}

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'Why Four Layers?',
    body: `A single monitoring metric cannot tell you why a model is misbehaving. It can tell you something is wrong, but the root cause could be anywhere in a stack that spans infrastructure, model logic, input data, and business outcomes. The four-layer monitoring framework - infrastructure, model quality, business metrics, and data quality - exists because each layer can fail independently, each layer detects a different class of failure, and each layer routes to a different owning team.

Consider what a single AUC metric misses. AUC may be stable while P99 inference latency degrades from 80ms to 900ms because a GPU memory leak is causing model servers to fall back to CPU - an infrastructure failure that does not touch model accuracy. AUC may be stable while a key feature's null rate spikes from 0.5% to 40% because an upstream pipeline failed - the model is silently returning near-random predictions because it lost its most important feature. AUC may be stable on the evaluation set while revenue drops 6% because the model is optimizing click probability on ad inventory that converts poorly - a business objective misalignment that label-based accuracy metrics will never surface.

The cascade direction of failures is almost always the same: data quality failures cause model quality degradations, which cause business metric drops. Infrastructure failures can independently trigger model quality and business metric effects by introducing latency that changes user behavior. Instrumenting all four layers provides both fast detection - infrastructure degrades in seconds - and correct attribution - data quality data tells you where in the pipeline the failure originated, narrowing root cause investigation from hours to minutes. Teams at DoorDash and Booking.com have reported that multi-layer monitoring reduced their mean time to diagnosis on model incidents by 60 to 70 percent compared to monitoring only outcome metrics.`,
  },
  {
    heading: 'Layer 1: Infrastructure Metrics',
    body: `Infrastructure metrics measure the health of the system serving predictions, not the quality of those predictions. They are the fastest-moving layer - a bad deploy or a hardware failure can degrade infrastructure metrics within seconds - and they are the first place to check during any incident.

The core serving metrics are prediction latency at multiple percentiles, request throughput, error rate, and resource utilization. Latency must be tracked at P50, P95, and P99 at minimum. P50 (median) latency is almost always acceptable and gives a false sense of health; P99 latency is where user-facing degradation occurs. If P50 is 25ms and P99 is 2,400ms, your median user is fine but 1 in 100 users is experiencing a 96x latency spike. For real-time systems with SLAs, P999 (one-in-a-thousand worst case) is also tracked. Grafana with Prometheus is the standard stack for these metrics in self-hosted environments; AWS CloudWatch, Google Cloud Monitoring, and Datadog provide managed equivalents.

Error rate requires decomposition to be actionable. A 0.5% error rate looks benign until you discover it is 100% of requests from a specific geographic region because a model server in that region is down, or 100% of requests for a specific user segment because a feature lookup times out for users without a certain profile attribute. Track error rate by model version, by traffic segment, by feature availability, and by serving region. Track specific error types separately: timeout errors (model server too slow), OOM kills (model requires more memory than allocated), upstream errors (feature store unavailable), and downstream errors (model response rejected by the calling service).

Resource utilization connects infrastructure to cost. GPU utilization below 30% on a GPU inference fleet suggests overprovisioning or batching inefficiency. Memory pressure approaching 90% is a leading indicator of OOM kills and unpredictable tail latency spikes due to memory swapping. Pod restart counts - visible in Kubernetes cluster metrics - are a crash-loop signal: a pod restarting more than twice per hour is failing faster than the scheduler can recover it. At Uber, the ML deployment safety paper described tracking online-offline inference consistency as an additional infrastructure metric - computing predictions both offline and online for identical inputs and alerting when they diverge, which catches serialization bugs and preprocessing differences that pure latency monitoring misses.`,
  },
  {
    heading: 'Layer 2: Model Quality Metrics',
    body: `Model quality metrics measure whether predictions are accurate, well-calibrated, and behaviorally consistent over time. Unlike business metrics, they can be computed on held-out labeled data or collected via production label pipelines. Unlike infrastructure metrics, they change on the timescale of days to weeks rather than seconds - except immediately after a bad model deployment, when they can change abruptly.

AUC-ROC measures discrimination: does the model assign higher scores to positive instances than negative instances? AUC of 0.80 means the model correctly ranks a random positive above a random negative 80% of the time. But AUC has a critical limitation in monitoring contexts: it is insensitive to calibration. A model that gives every positive instance a score of 0.51 and every negative a score of 0.49 has perfect AUC but is entirely useless as a probability estimator. For systems that use predicted probabilities as inputs to downstream decisions - pricing engines, bid optimizers, policy enforcement thresholds - calibration is the metric that matters.

Expected Calibration Error (ECE) measures probability accuracy: if you bucket predictions by score range, does predicted probability 0.7 correspond to actual positive rate of 70%? ECE is computed by dividing predictions into N equal-width probability bins (typically 10 bins from 0.0 to 1.0), computing the average predicted probability and the actual positive rate in each bin, and summing the weighted absolute difference. ECE below 0.05 is generally considered acceptable; ECE above 0.10 indicates meaningful miscalibration. A model with good AUC but ECE of 0.15 will systematically over-predict or under-predict risk, producing suboptimal decisions in any downstream system that uses the raw probability.

Prediction distribution monitoring is a label-free proxy that detects model behavioral changes in real time. Track the mean, standard deviation, and key percentiles (10th, 25th, 50th, 75th, 90th) of prediction scores on a sliding window - typically hourly. Sudden score distribution shifts - the mean fraud score dropping from 0.12 to 0.03, or the score variance collapsing - indicate the model is behaving differently even before labeled data arrives to confirm whether performance has changed. PSI on the prediction score distribution computed against the launch-period baseline is a useful scalar summary. The null prediction rate - the fraction of requests where the model returns a default fallback score rather than a live prediction - is a critical operational metric that is distinct from the error rate: it reflects cases where the model server is healthy but cannot produce a real prediction due to missing features or timeout on feature lookup.`,
  },
  {
    heading: 'Layer 3: Business Metrics',
    body: `Business metrics are the ultimate measure of model value. They answer the question that no accuracy metric can directly answer: is the model producing good outcomes for users and the company? They are also the most difficult layer to monitor correctly because they are delayed, noisy, and confounded by factors outside the model's control.

The specific metrics depend heavily on the product. In recommendation systems: click-through rate, watch time, save rate, and downstream conversion (purchase, subscription). In fraud detection: fraud loss rate per dollar processed, false positive rate (legitimate users blocked), customer escalation rate due to incorrect declines. In pricing: revenue per session, margin per transaction, cannibalization of organic behavior. In search ranking: NDCG at rank 5 and 10, query abandonment rate, zero-result rate. Each of these has a different lag from model change to observable impact. CTR can shift within 30 minutes of a model deploy. Revenue per session may take 48 to 72 hours to stabilize because user sessions span hours and purchase attribution can be delayed further.

Lag creates a structural problem for automated rollback decisions. A recommendation model change may show a negative CTR signal in the first hour of a canary due to novelty-aversion from users who were used to the old experience - and then recover to flat or positive over 24 hours. Automated rollback triggered by the 1-hour metric would kill a change that was actually net positive. The correct design is to use short-lag proxy metrics (add-to-cart rate, detail page view rate) as early signals for investigation, and only authorize automated rollback on infrastructure metrics like error rate and latency where the signal is fast, clean, and unambiguous. Business metrics are inputs to human-in-the-loop decisions.

Separating model impact from confounders requires a contemporaneous control group. A before-after comparison of business metrics is almost always misleading because the product environment, marketing activity, seasonal patterns, and user behavior change continuously. The correct comparison is treatment versus control during the same time window - a canary deployment with a holdout group receiving the old model simultaneously. This design, used by experimentation platforms at Airbnb, Netflix, and Lyft, allows clean attribution: the difference between treatment and control in the same window isolates the model's contribution from ambient environmental change. Maintaining an experiment change log that records every model deploy, product change, and marketing campaign allows post-hoc correlation analysis when anomalies appear in business metrics without a contemporaneous control.`,
  },
  {
    heading: 'Layer 4: Data Quality Metrics',
    body: `Data quality is frequently the root cause of model degradation that gets attributed to model drift or concept drift. When a feature pipeline fails, when a schema changes upstream, when a real-time feature store returns stale values, the model receives inputs that do not match what it was trained on - and produces degraded predictions as a result. In a study of ML incidents across several production systems, data quality failures were the leading cause of model performance regressions, more common than model-side bugs or genuine distribution shift.

Null rate per feature is the most sensitive leading indicator of pipeline failure. Most features have a stable null rate in production - a feature derived from user profile completeness might run at 2% null consistently. A sudden jump to 30% null indicates that the data source for that feature has partially failed or that a query is returning empty results for a new user segment. Track null rate as a time series per feature with an alert threshold calibrated to the historical mean plus three standard deviations. Null rate spikes should route to the data engineering team, not the ML team - they are infrastructure problems, not model problems.

Schema validation catches upstream changes before they propagate to model inputs. A column type change from int64 to string, a categorical feature acquiring a new value not seen in training, a timestamp format change - all of these cause silent prediction failures when the model's preprocessing code makes hard assumptions about column types. Great Expectations and dbt tests are the standard tools for schema validation at the pipeline level. Great Expectations allows you to define machine-readable expectations (column must be of type float64, values must be between 0 and 1, no null values allowed in critical columns) and enforce them at each pipeline stage. A Great Expectations validation failure at the ETL output blocks the pipeline job, preventing bad data from reaching the feature store.

Feature freshness monitoring is distinct from distribution monitoring and catches a class of failure that PSI cannot detect. A feature that is stale - its value has not been recomputed since the expected refresh interval - may have a distribution that looks perfectly normal because the stale values are from the last successful refresh. But the predictions are wrong because the feature no longer reflects current user behavior. For real-time recommendation and personalization models, freshness SLAs are as critical as accuracy SLAs. Track the timestamp of the last successful write for each feature in the feature store and alert when any critical feature's freshness lag exceeds the defined SLA - for example, alert if a feature that should refresh every 5 minutes has not been updated in 15 minutes.`,
  },
  {
    heading: 'SLO Design for ML Systems',
    body: `A Service Level Objective defines a target reliability or performance level for your system, expressed as a threshold on a metric over a time window. For ML systems, SLOs must span all four monitoring layers because each layer can fail in ways that the others do not capture. Well-defined SLOs also force explicit conversations about acceptable degradation levels before incidents occur, rather than during them.

Infrastructure SLOs are the most straightforward to define and enforce. Typical targets: P99 inference latency below 200ms measured over a rolling 5-minute window, model serving error rate below 0.1% over a rolling 1-hour window, service availability above 99.9% per month (allowing 43 minutes of downtime). These can be enforced with automated rollback: if error rate exceeds 0.5% for 2 consecutive minutes post-deploy, the canary is automatically rolled back. Prometheus AlertManager and PagerDuty Escalation Policies provide the infrastructure for this automation.

Model quality SLOs require more care because they involve labeled data with lag. Common targets: AUC must not drop more than 2 percentage points from the launch baseline measured over a 7-day rolling window of accumulated labels; ECE must stay below 0.05; PSI on the prediction score distribution must stay below 0.15 relative to the first-week baseline. These SLOs are evaluated by a scheduled batch job that runs daily, not by a real-time alert, because the labeled data needed to evaluate them is only available on a lag-appropriate schedule.

Error budgets formalize the relationship between SLOs and reliability investment. If your service has a 99.9% availability SLO, you have a monthly error budget of 0.1% of minutes - 43.2 minutes. When your error budget is fully consumed, new feature launches are paused until the budget resets, forcing investment in reliability. When the budget is healthy, the team can ship faster. Error budgets have been adopted beyond infrastructure at several ML teams: defining model quality error budgets (we can tolerate AUC degradations totaling X percentage-point-days per quarter before mandatory reliability sprint) aligns business expectations with technical reality and prevents the situation where a model is continuously degraded because there is no formal mechanism to enforce a quality floor.`,
  },
  {
    heading: 'Cascading Failures Across Layers',
    body: `Production ML failures rarely stay isolated in a single layer. A failure that originates in the data layer typically cascades to model quality and then to business metrics, following the dependency direction of the system. Understanding cascade patterns before an incident occurs allows faster diagnosis during one, because the investigator already has a mental model of which upstream layer to check when a downstream metric degrades.

The most common cascade pattern in ML systems is the data pipeline cascade. An ETL job fails or produces incorrect output at 2am. The feature store receives bad data for several features. Model predictions that depend on those features shift - in the common case, the model receives null or default values and falls back to prior-heavy predictions. PSI on the prediction score distribution rises. Business metrics - CTR, conversion, fraud loss rate - begin to drift 4 to 12 hours later as the bad predictions accumulate. By the time a business metric alert fires, the root cause is 12 hours in the past and the on-call team must reconstruct the cascade from logs.

Proper instrumentation at all four layers collapses this investigation to minutes. If null rate monitoring on the affected feature alerted at 2:05am when the pipeline job finished writing bad data, the on-call team is paged at the source with immediate root cause context: feature X null rate spiked from 1% to 45%. The data engineering team fixes the pipeline job and re-processes the affected window. No model action is needed. If the first alert was a business metric change at 2pm, the team spends hours tracing a cascading failure that could have been fixed in 20 minutes.

Infrastructure cascades follow the same pattern but move faster. A GPU memory leak causes gradual memory pressure increase over several hours. Memory pressure causes swap usage and cache eviction, increasing P99 latency from 80ms to 400ms. High P99 latency causes timeout errors in the calling service, which falls back to a default ranking policy. Default ranking policy degrades recommendation quality. CTR begins dropping. At Uber, the ML deployment safety system documented tracking online-offline prediction consistency as an additional cross-layer signal that detects both infrastructure degradations (serialization differences, preprocessing bugs that only appear at runtime) and data quality issues simultaneously - a single metric that bridges the infrastructure and model quality layers.`,
  },
  {
    heading: 'Alert Routing and Escalation',
    body: `Different monitoring layers should route alerts to different owning teams, because the skills and system access needed to diagnose and fix a failure are layer-specific. Infrastructure alerts require knowledge of Kubernetes, GPU drivers, and serving framework internals. Data quality alerts require knowledge of the ETL pipeline, feature store architecture, and upstream data sources. Model quality alerts require ML expertise, access to training pipelines, and understanding of the feature importance landscape. Business metric alerts require product context and often need leadership involvement for trade-off decisions.

Routing to the wrong team is a leading cause of slow mean time to resolution. An ML scientist paged on a null rate spike can investigate the model's sensitivity to that feature but cannot fix the upstream pipeline that caused the null rate spike. A data engineer paged on an AUC drop can look at feature distributions but does not have the context to determine whether the degradation warrants retraining or whether it is within expected variance for the model. Role clarity must be defined in a RACI matrix per alert type before launch, not negotiated during an incident when every minute of uncertainty extends downtime.

Escalation policy design should match the severity and pace of the failure. For P1 infrastructure alerts - model server down, error rate above 5%, complete unavailability - page the primary on-call immediately and auto-escalate to the secondary in 5 minutes if unacknowledged. For P2 model quality alerts - AUC drop above 3%, PSI on a top feature above 0.25 - page during business hours with a 15-minute acknowledgment window; automated rollback is not appropriate without human validation. For P3 data quality alerts - null rate above threshold on a non-critical feature, freshness lag above SLA on a secondary feature - post to Slack with a next-business-day resolution SLA. Most ML model quality degradations are P2 or P3, not P1: they degrade gradually rather than causing immediate outages, and automated rollback based on model quality metrics alone carries risk of oscillation (retraining, deploying, observing noise, rolling back, repeating).`,
  },
  {
    heading: 'Metric Lag and Attribution',
    body: `The lag between a model change and its observable effect on business metrics is one of the most underappreciated challenges in ML monitoring. Every business metric has a characteristic lag that is determined by the product's engagement cycle - the time between a model-driven decision and the outcome that reflects its quality. Misunderstanding lag causes both premature rollbacks (the metric looks bad but has not stabilized) and missed regressions (the metric looks fine because the lag extends beyond the monitoring window).

Click-through rate in a search or feed ranking system can shift within 30 minutes of a model deploy because user engagement with results is immediate. Purchase conversion rate has a lag of hours to days because users add items to carts, return later, and complete purchases on a separate session. Subscription conversion for a streaming service can lag weeks because trial periods and consideration cycles span that long. Credit default prediction outcomes lag months. The SLA for your canary monitoring window must be at minimum 2 to 3 times the expected lag for the primary business metric - otherwise you are making rollback decisions on incomplete data.

Proxy metrics with shorter lag are used to bridge the gap between deploy and stable business metric signal. For a recommendation model where the primary metric is 7-day retention (high lag), proxy metrics include: session CTR (minutes lag), detail page view rate (minutes lag), add-to-cart rate (hours lag). When the primary metric has not yet stabilized, the proxy metrics provide directional signal. The risk is that proxy metrics and primary metrics diverge: a change that increases CTR but decreases purchase conversion is a net negative change, but would appear positive if only the proxy is monitored. Define explicit relationships between proxy and primary metrics during experiment design, not during incident response.

Attribution - determining how much of a business metric change is caused by the model versus other factors - requires either a simultaneous control group or a causal inference technique. The most robust method is maintaining a holdout group on the previous model version while the new model is in canary. The difference in business metrics between canary and holdout, measured in the same time window, isolates the model's causal contribution from seasonality, marketing activity, product changes, and other confounders. Teams without a maintained holdout can use difference-in-differences analysis: compare the before-after change in the affected segment to the before-after change in an unaffected segment, using the unaffected segment as a counterfactual control.`,
  },
  {
    heading: 'Dashboarding Best Practices',
    body: `An effective ML monitoring dashboard surfaces the right signal to the right audience at the right level of detail. The most common failure in ML monitoring dashboards is consolidation: a single dashboard with 40 panels covering all four monitoring layers, intended to serve on-call engineers, ML scientists, and leadership simultaneously. In practice, it serves none of them well. On-call engineers need large-format status indicators with red/green state and P99 latency numbers. ML scientists need trend lines for AUC, calibration, and feature drift across days and weeks. Leadership needs week-over-week business metric comparisons expressed in business terms, not technical metrics.

The Grafana and Prometheus combination is the standard for infrastructure metrics in production ML systems. Grafana dashboards can display real-time P99 latency, error rate, GPU utilization, and pod health in a format optimized for rapid incident diagnosis. Alerts fire when Prometheus recording rules detect threshold violations, routing through Alertmanager to PagerDuty. For model quality and drift metrics, Grafana can ingest custom metrics emitted by the drift computation pipeline - computed by Evidently or WhyLogs and pushed to Prometheus or BigQuery - but the visualization needs differ: trend lines over days rather than real-time sparklines.

For model quality and data quality metrics, the dashboard design principle is trend visibility over point-in-time values. An AUC of 0.81 is meaningless without context: is it up from 0.79 last week (positive) or down from 0.84 three weeks ago (worrying trend)? Display 30-day rolling trend lines for all model quality metrics, with the launch baseline and the SLO threshold marked as reference lines. For drift metrics, display PSI as a heat map over features and time - columns are features, rows are time windows, color encodes PSI value. This allows a single glance to identify which features are drifting and whether the drift is recent or sustained.

The operational rule for dashboard maintenance is to treat dashboard panels like alert rules: review them quarterly and retire panels that no one has clicked through to investigate in 90 days. Dashboard sprawl - the accumulation of monitoring panels that made sense at launch but have never been used for diagnosis - erodes trust in the monitoring system. Engineers learn to ignore dashboards that are noisy or irrelevant. A dashboard with 8 highly actionable panels that engineers use during every incident is more valuable than a dashboard with 80 panels that is occasionally consulted for quarterly reviews.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are the four layers of ML monitoring and why does each matter?',
    keyPoints: [
      'Infrastructure (latency, errors, CPU), model quality (AUC, calibration, drift), business (CTR, conversion, revenue), data quality (nulls, schema, freshness)',
      'Each layer can fail independently - infra can be healthy while model degrades due to data drift',
      'Layers have different lag times: infra degrades in seconds, business metrics lag days',
      'Different layers route alerts to different owners',
    ],
    trap: 'Candidates often mention only model accuracy and infrastructure, omitting data quality - which is the most common root cause of silent degradation.',
  },
  {
    difficulty: 'junior',
    question: 'What infrastructure metrics would you monitor for a model serving endpoint?',
    keyPoints: [
      'P99 latency (not mean - mean masks tail issues)',
      'Error rate: 5xx, timeouts, OOM kills',
      'CPU/GPU utilization and memory pressure',
      'Request throughput vs expected traffic patterns',
      'Pod restart count as a crash-loop signal',
    ],
    trap: 'Monitoring P50 latency alone gives a false sense of health when P99 is degraded.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between model accuracy and model calibration? Why monitor both?',
    keyPoints: [
      'Accuracy/AUC measures discrimination - does the model rank positives above negatives',
      'Calibration measures probability correctness - does P(positive)=0.7 mean 70% actual positive rate',
      'A model can have high AUC but poor calibration, causing downstream systems using raw scores to behave incorrectly',
      'Calibration is especially important for risk, pricing, and auction systems that use raw probabilities',
    ],
    trap: 'Treating accuracy as the only model quality signal - calibration is critical for any system that uses predicted probabilities as inputs to a decision.',
  },
  {
    difficulty: 'junior',
    question: 'What data quality metrics should you monitor for ML features?',
    keyPoints: [
      'Null rate per feature - spikes indicate upstream pipeline failures',
      'Schema violations - type changes, unexpected categories, out-of-range values',
      'Volume anomalies - significantly fewer/more events than baseline',
      'Feature freshness / lag - time since last computation for streaming features',
    ],
    trap: 'Only monitoring whether the pipeline ran (success/failure) rather than the quality of the data it produced.',
  },
  {
    difficulty: 'junior',
    question: 'Why do business metrics lag behind model changes?',
    keyPoints: [
      'User behavior takes time to reflect in aggregated metrics',
      'Conversion cycles can span minutes to days depending on product',
      'Short-lag proxies (CTR) can be used as leading indicators',
      'Canary windows should be 2–3× the expected lag',
    ],
    trap: 'Using conversion or revenue as the rollback trigger for a real-time canary - by the time the metric moves, far too many users have been affected.',
  },
  {
    difficulty: 'mid',
    question: 'How would you design SLOs for a production ML model?',
    keyPoints: [
      'Infrastructure SLOs: P99 latency, error rate, availability',
      'Model quality SLOs: AUC drift bound, calibration error threshold, prediction distribution PSI',
      'Data quality SLOs: null rate, freshness lag per critical feature',
      'Define which SLO violations trigger automatic rollback vs human investigation',
      'Use error budgets to track cumulative reliability against annual targets',
    ],
    trap: 'Setting SLOs on mean latency or average accuracy - both mask tail behavior and sudden degradations.',
  },
  {
    difficulty: 'mid',
    question: 'A model\'s AUC dropped 3% but infrastructure metrics are healthy. What do you check first?',
    keyPoints: [
      'Check data quality layer first - null rate spike, schema change, feature distribution shift',
      'Check if a new data source or feature pipeline was changed recently',
      'Compute PSI on top features to detect distribution shift',
      'Check if the label distribution in eval data changed (label shift, not model regression)',
      'Look at the change log for data pipeline deploys in the 24–48h before the drop',
    ],
    trap: 'Immediately blaming the model or triggering a retrain without first ruling out data pipeline issues.',
  },
  {
    difficulty: 'mid',
    question: 'How do you distinguish a genuine model regression from noise in business metrics?',
    keyPoints: [
      'Use statistical significance testing - run t-test or Mann-Whitney on pre/post windows',
      'Compare to seasonality-adjusted baseline (same day last week/year)',
      'Look at correlated model quality metrics (AUC, prediction distribution) for confirmation',
      'Maintain a change log - correlate model deploys with metric movements',
      'Extend observation window before declaring regression - business metrics are noisy',
    ],
    trap: 'Triggering rollback on a business metric drop without checking whether the drop is statistically significant or within normal week-over-week variance.',
  },
  {
    difficulty: 'mid',
    question: 'Describe a cascading failure in an ML system and how you would instrument to catch it early.',
    keyPoints: [
      'Example: data pipeline bug → missing feature → model fallback → prediction shift → CTR drop',
      'Cascade direction is always: data quality → model quality → business metrics',
      'Catching at data layer is fastest: alert on null rate spike before model quality degrades',
      'Use intermediate signals (prediction distribution PSI) as leading indicators for business metrics',
      'Cross-layer correlation in dashboards helps trace root cause quickly',
    ],
    trap: 'Only instrumenting the final business metric and missing the opportunity to catch the root cause 2–3 layers upstream.',
  },
  {
    difficulty: 'mid',
    question: 'How would you set up alert routing for a four-layer ML monitoring system?',
    keyPoints: [
      'Infrastructure alerts → serving/platform team',
      'Model quality alerts → ML team',
      'Data quality alerts → data engineering team',
      'Business alerts → product/ML team with human-in-the-loop',
      'Define escalation paths and SLA for acknowledgment; document in runbooks before launch',
    ],
    trap: 'Routing all alerts to the ML team - data quality issues are usually owned by data engineering, and platform issues by SRE.',
  },
  {
    difficulty: 'mid',
    question: 'What is the difference between a lagging indicator and a leading indicator in ML monitoring? Give examples.',
    keyPoints: [
      'Lagging indicator: business metric that reflects model impact after a delay (revenue, conversion)',
      'Leading indicator: a fast-moving proxy that predicts business metric movement (CTR, click rate, prediction distribution)',
      'Data quality metrics are leading indicators for model quality metrics',
      'Model quality metrics are leading indicators for business metrics',
      'Design monitoring to alarm on leading indicators first to reduce MTTD',
    ],
    trap: 'Using lagging business metrics as the primary monitoring signal - by the time they move, significant user harm has already occurred.',
  },
  {
    difficulty: 'mid',
    question: 'Your model\'s prediction distribution shifted significantly overnight, but AUC is unchanged. What does this mean and what do you do?',
    keyPoints: [
      'Distribution shift without AUC change suggests input distribution shifted but the model still ranks correctly within the new distribution',
      'Could indicate covariate shift - the mix of users/requests changed (e.g., new geographic market)',
      'Downstream systems using raw scores (threshold-based decisions) may be badly affected even if AUC is fine',
      'Check calibration - if score distributions shifted, calibration may have degraded even if discrimination is preserved',
      'Investigate upstream: new traffic source, product change, feature pipeline change',
    ],
    trap: 'Concluding that everything is fine because AUC is stable - raw score shift can break downstream rule-based systems that use hard thresholds.',
  },
  {
    difficulty: 'senior',
    question: 'Design a complete monitoring system for a high-traffic recommendation model serving 50k RPS.',
    keyPoints: [
      'Infrastructure: Prometheus + Grafana for P50/P99/P999 per endpoint, GPU utilization, error rate, auto-rollback on SLO breach',
      'Model quality: streaming PSI on top-20 features, prediction distribution percentiles, AUC on sampled labeled data (1% label collection)',
      'Business: CTR, NDCG@10, revenue per session with 5-minute rollup; statistical significance test before alerting',
      'Data quality: schema enforcement at ingestion, null rate by feature by traffic segment, freshness SLA per feature tier',
      'Alerting: PagerDuty escalation chains, burn rate alerts for SLO budgets, inhibit business alerts when infra is down',
    ],
    trap: 'Designing an overly complex system that generates too many alerts - alert fatigue is as dangerous as no monitoring.',
  },
  {
    difficulty: 'senior',
    question: 'How do you attribute a business metric change to a specific model change vs other confounders?',
    keyPoints: [
      'Holdout experiment: keep a slice of traffic on the old model as control while the new model is in canary',
      'Difference-in-differences: compare canary vs control change relative to pre-launch baseline',
      'Covariate adjustment: control for known confounders (device type, geography, time of day) using regression',
      'Change log correlation: rule out simultaneous product/marketing changes',
      'Segment analysis: does the model change affect all segments equally or just specific cohorts?',
    ],
    trap: 'Using a simple before/after comparison without a contemporaneous control group - seasonality, marketing, and A/B test interactions all confound naive before/after analysis.',
  },
  {
    difficulty: 'senior',
    question: 'How do you build a monitoring system that is robust to seasonality (e.g., holiday traffic spikes)?',
    keyPoints: [
      'Compute thresholds relative to the same period in prior years/weeks, not absolute values',
      'Use percentage-of-baseline thresholds rather than fixed absolute thresholds',
      'Separate traffic volume anomaly detection from per-request quality metrics',
      'Maintain a calendar of expected anomalies (Black Friday, product launches) and pre-configure threshold relaxations',
      'Use Holt-Winters or Prophet-based anomaly detection for seasonal time series',
    ],
    trap: 'Using fixed absolute thresholds that fire every holiday because traffic naturally doubles - this trains on-call teams to ignore alerts.',
  },
  {
    difficulty: 'senior',
    question: 'A business metric dropped 8% after a model update but the model quality metrics look fine. Walk through your investigation.',
    keyPoints: [
      'Segment the business metric by user cohort, device, geography - is the drop concentrated or broad?',
      'Check if any model quality metric moved even slightly - small AUC changes can have large business impact at scale',
      'Verify the canary was properly randomized - selection bias in canary assignment can explain metric divergence',
      'Check data quality in the post-deploy window - did a feature pipeline change coincide with the model deploy?',
      'Review what "model quality metrics look fine" actually means - which metrics, on what eval set, with what label lag?',
    ],
    trap: 'Immediately reverting without diagnosing root cause - the 8% drop might be a measurement artifact, a coincident product change, or a selection bias in the canary.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle monitoring for a model that has 2-week label lag (e.g., credit default prediction)?',
    keyPoints: [
      'Use proxy metrics available sooner: application completion rate, feature coverage, prediction distribution stability',
      'Monitor calibration on early-return labels (e.g., immediate declines, obvious fraud)',
      'Run offline shadow evaluation: replay recent production requests through the new model and compare to the old model on held-out historical data',
      'Use a population-level approach: compare prediction score distribution to historical labeled cohorts with similar features',
      'Set longer canary windows - 2–4 weeks before full promotion for high-lag models',
    ],
    trap: 'Waiting for ground truth labels before monitoring anything - by the time labels arrive, weeks of bad predictions have already been made.',
  },
  {
    difficulty: 'junior',
    question: 'What is the purpose of monitoring prediction distribution (not just accuracy)?',
    keyPoints: [
      'Distribution shift is detectable immediately - accuracy requires ground truth labels which lag',
      'Score distribution change indicates the model is behaving differently even if AUC is unknown yet',
      'PSI on prediction scores is a fast, label-free early warning signal',
      'Sudden clumping of scores near 0 or 1 may indicate feature preprocessing bugs',
    ],
    trap: 'Ignoring score distribution monitoring and waiting for labeled data to compute AUC - by then, the bad predictions have already been served.',
  },
  {
    difficulty: 'mid',
    question: 'How do you design dashboards for different stakeholders in an ML monitoring system?',
    keyPoints: [
      'On-call engineers: P99 latency, error rate, alert count - large numbers, red/green status',
      'ML scientists: AUC trend, prediction distribution, top features by drift - trend lines over time',
      'Leadership: business metrics, revenue index, model contribution estimate - week-over-week comparisons',
      'Avoid dashboard sprawl - too many panels cause on-call engineers to ignore dashboards',
      'Group by layer, hide secondary metrics by default, surface only actionable signals',
    ],
    trap: 'Building a single dashboard with 40+ metrics for all audiences - on-call engineers need a different view than ML researchers.',
  },
  {
    difficulty: 'senior',
    question: 'How would you quantify the business impact of a 1% increase in model AUC?',
    keyPoints: [
      'Run a controlled A/B experiment - compare conversion/revenue between old and new model at the same traffic split',
      'Use observational causal inference if A/B is not possible: diff-in-diff or synthetic control',
      'Build a sensitivity model: how much does each 1% AUC gain translate to CTR/conversion in your historical data?',
      'Segment by decision tier - high-AUC gain may only matter at the decision boundary (threshold ± 0.05)',
      'Account for cannibalization and halo effects when computing incremental lift',
    ],
    trap: 'Assuming AUC and business metrics are linearly correlated - the relationship is highly nonlinear and depends on the operating threshold, user population, and product design.',
  },
];
