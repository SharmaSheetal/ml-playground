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
    body: `Every alert system is a binary classifier: given an incoming signal, should we fire an alert or not? This framing makes the precision-recall tradeoff explicit and gives you the right vocabulary to reason about it.

True positive: a real incident fires an alert. False positive: an alert fires but there is no real incident — on-call engineer wakes up for nothing. False negative: a real incident produces no alert — the incident goes undetected. True negative: no alert fires and everything is fine.

The cost asymmetry between FP and FN is different in every context. For a payments fraud alert, an FN (missed fraud) is catastrophic. For a recommendation model latency alert, an FP (alert during normal traffic spike) erodes trust in the alert system. Designing an alert system means picking an operating point on the precision-recall curve that matches your cost asymmetry.`,
  },
  {
    heading: 'False Positive Cost vs False Negative Cost',
    body: `False positives cost engineer time and attention. When on-call engineers respond to false alerts repeatedly, they begin to ignore real ones. This is alert fatigue — the most dangerous failure mode of an alerting system.

False negatives cost in proportion to the severity of the incident. A missed outage in a payments system can cost millions per minute. A missed accuracy regression in a recommendation model might cost 2% CTR over a week.

The right threshold is the one that minimizes expected cost: threshold* = argmin(FP_rate * cost_FP + FN_rate * cost_FN). This is a business decision, not a technical one. ML teams should present the precision-recall curve and ask the business to pick a cost ratio.

Rule of thumb: if your on-call team complains about false alerts, your threshold is too low. If incidents are consistently discovered by users before your alerting system, your threshold is too high.`,
  },
  {
    heading: 'Alert Fatigue — The Biggest Risk',
    body: `Alert fatigue happens when on-call engineers see so many false alerts that they stop treating alerts as meaningful signals. Studies from SRE practice show that engineers stop acknowledging alerts within seconds when false positive rates exceed 30%.

Signs of alert fatigue: alerts are acknowledged but not investigated, runbooks are not followed, engineers "snooze" or silence alerts without investigation, real incidents are discovered via user reports rather than alerts.

Prevention strategies:
  • Target false positive rate below 10% per week per team
  • Group correlated alerts (one incident should produce one page, not 20)
  • Route alerts only to the team that owns the affected service
  • Review and retire alerts that have not produced actionable follow-up in 90 days
  • Track alert-to-incident conversion rate as a first-class metric

An alert system that no one trusts is worse than no alert system — it provides false confidence.`,
  },
  {
    heading: 'Threshold Calibration Techniques',
    body: `Static thresholds are the simplest but least robust. "Alert if error rate > 1%" works until traffic doubles on Black Friday and the absolute error count doubles with it.

Percentile-based thresholds: compute the 99th percentile of a metric over the past 30 days and alert if the current value exceeds it. Self-adjusting but slow to adapt to genuine step-changes in traffic.

Standard deviation thresholds: alert if current value > mean + k*std. k=3 gives a 0.3% false positive rate for Gaussian data. Most production metrics are not Gaussian — this often underestimates tail risk.

Rolling baseline: compare current window to same period last week/month to account for seasonality. Effective for e-commerce, social media, and other seasonally patterned systems.

ML-based anomaly detection: Prophet, SARIMA, or LSTM-based models learn seasonal patterns and alert on residuals. High accuracy but requires training data and introduces model drift risk into your monitoring infrastructure.`,
  },
  {
    heading: 'Composite Alerts and Multi-Signal Fusion',
    body: `A single metric threshold generates many false positives. Composite alerts require multiple signals to fire before paging.

AND logic: "alert if P99 > 200ms AND error rate > 0.5%" — both conditions must be true simultaneously. Significantly reduces false positives but increases false negatives — a condition that only violates one dimension will be missed.

OR logic: "alert if P99 > 300ms OR error rate > 2%" — either condition triggers. More sensitive, more noisy.

Correlated alert grouping: if one root cause fires 12 different alerts (CPU, memory, latency, error rate, downstream timeouts), group them into a single page with the probable root cause. PagerDuty, Opsgenie, and Alertmanager all support grouping rules.

Causality chains: only alert on upstream metrics — if the database is down, alert on the database, not on every service that depends on it. This requires knowing your dependency graph.`,
  },
  {
    heading: 'Time-Based Thresholds and Seasonality',
    body: `The appropriate threshold for a metric at 3am Saturday is different from the threshold at 2pm Monday. A "low traffic" alarm at 3am is expected. The same absolute traffic level at 2pm is a serious problem.

Business hours vs off-hours: use tighter thresholds during business hours when users are active, looser thresholds overnight when low traffic is normal.

Seasonality: Black Friday, product launches, sporting events all change baseline behavior. Pre-configure threshold relaxations in your alert system calendar before these events.

Relative thresholds: "alert if traffic drops more than 30% from same hour last week" accounts for weekly seasonality automatically without manual calendar configuration.

The danger of static thresholds during planned events: teams learn to silence alerts before events rather than properly configuring seasonal thresholds. This creates a habit of alert suppression that outlasts the event.`,
  },
  {
    heading: 'MTTD and MTTR — Detection and Recovery Time',
    body: `Mean Time to Detection (MTTD): how long after an incident starts until an alert fires. Determined by your alert threshold, polling interval, and minimum observation window.

Mean Time to Recovery (MTTR): how long from detection until the service is restored. Determined by alert routing, escalation policies, runbook quality, and system rollback speed.

Threshold choice directly affects MTTD. A tight threshold (alert on small deviations) reduces MTTD but increases false positives. A loose threshold reduces false positives but misses small incidents until they grow.

For ML systems: tolerate slightly higher MTTD (minutes, not seconds) in exchange for lower false positive rates. Most model regressions are not instantaneous outages — they degrade gradually. A 5-minute detection delay is acceptable if it reduces false alert rate from 40% to 5%.

MTTD tracking: measure the time between incident start (when the metric first exceeded threshold) and alert fire time. Plot this as a percentile distribution, not a mean.`,
  },
  {
    heading: 'Burn Rate Alerts — SLO-Based Alerting',
    body: `Traditional threshold alerts miss gradual degradations that individually stay below the alert threshold. Burn rate alerts from the Google SRE model solve this.

Concept: an SLO has an error budget — the amount of allowed downtime or errors over a period (e.g., 0.1% error rate over 30 days = 43 minutes of allowed errors). A burn rate alert fires when you are consuming your error budget faster than it can recover.

A burn rate of 1x means you are exactly on track to exhaust your error budget at the end of the period. A burn rate of 14.4x means you would exhaust a monthly budget in 2 days.

Multi-window burn rate alerts: "alert if burn rate > 14.4x for 1 hour AND burn rate > 6x for 6 hours" catches both fast and slow burns while reducing false positives from transient spikes.

Burn rate is a more robust alerting primitive than fixed thresholds because it automatically accounts for budget consumption rather than absolute metric values.`,
  },
  {
    heading: 'Reducing Alert Fatigue — Grouping, Deduplication, Silencing',
    body: `Alert grouping: one underlying incident should produce one page. Use your alert manager (Alertmanager, PagerDuty) to group alerts by source, service, or time window. A single pod OOM should not produce 20 alerts for 20 downstream metrics.

Alert deduplication: if the same alert fires every minute until resolved, deduplicate to a single open alert per condition. Only re-alert after the condition clears and recurs.

Alert inhibition: suppress downstream alerts when a root cause alert is open. If the database is paged, suppress all service-level latency alerts that are caused by database unavailability.

Silence windows: pre-configure silences for planned events (deploys, maintenance, load tests). Never silence manually during incidents — it trains engineers to silence instead of fix.

Alert lifecycle management: review active alert rules every quarter. Archive rules that fire zero true positives in 90 days. Alert rule drift (accumulation of rules that no longer match current system behavior) is a leading cause of chronic alert fatigue.`,
  },
  {
    heading: 'On-Call Design and Escalation Policies',
    body: `A well-designed on-call rotation and escalation policy is as important as the alert thresholds themselves. An alert that pages the wrong person, or fails to escalate, delays recovery.

Rotation design: 1-week primary / 1-week secondary on-call per team. Primary is paged first. Secondary is paged if primary does not acknowledge within 5 minutes.

Escalation policy: if secondary does not acknowledge within 10 minutes, page the team manager. If manager does not respond in 15 minutes, escalate to on-call coordinator.

Alert severity levels:
  • P1 (critical): page immediately, 24/7, user-visible outage
  • P2 (high): page during business hours, significant degradation
  • P3 (medium): Slack notification, investigate next business day
  • P4 (low): ticket created, addressed in sprint planning

ML-specific consideration: most model regressions are P2 or P3, not P1. Avoid paging on-call at 3am for a 1% AUC drop that has been stable for 6 hours. Reserve 3am pages for actual user-visible outages.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are false positives and false negatives in the context of alerting systems?',
    keyPoints: [
      'False positive: alert fires with no real incident — wastes on-call time',
      'False negative: real incident produces no alert — incident goes undetected',
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
      'Leads to missed real incidents — alerts are acknowledged but not investigated',
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
    trap: 'Optimizing only for MTTD without considering false positive rate — a threshold of zero produces instant detection but pages on every request.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between a static threshold and a relative threshold for alerting?',
    keyPoints: [
      'Static: alert if metric > fixed value — simple but breaks under seasonality',
      'Relative: alert if metric deviates > X% from same period last week — self-adjusting for seasonality',
      'Static thresholds fire on Black Friday when traffic doubles naturally',
      'Relative thresholds require stable baselines — new services do not have last-week data',
    ],
    trap: 'Using absolute thresholds for metrics that have strong daily/weekly seasonality — causes chronic false positives during predictable high-traffic periods.',
  },
  {
    difficulty: 'mid',
    question: 'How do you calibrate alert thresholds to reduce false positives without increasing false negatives?',
    keyPoints: [
      'Collect historical data on past incidents and metric behavior at incident time vs normal operation',
      'Plot precision-recall curve across threshold values — pick operating point matching cost ratio',
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
    trap: 'Using OR logic for all composite conditions — creates extremely noisy alerts that fire on any single signal deviation.',
  },
  {
    difficulty: 'mid',
    question: 'What is a burn rate alert and when would you use it?',
    keyPoints: [
      'Burn rate: how fast you are consuming your SLO error budget relative to sustainable rate',
      'Burn rate of 14.4x means monthly budget is consumed in 2 days',
      'Catches gradual degradations that individually stay below fixed thresholds',
      'Multi-window burn rate: alert if burn > 14.4x for 1h AND > 6x for 6h — avoids transient spikes',
      'More robust than fixed thresholds for systems with variable traffic patterns',
    ],
    trap: 'Using burn rate alerts without defining an error budget first — burn rate is meaningless without an SLO to burn against.',
  },
  {
    difficulty: 'mid',
    question: 'An on-call team is experiencing 200 alerts per week with 80% being false positives. How do you fix this?',
    keyPoints: [
      'Audit all active alert rules — classify each as actionable, informational, or obsolete',
      'Retire rules with zero true positives in the past 90 days',
      'Add minimum observation windows (require violation for 5+ minutes before paging)',
      'Group correlated alerts — single root cause should produce single page',
      'Track alert-to-incident conversion rate as a weekly metric and set a target (e.g., 80% actionable)',
    ],
    trap: 'Adding more alert grouping without also auditing and retiring obsolete rules — the underlying noise source remains.',
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
    trap: 'Manually silencing alerts before seasonal events rather than configuring proper relative thresholds — trains the team to silence rather than configure.',
  },
  {
    difficulty: 'mid',
    question: 'How do you design alert severity levels for an ML system?',
    keyPoints: [
      'P1: user-visible outage, immediate 24/7 page (model serving error > 10%, complete unavailability)',
      'P2: significant degradation, page during business hours (AUC drop > 5%, latency SLO breach)',
      'P3: early warning, Slack notification (PSI > threshold, gradual drift)',
      'P4: informational ticket (minor data quality issue, retrain recommended)',
      'Most ML regressions are P2/P3 — avoid P1 pages for accuracy drops unless user impact is immediate',
    ],
    trap: 'Treating all model metric violations as P1 emergencies — this trains on-call teams to deprioritize pages and defeats the purpose of severity levels.',
  },
  {
    difficulty: 'senior',
    question: 'Design an alert system for a real-time fraud detection model that processes 10,000 transactions per second.',
    keyPoints: [
      'Layer 1 — infra: P99 scoring latency (SLO: < 50ms), error rate (SLO: < 0.01%), throughput',
      'Layer 2 — model quality: prediction score distribution PSI, decline rate by segment, calibration drift',
      'Layer 3 — business: fraud loss rate per hour, false positive rate (good customers blocked), estimated cost',
      'Composite alert: require P99 breach + error rate breach for automatic rollback; single-signal for investigation',
      'Burn rate alerts for false positive SLO (customer experience) and false negative SLO (fraud loss)',
    ],
    trap: 'Designing alerts without explicitly modeling the cost asymmetry — in fraud, FN (missed fraud) costs far more than FP (false block), which should push the threshold to be more sensitive.',
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
    trap: 'Only measuring MTTD without measuring false positive rate — a system with 1-second MTTD but 90% FP rate is worse than one with 5-minute MTTD and 5% FP rate.',
  },
  {
    difficulty: 'senior',
    question: 'How do you prevent threshold drift — where alert thresholds become miscalibrated over time as the system evolves?',
    keyPoints: [
      'Schedule quarterly alert reviews — compare current thresholds to recent incident data',
      'Track alert-to-incident conversion rate monthly; investigate when it drops below target',
      'Use adaptive thresholds (percentile-based, rolling baseline) that self-adjust to system changes',
      'Require threshold justification in alert rule PRs — forces explicit reasoning about FP/FN tradeoffs',
      'Build an alert simulation tool: replay the past 30 days of metrics through candidate thresholds and report FP/FN rates',
    ],
    trap: 'Setting thresholds once at launch and never reviewing them — systems evolve, traffic patterns change, and thresholds become stale within months.',
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
    trap: 'Designing escalation policies as a single linear chain — if a team is overwhelmed, escalation to the same team adds noise without changing anything.',
  },
  {
    difficulty: 'junior',
    question: 'Why do you need a minimum observation window before firing an alert?',
    keyPoints: [
      'Single metric spikes are common and often transient — they resolve themselves within seconds',
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
      'Sigma-based: alert if value > mean + k*std — assumes Gaussian distribution, often wrong for production metrics',
      'Percentile-based: alert if value exceeds 99th percentile of recent history — no distributional assumption, more robust',
      'Sigma thresholds underestimate risk for heavy-tailed metrics (latency, error rate)',
      'Percentile thresholds can be fooled if the reference window includes past incidents',
      'Neither handles step-changes well — a major traffic ramp permanently shifts the baseline',
    ],
    trap: 'Applying sigma-based thresholds to metrics like latency that are inherently heavy-tailed and highly right-skewed.',
  },
  {
    difficulty: 'senior',
    question: 'A new product launch will triple traffic for 72 hours. How do you manage alerting during this period?',
    keyPoints: [
      'Pre-configure threshold relaxations 48h before launch — do not manually silence during the event',
      'Switch to relative thresholds: alert if error rate increases > 20% relative to launch baseline (not absolute)',
      'Pre-deploy capacity headroom so infrastructure SLOs are not breached by expected traffic',
      'Set up a dedicated on-call rotation for the launch window with increased staffing',
      'Define explicit launch criteria — what metrics must hold for the launch to proceed vs pause',
    ],
    trap: 'Silencing all alerts for the duration of the launch — creates a coverage gap where real incidents during the launch go undetected.',
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
