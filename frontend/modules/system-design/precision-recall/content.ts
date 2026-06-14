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
    heading: 'The Confusion Matrix - Foundation of Classification Metrics',
    body: `Every binary classification metric - precision, recall, F1, AUC, specificity, and dozens of domain-specific variants - is derived from four fundamental counts: True Positives (TP), False Positives (FP), True Negatives (TN), and False Negatives (FN). Understanding the confusion matrix is not just a prerequisite to understanding metrics; it is the lens through which the business meaning of a model's behavior becomes visible. A model that is 99% accurate may be producing 10,000 FPs per day, causing significant operational cost, while a model with 85% accuracy may be producing only 100 FPs per day because it operates at a very different threshold.

TP is the count of examples the model correctly predicted as positive - the cancer screenings that correctly identified malignant tumors, the fraud transactions that were correctly flagged, the spam emails that were correctly caught. FP is the count of examples the model predicted as positive that were actually negative - the false alarms, the legitimate transactions wrongly declined, the healthy patients sent for unnecessary biopsies. TN is the count of correctly predicted negatives - the legitimate transactions correctly approved, the genuine emails correctly delivered. FN is the count of actual positives that the model missed - the fraudulent transactions approved, the cancers not caught, the spam delivered to the inbox.

The critical insight is that TP, FP, TN, and FN have vastly different costs depending on the application domain, and those costs are not symmetric. In cancer screening, the societal consensus is that an FN (missed cancer) is catastrophically more costly than an FP (unnecessary follow-up biopsy). In legal discovery document review, FN (missed responsive document) may expose a law firm to sanctions, while FP (reviewing a non-responsive document) wastes some analyst time. In email spam filtering, FP (legitimate email in spam folder) may be more costly than FN (spam in inbox) because users tolerate spam but are angry when real email is lost. Understanding the cost matrix of a specific application domain - not just knowing the formulas - is the skill that separates engineers who can apply classification metrics from those who merely know them.`,
  },
  {
    heading: 'Precision and Recall - When Each Matters',
    body: `Precision and recall measure complementary and conflicting properties of a classifier, and the tension between them is not a mathematical curiosity but a direct reflection of a real-world tradeoff between two types of error. Precision = TP / (TP + FP) answers: "Of all the instances we labeled as positive, how many actually were positive?" It measures the rate of false alarms - the fraction of the model's positive predictions that are wrong. Recall = TP / (TP + FN) answers: "Of all the instances that actually were positive, how many did we correctly identify?" It measures the miss rate - the fraction of actual positives the model failed to detect.

The fundamental tradeoff is controlled by the classification threshold. Lowering the threshold causes more examples to be predicted positive, which increases TP (catching more of the true positives) but also increases FP (falsely flagging more negatives) - increasing recall and decreasing precision. Raising the threshold causes fewer examples to be predicted positive, which increases the precision of remaining positive predictions but decreases recall as fewer true positives clear the higher bar. At the extreme of threshold = 0, every example is predicted positive, recall = 1.0 and precision = positive class prevalence. At threshold = 1, no example is predicted positive, and both precision and recall are undefined (0/0 by convention). The operating threshold is the single knob that moves you along the precision-recall curve, and choosing it correctly requires understanding the application's cost matrix.

When to optimize for precision: in contexts where false alarms are expensive. An ad targeting system that predicts purchase intent should be high-precision: showing an expensive high-intent ad to a user who has no purchase intent wastes the advertiser's budget and annoys the user. A content moderation system that removes posts for policy violations should be high-precision because falsely removing legitimate content suppresses valid expression and creates legal and reputational risk. A medical test used for screening an asymptomatic population where positive results trigger expensive or dangerous follow-up procedures (such as invasive biopsies) should be high-precision to avoid over-treatment. When to optimize for recall: in contexts where misses are catastrophic. A cancer screening test should be high-recall because a missed cancer can be fatal while a false positive triggers a follow-up test, not immediate treatment. A safety-critical anomaly detector on an industrial system should be high-recall because missing a genuine fault can cause a catastrophic failure worth far more than the cost of investigating a false alarm. A fraud detection system where fraud loss per transaction is high should be high-recall, accepting more false declines to avoid more fraud losses. The discipline is always to name the application, state the cost asymmetry explicitly, and then derive which metric to optimize - not to state a general preference for one over the other.`,
  },
  {
    heading: 'F1 Score and F-beta',
    body: `The F1 score was designed to provide a single summary number when both precision and recall matter but neither dominates. It is defined as the harmonic mean of precision and recall: F1 = 2 * (precision * recall) / (precision + recall). The use of the harmonic mean rather than the arithmetic mean is deliberate and important: the harmonic mean is dominated by the smaller of the two values, which means a model with very high precision but very low recall gets a low F1 score, despite having a good arithmetic average. Specifically, a model with 99% precision and 1% recall has an arithmetic mean of 50% but an F1 of 1.98% - correctly signaling that a model that catches essentially none of the positives is useless, regardless of how precisely it identifies the tiny fraction it does catch.

The F-beta family generalizes F1 to handle cases where precision and recall have different relative importance. F_beta = (1 + beta^2) * (precision * recall) / (beta^2 * precision + recall). When beta = 1, this reduces to F1, treating precision and recall equally. When beta = 2, the formula weights recall twice as heavily as precision - appropriate for fraud detection or cancer screening where misses are more costly than false alarms. When beta = 0.5, the formula weights precision twice as heavily as recall - appropriate for information retrieval where users care more about the quality of returned results than exhaustive coverage. The beta parameter should be chosen by asking: "How many false positives is one false negative worth?" If one missed fraud is worth tolerating 10 false declines, beta should be approximately sqrt(10) ≈ 3.16.

F1 and F-beta have important limitations that are frequently ignored in practice. They measure performance at a single threshold - the one used when computing precision and recall - and provide no information about the shape of the precision-recall curve at other thresholds. A model that achieves F1 = 0.75 at threshold 0.5 might be outperformed at threshold 0.3 by its own F1 of 0.82, and both values hide the fact that a competing model with F1 = 0.74 at threshold 0.5 might have Average Precision of 0.85 compared to your model's 0.72 - making the competitor better across most of the operating range despite being slightly worse at the single threshold you happen to evaluate at. The discipline in production metric reporting is to plot the full PR curve and report Average Precision as the summary statistic, reserving F1 for the specific operating threshold selected for deployment.`,
  },
  {
    heading: 'ROC Curve and AUC',
    body: `The ROC (Receiver Operating Characteristic) curve was developed in the 1950s for evaluating radar signal detection systems and has become the dominant model comparison metric in ML for good reasons and some bad ones. It plots True Positive Rate (TPR = recall = TP / (TP + FN)) against False Positive Rate (FPR = FP / (FP + TN)) across all possible classification thresholds. Each point on the ROC curve corresponds to a different threshold: the point (FPR=0, TPR=0) corresponds to threshold=1 (predict all negative), and the point (FPR=1, TPR=1) corresponds to threshold=0 (predict all positive). A model with no discrimination ability produces the diagonal line from (0,0) to (1,1) - at every threshold, it catches the same fraction of positives as it incorrectly flags negatives. A useful model produces a curve that bows toward the upper-left corner, indicating that it can achieve high TPR with low FPR.

AUC (Area Under the ROC Curve) has a compelling probabilistic interpretation: it equals the probability that a randomly chosen positive example receives a higher model score than a randomly chosen negative example. This makes AUC a measure of ranking quality - how well the model separates the positive and negative classes in score space - independent of any threshold choice. AUC = 0.5 means the model ranks positives and negatives no better than random; AUC = 1.0 means the model perfectly ranks all positives above all negatives. This threshold-independence is AUC's primary advantage: it is suitable for comparing two models' overall discrimination ability without committing to a specific operating point.

AUC has a well-known failure mode on imbalanced datasets that is critical to understand. Consider a fraud detection dataset where 0.1% of transactions are fraudulent. A model that scores all transactions as 0 (predict all negative) achieves AUC = 0.5. But a model that scores 99% of legitimate transactions at 0 and 0.1% of legitimate transactions at 0.5, while scoring all 0.1% fraudulent transactions at 1.0, achieves AUC very close to 1.0 - because the fraudulent transactions all score higher than almost all legitimate transactions. However, this second model has perfect recall (catches all fraud) and essentially zero precision at any reasonable threshold above 0 (because its scores for legitimate transactions and fraudulent transactions overlap significantly). AUC says the second model is excellent; the business would say it has a 50% false positive rate and is unusable. This is not a flaw in AUC's definition - it accurately measures discrimination - but it demonstrates that for imbalanced problems where the precision of positive predictions matters, AUC-ROC provides misleading comfort. Average Precision (PR AUC) is the correct summary metric for imbalanced classification because it directly measures precision at every recall level, without being influenced by the large number of true negatives.`,
  },
  {
    heading: 'Precision-Recall Curve and Average Precision',
    body: `The Precision-Recall curve plots precision on the y-axis against recall on the x-axis as the classification threshold is varied from 1.0 to 0.0. Unlike the ROC curve, which includes the true negative rate (specificity) in its x-axis and is therefore influenced by the large number of true negatives in imbalanced datasets, the PR curve focuses exclusively on the positive class. Every point on the PR curve represents a specific threshold and answers: "At this recall level - this fraction of all true positives caught - what precision can this model achieve?" A model that can maintain high precision even at high recall is dramatically better than one that achieves high precision only by catching very few positives.

The shape of the PR curve reveals model behavior that AUC-ROC hides. A model might show an AUC-ROC of 0.92 while having a PR curve that drops sharply from precision 1.0 at recall 0.05 to precision 0.3 at recall 0.5, indicating that the model is excellent at identifying the most obvious positives but struggles enormously to catch the more ambiguous ones. Another model might show AUC-ROC of 0.89 but have a PR curve that descends gradually and maintains precision above 0.6 all the way to recall 0.8 - a much better operating characteristic for any business that needs to catch more than 5% of the positive class while maintaining useful precision. These two models are not comparable from AUC-ROC alone; the PR curve is the diagnostic that reveals their true operating characteristics.

Average Precision (AP) is the standard single-number summary of the PR curve: it is computed as the weighted mean of precision values at each recall threshold, weighted by the increase in recall from one threshold to the next. This is equivalent to the area under the PR curve when computed by the trapezoidal or interpolated approximation. In scikit-learn, average_precision_score() computes this correctly. Mean Average Precision (mAP) extends this to multi-class problems by computing AP for each class (treating it as a one-vs-rest binary problem) and then averaging across classes. mAP is the dominant evaluation metric in object detection and information retrieval research, where both precision and recall matter and the positive class is rare relative to the search space. In production ML systems, reporting AP alongside AUC-ROC for any imbalanced binary classification problem is considered best practice - the two metrics together provide a more complete picture than either alone.`,
  },
  {
    heading: 'Threshold Selection - Business Operating Point',
    body: `After training and evaluating a model's full precision-recall and ROC curves, the final step before deployment is selecting the classification threshold that converts the model's continuous score output into a binary decision. This step is frequently treated as a technical formality - just use 0.5 - but threshold selection is one of the most business-critical decisions in the ML deployment process, and the default of 0.5 is almost never the correct choice for real-world problems.

The cost matrix approach is the most principled method for threshold selection. Define cost_FP as the expected cost of one false positive (a false alarm acted upon by the system or a legitimate transaction declined) and cost_FN as the expected cost of one false negative (a genuine fraud missed, a cancer not detected, a defect passed through quality control). For each candidate threshold, compute the expected total cost as FP_count * cost_FP + FN_count * cost_FN on a held-out validation set. Plot this cost curve across the threshold range - it is typically U-shaped, with high cost at very low thresholds (too many FPs) and high cost at very high thresholds (too many FNs), with a clear minimum somewhere in between. Deploy the threshold at the minimum of this cost curve. The cost inputs should come from the business team, not be assumed by the ML team: cost_FP is a business quantity (value of churn risk from a false decline, labor cost of a false fraud review, patient harm from an unnecessary procedure) that the ML team cannot determine independently.

Constraint-based threshold selection is appropriate when the business specifies hard requirements on one metric and wants to maximize the other. "Our spam filter cannot flag more than 0.01% of legitimate emails as spam" specifies a maximum acceptable FPR; the threshold should be set as low as possible while satisfying this constraint, then recall is whatever it happens to be. "Our fraud model must catch at least 90% of fraud" specifies a minimum recall; the threshold is set to achieve exactly 90% recall on the validation set, and precision is whatever it happens to be. These constraint specifications are almost always more natural for business stakeholders than cost matrix specifications, because they express requirements in terms of observable outcomes rather than abstract costs.

Multiple thresholds for different segments is standard practice in production systems with heterogeneous risk. A fraud detection system should not apply the same threshold to a $2 micropayment and a $5,000 wire transfer - the cost of a false decline relative to the cost of a missed fraud is completely different across these segments. A credit scoring system should not apply the same threshold to a first-time applicant with no credit history and a 10-year customer with a perfect payment record - the model's calibration and the business's risk tolerance differ across these segments. Threshold management in production requires building the segment-specific threshold configuration into the serving pipeline, monitoring per-segment precision and recall separately in production, and re-calibrating thresholds after every model update, since new model versions change the score distributions and the threshold that achieved the right operating point on the old model may be wrong for the new model.`,
  },
  {
    heading: 'Model Calibration - When Probabilities Must Be Accurate',
    body: `A classifier can rank positives above negatives almost perfectly - achieving AUC of 0.95 - while its predicted probabilities are systematically wrong by a factor of 2 or 3. These are independent properties: ranking quality measures whether positive examples score higher than negative examples, while calibration measures whether the numeric value of the score correctly reflects the actual probability of the positive class. A model with perfect ranking and terrible calibration is very useful for threshold-based binary decisions but will fail catastrophically in any downstream system that uses the raw probability score as an input.

The distinction matters in a large class of production applications. A credit risk model used to price loans must produce calibrated probabilities: if the model outputs 0.05 for an applicant, approximately 5% of applicants with that score should default, because the interest rate is set based on this expected default rate. A miscalibrated model that outputs 0.05 for applicants who actually default at a 12% rate will lead to systematic under-pricing of risk and eventual financial losses. An ad auction system that bids on impressions using predicted click-through rates requires calibrated CTR predictions: if the model predicts CTR of 0.03 when the true CTR is 0.009, the bidding system will over-bid by 3x and blow the advertising budget. A fraud scoring model whose outputs are used to set the review queue routing threshold must be calibrated: if the model outputs 0.7 for transactions that are actually fraudulent at a 20% rate, the threshold set based on the score has no predictable relationship to the actual fraud rate.

The calibration curve (reliability diagram) is the standard visualization: bin predicted probabilities into equal-width intervals (0-0.1, 0.1-0.2, etc.), compute the actual positive rate within each bin, and plot predicted probability (x-axis) against actual positive rate (y-axis). A perfectly calibrated model's points fall on the diagonal line y=x. A curve that lies below the diagonal indicates overconfidence - the model predicts higher probabilities than the actual rates. A curve above the diagonal indicates underconfidence - the model hedges its predictions toward 0.5 even when it should predict near 0 or near 1.

Three standard calibration correction techniques address different calibration patterns. Platt scaling fits a logistic regression to the model's raw score, learning a sigmoid-shaped transformation that maps the raw scores to calibrated probabilities. It is effective for models whose calibration error follows a sigmoid-shaped curve, which is common for SVMs and other margin-based classifiers. Isotonic regression fits a monotone non-decreasing step function from raw scores to calibrated probabilities, which is more flexible than Platt scaling and can correct arbitrary non-monotone miscalibration, but requires more data (typically thousands of examples) to avoid overfitting. Temperature scaling, developed specifically for neural networks, divides all logits by a single learned scalar "temperature" parameter before applying the softmax. A temperature greater than 1 reduces confidence (spreads the probability distribution), correcting overconfident networks; a temperature less than 1 increases confidence, correcting underconfident ones. Temperature scaling is remarkably effective for neural networks trained with cross-entropy loss, which are systematically overconfident due to the loss function's incentive to push logits to extreme values.`,
  },
  {
    heading: 'Class Imbalance and Metric Selection',
    body: `Class imbalance is the condition in which one class appears far more frequently than the other in the dataset, and it is the default state for most high-value ML applications rather than the exception. Credit card fraud rates are 0.1-1% of transactions. Malignant tumor rates in screening populations are 0.5-2%. Equipment failure rates in industrial predictive maintenance are 0.01-1% of monitored time windows. Malware rates in file scanning are 0.01-1% of scanned files. The rarity of the positive class in these applications is precisely why the applications have value - if fraud occurred in 50% of transactions, credit cards would not exist. The challenge is that standard ML metrics are designed for balanced datasets and produce deeply misleading conclusions when applied to imbalanced ones.

The failure of accuracy is the canonical example. A dataset with 99% negative examples allows a classifier that predicts negative for every single example to achieve 99% accuracy with zero true positives - a model that has learned absolutely nothing useful. This is not a subtle failure; it is a catastrophic one that is caught immediately if precision and recall are reported. But accuracy continues to appear in ML papers, code, and dashboards for imbalanced problems, causing misaligned incentives and poor model selection decisions. The correct default metric suite for imbalanced binary classification is: PR AUC (Average Precision) as the primary summary, AUC-ROC as a secondary summary for ranking quality, and precision and recall at the deployment threshold as the operationally relevant point estimates.

Multi-class metric averaging introduces a further subtlety when the class distribution is imbalanced. Macro averaging computes the metric separately for each class and then averages them equally, which gives equal weight to a class with 10 examples and a class with 10,000 examples. This is appropriate when the minority class is genuinely as important as the majority class - for example, a 10-class disease classification where a rare disease with few training examples is as important to detect correctly as a common one. Micro averaging aggregates TP, FP, and FN counts across all classes before computing the metric, which weights each example equally and therefore weights each class by its frequency. Micro-averaged precision is dominated by the majority class; a model that perfectly classifies the majority class and randomly guesses on all minority classes will have high micro-averaged precision. Weighted averaging computes per-class metrics and then averages them weighted by class frequency, producing a value between macro and micro. The choice of averaging method should always be stated explicitly when reporting multi-class metrics, because the same model can appear to have wildly different performance depending on which averaging scheme is reported.`,
  },
  {
    heading: 'Multi-class Metrics',
    body: `Binary classification metrics generalize to multi-class problems through three distinct strategies, each with different properties and appropriate use cases. Understanding when to apply each strategy - and what information each one hides - is essential for correct multi-class model evaluation in production.

One-vs-Rest (OVR) extends any binary classification metric to K classes by training K binary classifiers, where each classifier treats one class as positive and all other classes as negative. For evaluation (as opposed to training), OVR computes the metric for each class-vs-rest binary problem and averages across classes. This is computationally efficient and produces interpretable per-class metrics, but has a significant flaw: the negative class for each binary problem includes all other classes, making the class imbalance for each binary problem even more extreme than in the original multi-class distribution. For a 10-class problem where each class has equal frequency, each OVR binary problem has 10% positive and 90% negative examples - a substantial imbalance that inflates AUC-ROC but does not affect Average Precision. For a 10-class problem with very unequal class frequencies, the OVR negative class for the majority class contains only minority-class examples, which may have a very different feature distribution from the original majority-class negative examples.

One-vs-One (OVO) computes the metric for each pair of classes, considering only examples from those two classes, and averages across all K*(K-1)/2 pairs. This avoids the class-imbalance issue of OVR within each pairwise comparison, and is more robust for imbalanced multi-class problems. The downside is quadratic scaling with the number of classes: 10 classes require 45 pairwise comparisons, 100 classes require 4,950. For very large numbers of classes, OVR is computationally necessary. Multi-class AUC in scikit-learn implements both approaches (via the average and multi_class parameters), and comparing the OVR and OVO results for the same model reveals how much the pairwise class balancing affects the metric.

The K-by-K confusion matrix is the most information-rich evaluation tool for multi-class classifiers and should always be examined before reporting summary metrics. Entry [i,j] of the confusion matrix is the number of examples of class i that the model classified as class j. The diagonal entries are the correct classifications; all off-diagonal entries are misclassifications. The confusion matrix reveals which specific class pairs are most confused - a pattern that summary metrics completely obscure. A medical diagnosis model with 90% macro-averaged accuracy might have a confusion matrix showing that it confuses class A with class B 40% of the time - a specific failure pattern that could indicate a data labeling issue, a class similarity problem, or a missing discriminative feature. For multi-class problems with more than 10 classes, dimensionality reduction of the confusion matrix (grouping similar classes) is often necessary to make the patterns interpretable.`,
  },
  {
    heading: 'Connecting Metrics to Business Outcomes',
    body: `The gap between the metrics ML practitioners report (AUC, F1, PR AUC, NDCG) and the outcomes business stakeholders care about (revenue, cost, customer satisfaction, regulatory compliance) is the source of a significant proportion of communication failures between ML teams and the organizations they serve. A model improvement from AUC 0.91 to AUC 0.94 is meaningful to an ML practitioner but unintelligible to a CFO or operations director. The translation from model metrics to business outcomes is not an optional communication skill for senior ML engineers - it is a core technical competency, because the translation determines whether the model is actually optimized for the right objective.

The translation requires assigning dollar values to each cell of the confusion matrix. Consider a fraud detection model operating on a payment platform processing 100,000 transactions per day, with a 1% fraud rate (1,000 fraudulent transactions per day) and average fraud loss of $150 per transaction. A model with 92% recall and 40% precision at the production threshold catches 920 of the 1,000 daily fraud cases, preventing $138,000 in daily fraud loss. Its 40% precision means that for every 920 true fraud cases flagged, it also flags 1,380 legitimate transactions as fraud (since TP/(TP+FP) = 0.4 implies FP = TP * 1.5). If each false decline costs $10 in customer service cost and expected churn value, the 1,380 false declines cost $13,800 per day. The 80 missed fraud cases cost $12,000 per day in undetected fraud. Net daily value of the model = $138,000 - $13,800 - $12,000 = $112,200 per day, or approximately $41 million per year. A model improvement from 92% to 95% recall at the same precision threshold prevents an additional 30 fraud cases per day, saving $4,500 per day in undetected fraud - $1.6 million per year. This is the number that justifies the model development investment.

Presenting this translation in an interview or stakeholder meeting requires doing the arithmetic explicitly rather than asserting that "a higher AUC is better." The calculation also reveals which lever matters most: if the cost matrix shows that false positives are much more costly than false negatives for this specific business, optimizing for precision rather than recall is the correct objective, and a model with lower AUC that has better precision at the business's operating point is preferred over one with higher AUC. The ROI calculation also establishes the threshold for model improvement that justifies retraining cost: if retraining takes 2 weeks of engineering time at $5,000 per week, the minimum acceptable model improvement is $10,000 in annual net value improvement - a specific, measurable bar that the team can evaluate before committing to the retraining project.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What are the four entries in a confusion matrix and what does each represent?',
    keyPoints: [
      'TP: predicted positive, actually positive - correct detection',
      'FP: predicted positive, actually negative - false alarm',
      'TN: predicted negative, actually negative - correct rejection',
      'FN: predicted negative, actually positive - missed detection',
      'All metrics (precision, recall, F1, AUC) are derived from these four values',
    ],
    trap: 'Mixing up FP and FN - FP is a false alarm (model is wrong in the positive direction), FN is a miss (model is wrong in the negative direction).',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between precision and recall?',
    keyPoints: [
      'Precision = TP/(TP+FP): of all predicted positives, what fraction are correct - measures false alarm rate',
      'Recall = TP/(TP+FN): of all actual positives, what fraction are caught - measures miss rate',
      'Higher threshold → higher precision, lower recall',
      'Lower threshold → higher recall, lower precision',
    ],
    trap: 'Saying "precision is accuracy for positives" - precision measures how much of what the model calls positive is actually positive, not overall accuracy.',
  },
  {
    difficulty: 'junior',
    question: 'When should you optimize for precision vs recall? Give examples.',
    keyPoints: [
      'Optimize precision when FP cost is high: spam filter (legitimate email lost), irrelevant ad shown',
      'Optimize recall when FN cost is high: cancer screening (missed diagnosis), fraud detection (missed fraud)',
      'The cost asymmetry of the specific application determines which metric to prioritize',
      'Never optimize one in isolation - state the cost tradeoff explicitly',
    ],
    trap: 'Claiming precision is "better" or recall is "better" without specifying the application - the right choice depends entirely on the relative cost of FP vs FN.',
  },
  {
    difficulty: 'junior',
    question: 'What is AUC-ROC and what does it measure?',
    keyPoints: [
      'Area under the ROC curve (True Positive Rate vs False Positive Rate across all thresholds)',
      'Probability that a random positive receives a higher score than a random negative',
      'AUC = 0.5 is random, AUC = 1.0 is perfect, AUC = 0.0 is perfectly reversed',
      'Threshold-independent - measures model discrimination ability across all operating points',
    ],
    trap: 'Interpreting AUC as "the model is correct 85% of the time" (for AUC=0.85) - AUC is not accuracy; it is a ranking probability.',
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
    trap: 'Using F1 as the only metric without plotting the full PR curve - a model can be tuned to maximize F1 at one threshold while being poor at other operating points.',
  },
  {
    difficulty: 'mid',
    question: 'When would you use Precision-Recall AUC instead of ROC AUC?',
    keyPoints: [
      'Imbalanced datasets where the positive class is rare (fraud, disease, defects)',
      'ROC AUC can appear high even when recall on the positive class is poor (TN inflates ROC)',
      'PR AUC focuses on the positive class performance - not affected by the large negative class',
      'If you care about ranking positive examples correctly, use PR AUC',
    ],
    trap: 'Always using ROC AUC as the default - for rare event detection (fraud at 0.1%, medical diagnosis), PR AUC is more informative.',
  },
  {
    difficulty: 'mid',
    question: 'How do you select the classification threshold for a production model?',
    keyPoints: [
      'Compute FP × cost_FP + FN × cost_FN across all thresholds on a validation set',
      'Select threshold minimizing expected total cost',
      'Or: use constraint-based approach - minimum acceptable precision/recall, then optimize the other',
      'Document the business justification for the selected threshold',
      'Re-evaluate threshold after every model update - score distributions change',
    ],
    trap: 'Using the default threshold of 0.5 without considering the cost matrix - 0.5 is almost never optimal for imbalanced problems.',
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
    trap: 'Conflating high AUC with good calibration - a model can rank positives above negatives perfectly (AUC=1) but still have completely wrong probability magnitudes.',
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
    trap: 'Reporting accuracy as a supplementary metric alongside AUC for imbalanced problems - accuracy adds no information and misleads stakeholders.',
  },
  {
    difficulty: 'mid',
    question: 'Explain macro, micro, and weighted averaging for multi-class metrics.',
    keyPoints: [
      'Macro: compute metric per class, average equally - treats all classes as equally important',
      'Micro: aggregate TP/FP/FN across all classes, compute metric - weighted toward majority class',
      'Weighted: per-class metric weighted by class frequency - between macro and micro',
      'Use macro when minority class performance matters; use micro when overall performance matters',
    ],
    trap: 'Using micro-averaging for an imbalanced multi-class problem and claiming good performance - micro-averaging hides poor minority class performance.',
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
    trap: 'Evaluating only on the training set calibration - calibration must be measured on held-out data to be meaningful.',
  },
  {
    difficulty: 'senior',
    question: 'Design the evaluation framework for a credit default prediction model that must meet both accuracy and fairness requirements.',
    keyPoints: [
      'Accuracy metrics: AUC-ROC, Average Precision, Brier score (calibration), threshold-specific precision/recall',
      'Fairness metrics: equal opportunity (equal TPR across groups), demographic parity (equal positive rate), calibration parity (equal calibration across groups)',
      'Operating point: threshold optimized using business cost matrix, then validated for fairness - adjust if fairness violation found',
      'Intersectional evaluation: metrics per demographic group and per subgroup combinations (gender × age × geography)',
      'Regulatory requirement: document all metrics, threshold decisions, and fairness trade-offs in a model card',
    ],
    trap: 'Only reporting aggregate AUC without evaluating per-group performance - regulatory frameworks (ECOA, Fair Housing Act) require evidence of non-discrimination by protected group.',
  },
  {
    difficulty: 'senior',
    question: 'A model has AUC = 0.92 in offline evaluation but performs poorly in production. What could explain this?',
    keyPoints: [
      'Calibration failure: AUC is fine but predicted probabilities are wrong - downstream systems using scores are misled',
      'Train-test distribution mismatch: test set is not representative of production traffic',
      'Threshold selection: model was evaluated at one threshold but deployed at a different one',
      'Label leakage: offline test set had future information that is not available in production',
      'Training-serving skew: feature computation differs between training pipeline and serving pipeline',
    ],
    trap: 'Concluding the model needs retraining - first diagnose whether the offline-online gap is due to calibration, threshold mismatch, skew, or label issues.',
  },
  {
    difficulty: 'senior',
    question: 'How do you translate model metrics into a business case for a stakeholder presentation?',
    keyPoints: [
      'Map FP rate to cost per false positive × daily volume = daily cost to operations',
      'Map FN rate to cost per missed event × daily volume = daily loss',
      'Compare total daily cost at current threshold to optimal threshold - quantify the improvement',
      'Compare model performance to baseline (no model, simple rules) - compute incremental value',
      'Project annual ROI: (daily_value_with_model - daily_value_without) × 365 vs model development cost',
    ],
    trap: 'Presenting only AUC or F1 to business stakeholders - non-technical stakeholders need dollar amounts and error counts, not statistical metrics.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle threshold calibration when the model is deployed with different SLOs for different customer tiers?',
    keyPoints: [
      'Compute separate cost matrices per customer tier (enterprise, SMB, consumer)',
      'Apply tier-specific thresholds: enterprise gets more aggressive detection (lower threshold = higher recall), consumer gets lower friction (higher threshold = higher precision)',
      'Feature flag or routing layer applies correct threshold based on customer tier at serving time',
      'Monitor per-tier precision and recall separately in production',
      'Evaluate fairness across tiers - ensure lower-tier customers are not systematically disadvantaged',
    ],
    trap: 'Using a single global threshold for all customer tiers - enterprise customers often have different risk tolerances and error costs than consumer customers.',
  },
  {
    difficulty: 'junior',
    question: 'What is the precision-recall tradeoff and how does the classification threshold control it?',
    keyPoints: [
      'Increasing threshold: fewer positives predicted → fewer FP (higher precision) → but also fewer TP (lower recall)',
      'Decreasing threshold: more positives predicted → more TP (higher recall) → but also more FP (lower precision)',
      'The threshold is the single knob that moves you along the precision-recall curve',
      'There is no threshold that simultaneously maximizes both - choosing one means accepting less of the other',
    ],
    trap: 'Claiming that a better model "has both higher precision and higher recall at the same threshold" - this is only possible if the model itself is improved, not by adjusting the threshold.',
  },
  {
    difficulty: 'mid',
    question: 'How do you evaluate a model\'s performance when ground truth labels are delayed by 30 days?',
    keyPoints: [
      'Proxy metrics: use leading indicators available immediately (score distribution stability, feature coverage, output range)',
      'Stratified evaluation: use a small cohort of short-cycle labels (e.g., same-day confirmations) for fast feedback',
      'Rolling evaluation: continuously evaluate on labeled examples as labels arrive - 30-day delayed AUC computed on a rolling basis',
      'Calibration monitoring: even without labels, monitor whether predicted probabilities are consistent with historical label rates',
    ],
    trap: 'Waiting 30 days for all labels before any production monitoring - 30-day label lag means a bad model goes undetected for a month without proxy metrics.',
  },
  {
    difficulty: 'junior',
    question: 'What is average precision (AP) and how does it differ from AUC-ROC?',
    keyPoints: [
      'AP is the area under the precision-recall curve - summarizes precision at every recall level',
      'AUC-ROC is the area under the ROC curve - summarizes TPR vs FPR across all thresholds',
      'AP is more informative for imbalanced datasets - not influenced by large TN count',
      'AP = 0.5 means the model performs at chance on the positive class; AUC-ROC = 0.5 is the same for ROC',
    ],
    trap: 'Using AP and AUC-ROC interchangeably - they measure different things and can diverge significantly on imbalanced datasets.',
  },
];
