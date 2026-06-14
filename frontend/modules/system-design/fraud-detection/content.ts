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
    body: `A fraud detection system must make a binary approve-or-decline decision before the user notices any delay. For card-present and online card transactions, the entire pipeline from transaction receipt to decision must complete in under 100 ms at P99. This constraint is not arbitrary - payment networks require it, and a 200 ms response causes measurable checkout abandonment. Every architectural decision flows from this latency budget: which features can be computed in real time, which must be precomputed, which model families are feasible, and how many tiers of review the system can support.

The canonical production pipeline has four stages. First, a rules engine evaluates deterministic blocklist and heuristic rules that can be checked in under 1 ms with no model inference: is this card on the stolen-card blocklist? Is the transaction country sanctioned? Is the velocity above a hard threshold? Rules catch 20-40% of fraud with near-zero false positive rate on verified good customers. Second, a feature extraction layer reads real-time features from Redis (velocity counts, session signals) and historical features from Cassandra or DynamoDB (lifetime patterns, device history) in a single batched operation targeting 5-10 ms. Third, an ML model scores the transaction, producing a fraud probability between 0 and 1. XGBoost or LightGBM inference on CPU takes 1-5 ms; neural network inference on GPU takes 5-20 ms. Fourth, a threshold comparison converts the score to a decision: approve, decline, or route to human review.

The tiered design is important for both cost and accuracy. Running every transaction through an expensive ML model is wasteful when deterministic rules can block obvious fraud cheaply. The ML layer adds value precisely for the ambiguous cases that rules cannot handle - a transaction that is not on any blocklist, not in a sanctioned country, not at extreme velocity, but whose combination of features is subtly wrong. Human review adds value for the thin slice of transactions - typically 1-5% - where the model's score falls in the uncertain region near the decision threshold, and where an analyst with access to additional context can make a better judgment than the model can from structured features alone. Stripe's public documentation describes a similar tiered philosophy: their Radar product applies rules first, then ML scoring, and allows merchants to configure the threshold at which transactions are blocked versus held for review.`,
  },
  {
    heading: 'Feature Engineering for Fraud',
    body: `Fraud is fundamentally a behavioral anomaly - it manifests as a deviation from what is normal for this card, this account, this device, and this merchant. The most powerful fraud features are therefore not static attributes of the transaction itself but dynamic measurements of how this transaction compares to established baselines. Building and maintaining these features requires a multi-tier feature architecture that spans real-time streams, near-real-time aggregations, and batch-computed historical patterns.

Velocity features are consistently among the most predictive signals in fraud detection. A card used 30 times in 5 minutes is almost certainly compromised; a card used twice in a day at the same merchant type is normal. Velocity counts are computed at multiple time windows simultaneously - 1 minute, 10 minutes, 1 hour, 24 hours - and at multiple entity levels: per card, per device, per IP address, per email, and per merchant. This produces a feature vector of roughly 20-40 velocity counts per transaction, all of which need to be freshly computed at request time. The standard implementation maintains rolling count windows in Redis using sorted sets, where each transaction event is written as a sorted set member with the transaction timestamp as the score, and the count at a given window is computed as ZCOUNT over the relevant time range. This lookup takes 1-3 ms per entity but can be parallelized across entities.

Historical pattern features capture what is normal for this particular card and user. Average transaction amount, modal merchant category, typical transaction hours, geographic clustering of past transactions, and longest gap between transactions all define the user's behavioral baseline. A $5,000 transaction at 3am in a country the user has never visited deviates dramatically from all of these baselines simultaneously - each deviation is a weak signal, but the combination is very strong. These features require looking up the user's full transaction history, which makes them infeasible to compute in real time at scale. They are precomputed nightly as batch aggregations, materialized in a low-latency feature store keyed by card and account ID, and served in 2-5 ms at request time.

Graph features are the most expensive to compute but capture ring fraud and money mule networks that individual transaction signals cannot detect. The entity graph connects cards, accounts, devices, IP addresses, email addresses, and phone numbers through shared-attribute edges. A device seen at multiple accounts is suspicious; an email domain that appears across hundreds of recently created accounts is a fraud ring signal. Graph features - degree centrality of this device node, clustering coefficient of this account's neighborhood, shortest path distance to the nearest known-fraud entity - are computed nightly using distributed graph processing (Apache Spark GraphX, or dedicated graph databases like TigerGraph) and materialized to Redis for fast serving. Real-time graph traversal at serving time is not feasible at the latencies required for card transactions.`,
  },
  {
    heading: 'Class Imbalance - The Core Challenge',
    body: `At most payment processors, fraud represents 0.1-1% of all transactions. At the high end - a new digital payments platform with weak controls - fraud might reach 2-3%. This extreme class imbalance has pervasive consequences for every step of the ML pipeline: metric selection, training procedure, threshold calibration, and evaluation methodology. Getting any one of these wrong produces a model that looks good in development and fails silently in production.

The most common mistake is evaluating on accuracy. A model that predicts "not fraud" for every single transaction achieves 99-99.9% accuracy on a dataset with 0.1-1% fraud rate. This model catches zero fraud and is completely useless, but its accuracy score is indistinguishable from a strong model. The metrics that matter for fraud detection are precision (of transactions flagged as fraud, what fraction actually are fraud - measures how much analyst time is wasted on false alarms), recall (of all actual fraud, what fraction was caught - measures what fraction of fraud loss is prevented), and Area Under the Precision-Recall Curve (PR AUC, which summarizes the model's precision-recall tradeoff across all thresholds without being inflated by the large true-negative class). AUC-ROC is widely reported but can be misleading for highly imbalanced problems because it is influenced by the true-negative rate, which looks excellent when negatives dominate.

Training under class imbalance requires deliberate intervention. Cost-sensitive learning is the most principled approach: assign a higher loss weight to false negatives (missed fraud) than to false positives (false declines) in the training objective, reflecting the actual cost asymmetry. For XGBoost and LightGBM, this is controlled via the scale_pos_weight parameter, which scales the positive class gradient by its value. If fraud represents 1% of transactions and you want the model to treat a missed fraud as 10 times worse than a false decline, set scale_pos_weight to approximately 10. Undersampling the majority class - randomly removing non-fraud examples until the dataset reaches a desired class ratio - is computationally efficient and effective for very large datasets where training on the full negative class adds computational cost without adding much information. SMOTE (Synthetic Minority Oversampling Technique) generates synthetic fraud examples by interpolating between existing fraud examples in feature space, which can improve recall by 10-20% compared to no resampling, but runs a risk of generating synthetic examples that do not represent realistic fraud patterns. Research consistently shows that a combination of moderate undersampling (targeting a 5:1 or 10:1 ratio rather than 50:1 or 100:1) combined with cost-sensitive learning outperforms pure SMOTE for most fraud detection workloads.

A critical but often overlooked point: the resampling strategy should only be applied to the training set, never to the validation or test set. The model will be deployed against the natural class distribution, and evaluation should reflect that distribution. Evaluating on a balanced test set produces optimistic metrics that do not translate to production performance. Similarly, the threshold used during evaluation must match the threshold used during deployment.`,
  },
  {
    heading: 'Threshold Optimization and the Business Cost Matrix',
    body: `The ML model outputs a fraud probability score between 0 and 1 for each transaction. Converting this continuous score into a binary approve-or-decline decision requires choosing a threshold. This threshold choice is the most consequential business decision in the fraud system design, and it is not a technical optimization problem - it is an economic one. The optimal threshold depends entirely on the relative costs of the two error types, which vary by industry, transaction type, merchant category, and company risk tolerance.

Quantifying these costs concretely changes the conversation. Stripe's primer on fraud detection provides a worked example that crystallizes the economics: for a product with a $26 sales price, $2.08 profit margin, and a $15 chargeback fee, one fraudulent transaction causes $38.92 in total loss ($26 product cost + $15 chargeback fee minus whatever was recovered), which wipes out the profit from approximately 19 legitimate sales. This means the break-even fraud detection precision is about 5% - even a model that wrongly flags 95 legitimate transactions for every 5 genuine frauds caught is still net positive. For high-margin digital goods, the math is even more aggressive. For thin-margin physical goods, the calculation reverses, and the cost of false positives (customer churn, negative reviews, customer service burden) may exceed the cost of letting some fraud through. The correct cost matrix is specific to each merchant segment, which is why production systems at Stripe and PayPal apply different thresholds to different merchant categories rather than a single global threshold.

The optimal threshold is computed on a validation set representative of the production transaction mix. For each candidate threshold value, compute the total expected cost as FP_count * cost_FP + FN_count * cost_FN, where cost_FP is the expected cost of falsely declining one legitimate transaction and cost_FN is the expected cost of approving one fraudulent transaction. Plot this cost curve across the threshold range - it is typically U-shaped, with high cost at very low thresholds (too many false positives) and high cost at very high thresholds (too many false negatives), and a minimum somewhere in between. Select the threshold at the minimum of this curve. The business team should provide the cost inputs; the ML team computes the optimal threshold given those inputs. This separation of concerns is important: the threshold decision belongs to the business, not the model.

Operating multiple thresholds is standard practice in production. A low-value transaction (under $10) at a known, trusted merchant warrants a much higher threshold (fewer declines, accept more risk) than a high-value transaction ($500+) at a merchant the user has never visited. New payment methods and international transactions with high chargeback rates warrant more aggressive thresholds. Session risk - whether the purchase follows suspicious session behavior like device fingerprint switching or unusual browsing patterns - justifies a lower threshold even for moderate-value transactions. The threshold management layer is separate from the model itself: the model scores every transaction identically, and the threshold selection logic applies segment-specific cutoffs based on transaction attributes.`,
  },
  {
    heading: 'Reject Inference - The Unobserved Label Problem',
    body: `Fraud detection training data has a fundamental sampling problem that is easy to miss: you only observe fraud outcomes for transactions that were approved. Every transaction that the current model declined never completed, so you have no observation of whether it would have been fraudulent or legitimate. This means your training data is not a random sample of all transactions - it is a sample biased toward transactions that the current model already considered low-risk. This is the reject inference problem, and ignoring it produces training sets with systematic bias that inflates apparent model quality and causes the model to perform worse on the borderline decisions that matter most.

The bias manifests in a specific way. Transactions near the current decision threshold - the genuinely ambiguous cases where the model is uncertain - are systematically underrepresented in the approved population and overrepresented in the declined population. If you retrain only on approved transactions, the new model is optimized for the easy cases (high-confidence approve and high-confidence decline) but has seen almost no examples of the borderline cases where its decisions have the most consequence. The model's apparent AUC on the training and test set looks excellent because both sets are drawn from the same approved-transaction distribution, but its performance on real borderline decisions degrades.

The methods for addressing reject inference span a spectrum from simple heuristics to rigorous causal inference. Augmentation assigns pseudo-labels to declined transactions: the pessimistic augmentation treats all declined transactions as fraud, the optimistic augmentation treats all as legitimate, and both are clearly wrong as standalone strategies. Fuzzy augmentation assigns each declined transaction a pseudo-label equal to the model's fraud probability score for that transaction, effectively treating high-scoring declines as probable fraud and low-scoring declines as probable legitimate. This is better than the binary augmentation but still circular - it uses the current model's predictions to generate the next model's training labels, which amplifies existing biases rather than correcting them. Semi-supervised approaches treat declined transactions as unlabeled examples and use self-training or label propagation to assign labels based on their proximity to labeled examples in feature space.

The only truly unbiased approach is an A/B test that randomly approves some fraction of borderline transactions - transactions with model scores near the decision threshold - observes their outcomes, and uses those outcomes as labels. This directly reveals the counterfactual: what fraction of currently declined transactions would have been fraudulent? The cost is explicit: some transactions that would have been fraudulent are approved, generating fraud loss. For most systems, the expected fraud loss from a small borderline approval experiment is far smaller than the long-term model quality improvement that results from having unbiased borderline-case labels. Running this experiment periodically - quarterly or annually - and retraining on the results is considered best practice for maintaining model quality on borderline decisions.`,
  },
  {
    heading: 'Model Stacking - Rule Engine + ML + Human Review',
    body: `No single automated component - not a rule engine, not a neural network, not a gradient boosted tree - produces the best fraud detection outcomes in isolation. Production systems universally combine multiple tiers in a stacking architecture, where each tier handles the cases it is best suited for and passes the remainder to the next tier. The goal is to minimize total cost (fraud loss plus operational cost plus customer friction) across the full transaction volume, not to maximize any individual tier's detection rate.

The rule engine tier operates on deterministic logic that can be evaluated in under 1 ms with no model inference. Rules operate on facts, not probabilities: "block if card number appears on the Visa or Mastercard global blocklist," "block if the billing country is on the sanctions list," "block if this card has made more than 20 transactions in the last 60 seconds," "block if the shipping address was added to the account in the last 10 minutes and the transaction amount exceeds $300." Rules catch the clearest fraud with essentially zero false positive rate on genuine good customers. The rule engine does not attempt to detect subtle fraud - it handles the definitively bad patterns that the ML model would detect anyway, saving ML inference cost and latency. Stripe's documentation indicates that deterministic rules block a significant fraction of fraud attempts before any ML scoring.

The ML tier scores all transactions not blocked by rules. XGBoost and LightGBM are the dominant choices for tabular features: they train in hours, produce interpretable feature importance, run inference in 1-5 ms per transaction batch, and handle mixed numerical and categorical features without preprocessing. Neural network models are used when the feature set includes sequence signals (ordered transaction history) or embedding inputs (device embeddings, merchant embeddings) that benefit from learned representations. Many production systems run both a GBDT and a neural network in an ensemble, with the GBDT handling interpretability requirements and the neural network adding incremental lift from embedding features. The ensemble output is a calibrated fraud probability, and the threshold comparison produces the approve/decline/review decision.

The human review tier is more operationally complex than it appears. The review window - the score range routed to human analysts rather than automatically approved or declined - must be tuned carefully. Too wide a review window overwhelms analyst capacity and forces auto-decline of the queue backlog, which is effectively a high false-positive rate for the queued transactions. Too narrow a window routes only extremely obvious borderline cases to analysts and misses the benefit of human judgment on ambiguous patterns. Analysts in the review tier have access to signals that the model cannot use in real time: they can contact the cardholder directly, see the merchant's recent chargeback history, review the account's full lifetime behavior, and apply pattern recognition to unusual combinations that fall outside the training distribution. The outcomes of human review - analyst decisions with eventual ground truth from chargebacks - feed back into model retraining, making the review tier not just a production safeguard but a source of high-quality labeled training data for borderline cases.`,
  },
  {
    heading: 'Real-time vs Batch Scoring',
    body: `Not all payment types have the same latency requirements or reversal properties, and the fraud detection architecture should match the characteristics of each payment type rather than forcing a single design onto all of them. The fundamental variable is whether a fraudulent payment can be reversed after the fact: if it can, asynchronous detection becomes viable; if it cannot, real-time detection is non-negotiable.

Credit and debit card transactions at point-of-sale or online require synchronous real-time scoring within 100 ms total pipeline time. Chargebacks exist as a reversal mechanism, but initiating a chargeback is costly for both the merchant (chargeback fee plus lost product) and the payment network, and excessive chargeback rates result in fines and potential loss of payment processing rights. The fraud detection system must make the correct decision in real time to avoid the chargeback in the first place. The model must be loaded in memory on the inference server - no disk reads in the critical path - and all features must be fetched from low-latency in-memory stores. XGBoost inference on CPU for a single transaction batch of 20-50 features consistently achieves 1-3 ms, which fits comfortably within the 100 ms total budget.

ACH (Automated Clearing House) transfers, wire transfers, and check clearing have settlement latencies measured in hours to days, not milliseconds. The payment network processes these asynchronously, and the fraud detection system has a much larger latency budget - sometimes hours. This opens the door to features that are computationally infeasible for real-time scoring: full graph traversal to identify money mule networks, complex historical aggregations over years of account history, and external database queries against third-party fraud intelligence services. Models can be more complex without latency constraints - deep learning models, ensembles, or Monte Carlo simulations of transaction risk scenarios are all feasible. The tradeoff is that fraudulent ACH transfers that are detected post-settlement require a reversal process that is expensive and not always successful.

Asynchronous fraud detection for low-value high-volume transactions is a deliberate design choice for some use cases. If the average transaction value is $5 and the cost of real-time ML inference is $0.001 per transaction, running synchronous scoring on 100 million daily microtransactions costs $100,000 per day in compute. If the fraud rate is 0.01% and the average fraud amount is $5, the expected fraud loss is $50,000 per day. Running cheaper rule-based real-time scoring and scoring the remainder asynchronously with a full ML model, then triggering reversals for detected fraud, may cost $20,000 per day in compute and $10,000 per day in unrecovered fraud - a significant saving. This calculation is specific to the cost structure of each business and must be recomputed as fraud rates, transaction volumes, and compute costs change.`,
  },
  {
    heading: 'Graph-Based Fraud Detection',
    body: `The most sophisticated fraud attacks are not isolated single-card compromises - they are organized operations involving dozens or hundreds of accounts, devices, merchants, and money movement patterns that leave traces in the relationships between entities rather than in the features of any individual transaction. Graph-based fraud detection constructs an entity relationship graph from transaction and account data, then extracts features from the graph structure to surface these coordinated fraud patterns.

The entity graph has nodes representing all relevant entities: payment cards, bank accounts, devices (identified by fingerprint or hardware ID), IP addresses, email addresses, phone numbers, physical addresses, and merchants. Edges connect entities that share attributes or have transactional relationships: a card and a device are connected if the card was used on that device; a device and an IP address are connected if they co-occurred; an account and an email domain are connected if the account was registered with that email. The graph captures patterns that are invisible in the feature vector of any individual transaction: a cluster of recently-created accounts all sharing the same device fingerprint, a merchant connected through three hops to twenty known-fraud cards, or a money mule network where funds flow from many compromised accounts through a small number of intermediary accounts before withdrawal.

The graph features most commonly used in fraud models are: degree centrality (how many entities share this device or IP - high degree in a short time window is suspicious), clustering coefficient (are this account's connected entities also connected to each other - high clustering indicates a fraud ring), shortest path distance to the nearest known-fraud node (accounts two hops from a confirmed fraud account are higher risk than those with no connection), and community membership (which cluster does this entity belong to, and what is the fraud rate in that cluster?). These features are computed offline in nightly batch jobs using distributed graph processing frameworks - Apache Spark GraphX, PyTorch Geometric, or dedicated graph databases like TigerGraph or Neo4j for systems requiring real-time graph queries.

The operational complexity of maintaining a production fraud graph is substantial. The entity graph at a mid-sized payment processor has billions of nodes and tens of billions of edges, spanning years of transaction history. Incremental updates as new transactions arrive must be applied correctly to maintain the graph's integrity. Graph community detection algorithms (Louvain, Girvan-Newman) for ring fraud detection are computationally expensive - a Louvain pass over a billion-node graph takes hours. Specialized graph features that require breadth-first search from a query node cannot be computed in real time within a 100 ms budget. The standard production architecture therefore computes all graph features in nightly batch jobs, materializes them into a Redis or Cassandra feature store keyed by entity ID, and serves them with 2-5 ms lookup latency at scoring time. The tradeoff is a 24-hour lag between when a fraud ring becomes detectable in the graph and when the model starts using that signal - a window that fraudsters can exploit if they know the refresh cadence.`,
  },
  {
    heading: 'Concept Drift in Fraud Detection',
    body: `Concept drift in fraud detection is categorically different from drift in other ML applications because it is intentional and adversarial rather than gradual and organic. A churn prediction model experiences drift because customers' behavior naturally changes over time - macroeconomic conditions shift, product features change, competitors enter. A fraud detection model experiences drift because fraudsters actively study it, identify its patterns, and deliberately alter their behavior to circumvent it. This adversarial feedback loop means that detection rate against the current fraud population degrades faster than in any other ML domain, and that the standard drift response - periodic retraining on recent data - is necessary but not sufficient.

The anatomy of adversarial drift is well-documented by fraud teams at companies like Stripe and PayPal. A newly trained model achieves high recall against the current fraud population. As the model deploys, the fraudsters most susceptible to detection are caught and removed from the attack population (selected out). The remaining population is implicitly more sophisticated. More deliberately, fraud ring operators study decline patterns, infer which features are causing declines, and change their tactics: they reduce transaction velocity to avoid velocity-based blocking, cycle through new devices and IP addresses to avoid device fingerprinting, and target merchant categories that the model's training data associate with lower fraud rates. Within weeks to months, a model that launched with 95% recall may degrade to 80% recall against the adapted fraud population.

The first-order response is high-frequency retraining. A model retrained weekly on recent transactions sees the most recent fraud patterns and has a shorter window for fraudsters to adapt. Daily retraining on the most recent 30 days of data is feasible with gradient boosting frameworks and greatly reduces the adaptation window. The second-order response is ensemble diversity: deploy multiple models with different feature sets, trained on different time windows, with different model families. A fraudster who has gamed the velocity features in the primary model has not necessarily gamed the graph features in a secondary model or the behavioral biometrics features in a third model. No single successful adaptation defeats all models in the ensemble simultaneously. Feature obfuscation - never exposing model features, scores, or decline reasons in API responses - limits the fraudster's ability to conduct experiments to identify which features are driving declines.

The most effective but rarely implemented defense is a honeypot evaluation protocol. Set aside a small dataset of the most recent confirmed fraud cases - fraud that the model has never been trained on and that occurred in the last 7 days - and evaluate detection rate on this honeypot set weekly. The honeypot set catches model degradation against the freshest fraud patterns far earlier than overall AUC metrics do, because overall AUC is dominated by historical fraud that the model already handles well. A drop in honeypot detection rate from 90% to 70% in a two-week period is a strong signal that the fraud population has adapted and retraining or rule addition is urgently needed.`,
  },
  {
    heading: 'Operational Metrics - Beyond Model Accuracy',
    body: `The gap between what ML teams measure during development (AUC-ROC, F1, precision at a fixed threshold) and what the business actually cares about (fraud loss in dollars, customer churn from false declines, analyst team workload, regulatory compliance) is wider in fraud detection than in almost any other ML application. A team that ships a model with improved AUC without understanding how that improvement translates into business outcomes will lose credibility with the stakeholders who control budget and deployment decisions. The translation requires mapping model metrics to operational and financial metrics with actual dollar signs.

Fraud loss rate is expressed in basis points (bps) of Gross Merchandise Value (GMV) - one basis point is 0.01%. An e-commerce platform processing $1 billion per month with a 15 bps fraud loss rate loses $1.5 million per month to fraud. Industry benchmarks vary significantly by vertical and card-present versus card-not-present (online) transactions. Online transactions generally run higher fraud rates - 15-50 bps depending on the industry - than card-present transactions (5-15 bps). Payment networks publish monthly benchmarks; exceeding them triggers warnings and eventual fines. Tracking fraud loss rate over time, segmented by merchant category, transaction type, and geography, is the primary business metric and the number that fraud teams are accountable for.

False positive rate on verified good customers is the second critical operational metric. Every false decline has a direct cost: the customer may abandon the cart, call customer service to dispute the decline, switch to a competitor for future purchases, or churn entirely. The probability of each outcome and its associated dollar cost determines the FP cost per declined legitimate transaction. For premium subscription products, a single false decline can trigger churn of a $200/year subscriber. For commodity e-commerce, the margin on a single falsely declined order may be $2. The target FPR varies accordingly: most consumer-facing payment systems target under 0.5% false decline rate on verified good customers, with premium segments targeted at under 0.1%.

Review queue metrics determine whether the human review tier is sustainable. Review queue volume is the number of transactions per day or per hour that require manual analyst review. Queue capacity is the maximum volume analysts can review at the required quality within the required SLA (typically 2-5 minutes per decision for transactions on hold). If queue volume exceeds capacity consistently, the queue backs up and the SLA is missed - resulting in either auto-declining the backlog (high FPR) or holding transactions past the SLA (degraded customer experience). Review queue precision - the fraction of reviewed transactions that turn out to be actual fraud - determines analyst efficiency. A precision of 30% means analysts are reviewing three legitimate transactions for every confirmed fraud case, which is operationally inefficient and morale-damaging. Tracking these metrics daily and alerting when queue volume approaches 80% of capacity is standard practice.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'Why is accuracy a poor metric for fraud detection models?',
    keyPoints: [
      'Fraud rate is typically 0.1–2% of transactions - predicting "not fraud" always achieves 98–99.9% accuracy',
      'A model that never detects fraud has near-perfect accuracy but is useless',
      'Use precision, recall, F1, AUC-ROC, and business cost metrics instead',
      'Precision: of flagged transactions, how many are actually fraud',
      'Recall: of actual fraud, how many are caught',
    ],
    trap: 'Reporting model accuracy as the primary metric - this impresses no one in a fraud context and signals misunderstanding of class imbalance.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between false positives and false negatives in fraud detection? What is the cost of each?',
    keyPoints: [
      'False positive: legitimate transaction declined - customer friction, potential churn',
      'False negative: fraudulent transaction approved - fraud loss absorbed by company',
      'Cost asymmetry varies by business: fraud loss per transaction vs review cost + customer experience',
      'Threshold choice explicitly trades off FP cost vs FN cost',
    ],
    trap: 'Treating FP and FN as equally costly - in most fraud contexts, the optimal threshold is not 0.5 because the costs are asymmetric.',
  },
  {
    difficulty: 'junior',
    question: 'What types of features are most useful for fraud detection?',
    keyPoints: [
      'Velocity features: transactions in last 1/10/60 minutes - strong signal for compromised cards',
      'Historical patterns: average amount, typical merchant category, usual transaction time',
      'Graph features: connections between cards, devices, IPs, known-fraud entities',
      'Behavioral biometrics: typing speed, device orientation, navigation patterns (session-level)',
    ],
    trap: 'Focusing only on static demographic features - fraud signals are primarily dynamic (velocity, graph connections) not static.',
  },
  {
    difficulty: 'junior',
    question: 'What is a tiered fraud detection system?',
    keyPoints: [
      'Tier 1 - Rule engine: blocks known-bad patterns instantly with zero model latency',
      'Tier 2 - ML model: scores remaining transactions, declines or flags high-risk ones',
      'Tier 3 - Human review queue: analysts investigate borderline model-uncertain cases',
      'Tiering reduces cost and latency while maintaining accuracy - not every transaction needs an ML score',
    ],
    trap: 'Running every transaction through the ML model - the rule engine tier eliminates obvious fraud cheaply, and many transactions do not need ML at all.',
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
    trap: 'Oversampling to a 50/50 split and evaluating on the balanced dataset - the model is deployed on an imbalanced distribution and evaluation should reflect that.',
  },
  {
    difficulty: 'mid',
    question: 'How do you select the optimal classification threshold for a fraud model?',
    keyPoints: [
      'Compute FP count × cost_FP + FN count × cost_FN across all threshold values on validation set',
      'Select threshold that minimizes total expected cost',
      'Cost_FP = review cost + expected churn loss; cost_FN = average fraud transaction value',
      'Use different thresholds for different transaction segments (high-value vs low-value)',
      'Visualize the cost curve vs threshold - it is usually a U-shape with a clear minimum',
    ],
    trap: 'Using the default threshold of 0.5 without considering the cost matrix - 0.5 is almost never the optimal threshold for imbalanced problems.',
  },
  {
    difficulty: 'mid',
    question: 'What is the reject inference problem and how do you handle it?',
    keyPoints: [
      'You only observe fraud labels for approved transactions - rejected transactions have no outcome',
      'Training only on approved transactions biases the model - it never learns from borderline declines',
      'Methods: fuzzy augmentation (pseudo-label based on model score), semi-supervised learning, A/B test (approve random sample)',
      'Most unbiased fix: A/B test - randomly approve borderline transactions to observe actual outcomes',
      'Acknowledge the bias in model evaluation - reported AUC is measured on observed-only data',
    ],
    trap: 'Ignoring the reject inference problem - a model trained only on approved transactions has systematic evaluation bias that inflates apparent performance.',
  },
  {
    difficulty: 'mid',
    question: 'How does fraud detection model drift differ from typical ML model drift?',
    keyPoints: [
      'Fraud drift is adversarial - fraudsters actively adapt to circumvent the model',
      'Not passive (users changing behavior organically) but intentional (fraudsters studying detection patterns)',
      'Requires more frequent retraining (weekly or even daily vs monthly for most models)',
      'Use adversarial training, ensemble diversity, and feature obfuscation as countermeasures',
      'Evaluate on a honeypot dataset of recent confirmed fraud not seen during training',
    ],
    trap: 'Applying the same drift response strategy as non-adversarial models - fraud drift requires adversarial countermeasures, not just periodic retraining.',
  },
  {
    difficulty: 'mid',
    question: 'What are the latency requirements for a real-time fraud scoring system and how do you meet them?',
    keyPoints: [
      'Total pipeline latency budget: < 100ms at P99 for synchronous card transactions',
      'Feature retrieval from Redis: 1–3ms for online features',
      'Model inference: XGBoost on CPU 1–5ms, neural network on GPU 5–20ms',
      'Model must be in memory - no cold starts, no disk I/O in the critical path',
      'Use connection pooling for feature store, pre-warm model server replicas',
    ],
    trap: 'Designing a system that meets average latency but fails P99 - fraud detection SLOs are measured at P99 to ensure consistent user experience.',
  },
  {
    difficulty: 'mid',
    question: 'How do you measure fraud detection system performance in production?',
    keyPoints: [
      'Fraud loss rate (basis points of GMV): primary business metric',
      'False positive rate on verified good customers: directly measures customer friction',
      'Review queue precision and throughput: efficiency of human review tier',
      'Chargeback ratio: chargebacks as % of transaction volume - regulatory threshold matters',
      'Detection latency: time from transaction to fraud flag, especially for batch scoring',
    ],
    trap: 'Reporting only model AUC to stakeholders - business stakeholders care about fraud loss bps and customer decline rate, not AUC.',
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
    trap: 'Proposing a centralized ML model for all 50k TPS without considering horizontal scaling - at this scale, the serving layer must be horizontally partitioned.',
  },
  {
    difficulty: 'senior',
    question: 'How do you balance fraud prevention and customer experience in threshold design?',
    keyPoints: [
      'Segment transactions by risk profile - apply different thresholds per segment',
      'High-value transactions: lower threshold (more aggressive detection, accept higher FPR)',
      'Trusted merchants with long history: higher threshold (lower friction for trusted relationships)',
      'Quantify the cost of a declined legitimate transaction: customer lifetime value × churn probability',
      'Present the FP/FN cost curve to the business and let them pick the operating point',
    ],
    trap: 'Using a global single threshold - one threshold for all transactions is almost never optimal; different risk segments require different tradeoffs.',
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
    trap: 'Trying to compute graph features in real-time during scoring - graph traversal is expensive and cannot be done within a 100ms latency budget at scale.',
  },
  {
    difficulty: 'senior',
    question: 'How do you evaluate a fraud model when your test set is biased by the existing model\'s decisions?',
    keyPoints: [
      'Resampling bias: test set only contains approved transactions - systematic exclusion of high-risk declines',
      'Retrospective A/B test: approve a random sample of borderline transactions to get unbiased labels',
      'Inverse propensity weighting: weight test examples by probability of being approved under the old model',
      'Use chargeback data as additional labels - chargebacks provide ground truth for approved fraud',
      'Report expected calibration error and recall separately for the observable and unobservable populations',
    ],
    trap: 'Treating the existing test set as a representative sample when it was selected by a previous model - the apparent improvement may be an evaluation artifact.',
  },
  {
    difficulty: 'junior',
    question: 'What is a chargeback and why does it matter for fraud detection?',
    keyPoints: [
      'Chargeback: customer disputes a transaction, bank reverses the charge, funds returned to customer',
      'For merchants/payment processors: chargebacks indicate fraud that was missed by the system',
      'Payment networks set chargeback ratio thresholds - exceeding them results in fines and risk of losing processing rights',
      'Chargeback data provides ground truth labels for approved fraud - essential for model retraining',
    ],
    trap: 'Treating chargebacks only as a financial metric - they are also the primary source of ground truth labels for fraud that the model missed.',
  },
  {
    difficulty: 'mid',
    question: 'When would you use asynchronous fraud detection instead of synchronous real-time scoring?',
    keyPoints: [
      'When the payment type supports post-hoc reversal: ACH, wire transfers, check clearing',
      'When fraud loss per transaction is low but volume is high - latency cost exceeds expected fraud loss',
      'When richer features (graph traversal, complex historical aggregations) improve detection enough to justify async',
      'Risk: fraud occurs before detection - only feasible when reversal is possible and low cost',
      'Hybrid: synchronous rule-based check, async ML scoring with reversal if fraud confirmed',
    ],
    trap: 'Defaulting to synchronous scoring for all transaction types - wire transfers and ACH have very different latency and reversal characteristics than card transactions.',
  },
  {
    difficulty: 'senior',
    question: 'How do you detect and respond to a fraudster who has reverse-engineered your model features?',
    keyPoints: [
      'Detection: monitor for anomalous feature distributions in declined transactions - adversarial patterns often leave traces',
      'Feature obfuscation: never expose model features or decision reasons in API responses',
      'Ensemble diversity: rotate between models with different feature sets - gaming one does not defeat all',
      'Honeypot features: include features that look useful but are deliberately noisy - model reliance on them indicates adversarial injection',
      'Rapid retraining: if a fraud pattern is identified, retrain within 24 hours on the new examples',
    ],
    trap: 'Treating model security as an afterthought - in fraud, the model is a target for adversarial attack and must be designed with adversarial robustness from the start.',
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
    trap: 'Making the review window too wide - a wide review window overwhelms analysts and the queue becomes a choke point, forcing auto-decline of the backlog.',
  },
];
