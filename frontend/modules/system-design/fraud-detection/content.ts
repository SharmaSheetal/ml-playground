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
    heading: 'Fraud Detection Architecture Overview',
    body: `A fraud detection system must make a decision in milliseconds — approve or decline a transaction — before the user experiences any perceptible delay. This real-time constraint shapes every architectural decision.

The pipeline: a transaction event arrives → feature extraction from real-time streams and historical stores → model scoring → threshold comparison → decision (approve/flag/decline). The entire pipeline must complete in under 100ms at P99.

Fraud detection is a layered system. Not every transaction runs through an expensive ML model. A rule engine first blocks obvious fraud (impossible geolocation, known bad card numbers). ML scores the remainder. A human review queue handles the highest-risk ambiguous cases. This tiered approach balances cost, speed, and accuracy.`,
  },
  {
    heading: 'Feature Engineering for Fraud',
    body: `Fraud features must be rich, fresh, and computed in real time. Static demographic features are insufficient — fraud is dynamic and adversarial.

Velocity features: how many transactions in the last 1 minute, 10 minutes, 1 hour, 24 hours? Velocity is one of the strongest fraud signals. A card making 30 purchases in 5 minutes is almost certainly compromised.

Graph features: is this merchant connected to other known-fraud merchants? Is this card linked to a previously fraudulent account? Graph features capture network-level patterns that individual transaction features miss.

Behavioral biometrics: typing speed, device orientation, navigation patterns. These are session-level features that characterize a legitimate user vs a bot or fraudster.

Historical patterns: average transaction amount, typical transaction time, usual merchant category. A $5,000 transaction at 3am in a country the user has never visited deviates from historical patterns.

Feature tiering: real-time features (velocity, session behavior) fetched from Redis; historical features (lifetime value, country frequency) fetched from Cassandra or BigQuery; graph features pre-computed nightly.`,
  },
  {
    heading: 'Class Imbalance — The Core Challenge',
    body: `In most fraud detection contexts, the positive class (fraud) represents 0.1–2% of all transactions. This extreme class imbalance makes naive accuracy metrics meaningless and requires specific techniques.

Why accuracy fails: a model that predicts "not fraud" for every transaction achieves 99% accuracy if fraud rate is 1%. This model is useless. Use precision, recall, F1, and AUC instead.

SMOTE (Synthetic Minority Oversampling Technique): generate synthetic minority class examples by interpolating between existing fraud examples. Helps the model learn the decision boundary with more signal from the positive class.

Cost-sensitive learning: assign higher misclassification cost to false negatives (missed fraud) than to false positives (false declines). The model optimizes for a weighted loss function that reflects the real-world cost asymmetry.

Undersampling the majority class: randomly remove non-fraud examples to balance the training set. Simple and effective for very large datasets, but risks losing important non-fraud patterns.

Resampling strategy: for most production systems, a combination — moderate undersampling + cost-sensitive loss — outperforms pure SMOTE.`,
  },
  {
    heading: 'Threshold Optimization and the Business Cost Matrix',
    body: `The model outputs a fraud probability score. The threshold converts that score into a binary decision. Threshold selection is not a technical decision — it is a business decision based on the cost of each error type.

Cost matrix:
  • True positive: fraud correctly caught — fraud loss prevented
  • False positive: legitimate transaction declined — review cost + customer friction + potential churn
  • False negative: fraud missed — fraud loss absorbed by company
  • True negative: legitimate transaction approved — happy path, no cost

For many businesses: false negative cost (fraud loss per transaction) >> false positive cost (review cost + churn). This pushes the optimal threshold low — maximize recall at the expense of precision.

For user-facing consumer products: false positive cost can be high (declined card = lost customer). Businesses like Stripe or PayPal balance fraud loss against customer experience degradation.

Optimal threshold: threshold* = argmin[FP_count * cost_FP + FN_count * cost_FN] computed on a validation set representative of production volume.

Operating multiple thresholds: use different thresholds for different transaction segments (low-value vs high-value, trusted merchants vs new merchants). A one-size-fits-all threshold is almost never optimal.`,
  },
  {
    heading: 'Reject Inference — The Unobserved Label Problem',
    body: `In fraud detection, you only observe outcomes for transactions you approved. Rejected transactions never transact — you cannot directly observe whether they would have been fraudulent.

This creates a systematic bias: your training data is censored. If you train only on approved transactions, your model is learning "what is fraud among transactions we already considered low-risk." It cannot generalize to the borderline decisions it currently declines.

Reject inference methods:
  • Augmentation: assume all rejected transactions are fraud (pessimistic) or all are legitimate (optimistic) — both are wrong but bounded the problem
  • Fuzzy augmentation: assign each rejected transaction a weighted pseudo-label based on model score
  • Semi-supervised learning: treat rejected transactions as unlabeled examples and use label propagation
  • A/B testing: approve a sample of borderline transactions to observe their outcomes (expensive but unbiased)

This is a classic causal inference problem — you want to know the counterfactual outcome of approving rejected transactions. The only unbiased method is actually approving a random sample.`,
  },
  {
    heading: 'Model Stacking — Rule Engine + ML + Human Review',
    body: `Production fraud detection rarely relies on a single model. A tiered system reduces cost and latency while maintaining accuracy.

Tier 1 — Rule engine: deterministic rules that block known-bad patterns instantly. "Block if card is on blocklist," "block if transaction country is sanctioned," "block if velocity > 100 transactions/minute." Zero model latency. Catches 20–40% of fraud with near-zero false positive rate.

Tier 2 — ML model: score all transactions not caught by rules. XGBoost or LightGBM for tabular features (fast, interpretable). Deep neural network for sequence or embedding features. Transactions above threshold are declined or queued for review. Processes 60–80% of remaining fraud.

Tier 3 — Human review queue: high-risk transactions that the model is uncertain about (score near the decision threshold) go to a human analyst. Analysts have access to additional signals, can call the customer, and make nuanced judgments. This tier handles 1–5% of transactions but catches fraud that would slip through automated tiers.

Key design decision: what score range goes to human review? Set a "review window" around the decision threshold (e.g., review if score is 0.40–0.70 when threshold is 0.50). The width of the review window determines your review queue volume.`,
  },
  {
    heading: 'Real-time vs Batch Scoring',
    body: `Not all fraud decisions are made in real time. The architecture depends on the payment type and the latency budget.

Real-time scoring: credit/debit card transactions, online payments. Latency budget: < 100ms total pipeline time. Model must be in memory, features served from Redis/Memcached. XGBoost inference on CPU: 1–5ms. Neural network inference on GPU: 5–20ms.

Batch scoring: ACH transfers, check clearing, wire transfers. Latency budget: hours. Can use richer features (graph traversal, complex historical aggregations) that are not feasible in real time. Can use more expensive models without latency constraints.

Asynchronous fraud detection: approve the transaction immediately, score asynchronously, and if fraud is detected post-hoc, trigger a chargeback or reversal. Used for low-value, high-volume transactions where the real-time latency cost exceeds the fraud loss from 30-second delayed decisions.

Choice is driven by: chargeback reversal feasibility, fraud loss per transaction, customer experience requirements, and technical constraints of the payment network.`,
  },
  {
    heading: 'Graph-Based Fraud Detection',
    body: `Individual transaction signals catch isolated fraudsters but miss coordinated ring fraud, money mule networks, and account takeover chains. Graph features reveal these patterns.

Entity graph: connect cards, accounts, devices, IP addresses, email addresses, and merchants with edges representing shared attributes. A card linked to a device that was previously used by a known-fraud account is a strong signal.

Graph features used as model inputs:
  • Degree: how many entities (cards, accounts) share this device or IP?
  • Clustering coefficient: are the entities connected to this node also connected to each other?
  • Shortest path to known-fraud entity: how many hops from this transaction to a labeled fraud node?

Ring fraud: a group of accounts transacts with each other or with a merchant that is controlled by the fraud ring. Graph partitioning algorithms (Louvain, Girvan-Newman) detect these clusters.

Operational challenge: maintaining a real-time entity graph at scale (billions of nodes) requires a graph database (Neo4j, TigerGraph, Amazon Neptune) or a specialized graph processing system. Graph features are typically pre-computed nightly and served from an online feature store rather than computed in real time.`,
  },
  {
    heading: 'Concept Drift in Fraud Detection',
    body: `Fraud detection faces a uniquely adversarial form of concept drift: fraudsters actively study and adapt to your model's detection patterns. Unlike churn prediction or recommendation models, where drift is passive (users change behavior organically), fraud drift is intentional.

Adversarial adaptation: once fraudsters identify which signals your model relies on (velocity, device fingerprint, merchant category), they adapt: use mules (low velocity), cycle through devices (avoid fingerprint), and target legitimate merchants.

Response strategies:
  • Frequent retraining: retrain weekly or even daily on recent transactions. Fresh data reduces the window in which fraudsters can exploit discovered patterns.
  • Ensemble diversity: use multiple models with different feature sets. If one model is gamed, others remain effective.
  • Adversarial training: augment training data with adversarially perturbed examples — teach the model to be robust to feature manipulation.
  • Feature obfuscation: do not expose model features or decisions publicly in API responses — limits fraudster's ability to reverse-engineer the model.

Evaluation: hold out a "fraud honeypot" dataset of recent, confirmed fraud that the model has not seen. Use it to measure detection rate on the newest fraud patterns — this is more indicative of production performance than the overall test set AUC.`,
  },
  {
    heading: 'Operational Metrics — Beyond Model Accuracy',
    body: `In production fraud detection, the metrics that matter to the business are not AUC or F1 — they are revenue metrics and operational costs.

Fraud loss rate (bps): basis points of gross merchandise value lost to fraud. One of the primary business metrics. Target varies by industry: e-commerce 10–30 bps, payments 5–15 bps.

False positive rate on good customers: percentage of legitimate transactions that are declined. High FPR directly causes customer churn, especially for credit card transactions. Target < 0.5% FPR on verified good customers.

Review queue throughput: how many manual reviews can analysts process per hour? Queue volume × analyst capacity determines whether the review tier is a bottleneck. If queue exceeds capacity, auto-decline the backlog.

Review queue precision: what fraction of transactions sent to human review are actually fraudulent? Low precision means analysts waste time on obvious legitimate transactions.

Chargeback ratio: chargebacks as a percentage of transaction volume. Payment networks (Visa, Mastercard) set thresholds — exceeding them results in fines and potentially losing card processing rights.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'Why is accuracy a poor metric for fraud detection models?',
    keyPoints: [
      'Fraud rate is typically 0.1–2% of transactions — predicting "not fraud" always achieves 98–99.9% accuracy',
      'A model that never detects fraud has near-perfect accuracy but is useless',
      'Use precision, recall, F1, AUC-ROC, and business cost metrics instead',
      'Precision: of flagged transactions, how many are actually fraud',
      'Recall: of actual fraud, how many are caught',
    ],
    trap: 'Reporting model accuracy as the primary metric — this impresses no one in a fraud context and signals misunderstanding of class imbalance.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between false positives and false negatives in fraud detection? What is the cost of each?',
    keyPoints: [
      'False positive: legitimate transaction declined — customer friction, potential churn',
      'False negative: fraudulent transaction approved — fraud loss absorbed by company',
      'Cost asymmetry varies by business: fraud loss per transaction vs review cost + customer experience',
      'Threshold choice explicitly trades off FP cost vs FN cost',
    ],
    trap: 'Treating FP and FN as equally costly — in most fraud contexts, the optimal threshold is not 0.5 because the costs are asymmetric.',
  },
  {
    difficulty: 'junior',
    question: 'What types of features are most useful for fraud detection?',
    keyPoints: [
      'Velocity features: transactions in last 1/10/60 minutes — strong signal for compromised cards',
      'Historical patterns: average amount, typical merchant category, usual transaction time',
      'Graph features: connections between cards, devices, IPs, known-fraud entities',
      'Behavioral biometrics: typing speed, device orientation, navigation patterns (session-level)',
    ],
    trap: 'Focusing only on static demographic features — fraud signals are primarily dynamic (velocity, graph connections) not static.',
  },
  {
    difficulty: 'junior',
    question: 'What is a tiered fraud detection system?',
    keyPoints: [
      'Tier 1 — Rule engine: blocks known-bad patterns instantly with zero model latency',
      'Tier 2 — ML model: scores remaining transactions, declines or flags high-risk ones',
      'Tier 3 — Human review queue: analysts investigate borderline model-uncertain cases',
      'Tiering reduces cost and latency while maintaining accuracy — not every transaction needs an ML score',
    ],
    trap: 'Running every transaction through the ML model — the rule engine tier eliminates obvious fraud cheaply, and many transactions do not need ML at all.',
  },
  {
    difficulty: 'mid',
    question: 'How do you handle class imbalance in a fraud detection model?',
    keyPoints: [
      'Cost-sensitive learning: assign higher loss to false negatives in the training objective',
      'Undersampling the majority: randomly remove non-fraud examples to balance training set',
      'SMOTE: generate synthetic fraud examples by interpolating between existing fraud cases',
      'Resampling strategy: combination of moderate undersampling + cost-sensitive loss typically best',
      'Evaluation: always evaluate on the natural class distribution, not the balanced training set',
    ],
    trap: 'Oversampling to a 50/50 split and evaluating on the balanced dataset — the model is deployed on an imbalanced distribution and evaluation should reflect that.',
  },
  {
    difficulty: 'mid',
    question: 'How do you select the optimal classification threshold for a fraud model?',
    keyPoints: [
      'Compute FP count × cost_FP + FN count × cost_FN across all threshold values on validation set',
      'Select threshold that minimizes total expected cost',
      'Cost_FP = review cost + expected churn loss; cost_FN = average fraud transaction value',
      'Use different thresholds for different transaction segments (high-value vs low-value)',
      'Visualize the cost curve vs threshold — it is usually a U-shape with a clear minimum',
    ],
    trap: 'Using the default threshold of 0.5 without considering the cost matrix — 0.5 is almost never the optimal threshold for imbalanced problems.',
  },
  {
    difficulty: 'mid',
    question: 'What is the reject inference problem and how do you handle it?',
    keyPoints: [
      'You only observe fraud labels for approved transactions — rejected transactions have no outcome',
      'Training only on approved transactions biases the model — it never learns from borderline declines',
      'Methods: fuzzy augmentation (pseudo-label based on model score), semi-supervised learning, A/B test (approve random sample)',
      'Most unbiased fix: A/B test — randomly approve borderline transactions to observe actual outcomes',
      'Acknowledge the bias in model evaluation — reported AUC is measured on observed-only data',
    ],
    trap: 'Ignoring the reject inference problem — a model trained only on approved transactions has systematic evaluation bias that inflates apparent performance.',
  },
  {
    difficulty: 'mid',
    question: 'How does fraud detection model drift differ from typical ML model drift?',
    keyPoints: [
      'Fraud drift is adversarial — fraudsters actively adapt to circumvent the model',
      'Not passive (users changing behavior organically) but intentional (fraudsters studying detection patterns)',
      'Requires more frequent retraining (weekly or even daily vs monthly for most models)',
      'Use adversarial training, ensemble diversity, and feature obfuscation as countermeasures',
      'Evaluate on a honeypot dataset of recent confirmed fraud not seen during training',
    ],
    trap: 'Applying the same drift response strategy as non-adversarial models — fraud drift requires adversarial countermeasures, not just periodic retraining.',
  },
  {
    difficulty: 'mid',
    question: 'What are the latency requirements for a real-time fraud scoring system and how do you meet them?',
    keyPoints: [
      'Total pipeline latency budget: < 100ms at P99 for synchronous card transactions',
      'Feature retrieval from Redis: 1–3ms for online features',
      'Model inference: XGBoost on CPU 1–5ms, neural network on GPU 5–20ms',
      'Model must be in memory — no cold starts, no disk I/O in the critical path',
      'Use connection pooling for feature store, pre-warm model server replicas',
    ],
    trap: 'Designing a system that meets average latency but fails P99 — fraud detection SLOs are measured at P99 to ensure consistent user experience.',
  },
  {
    difficulty: 'mid',
    question: 'How do you measure fraud detection system performance in production?',
    keyPoints: [
      'Fraud loss rate (basis points of GMV): primary business metric',
      'False positive rate on verified good customers: directly measures customer friction',
      'Review queue precision and throughput: efficiency of human review tier',
      'Chargeback ratio: chargebacks as % of transaction volume — regulatory threshold matters',
      'Detection latency: time from transaction to fraud flag, especially for batch scoring',
    ],
    trap: 'Reporting only model AUC to stakeholders — business stakeholders care about fraud loss bps and customer decline rate, not AUC.',
  },
  {
    difficulty: 'senior',
    question: 'Design a complete real-time fraud detection system for a payment processor handling 50,000 transactions per second.',
    keyPoints: [
      'Ingestion: Kafka for transaction events, < 10ms from transaction to model score',
      'Feature pipeline: Redis for real-time velocity features (1-min, 10-min windows), Cassandra for historical patterns, nightly graph feature materialization',
      'Model tier: XGBoost for tabular features (1ms inference), ensemble with behavior model for session-level features',
      'Serving: stateless model servers behind load balancer, auto-scaled to maintain < 50ms P99',
      'Monitoring: fraud rate per segment, FPR, chargeback ratio, feature freshness, model score distribution',
    ],
    trap: 'Proposing a centralized ML model for all 50k TPS without considering horizontal scaling — at this scale, the serving layer must be horizontally partitioned.',
  },
  {
    difficulty: 'senior',
    question: 'How do you balance fraud prevention and customer experience in threshold design?',
    keyPoints: [
      'Segment transactions by risk profile — apply different thresholds per segment',
      'High-value transactions: lower threshold (more aggressive detection, accept higher FPR)',
      'Trusted merchants with long history: higher threshold (lower friction for trusted relationships)',
      'Quantify the cost of a declined legitimate transaction: customer lifetime value × churn probability',
      'Present the FP/FN cost curve to the business and let them pick the operating point',
    ],
    trap: 'Using a global single threshold — one threshold for all transactions is almost never optimal; different risk segments require different tradeoffs.',
  },
  {
    difficulty: 'senior',
    question: 'How do you build a graph-based fraud detection feature pipeline?',
    keyPoints: [
      'Entity graph: nodes = cards, accounts, devices, IPs, emails, merchants; edges = shared attributes or transactions',
      'Graph database (Neo4j, TigerGraph) or distributed graph processing (GraphX, DGL) for computation',
      'Nightly batch: compute graph features per entity (degree, clustering coefficient, distance to fraud nodes)',
      'Materialize graph features to online feature store (Redis) for low-latency serving',
      'Real-time graph update: append new edges as transactions occur, but use nightly features for serving',
    ],
    trap: 'Trying to compute graph features in real-time during scoring — graph traversal is expensive and cannot be done within a 100ms latency budget at scale.',
  },
  {
    difficulty: 'senior',
    question: 'How do you evaluate a fraud model when your test set is biased by the existing model\'s decisions?',
    keyPoints: [
      'Resampling bias: test set only contains approved transactions — systematic exclusion of high-risk declines',
      'Retrospective A/B test: approve a random sample of borderline transactions to get unbiased labels',
      'Inverse propensity weighting: weight test examples by probability of being approved under the old model',
      'Use chargeback data as additional labels — chargebacks provide ground truth for approved fraud',
      'Report expected calibration error and recall separately for the observable and unobservable populations',
    ],
    trap: 'Treating the existing test set as a representative sample when it was selected by a previous model — the apparent improvement may be an evaluation artifact.',
  },
  {
    difficulty: 'junior',
    question: 'What is a chargeback and why does it matter for fraud detection?',
    keyPoints: [
      'Chargeback: customer disputes a transaction, bank reverses the charge, funds returned to customer',
      'For merchants/payment processors: chargebacks indicate fraud that was missed by the system',
      'Payment networks set chargeback ratio thresholds — exceeding them results in fines and risk of losing processing rights',
      'Chargeback data provides ground truth labels for approved fraud — essential for model retraining',
    ],
    trap: 'Treating chargebacks only as a financial metric — they are also the primary source of ground truth labels for fraud that the model missed.',
  },
  {
    difficulty: 'mid',
    question: 'When would you use asynchronous fraud detection instead of synchronous real-time scoring?',
    keyPoints: [
      'When the payment type supports post-hoc reversal: ACH, wire transfers, check clearing',
      'When fraud loss per transaction is low but volume is high — latency cost exceeds expected fraud loss',
      'When richer features (graph traversal, complex historical aggregations) improve detection enough to justify async',
      'Risk: fraud occurs before detection — only feasible when reversal is possible and low cost',
      'Hybrid: synchronous rule-based check, async ML scoring with reversal if fraud confirmed',
    ],
    trap: 'Defaulting to synchronous scoring for all transaction types — wire transfers and ACH have very different latency and reversal characteristics than card transactions.',
  },
  {
    difficulty: 'senior',
    question: 'How do you detect and respond to a fraudster who has reverse-engineered your model features?',
    keyPoints: [
      'Detection: monitor for anomalous feature distributions in declined transactions — adversarial patterns often leave traces',
      'Feature obfuscation: never expose model features or decision reasons in API responses',
      'Ensemble diversity: rotate between models with different feature sets — gaming one does not defeat all',
      'Honeypot features: include features that look useful but are deliberately noisy — model reliance on them indicates adversarial injection',
      'Rapid retraining: if a fraud pattern is identified, retrain within 24 hours on the new examples',
    ],
    trap: 'Treating model security as an afterthought — in fraud, the model is a target for adversarial attack and must be designed with adversarial robustness from the start.',
  },
  {
    difficulty: 'mid',
    question: 'How would you set up the human review tier for a fraud detection system?',
    keyPoints: [
      'Route transactions with model score in the "review window" (e.g., 0.40–0.70 when threshold is 0.50)',
      'Review queue capacity: estimate analyst throughput × team size to determine sustainable queue volume',
      'Analyst tools: transaction history, graph visualization, customer contact info, pattern explanation',
      'SLA: high-risk reviews must complete within 2 minutes for pending transaction holds',
      'Close the loop: analyst decisions feed back as labels for model retraining',
    ],
    trap: 'Making the review window too wide — a wide review window overwhelms analysts and the queue becomes a choke point, forcing auto-decline of the backlog.',
  },
];
