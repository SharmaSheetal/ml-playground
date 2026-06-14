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
    heading: 'Alerting Is a Classification Problem',
    body: `Every alert system is performing binary classification on a continuous stream of signals: given the current metric value, should this fire a page or not? Making this framing explicit gives you the correct vocabulary and tools to reason about alert system design. The metric value is your feature. The threshold is your decision boundary. True positives are pages that correspond to real incidents. False positives are pages with no corresponding incident - the on-call engineer wakes up for nothing. False negatives are real incidents that produce no page. True negatives are metric values within normal range that correctly do not page.

This framing immediately clarifies the key design tension. Lowering your threshold increases recall (you catch more real incidents) at the cost of precision (more of your pages are false alarms). Raising your threshold improves precision (fewer false alarms) at the cost of recall (some real incidents are missed). The optimal operating point on this precision-recall curve depends entirely on the asymmetric cost of false positives versus false negatives in your specific context. A payments fraud model where a missed detection costs tens of thousands of dollars per minute needs a very different threshold than a content recommendation model where a 2% CTR regression costs a few thousand dollars per day.

The key insight that many teams miss is that the cost of a false positive is not just the time spent investigating the false alarm. It is also the erosion of trust in the alerting system. When engineers learn that 70% of pages are false alarms, they develop a habit of assuming each new page is also a false alarm - and eventually they stop investigating promptly. The next real incident then goes undetected for longer precisely because the alerting system lost its credibility. This makes false positive cost nonlinear: a false positive rate above some threshold (SRE literature suggests around 30%) triggers a qualitative shift in engineer behavior that multiplies the impact of each subsequent false positive.`,
  },
  {
    heading: 'False Positive Cost vs False Negative Cost',
    body: `Quantifying the cost of false positives and false negatives is the foundational step in calibrating alert thresholds, and it is a business decision that cannot be made by the ML or SRE team alone. The ML team can provide the precision-recall curve - showing how false positive rate and false negative rate vary across thresholds - but the choice of operating point requires input from business stakeholders who know the cost of an undetected incident versus the cost of a wasted engineer investigation.

The cost of a false positive is composed of several components: the direct time cost of the on-call engineer's investigation (typically 30 to 90 minutes for a thorough false alarm investigation), the opportunity cost of interrupting high-focus engineering work or sleep, and the cumulative trust erosion cost described above. At many companies, a reasonable estimate for the direct cost of a false positive is $200 to $500 in engineer time. But the trust erosion component is harder to quantify: a 30% false positive rate might reduce effective alerting response speed by a factor of 2 to 3, which multiplies the cost of every subsequent real incident.

The cost of a false negative depends on the system. For a fraud detection model with a false negative, the cost is the fraud loss that occurs during the period between when the model should have been caught and when the problem was eventually detected through other means. For a recommendation model, it is the revenue opportunity lost during the silent degradation period - often quantified as (traffic volume) times (revenue per request) times (AUC drop percentage) times (detection delay in hours). For a safety-critical system in healthcare or autonomous vehicles, false negatives can have non-financial costs that dwarf any financial calculation.

The practical formula for the optimal threshold is: minimize the expected cost = (false positive rate) * (cost per false positive) + (false negative rate) * (cost per false negative). This is a standard decision theory result. In practice, rather than computing exact costs, teams often use cost ratios: "a missed incident costs us 20x what a false alarm costs" implies operating at the threshold where the false negative rate is 20x lower than the false positive rate. Presenting the precision-recall curve to leadership with the estimated cost ratio marked on it turns threshold calibration into a legible business decision.`,
  },
  {
    heading: 'Alert Fatigue - The Biggest Risk',
    body: `Alert fatigue is the systematic degradation of an on-call team's response quality caused by chronic exposure to high volumes of low-signal alerts. SRE literature from Google, PagerDuty, and Atlassian consistently identifies alert fatigue as one of the primary contributors to extended mean time to resolution in production incidents, because the psychological and operational mechanisms it triggers directly impair the response to real incidents.

The mechanism works through learned association. When engineers respond to 20 alerts per day and 18 of them are false positives, they learn - rationally - that the prior probability that any given page represents a real problem is low. They begin optimizing their response protocol accordingly: acknowledging pages more quickly (to stop the phone from ringing) without beginning substantive investigation, skimming runbooks rather than following them, and escalating lower-confidence decisions upward rather than investing in root cause analysis. These adaptations are individually rational responses to a high-false-positive environment, but collectively they increase mean time to resolution when a real incident occurs.

The operational signatures of alert fatigue are identifiable before they cause a major incident: alert acknowledgment times are fast but investigation times are short (engineers click "acknowledge" immediately but close the alert 2 minutes later without following the runbook); Slack or incident communication shows comments like "false alarm again" without documented verification; incidents are increasingly discovered by user reports or by downstream teams rather than by the alerting system; the on-call team routinely requests alert silences or threshold increases rather than root cause investigation of recurring alerts.

Prevention requires treating alert quality as a first-class operational metric. Track alert-to-incident conversion rate (what fraction of pages lead to documented incidents with remediation actions taken) as a weekly metric per team. Target 80 percent or above. When the conversion rate drops below 60 percent, the team should enter an alert reduction sprint: audit all active alert rules, retire rules with zero true positives in 90 days, add minimum observation windows to rules that fire on transient spikes, and group correlated rules that fire from the same root cause into a single page. The goal is not to minimize alert volume - it is to maximize the information content of each page.`,
  },
  {
    heading: 'Threshold Calibration Techniques',
    body: `Static fixed thresholds - alert if metric exceeds some absolute value - are the simplest to implement but the least robust in production. Their fundamental limitation is that they do not adapt to changes in the baseline behavior of the system they monitor. If your model serving latency baseline is 40ms in normal operation and you set an alert threshold at 200ms, this is reasonable today. After a product launch that doubles request complexity and pushes baseline latency to 90ms, the 200ms threshold produces chronic false positives at the new normal level - or alternatively, you raise it to 350ms, which then misses genuine regressions that push latency to 250ms.

Percentile-based thresholds address baseline adaptation by anchoring the threshold to historical behavior of the metric itself. Compute the 99th or 99.9th percentile of the metric over a reference window - typically 30 to 90 days of stable operation, excluding known incident periods. Alert when the current value exceeds this historical percentile. This self-adjusts the threshold to the system's actual behavior rather than to an engineer's estimate of normal. The limitation is that it adapts slowly: a genuine step-change in baseline behavior (a permanent traffic increase after a product launch) will suppress alerts for 30 days while the historical window catches up, potentially missing legitimate regressions during that period.

Standard deviation thresholds - alert when the metric exceeds mean plus k standard deviations - are theoretically grounded in Gaussian statistics but practically unreliable for most production ML metrics. Latency, error rate, and prediction scores are all right-skewed and heavy-tailed. For a metric with a lognormal distribution (common for latency), the standard deviation is dominated by the tail and the Gaussian model dramatically underestimates the probability of extreme values. Setting k=3 assuming Gaussian behavior gives a theoretical 0.3% false positive rate, but on lognormal latency data, the actual false positive rate may be 5 to 10 times higher. Use percentile-based thresholds rather than sigma-based thresholds for any metric that is not demonstrably Gaussian.

Rolling baseline thresholds - comparing the current value to the same metric in the same time window one week or one year ago - are highly effective for metrics with strong seasonal or day-of-week patterns. An e-commerce model naturally has higher traffic on weekends and higher prediction volume on Wednesday evenings than Saturday mornings. Comparing Sunday afternoon to Saturday morning baselines will produce chronic false positives. Comparing Sunday afternoon to the prior Sunday afternoon baseline produces a clean signal that automatically accounts for weekly patterns. Prophet and Holt-Winters exponential smoothing are commonly used for time series baseline modeling in this context, used by teams at Twitter, Airbnb, and Meta for infrastructure anomaly detection.`,
  },
  {
    heading: 'Composite Alerts and Multi-Signal Fusion',
    body: `Single-metric thresholds generate excessive false positives because individual metrics are noisy and frequently cross thresholds due to unrelated transient causes. Composite alerts require multiple independent signals to be in an anomalous state simultaneously before paging, which dramatically improves precision while accepting a modest increase in detection latency.

AND-logic composite alerts require all specified conditions to be simultaneously true. An example for a fraud model: alert if (fraud score distribution PSI > 0.25) AND (prediction volume is within normal range) AND (model latency is below SLO). This structure filters out alerts caused by data pipeline volume anomalies (PSI spikes when volume drops severely but the model is fine), alerts during latency incidents (where prediction behavior changes are caused by infrastructure, not model issues), and alerts from known seasonal drift (volume outside normal range on holidays). The cost of AND logic is reduced recall: if only one of the required conditions triggers during a real incident, the composite alert will not fire. This is acceptable when the conditions are logically connected and should co-occur in genuine incidents.

OR-logic composites are appropriate when any one of multiple independent symptoms is sufficient evidence of a problem. An example: alert if (null rate on critical feature A > 5%) OR (null rate on critical feature B > 5%) OR (feature freshness lag for feature C > 15 minutes). Each condition independently represents a data quality failure that should trigger investigation. OR-logic is more sensitive but noisier - use it when each individual condition has been validated to produce high-signal alerts on its own.

Alert inhibition is a critical complement to composite alerts. It defines a suppression relationship between a root cause alert and dependent downstream alerts. If the feature store is paged for unavailability, the model's null rate alerts should be automatically inhibited - the null rate spike is caused by the feature store outage, not by an independent data quality issue, and paging the ML team and data engineering team simultaneously on the same root cause is noise. Prometheus Alertmanager has native inhibition rule support. PagerDuty supports alert dependencies. Defining inhibition rules requires knowing your service dependency graph - which monitoring components depend on which infrastructure components - and this dependency graph should be documented and maintained as part of the monitoring infrastructure.`,
  },
  {
    heading: 'Time-Based Thresholds and Seasonality',
    body: `A metric threshold appropriate for 2pm on a Tuesday is often entirely inappropriate for 3am on a Saturday. Production ML systems exhibit strong temporal patterns driven by user behavior cycles: daily peaks and troughs, weekly day-of-week patterns, monthly and annual seasonal cycles, and event-driven spikes from product launches or external events. Alert thresholds that ignore these patterns produce either chronic false positives during predictable high-traffic periods or missed detections during predictable low-traffic periods.

Day-of-week and time-of-day patterns are the most common source of threshold miscalibration. A recommendation model that serves 500k RPS at peak Tuesday afternoon and 80k RPS at 4am Saturday will have very different absolute metric values for error rate, latency distribution, and prediction volume at those two times. An absolute threshold calibrated for Tuesday peak will miss genuine problems on Saturday night when traffic is low and an absolute error count of 200 is actually a 0.25% error rate - far above the SLO. The fix is to express thresholds as rates and percentages rather than absolute counts wherever possible, and to use time-segmented baselines for metrics where even rates shift significantly.

Planned event management is a distinct problem from seasonal adaptation. Black Friday, Cyber Monday, the Super Bowl, major product launches, and marketing campaign activations all produce predictable traffic spikes that will fire static thresholds. The operationally immature response is to silence all alerts for the event duration - this creates coverage gaps where real incidents during the event go undetected and training engineers to treat alert silencing as the correct preparation for high-traffic events. The correct approach is to pre-configure threshold relaxations as first-class monitoring configuration that takes effect for the event window and automatically reverts afterward.

Relative thresholds handle most temporal variation automatically. Instead of alerting when traffic drops below 400k RPS (an absolute threshold calibrated to peak), alert when traffic drops more than 25% from the same 30-minute window one week ago. This comparison automatically accounts for weekly patterns, event-driven spikes (if last week also had an event), and secular growth trends. The limitation is that relative thresholds require at least one full baseline period of stable operation before they can be used, making them unavailable for new services or for services that experienced incidents in the reference window. For new services, start with generous absolute thresholds and progressively tighten them as you accumulate baseline data.`,
  },
  {
    heading: 'MTTD and MTTR - Detection and Recovery Time',
    body: `Mean Time to Detection and Mean Time to Resolution are the two primary operational metrics for evaluating alert system performance, and the tension between them defines the core threshold calibration tradeoff. MTTD measures how long after an incident starts until an alert fires and an engineer is engaged. MTTR measures how long from the first page until the service is restored to normal. Both matter for minimizing the total user impact of an incident: total impact is proportional to (incident severity) times (MTTR), and MTTR = detection_lag + investigation_time + remediation_time.

Alert threshold choice directly controls MTTD. A tight threshold (alert on small deviations from baseline) detects incidents faster - lower MTTD - but generates more false positives because small deviations are common in normal operation. A loose threshold (alert only on large deviations) generates fewer false positives but increases MTTD because the incident must grow to a larger magnitude before detection. For ML systems, the appropriate balance is different from infrastructure systems: most model quality regressions are gradual rather than catastrophic, the cost per minute of a model degradation is usually lower than the cost per minute of a full service outage, and the false positive cost (alert fatigue erosion of on-call response quality) is relatively higher. This justifies tolerating longer MTTD - 15 to 30 minutes is typically acceptable for model quality alerts - in exchange for false positive rates below 10 to 15 percent.

Minimum observation windows directly reduce false positives caused by transient metric spikes without meaningfully increasing MTTD for sustained incidents. Requiring that a threshold be exceeded for 5 consecutive minutes before firing an alert eliminates pages caused by 30-second spikes, random fluctuations, and single-query outliers that would otherwise trigger the alert. A 5-minute minimum window adds at most 5 minutes to MTTD for real incidents - typically acceptable - while eliminating a large fraction of false positives caused by transient noise. For ML model quality metrics, where degradations are gradual rather than instantaneous, minimum windows of 15 to 30 minutes are often appropriate.

MTTR is primarily a function of runbook quality and escalation policy design, not of threshold choice. An alert that fires promptly but routes to the wrong team, lacks context about likely root causes, or has no pre-approved remediation steps (rollback, pipeline restart, cache flush) will have high MTTR regardless of detection speed. The most impactful investments in MTTR are: writing detailed, verified runbooks with specific commands for each alert type; defining automated remediation actions (model rollback on error rate SLO breach) that execute before a human is even paged; and maintaining a change log that on-call engineers can consult during investigation to correlate the incident timing with recent deploys.`,
  },
  {
    heading: 'Burn Rate Alerts - SLO-Based Alerting',
    body: `Burn rate alerting, introduced in the Google SRE Workbook and now widely adopted in production infrastructure and ML systems, solves a fundamental problem with threshold-based alerting: it fails to distinguish between a brief severe incident and a sustained moderate degradation, even though both can exhaust the same reliability budget over time. A fraud model that has 2% error rate for 4 hours consumes the same error budget as one that has 0.2% error rate for 40 hours - but threshold-based alerting behaves very differently for these two scenarios.

An error budget is the complement of an SLO. If your model has a 99.9% availability SLO, the error budget over a 30-day month is 0.1% of requests - approximately 43 minutes of complete unavailability, or a proportionally larger volume of partial errors. Burn rate measures how fast you are consuming this error budget relative to the rate at which it sustainably replenishes. A burn rate of 1.0 means you are consuming the budget exactly at the rate that allows you to finish the month with zero budget remaining. A burn rate of 14.4 means you are consuming the monthly budget 14.4 times faster than sustainable - at this rate, a 30-day budget would be exhausted in approximately 2 days.

The multi-window burn rate alert, recommended in the Google SRE Workbook, uses two simultaneous conditions to catch both fast-burning and slow-burning incidents while avoiding false positives from transient spikes. The recommended thresholds for a 30-day SLO: alert if (burn rate over the past 1 hour > 14.4x) AND (burn rate over the past 5 minutes > 14.4x). The 1-hour window ensures the alert reflects a sustained issue, not a transient spike. The 5-minute window ensures the issue is still active, not already resolved. For slower burns, a second alert tier: burn rate over 6 hours > 6x AND burn rate over 30 minutes > 6x. The 6x threshold over 6 hours means the monthly budget would be exhausted in 5 days - serious but not catastrophic, warranting investigation during business hours rather than an immediate 3am page.

Burn rate alerts have a significant advantage over fixed threshold alerts for ML model quality metrics: they automatically scale with the SLO target. If you improve your SLO from 99.9% to 99.95%, the burn rate alert automatically becomes more sensitive without threshold reconfiguration. They also scale with traffic volume: a 14.4x burn rate during high-traffic periods is just as meaningful as a 14.4x burn rate during low-traffic periods, whereas an absolute error count threshold produces chronic false positives when traffic doubles.`,
  },
  {
    heading: 'Reducing Alert Fatigue - Grouping, Deduplication, Silencing',
    body: `Alert grouping, deduplication, and inhibition are the operational mechanisms for ensuring that a single incident produces a single, coherent page rather than a storm of correlated alerts. Without these mechanisms, a single root cause - a GPU driver crash that takes down all model server pods in a region - can trigger dozens of alerts simultaneously: error rate alerts for each upstream service, latency alerts, pod restart alerts, feature store connection timeout alerts, and business metric alerts, all for the same incident. The on-call engineer's phone rings 20 times for a problem that requires one remediation action.

Alert grouping in Prometheus Alertmanager and PagerDuty works by aggregating alerts that share specified labels - typically service, team, environment, or alert type - into a single notification. When the database cluster goes down, instead of receiving 15 individual pages for 15 services that depend on the database, the on-call engineer receives one grouped alert: "15 services affected, root cause: database cluster." The grouped notification includes the list of affected services, making the scope of the incident immediately clear without requiring the engineer to correlate 15 individual pages. Grouping wait time - typically 30 to 60 seconds - allows correlated alerts that fire within a short window to be grouped before the first notification is sent.

Deduplication prevents alert storms within a single alert condition. Without deduplication, a metric that exceeds threshold and stays there generates a new page every evaluation interval - potentially every 30 seconds. Alertmanager's repeat_interval configuration suppresses re-notification on an active alert until the specified time has passed or the alert resolves and re-fires. The appropriate repeat interval depends on the alert severity: P1 critical alerts might re-notify every 5 minutes to ensure they are not dropped, while P3 informational alerts might re-notify every 24 hours since they do not require immediate response.

Alert lifecycle management prevents the long-term accumulation of stale alert rules that fire but no longer correspond to actionable incidents. This is called alert rule drift: rules that were accurate at launch become miscalibrated as the system evolves, thresholds become outdated, and the teams and runbooks they reference may no longer exist. A quarterly alert review process should classify each active alert rule as actionable (fired at least one true positive in 90 days), under observation (recently added, no incidents yet to validate against), or candidate for retirement (zero true positives in 90 days). Retiring stale rules directly reduces false positive rate without any threshold changes.`,
  },
  {
    heading: 'On-Call Design and Escalation Policies',
    body: `Alert thresholds determine when a page fires; escalation policies determine who receives it, in what order, and what happens if they do not respond. An excellent alert that fires promptly but routes to the wrong team or fails to escalate when unanswered has the same effective MTTR as no alert at all. Escalation policy design is as important to incident response outcomes as threshold calibration, and should be designed before launch with the same care.

Severity-tiered paging is the standard for production ML systems. P1 alerts - complete model serving unavailability, error rate above 10% for more than 2 minutes, confirmed user-visible outage - page the primary on-call engineer immediately via phone call, 24 hours a day. P2 alerts - significant degradation such as AUC drop above 4%, PSI alert on a top-3 feature, calibration error above 0.10 - send a Slack notification during business hours (8am to 10pm local time) and page the secondary on-call after 30 minutes if unacknowledged. P3 alerts - early warning signals such as moderate PSI on a low-importance feature, gradual freshness lag increase, null rate trending upward - create a Jira ticket automatically and appear in a weekly review meeting. P4 - informational metrics outside historical norms but within SLO - log to a monitoring data store for offline review.

The escalation chain ensures that unacknowledged critical alerts do not drop. P1 acknowledgment SLA: 5 minutes for the primary on-call. If unacknowledged in 5 minutes, auto-escalate to the secondary on-call with a separate page. If the secondary does not acknowledge in 10 minutes, escalate to the team manager. If the manager does not respond in 15 minutes, escalate to the organization's on-call coordinator. This ensures that every P1 incident has an engaged responder within 30 minutes regardless of individual availability. The chain should be tested quarterly with simulated incidents to verify that each escalation step actually reaches the intended recipient - routing rules that look correct in documentation frequently have silent failures in practice.

The most common organizational failure in ML monitoring is unclear ownership at the boundary between ML and data engineering. When a PSI alert fires on a model input feature, is that an ML alert or a data quality alert? If it is a data pipeline issue, paging the ML team wastes 30 minutes while they investigate before discovering the pipeline is the cause and handing off to data engineering. The fix is to design composite alerts that are pre-diagnosed before paging: alert if PSI > 0.25 AND upstream feature store volume is normal AND null rate is normal. This composite filters out the pipeline failure case and only pages the ML team when the drift cannot be explained by known upstream issues.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are false positives and false negatives in the context of alerting systems?',
    keyPoints: [
      'False positive: alert fires with no real incident - wastes on-call time',
      'False negative: real incident produces no alert - incident goes undetected',
      'Both have costs: FP causes alert fatigue, FN causes missed incidents',
      'The right threshold balances these costs based on the business context',
    ],
    trap: 'Treating false positives as merely annoying rather than recognizing that alert fatigue from FPs directly causes real incidents to be missed.',
  },
  {
    difficulty: 'junior',
    question: 'What is alert fatigue and why is it dangerous?',
    keyPoints: [
      'Alert fatigue: engineers stop taking alerts seriously because too many are false positives',
      'Leads to missed real incidents - alerts are acknowledged but not investigated',
      'Signs: engineers snooze alerts without investigation, incidents discovered via user reports',
      'Prevention: target < 10% false positive rate, group correlated alerts, retire unused rules',
    ],
    trap: 'Treating alert fatigue as a team morale problem rather than a system design failure that directly increases MTTR.',
  },
  {
    difficulty: 'junior',
    question: 'What is MTTD and how does your alert threshold affect it?',
    keyPoints: [
      'MTTD (Mean Time to Detection): time from incident start to alert firing',
      'Tight threshold → lower MTTD but more false positives',
      'Loose threshold → fewer false positives but higher MTTD, small incidents grow before detection',
      'For ML regressions (gradual), tolerating 5-minute MTTD in exchange for lower FP rate is often correct',
    ],
    trap: 'Optimizing only for MTTD without considering false positive rate - a threshold of zero produces instant detection but pages on every request.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between a static threshold and a relative threshold for alerting?',
    keyPoints: [
      'Static: alert if metric > fixed value - simple but breaks under seasonality',
      'Relative: alert if metric deviates > X% from same period last week - self-adjusting for seasonality',
      'Static thresholds fire on Black Friday when traffic doubles naturally',
      'Relative thresholds require stable baselines - new services do not have last-week data',
    ],
    trap: 'Using absolute thresholds for metrics that have strong daily/weekly seasonality - causes chronic false positives during predictable high-traffic periods.',
  },
  {
    difficulty: 'mid',
    question: 'How do you calibrate alert thresholds to reduce false positives without increasing false negatives?',
    keyPoints: [
      'Collect historical data on past incidents and metric behavior at incident time vs normal operation',
      'Plot precision-recall curve across threshold values - pick operating point matching cost ratio',
      'Use percentile-based thresholds (99th percentile over 30 days) that self-adjust',
      'Run offline simulation: replay 30 days of metrics through candidate threshold, measure FP/FN rate',
      'Start with a conservative (high) threshold, tighten gradually as you measure false positive rate',
    ],
    trap: 'Setting thresholds based on intuition or "round numbers" rather than historical incident data.',
  },
  {
    difficulty: 'mid',
    question: 'How would you design a composite alert to reduce false positives for an ML model latency issue?',
    keyPoints: [
      'Require multiple signals simultaneously: P99 > threshold AND error rate > threshold',
      'Require sustained violation: P99 > threshold for 5 consecutive minutes (not a single spike)',
      'Inhibit alert if upstream dependency (database, feature store) is already paged',
      'Group correlated downstream alerts (5 services affected by same latency) into one page',
    ],
    trap: 'Using OR logic for all composite conditions - creates extremely noisy alerts that fire on any single signal deviation.',
  },
  {
    difficulty: 'mid',
    question: 'What is a burn rate alert and when would you use it?',
    keyPoints: [
      'Burn rate: how fast you are consuming your SLO error budget relative to sustainable rate',
      'Burn rate of 14.4x means monthly budget is consumed in 2 days',
      'Catches gradual degradations that individually stay below fixed thresholds',
      'Multi-window burn rate: alert if burn > 14.4x for 1h AND > 14.4x for 5min - avoids transient spikes',
      'More robust than fixed thresholds for systems with variable traffic patterns',
    ],
    trap: 'Using burn rate alerts without defining an error budget first - burn rate is meaningless without an SLO to burn against.',
  },
  {
    difficulty: 'mid',
    question: 'An on-call team is experiencing 200 alerts per week with 80% being false positives. How do you fix this?',
    keyPoints: [
      'Audit all active alert rules - classify each as actionable, informational, or obsolete',
      'Retire rules with zero true positives in the past 90 days',
      'Add minimum observation windows (require violation for 5+ minutes before paging)',
      'Group correlated alerts - single root cause should produce single page',
      'Track alert-to-incident conversion rate as a weekly metric and set a target (e.g., 80% actionable)',
    ],
    trap: 'Adding more alert grouping without also auditing and retiring obsolete rules - the underlying noise source remains.',
  },
  {
    difficulty: 'mid',
    question: 'How do you handle alerting for a model deployed to a system with strong seasonal traffic (e.g., e-commerce during holidays)?',
    keyPoints: [
      'Use relative thresholds: alert if metric deviates > X% from same period last year/week',
      'Pre-configure threshold relaxations in the alert calendar before known events (Black Friday)',
      'Separate volume anomaly detection (absolute) from quality metric anomaly detection (relative)',
      'Monitor error rate and latency as percentages of requests, not absolute counts',
      'Set expectations with stakeholders about which alerts will be suppressed during high-traffic events',
    ],
    trap: 'Manually silencing alerts before seasonal events rather than configuring proper relative thresholds - trains the team to silence rather than configure.',
  },
  {
    difficulty: 'mid',
    question: 'How do you design alert severity levels for an ML system?',
    keyPoints: [
      'P1: user-visible outage, immediate 24/7 page (model serving error > 10%, complete unavailability)',
      'P2: significant degradation, page during business hours (AUC drop > 5%, latency SLO breach)',
      'P3: early warning, Slack notification (PSI > threshold, gradual drift)',
      'P4: informational ticket (minor data quality issue, retrain recommended)',
      'Most ML regressions are P2/P3 - avoid P1 pages for accuracy drops unless user impact is immediate',
    ],
    trap: 'Treating all model metric violations as P1 emergencies - this trains on-call teams to deprioritize pages and defeats the purpose of severity levels.',
  },
  {
    difficulty: 'senior',
    question: 'Design an alert system for a real-time fraud detection model that processes 10,000 transactions per second.',
    keyPoints: [
      'Layer 1 - infra: P99 scoring latency (SLO: < 50ms), error rate (SLO: < 0.01%), throughput',
      'Layer 2 - model quality: prediction score distribution PSI, decline rate by segment, calibration drift',
      'Layer 3 - business: fraud loss rate per hour, false positive rate (good customers blocked), estimated cost',
      'Composite alert: require P99 breach + error rate breach for automatic rollback; single-signal for investigation',
      'Burn rate alerts for false positive SLO (customer experience) and false negative SLO (fraud loss)',
    ],
    trap: 'Designing alerts without explicitly modeling the cost asymmetry - in fraud, FN (missed fraud) costs far more than FP (false block), which should push the threshold to be more sensitive.',
  },
  {
    difficulty: 'senior',
    question: 'How do you measure the effectiveness of your alerting system itself?',
    keyPoints: [
      'Alert-to-incident conversion rate: % of alerts that correspond to real incidents (target: > 80%)',
      'MTTD: time from incident start to alert fire, measured as P50/P99 distribution',
      'False positive rate: alerts per week that are acknowledged but not actioned',
      'Coverage gap: incidents detected by users/customer reports but not by alerts (missed incidents)',
      'Alert volume trend: rising alert volume without rising incident count indicates threshold drift',
    ],
    trap: 'Only measuring MTTD without measuring false positive rate - a system with 1-second MTTD but 90% FP rate is worse than one with 5-minute MTTD and 5% FP rate.',
  },
  {
    difficulty: 'senior',
    question: 'How do you prevent threshold drift - where alert thresholds become miscalibrated over time as the system evolves?',
    keyPoints: [
      'Schedule quarterly alert reviews - compare current thresholds to recent incident data',
      'Track alert-to-incident conversion rate monthly; investigate when it drops below target',
      'Use adaptive thresholds (percentile-based, rolling baseline) that self-adjust to system changes',
      'Require threshold justification in alert rule PRs - forces explicit reasoning about FP/FN tradeoffs',
      'Build an alert simulation tool: replay the past 30 days of metrics through candidate thresholds and report FP/FN rates',
    ],
    trap: 'Setting thresholds once at launch and never reviewing them - systems evolve, traffic patterns change, and thresholds become stale within months.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle alert escalation when the on-call engineer is unresponsive?',
    keyPoints: [
      'Define acknowledgment SLA per severity: P1 = 5 min, P2 = 15 min, P3 = business hours',
      'Auto-escalate to secondary on-call after primary acknowledgment SLA is missed',
      'Auto-escalate to team manager after secondary misses their SLA',
      'Log all escalations and review in weekly reliability meetings',
      'For P1: page team manager and on-call coordinator in parallel after 15 minutes without response',
    ],
    trap: 'Designing escalation policies as a single linear chain - if a team is overwhelmed, escalation to the same team adds noise without changing anything.',
  },
  {
    difficulty: 'junior',
    question: 'Why do you need a minimum observation window before firing an alert?',
    keyPoints: [
      'Single metric spikes are common and often transient - they resolve themselves within seconds',
      'A 30-second spike should not wake up an on-call engineer',
      'Observation windows (e.g., require violation for 5 consecutive minutes) filter transient noise',
      'Trade-off: longer window reduces FP but increases MTTD for real incidents',
    ],
    trap: 'Setting observation windows so long that real incidents are not caught until they become outages.',
  },
  {
    difficulty: 'mid',
    question: 'Compare and contrast sigma-based thresholds and percentile-based thresholds for ML monitoring.',
    keyPoints: [
      'Sigma-based: alert if value > mean + k*std - assumes Gaussian distribution, often wrong for production metrics',
      'Percentile-based: alert if value exceeds 99th percentile of recent history - no distributional assumption, more robust',
      'Sigma thresholds underestimate risk for heavy-tailed metrics (latency, error rate)',
      'Percentile thresholds can be fooled if the reference window includes past incidents',
      'Neither handles step-changes well - a major traffic ramp permanently shifts the baseline',
    ],
    trap: 'Applying sigma-based thresholds to metrics like latency that are inherently heavy-tailed and highly right-skewed.',
  },
  {
    difficulty: 'senior',
    question: 'A new product launch will triple traffic for 72 hours. How do you manage alerting during this period?',
    keyPoints: [
      'Pre-configure threshold relaxations 48h before launch - do not manually silence during the event',
      'Switch to relative thresholds: alert if error rate increases > 20% relative to launch baseline (not absolute)',
      'Pre-deploy capacity headroom so infrastructure SLOs are not breached by expected traffic',
      'Set up a dedicated on-call rotation for the launch window with increased staffing',
      'Define explicit launch criteria - what metrics must hold for the launch to proceed vs pause',
    ],
    trap: 'Silencing all alerts for the duration of the launch - creates a coverage gap where real incidents during the launch go undetected.',
  },
  {
    difficulty: 'mid',
    question: 'What is alert inhibition and when should you use it?',
    keyPoints: [
      'Alert inhibition: suppress downstream alerts when a root cause alert is already open',
      'Example: if the database is paged, inhibit latency alerts from all services that depend on it',
      'Requires explicit dependency graph to know which services are downstream of which',
      'Prevents alert storms where one root cause triggers 20+ downstream alerts',
      'Be careful: inhibition can mask secondary failures that are independent of the root cause',
    ],
    trap: 'Over-aggressive inhibition that masks legitimate secondary failures unrelated to the active incident.',
  },
  {
    difficulty: 'junior',
    question: 'What is the precision-recall tradeoff and how does it apply to alerting?',
    keyPoints: [
      'Precision: of all alerts fired, what fraction correspond to real incidents',
      'Recall: of all real incidents, what fraction fired an alert',
      'Lower threshold → higher recall (catch more incidents) but lower precision (more false alerts)',
      'Higher threshold → higher precision (fewer false alerts) but lower recall (miss more incidents)',
      'Optimal threshold is determined by the relative cost of FP vs FN in your context',
    ],
    trap: 'Treating precision and recall as independently tunable when they are directly linked through the threshold choice.',
  },
];
