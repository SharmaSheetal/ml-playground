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
    body: `A single metric cannot tell you why a model is misbehaving. Infrastructure metrics tell you whether the serving stack is healthy. Model quality metrics tell you whether predictions are accurate. Business metrics tell you whether the model is producing value. Data quality metrics tell you whether the inputs are trustworthy.

Each layer can fail independently. A model can have perfect infrastructure health and still degrade in accuracy because of data drift. A model can have high accuracy and still hurt revenue because it optimizes the wrong objective. Instrumenting all four layers gives you both fast detection (infra degrades in seconds) and deep diagnosis (data quality explains the root cause).`,
  },
  {
    heading: 'Layer 1: Infrastructure Metrics',
    body: `Infrastructure metrics measure the serving stack — not the model's behavior.

  • CPU / GPU utilization: high utilization increases queuing latency
  • Memory pressure: swap causes unpredictable tail latency spikes
  • P50 / P95 / P99 latency: set SLOs on P99, not mean
  • Throughput (RPS): compare to expected traffic patterns
  • Error rate: 5xx responses from the model server, timeouts, OOM kills
  • Pod restarts: crash loops indicate memory or config problems

Infrastructure metrics degrade fast — within seconds of a bad deploy. They are the first layer to alarm. If infra is healthy but model quality degrades, look at data and model layers.`,
  },
  {
    heading: 'Layer 2: Model Quality Metrics',
    body: `Model quality metrics measure whether predictions are accurate and well-calibrated. Unlike business metrics, they can be computed offline on labeled data or online via held-out label collection.

  • AUC-ROC: discrimination ability — does the model rank positives above negatives?
  • Calibration error (ECE): does predicted probability 0.7 correspond to actual 70% positive rate?
  • Prediction distribution: are score distributions stable day over day? Sudden shift indicates drift.
  • Null / default prediction rate: % of requests where the model returns a fallback score
  • Feature coverage: % of requests missing key features

Model quality metrics change over days to weeks (except after a bad deploy). They require labeled data, which creates lag — you often don't have ground truth for days or weeks after the decision.`,
  },
  {
    heading: 'Layer 3: Business Metrics',
    body: `Business metrics measure whether the model produces value for users and the company. They are the ultimate north star — everything else is a proxy.

  • Click-through rate (CTR): did users engage with model-driven content?
  • Conversion rate: did engagement lead to the desired action?
  • Revenue per request: direct dollar impact attributable to the model
  • User complaints and escalations: qualitative signal of bad predictions
  • Churn or cancellation rate: longer-lag metric that captures sustained degradation

Business metrics are the most meaningful but also the most lagged — a recommendation model change may take 48–72 hours to show in revenue. They are also noisy (affected by marketing, seasonality, product changes). Do not set tight thresholds on business metrics for automated rollback; use them for human-in-the-loop decisions.`,
  },
  {
    heading: 'Layer 4: Data Quality Metrics',
    body: `Data quality metrics measure whether model inputs are trustworthy. A perfect model on corrupted inputs produces bad predictions. Data quality is often the root cause when other layers degrade.

  • Null rate per feature: sudden spikes indicate upstream pipeline failures
  • Schema violations: field type changes, unexpected categories, out-of-range values
  • Volume anomalies: significantly fewer or more events than expected
  • Feature freshness / lag: time since the feature was last computed
  • Training-serving skew: distribution difference between training data and live traffic

Data quality failures often cascade — a missing feature causes fallback logic, which changes prediction distributions, which eventually degrades business metrics. Catching it at the data layer is the fastest path to diagnosis.`,
  },
  {
    heading: 'SLO Design for ML Systems',
    body: `A Service Level Objective (SLO) is a target for how reliable or performant your system must be. For ML systems, SLOs span all four layers.

Infrastructure SLOs: P99 latency < 200ms, error rate < 0.1%, availability 99.9%.

Model quality SLOs: AUC must not drop more than 2% from baseline over a 7-day rolling window, calibration error < 0.05, prediction drift PSI < 0.2.

Data quality SLOs: null rate < 1% per critical feature, freshness lag < 5 minutes for real-time features.

The key design question is: which SLO violations trigger automatic rollback vs human investigation? Infra SLOs (fast, objective) are good candidates for automation. Business SLOs (slow, noisy) are better for human-in-the-loop.`,
  },
  {
    heading: 'Cascading Failures Across Layers',
    body: `Failures often cascade from one layer to another. Understanding the cascade direction helps prioritize which metrics to check first.

Cascade direction: data quality → model quality → business metrics. Infrastructure failures can also cascade — a latency spike causes timeouts, which cause fallback responses, which degrade model quality metrics.

Example: a feature pipeline bug (data quality) causes a key feature to be missing. The model falls back to a default value, shifting the prediction distribution (model quality metric changes). Over 48 hours, CTR drops (business metric). Instrumenting all four layers lets you catch this at the data layer — the earliest and cheapest point to fix.

Root cause analysis order: when a business metric alarms, first check data quality, then model quality, then infrastructure. Do not assume the model itself is wrong until you have ruled out upstream data issues.`,
  },
  {
    heading: 'Alert Routing and Escalation',
    body: `Different layers should route to different owners. Infrastructure alerts go to the serving/platform team. Model quality alerts go to the ML team. Data quality alerts go to the data engineering team. Business alerts go to the product or ML team.

Unclear ownership is a major cause of slow MTTR. Define a RACI matrix per layer before you launch. The "who gets paged first" question should be answered in a runbook, not during an incident.

Escalation paths: if P1 infra alert is not acknowledged in 5 minutes, escalate to on-call manager. If model quality degrades for 30 minutes without a fix, trigger a canary rollback. Automate what you can — human escalation is slow and error-prone at 3am.`,
  },
  {
    heading: 'Metric Lag and Attribution',
    body: `Business metrics lag behind model changes. The lag depends on the product: search results affect CTR within minutes; recommendation-driven purchases may take 24–72 hours to manifest.

Lag creates false negatives. A bad model may not show a business metric drop during the initial canary window, then cause a large drop at scale.

Mitigation strategies:
  • Use shorter-lag proxies (CTR instead of conversion, clicks instead of revenue)
  • Extend canary observation windows to 2–3× the expected lag
  • Use offline evaluation (A/B test on held-out data) to predict business impact before launch
  • Instrument intermediate actions (add-to-cart, detail-page view) as leading indicators

Attribution is also hard — a drop in revenue during a model rollout might be caused by a product change, a marketing campaign ending, or a holiday. Maintain a change log and correlate model changes with business metric movements.`,
  },
  {
    heading: 'Dashboarding Best Practices',
    body: `An effective ML monitoring dashboard surfaces the right information for each audience — an on-call engineer needs a different view than an ML scientist.

For on-call: P99 latency, error rate, alert count. Large numbers, red/green status, sorted by severity.

For ML teams: prediction distribution over time, AUC trend, top features by drift score. Trend lines, not point-in-time values.

For leadership: business metrics (CTR, revenue index), comparison to prior period, model contribution estimate.

Tooling: Grafana + Prometheus for infrastructure; custom dashboards with BigQuery or Snowflake for model quality and business metrics; Evidently or Arize for drift-specific views.

Avoid dashboard sprawl — too many panels cause alert fatigue for humans looking at dashboards. Group metrics by layer, hide secondary metrics by default, and surface only the most actionable signals.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are the four layers of ML monitoring and why does each matter?',
    keyPoints: [
      'Infrastructure (latency, errors, CPU), model quality (AUC, calibration, drift), business (CTR, conversion, revenue), data quality (nulls, schema, freshness)',
      'Each layer can fail independently — infra can be healthy while model degrades due to data drift',
      'Layers have different lag times: infra degrades in seconds, business metrics lag days',
      'Different layers route alerts to different owners',
    ],
    trap: 'Candidates often mention only model accuracy and infrastructure, omitting data quality — which is the most common root cause of silent degradation.',
  },
  {
    difficulty: 'junior',
    question: 'What infrastructure metrics would you monitor for a model serving endpoint?',
    keyPoints: [
      'P99 latency (not mean — mean masks tail issues)',
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
      'Accuracy/AUC measures discrimination — does the model rank positives above negatives',
      'Calibration measures probability correctness — does P(positive)=0.7 mean 70% actual positive rate',
      'A model can have high AUC but poor calibration, causing downstream systems using raw scores to behave incorrectly',
      'Calibration is especially important for risk, pricing, and auction systems that use raw probabilities',
    ],
    trap: 'Treating accuracy as the only model quality signal — calibration is critical for any system that uses predicted probabilities as inputs to a decision.',
  },
  {
    difficulty: 'junior',
    question: 'What data quality metrics should you monitor for ML features?',
    keyPoints: [
      'Null rate per feature — spikes indicate upstream pipeline failures',
      'Schema violations — type changes, unexpected categories, out-of-range values',
      'Volume anomalies — significantly fewer/more events than baseline',
      'Feature freshness / lag — time since last computation for streaming features',
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
    trap: 'Using conversion or revenue as the rollback trigger for a real-time canary — by the time the metric moves, far too many users have been affected.',
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
    trap: 'Setting SLOs on mean latency or average accuracy — both mask tail behavior and sudden degradations.',
  },
  {
    difficulty: 'mid',
    question: 'A model\'s AUC dropped 3% but infrastructure metrics are healthy. What do you check first?',
    keyPoints: [
      'Check data quality layer first — null rate spike, schema change, feature distribution shift',
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
      'Use statistical significance testing — run t-test or Mann-Whitney on pre/post windows',
      'Compare to seasonality-adjusted baseline (same day last week/year)',
      'Look at correlated model quality metrics (AUC, prediction distribution) for confirmation',
      'Maintain a change log — correlate model deploys with metric movements',
      'Extend observation window before declaring regression — business metrics are noisy',
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
    trap: 'Routing all alerts to the ML team — data quality issues are usually owned by data engineering, and platform issues by SRE.',
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
    trap: 'Using lagging business metrics as the primary monitoring signal — by the time they move, significant user harm has already occurred.',
  },
  {
    difficulty: 'mid',
    question: 'Your model\'s prediction distribution shifted significantly overnight, but AUC is unchanged. What does this mean and what do you do?',
    keyPoints: [
      'Distribution shift without AUC change suggests input distribution shifted but the model still ranks correctly within the new distribution',
      'Could indicate covariate shift — the mix of users/requests changed (e.g., new geographic market)',
      'Downstream systems using raw scores (threshold-based decisions) may be badly affected even if AUC is fine',
      'Check calibration — if score distributions shifted, calibration may have degraded even if discrimination is preserved',
      'Investigate upstream: new traffic source, product change, feature pipeline change',
    ],
    trap: 'Concluding that everything is fine because AUC is stable — raw score shift can break downstream rule-based systems that use hard thresholds.',
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
    trap: 'Designing an overly complex system that generates too many alerts — alert fatigue is as dangerous as no monitoring.',
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
    trap: 'Using a simple before/after comparison without a contemporaneous control group — seasonality, marketing, and A/B test interactions all confound naive before/after analysis.',
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
    trap: 'Using fixed absolute thresholds that fire every holiday because traffic naturally doubles — this trains on-call teams to ignore alerts.',
  },
  {
    difficulty: 'senior',
    question: 'A business metric dropped 8% after a model update but the model quality metrics look fine. Walk through your investigation.',
    keyPoints: [
      'Segment the business metric by user cohort, device, geography — is the drop concentrated or broad?',
      'Check if any model quality metric moved even slightly — small AUC changes can have large business impact at scale',
      'Verify the canary was properly randomized — selection bias in canary assignment can explain metric divergence',
      'Check data quality in the post-deploy window — did a feature pipeline change coincide with the model deploy?',
      'Review what "model quality metrics look fine" actually means — which metrics, on what eval set, with what label lag?',
    ],
    trap: 'Immediately reverting without diagnosing root cause — the 8% drop might be a measurement artifact, a coincident product change, or a selection bias in the canary.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle monitoring for a model that has 2-week label lag (e.g., credit default prediction)?',
    keyPoints: [
      'Use proxy metrics available sooner: application completion rate, feature coverage, prediction distribution stability',
      'Monitor calibration on early-return labels (e.g., immediate declines, obvious fraud)',
      'Run offline shadow evaluation: replay recent production requests through the new model and compare to the old model on held-out historical data',
      'Use a population-level approach: compare prediction score distribution to historical labeled cohorts with similar features',
      'Set longer canary windows — 2–4 weeks before full promotion for high-lag models',
    ],
    trap: 'Waiting for ground truth labels before monitoring anything — by the time labels arrive, weeks of bad predictions have already been made.',
  },
  {
    difficulty: 'junior',
    question: 'What is the purpose of monitoring prediction distribution (not just accuracy)?',
    keyPoints: [
      'Distribution shift is detectable immediately — accuracy requires ground truth labels which lag',
      'Score distribution change indicates the model is behaving differently even if AUC is unknown yet',
      'PSI on prediction scores is a fast, label-free early warning signal',
      'Sudden clumping of scores near 0 or 1 may indicate feature preprocessing bugs',
    ],
    trap: 'Ignoring score distribution monitoring and waiting for labeled data to compute AUC — by then, the bad predictions have already been served.',
  },
  {
    difficulty: 'mid',
    question: 'How do you design dashboards for different stakeholders in an ML monitoring system?',
    keyPoints: [
      'On-call engineers: P99 latency, error rate, alert count — large numbers, red/green status',
      'ML scientists: AUC trend, prediction distribution, top features by drift — trend lines over time',
      'Leadership: business metrics, revenue index, model contribution estimate — week-over-week comparisons',
      'Avoid dashboard sprawl — too many panels cause on-call engineers to ignore dashboards',
      'Group by layer, hide secondary metrics by default, surface only actionable signals',
    ],
    trap: 'Building a single dashboard with 40+ metrics for all audiences — on-call engineers need a different view than ML researchers.',
  },
  {
    difficulty: 'senior',
    question: 'How would you quantify the business impact of a 1% increase in model AUC?',
    keyPoints: [
      'Run a controlled A/B experiment — compare conversion/revenue between old and new model at the same traffic split',
      'Use observational causal inference if A/B is not possible: diff-in-diff or synthetic control',
      'Build a sensitivity model: how much does each 1% AUC gain translate to CTR/conversion in your historical data?',
      'Segment by decision tier — high-AUC gain may only matter at the decision boundary (threshold ± 0.05)',
      'Account for cannibalization and halo effects when computing incremental lift',
    ],
    trap: 'Assuming AUC and business metrics are linearly correlated — the relationship is highly nonlinear and depends on the operating threshold, user population, and product design.',
  },
];
