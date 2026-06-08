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
    heading: 'The Confusion Matrix — Foundation of Classification Metrics',
    body: `Every binary classification metric is derived from four fundamental quantities: True Positives (TP), False Positives (FP), True Negatives (TN), and False Negatives (FN).

TP: model predicted positive, and it was actually positive. FP: model predicted positive, but it was actually negative (false alarm). TN: model predicted negative, and it was actually negative. FN: model predicted negative, but it was actually positive (missed detection).

These four cells have different costs in different applications. In spam detection, FP (a legitimate email marked as spam) is more costly than FN (a spam email not caught). In cancer screening, FN (a cancer missed) is far more costly than FP (a benign result flagged for additional testing). Understanding the cost matrix of your application is the prerequisite to evaluating any metric.`,
  },
  {
    heading: 'Precision and Recall — When Each Matters',
    body: `Precision = TP / (TP + FP) — of all instances the model labeled positive, what fraction actually were positive?

Recall = TP / (TP + FN) — of all instances that actually were positive, what fraction did the model catch?

These two metrics are in direct tension through the classification threshold. Lowering the threshold increases recall (catch more positives) but decreases precision (more false alarms). Raising the threshold increases precision (fewer false alarms) but decreases recall (miss more positives).

When to optimize for precision: when the cost of a false positive is high. Spam filter (legitimate email lost), recommendation system (irrelevant recommendation erodes user trust), ad targeting (ad shown to the wrong user wastes budget).

When to optimize for recall: when the cost of a false negative is high. Cancer screening (missed diagnosis), fraud detection (missed fraud), safety systems (missed dangerous condition).

In ML interviews: name the application, state the cost asymmetry, then explain which metric to optimize. Never optimize precision or recall in isolation without this context.`,
  },
  {
    heading: 'F1 Score and F-beta',
    body: `F1 score is the harmonic mean of precision and recall: F1 = 2 × (precision × recall) / (precision + recall).

The harmonic mean penalizes extreme imbalance between precision and recall. A model with 90% precision and 10% recall has F1 = 0.18, not the arithmetic average of 50%. This makes F1 a better single-number summary than the arithmetic mean when both precision and recall matter.

F-beta generalizes this: F_β = (1 + β²) × (precision × recall) / (β² × precision + recall). β > 1 weights recall more heavily (β=2 means recall twice as important). β < 1 weights precision more heavily (β=0.5 means precision twice as important).

Limitation: F1 assumes precision and recall are equally important and averages across the threshold you happen to use. It does not tell you whether a better operating point exists on the precision-recall curve. Always plot the full PR curve, not just the F1 at one threshold.`,
  },
  {
    heading: 'ROC Curve and AUC',
    body: `The ROC (Receiver Operating Characteristic) curve plots True Positive Rate (recall) vs False Positive Rate (FPR = FP / (FP + TN)) across all possible classification thresholds. AUC (Area Under the Curve) summarizes the entire curve in a single number.

AUC interpretation: the probability that a randomly chosen positive instance receives a higher model score than a randomly chosen negative instance. AUC = 0.5 means the model performs no better than random. AUC = 1.0 is perfect discrimination.

AUC is threshold-independent — it measures the model's discrimination ability across all operating points. This is useful for comparing models before you have decided on a threshold. It is not the right metric if you care about performance at a specific operating point.

When AUC misleads: on highly imbalanced datasets, ROC AUC can look excellent while the model performs poorly on the positive class. At 99% negative rate, a model that outputs all negatives has 0% recall and 0% FPR — it lies on the ROC curve at the bottom left, not at AUC = 0.5. Use Precision-Recall AUC (Average Precision) for imbalanced datasets instead.`,
  },
  {
    heading: 'Precision-Recall Curve and Average Precision',
    body: `The Precision-Recall (PR) curve plots precision vs recall across all thresholds. It is more informative than the ROC curve for imbalanced datasets because it focuses on the performance of the positive class.

Average Precision (AP) is the area under the PR curve, weighted by the change in recall. It summarizes the model's precision at every recall level. High AP means high precision even at high recall — the model can catch many positives while remaining accurate.

Comparison: a model with higher AUC-ROC but lower Average Precision may actually perform worse for imbalanced use cases. When your positive class is rare (fraud, disease, defects), PR AUC is the more meaningful metric.

Plotting the PR curve: for each threshold value, compute precision and recall. Plot precision on y-axis, recall on x-axis. A model with a PR curve that stays high across the full recall range is better than one that has high precision only at low recall.

In ML system design interviews: mention Average Precision when discussing imbalanced problems. It signals that you know when ROC AUC is misleading.`,
  },
  {
    heading: 'Threshold Selection — Business Operating Point',
    body: `Once you have evaluated a model's precision-recall and ROC curves, threshold selection is a business decision, not a technical one.

Cost matrix approach: define cost_FP (cost of a false alarm) and cost_FN (cost of a missed detection). Compute total_cost = FP × cost_FP + FN × cost_FN at every threshold point. Select the threshold that minimizes total cost.

Constraint-based approach: "precision must be at least 90%, maximize recall subject to that constraint." Find the lowest threshold at which precision >= 90%, use that threshold.

F-beta approach: if you cannot quantify costs precisely but know recall is β times as important as precision, use the threshold that maximizes F_β.

Operating point documentation: record the selected threshold and the business justification. As the model is updated, re-evaluate whether the threshold should change. Model updates change the score distributions, so optimal thresholds change with every model update.

Multiple thresholds: for high-volume systems, use different thresholds for different user segments, transaction types, or risk tiers. One global threshold is almost never optimal.`,
  },
  {
    heading: 'Model Calibration — When Probabilities Must Be Accurate',
    body: `A well-discriminating model (high AUC) can still have poorly calibrated probabilities. Calibration measures whether the model's predicted probabilities match actual event rates.

Perfect calibration: among all instances where the model predicts 0.7, approximately 70% should actually be positive. A miscalibrated model might predict 0.7 for all instances where the actual rate is 40%.

Why calibration matters: systems that use raw model probabilities for downstream decisions (risk scoring, bid prices, insurance premiums) require calibrated probabilities. A miscalibrated model sets wrong prices, collects wrong premiums, or misallocates resources.

Calibration plot: bin predictions by score range (0–0.1, 0.1–0.2, ... 0.9–1.0). For each bin, plot the mean predicted probability vs the actual positive rate. A perfectly calibrated model's points fall on the diagonal.

Calibration techniques:
  • Platt scaling: fit a logistic regression on the model's raw outputs. Simple, works well for sigmoid-shaped miscalibration.
  • Isotonic regression: fit a monotone step function. More flexible, can correct arbitrary miscalibration, but requires more data.
  • Temperature scaling: for neural networks, divide logits by a learned temperature parameter before softmax.`,
  },
  {
    heading: 'Class Imbalance and Metric Selection',
    body: `Class imbalance — when one class is far more common than another — causes standard metrics to mislead.

Why accuracy fails: a model that always predicts the majority class achieves accuracy = majority class rate. At 1% positive rate, always predicting negative gives 99% accuracy with 0% recall.

Macro averaging: compute metric separately for each class, then average equally. Treats all classes as equally important regardless of size. Appropriate when minority class performance matters equally.

Micro averaging: aggregate TP, FP, FN across all classes, then compute metric. Weighted toward the majority class. Appropriate when overall system performance matters and minority class is genuinely less important.

Weighted averaging: compute metric per class, weight by class frequency. Standard in scikit-learn. Reports a number between macro and micro.

For imbalanced binary classification, report all of: AUC-ROC, Average Precision (PR AUC), precision at your operating threshold, recall at your operating threshold, and F1. A single number hides too much information.`,
  },
  {
    heading: 'Multi-class Metrics',
    body: `Binary classification metrics extend to multi-class in three ways: one-vs-rest (OVR), one-vs-one (OVO), and direct multi-class formulations.

One-vs-Rest (OVR): for each class, compute the metric treating that class as positive and all other classes as negative. Average across classes. Computationally efficient. Can be misleading when class frequencies are very unequal.

One-vs-One (OVO): for every pair of classes, compute the metric on only those two classes. Average across all pairs. More robust for imbalanced datasets. O(k²) computation for k classes.

Multi-class AUC: compute AUC for each class vs rest (OVR) or each pair (OVO), then average. Commonly reported as macro-averaged AUC or weighted-averaged AUC.

Confusion matrix for multi-class: K×K matrix where entry [i,j] is the number of examples of class i classified as class j. Off-diagonal entries reveal which class pairs are most confused. Essential for diagnosing multi-class model failures.

In interviews: when asked about multi-class metrics, explain the confusion matrix first, then derive which averaging makes sense given the problem's class distribution and cost structure.`,
  },
  {
    heading: 'Connecting Metrics to Business Outcomes',
    body: `Offline metrics (AUC, F1, precision, recall) are proxies. The business cares about revenue, cost, customer satisfaction, and regulatory compliance — not AUC.

The translation: map each metric category to a business quantity with dollar values.
  • FP rate → cost per false alarm × alarm volume → cost to business per day
  • FN rate → cost per missed event × event volume → loss to business per day
  • Threshold optimization → minimize (FP_rate × FP_cost + FN_rate × FN_cost)

Example: a fraud model with 95% recall and 80% precision at 10,000 fraudulent transactions/day:
  • Catches 9,500 fraud cases (saves $950,000 if average fraud = $100)
  • Generates 2,375 false alerts (costs $2,375 in review time at $1/alert)
  • Misses 500 fraud cases (costs $50,000 in undetected fraud)
  • Net value = $950,000 - $2,375 - $50,000 = $897,625/day vs no model

Presenting this calculation in an interview demonstrates that you understand metrics as business tools, not ends in themselves. Most interviewers at senior level expect this translation.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are the four entries in a confusion matrix and what does each represent?',
    keyPoints: [
      'TP: predicted positive, actually positive — correct detection',
      'FP: predicted positive, actually negative — false alarm',
      'TN: predicted negative, actually negative — correct rejection',
      'FN: predicted negative, actually positive — missed detection',
      'All metrics (precision, recall, F1, AUC) are derived from these four values',
    ],
    trap: 'Mixing up FP and FN — FP is a false alarm (model is wrong in the positive direction), FN is a miss (model is wrong in the negative direction).',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between precision and recall?',
    keyPoints: [
      'Precision = TP/(TP+FP): of all predicted positives, what fraction are correct — measures false alarm rate',
      'Recall = TP/(TP+FN): of all actual positives, what fraction are caught — measures miss rate',
      'Higher threshold → higher precision, lower recall',
      'Lower threshold → higher recall, lower precision',
    ],
    trap: 'Saying "precision is accuracy for positives" — precision measures how much of what the model calls positive is actually positive, not overall accuracy.',
  },
  {
    difficulty: 'junior',
    question: 'When should you optimize for precision vs recall? Give examples.',
    keyPoints: [
      'Optimize precision when FP cost is high: spam filter (legitimate email lost), irrelevant ad shown',
      'Optimize recall when FN cost is high: cancer screening (missed diagnosis), fraud detection (missed fraud)',
      'The cost asymmetry of the specific application determines which metric to prioritize',
      'Never optimize one in isolation — state the cost tradeoff explicitly',
    ],
    trap: 'Claiming precision is "better" or recall is "better" without specifying the application — the right choice depends entirely on the relative cost of FP vs FN.',
  },
  {
    difficulty: 'junior',
    question: 'What is AUC-ROC and what does it measure?',
    keyPoints: [
      'Area under the ROC curve (True Positive Rate vs False Positive Rate across all thresholds)',
      'Probability that a random positive receives a higher score than a random negative',
      'AUC = 0.5 is random, AUC = 1.0 is perfect, AUC = 0.0 is perfectly reversed',
      'Threshold-independent — measures model discrimination ability across all operating points',
    ],
    trap: 'Interpreting AUC as "the model is correct 85% of the time" (for AUC=0.85) — AUC is not accuracy; it is a ranking probability.',
  },
  {
    difficulty: 'junior',
    question: 'What is the F1 score and when is it useful?',
    keyPoints: [
      'Harmonic mean of precision and recall: 2 × (P × R) / (P + R)',
      'Penalizes extreme imbalance between precision and recall (unlike arithmetic mean)',
      'Useful when both precision and recall matter equally and you need a single summary number',
      'Limitation: assumes equal importance of precision and recall; use F-beta if they are not equal',
    ],
    trap: 'Using F1 as the only metric without plotting the full PR curve — a model can be tuned to maximize F1 at one threshold while being poor at other operating points.',
  },
  {
    difficulty: 'mid',
    question: 'When would you use Precision-Recall AUC instead of ROC AUC?',
    keyPoints: [
      'Imbalanced datasets where the positive class is rare (fraud, disease, defects)',
      'ROC AUC can appear high even when recall on the positive class is poor (TN inflates ROC)',
      'PR AUC focuses on the positive class performance — not affected by the large negative class',
      'If you care about ranking positive examples correctly, use PR AUC',
    ],
    trap: 'Always using ROC AUC as the default — for rare event detection (fraud at 0.1%, medical diagnosis), PR AUC is more informative.',
  },
  {
    difficulty: 'mid',
    question: 'How do you select the classification threshold for a production model?',
    keyPoints: [
      'Compute FP × cost_FP + FN × cost_FN across all thresholds on a validation set',
      'Select threshold minimizing expected total cost',
      'Or: use constraint-based approach — minimum acceptable precision/recall, then optimize the other',
      'Document the business justification for the selected threshold',
      'Re-evaluate threshold after every model update — score distributions change',
    ],
    trap: 'Using the default threshold of 0.5 without considering the cost matrix — 0.5 is almost never optimal for imbalanced problems.',
  },
  {
    difficulty: 'mid',
    question: 'What is model calibration and why does it matter?',
    keyPoints: [
      'Calibration: predicted probability 0.7 should correspond to 70% actual positive rate',
      'Matters for systems using raw probabilities: pricing, risk scoring, auctions, insurance',
      'A well-discriminating (high AUC) model can be poorly calibrated',
      'Techniques: Platt scaling, isotonic regression, temperature scaling for neural networks',
      'Assess with a calibration plot: predicted probability bins vs actual positive rate per bin',
    ],
    trap: 'Conflating high AUC with good calibration — a model can rank positives above negatives perfectly (AUC=1) but still have completely wrong probability magnitudes.',
  },
  {
    difficulty: 'mid',
    question: 'Why does accuracy fail as a metric for imbalanced classification?',
    keyPoints: [
      'A model predicting the majority class always achieves accuracy = majority class frequency',
      'At 1% positive rate: always predicting negative gives 99% accuracy with 0% recall',
      'Accuracy provides no signal on how well the model handles the rare class',
      'Use precision, recall, F1, or AUC for imbalanced problems',
    ],
    trap: 'Reporting accuracy as a supplementary metric alongside AUC for imbalanced problems — accuracy adds no information and misleads stakeholders.',
  },
  {
    difficulty: 'mid',
    question: 'Explain macro, micro, and weighted averaging for multi-class metrics.',
    keyPoints: [
      'Macro: compute metric per class, average equally — treats all classes as equally important',
      'Micro: aggregate TP/FP/FN across all classes, compute metric — weighted toward majority class',
      'Weighted: per-class metric weighted by class frequency — between macro and micro',
      'Use macro when minority class performance matters; use micro when overall performance matters',
    ],
    trap: 'Using micro-averaging for an imbalanced multi-class problem and claiming good performance — micro-averaging hides poor minority class performance.',
  },
  {
    difficulty: 'mid',
    question: 'How do you plot and interpret a calibration curve?',
    keyPoints: [
      'Bin predictions by score range (10 equal-width bins: 0–0.1, 0.1–0.2, etc.)',
      'For each bin, compute mean predicted probability and actual positive rate',
      'Plot predicted probability (x-axis) vs actual rate (y-axis)',
      'Perfect calibration = diagonal line',
      'Curve above diagonal = underconfident (model hedges), below = overconfident (model too sure)',
    ],
    trap: 'Evaluating only on the training set calibration — calibration must be measured on held-out data to be meaningful.',
  },
  {
    difficulty: 'senior',
    question: 'Design the evaluation framework for a credit default prediction model that must meet both accuracy and fairness requirements.',
    keyPoints: [
      'Accuracy metrics: AUC-ROC, Average Precision, Brier score (calibration), threshold-specific precision/recall',
      'Fairness metrics: equal opportunity (equal TPR across groups), demographic parity (equal positive rate), calibration parity (equal calibration across groups)',
      'Operating point: threshold optimized using business cost matrix, then validated for fairness — adjust if fairness violation found',
      'Intersectional evaluation: metrics per demographic group and per subgroup combinations (gender × age × geography)',
      'Regulatory requirement: document all metrics, threshold decisions, and fairness trade-offs in a model card',
    ],
    trap: 'Only reporting aggregate AUC without evaluating per-group performance — regulatory frameworks (ECOA, Fair Housing Act) require evidence of non-discrimination by protected group.',
  },
  {
    difficulty: 'senior',
    question: 'A model has AUC = 0.92 in offline evaluation but performs poorly in production. What could explain this?',
    keyPoints: [
      'Calibration failure: AUC is fine but predicted probabilities are wrong — downstream systems using scores are misled',
      'Train-test distribution mismatch: test set is not representative of production traffic',
      'Threshold selection: model was evaluated at one threshold but deployed at a different one',
      'Label leakage: offline test set had future information that is not available in production',
      'Training-serving skew: feature computation differs between training pipeline and serving pipeline',
    ],
    trap: 'Concluding the model needs retraining — first diagnose whether the offline-online gap is due to calibration, threshold mismatch, skew, or label issues.',
  },
  {
    difficulty: 'senior',
    question: 'How do you translate model metrics into a business case for a stakeholder presentation?',
    keyPoints: [
      'Map FP rate to cost per false positive × daily volume = daily cost to operations',
      'Map FN rate to cost per missed event × daily volume = daily loss',
      'Compare total daily cost at current threshold to optimal threshold — quantify the improvement',
      'Compare model performance to baseline (no model, simple rules) — compute incremental value',
      'Project annual ROI: (daily_value_with_model - daily_value_without) × 365 vs model development cost',
    ],
    trap: 'Presenting only AUC or F1 to business stakeholders — non-technical stakeholders need dollar amounts and error counts, not statistical metrics.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle threshold calibration when the model is deployed with different SLOs for different customer tiers?',
    keyPoints: [
      'Compute separate cost matrices per customer tier (enterprise, SMB, consumer)',
      'Apply tier-specific thresholds: enterprise gets more aggressive detection (lower threshold = higher recall), consumer gets lower friction (higher threshold = higher precision)',
      'Feature flag or routing layer applies correct threshold based on customer tier at serving time',
      'Monitor per-tier precision and recall separately in production',
      'Evaluate fairness across tiers — ensure lower-tier customers are not systematically disadvantaged',
    ],
    trap: 'Using a single global threshold for all customer tiers — enterprise customers often have different risk tolerances and error costs than consumer customers.',
  },
  {
    difficulty: 'junior',
    question: 'What is the precision-recall tradeoff and how does the classification threshold control it?',
    keyPoints: [
      'Increasing threshold: fewer positives predicted → fewer FP (higher precision) → but also fewer TP (lower recall)',
      'Decreasing threshold: more positives predicted → more TP (higher recall) → but also more FP (lower precision)',
      'The threshold is the single knob that moves you along the precision-recall curve',
      'There is no threshold that simultaneously maximizes both — choosing one means accepting less of the other',
    ],
    trap: 'Claiming that a better model "has both higher precision and higher recall at the same threshold" — this is only possible if the model itself is improved, not by adjusting the threshold.',
  },
  {
    difficulty: 'mid',
    question: 'How do you evaluate a model\'s performance when ground truth labels are delayed by 30 days?',
    keyPoints: [
      'Proxy metrics: use leading indicators available immediately (score distribution stability, feature coverage, output range)',
      'Stratified evaluation: use a small cohort of short-cycle labels (e.g., same-day confirmations) for fast feedback',
      'Rolling evaluation: continuously evaluate on labeled examples as labels arrive — 30-day delayed AUC computed on a rolling basis',
      'Calibration monitoring: even without labels, monitor whether predicted probabilities are consistent with historical label rates',
    ],
    trap: 'Waiting 30 days for all labels before any production monitoring — 30-day label lag means a bad model goes undetected for a month without proxy metrics.',
  },
  {
    difficulty: 'junior',
    question: 'What is average precision (AP) and how does it differ from AUC-ROC?',
    keyPoints: [
      'AP is the area under the precision-recall curve — summarizes precision at every recall level',
      'AUC-ROC is the area under the ROC curve — summarizes TPR vs FPR across all thresholds',
      'AP is more informative for imbalanced datasets — not influenced by large TN count',
      'AP = 0.5 means the model performs at chance on the positive class; AUC-ROC = 0.5 is the same for ROC',
    ],
    trap: 'Using AP and AUC-ROC interchangeably — they measure different things and can diverge significantly on imbalanced datasets.',
  },
];
