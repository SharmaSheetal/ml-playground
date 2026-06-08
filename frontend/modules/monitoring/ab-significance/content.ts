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
    heading: 'A/B Testing Fundamentals',
    body: `An A/B test is a randomized controlled experiment that compares two treatments — typically a control (existing system) and a treatment (new model or feature). Users are randomly assigned to one group and their behavior is measured independently.

Randomization is the critical ingredient. It ensures that any difference in outcomes between groups is caused by the treatment, not by pre-existing differences between users. Without proper randomization, you cannot make causal claims.

The basic workflow: define a hypothesis, choose a primary metric, compute required sample size, run the experiment, analyze results. Simple in principle — but each step hides significant complexity.`,
  },
  {
    heading: 'Hypothesis Testing — p-values and Significance',
    body: `The null hypothesis (H0) states that the treatment has no effect — any observed difference is due to chance. The alternative hypothesis (H1) states the treatment has a real effect.

The p-value is the probability of observing a difference at least as extreme as what you measured, assuming H0 is true. A p-value of 0.03 means: if the treatment had zero effect, you would see this large a difference by chance only 3% of the time.

The significance level α (typically 0.05) is the threshold for rejecting H0. If p < α, you reject H0 and declare the result statistically significant.

Common misconception: p < 0.05 does not mean there is a 95% chance the treatment is effective. It means: if H0 were true, the probability of this data is less than 5%. The distinction matters — do not confuse the probability of the data given H0 with the probability of H0 given the data (that requires Bayesian analysis).`,
  },
  {
    heading: 'Type I and Type II Errors',
    body: `Type I error (false positive): you reject H0 when H0 is actually true — you declare a winner when there is no real effect. Probability = α (significance level, typically 0.05). This means 1 in 20 tests with no real effect will appear significant.

Type II error (false negative): you fail to reject H0 when H1 is actually true — you declare no winner when there is a real effect. Probability = β. Statistical power = 1 - β (typically target 0.80 or 0.90).

The tradeoff: lowering α reduces Type I errors but increases Type II errors for a fixed sample size. Increasing sample size reduces both, which is why sample size calculation is central to experiment design.

In practice for ML experiments, teams often worry too little about Type II errors. Running an experiment that is underpowered (too few samples) makes it likely to miss real improvements — you conclude "no winner" and continue using the worse model.`,
  },
  {
    heading: 'Sample Size Calculation',
    body: `The required sample size per variant depends on four inputs:
  • Baseline conversion rate (p1): existing metric level
  • Minimum detectable effect (MDE): smallest lift you care about detecting
  • Significance level (α): typically 0.05
  • Power (1-β): typically 0.80 or 0.90

Formula (two-proportion z-test): n = (z_α + z_β)² × (p1(1-p1) + p2(1-p2)) / (p1-p2)²

Where p2 = p1 × (1 + MDE/100) and z_α = 1.96, z_β = 0.84 for 80% power.

Key insight: sample size scales quadratically with the inverse of the effect size. Halving the minimum detectable effect quadruples the required sample size. This is why detecting small improvements in mature, high-traffic products is expensive.

Common mistake: not accounting for multiple primary metrics. Running one test but tracking 20 metrics inflates the family-wise Type I error rate. Use Bonferroni correction or define a single primary metric upfront.`,
  },
  {
    heading: 'The Peeking Problem — Why You Cannot Stop Early',
    body: `The most common A/B testing mistake: checking p-values while the experiment is still running, and stopping as soon as p < 0.05.

This inflates Type I error dramatically. If you check significance every day for 20 days, the probability of seeing p < 0.05 at least once — even with no real effect — is around 30–40%. Far above the nominal 5%.

Intuition: p-values fluctuate randomly. As data accumulates, a test that starts significant often becomes insignificant and vice versa. Stopping at the first "significant" moment selects for a favorable random fluctuation.

Correct approaches:
  • Pre-commit to a sample size and only test at the end
  • Use sequential testing methods (mSPRT, CUPED) that provide valid p-values at any point during the experiment
  • Use a Bonferroni-corrected significance level if you must check at multiple pre-specified points`,
  },
  {
    heading: 'Multi-Armed Bandits vs A/B Tests',
    body: `A traditional A/B test holds traffic split fixed (50/50) until the end. A multi-armed bandit (MAB) adaptively shifts traffic toward the winning variant as evidence accumulates.

When to use A/B tests: when the cost of running the experiment is low relative to potential opportunity cost, and when you need a clean causal estimate of the effect size. A/B tests are simpler to reason about and audit.

When to use MABs: when exploration is costly (showing a worse recommendation costs revenue) and you want to minimize regret during the experiment. Common in ad bidding, content recommendations, and price optimization.

Trade-off: MABs reduce experiment regret but make statistical inference harder. The adaptive allocation violates the independent sampling assumption of standard hypothesis tests. Do not apply a t-test to MAB data — use Thompson Sampling or Bayesian inference.

The peeking problem is irrelevant for MABs — they are designed to update continuously. But causal attribution becomes harder: you cannot easily compute "what would have happened if we had deployed this model to all users?"`,
  },
  {
    heading: 'Bayesian A/B Testing',
    body: `Bayesian A/B testing models the conversion rate as a probability distribution, not a fixed unknown. You start with a prior belief about the rate and update it with observed data to get a posterior.

The Bayesian answer is a probability statement: "There is an 87% probability that the treatment is better than control." This is more intuitive than a frequentist p-value, which is a statement about the data, not about the hypothesis.

Bayesian approaches handle early stopping naturally — the posterior probability is always valid, unlike frequentist p-values. You can check daily and stop when you are sufficiently confident without inflating error rates.

Trade-off: the result depends on the prior. A strong prior can dominate the posterior if data is sparse — this can be good (regularization) or bad (bias). Frequentist tests have no prior, which is equivalent to assuming all effect sizes are equally likely — a strong and often wrong assumption.

In practice, many tech companies use Bayesian approaches because they allow more intuitive communication of results to non-statistical stakeholders.`,
  },
  {
    heading: 'Primary Metric, Guardrail Metrics, and Novelty Effects',
    body: `Pre-specify a single primary metric before the experiment. The primary metric is what you use to decide winner/loser. Running an experiment and then selecting the metric that shows the best result inflates Type I error.

Guardrail metrics are metrics that must not be harmed. Common guardrails: page load time, error rate, user complaints. If the treatment improves CTR but degrades session duration, the guardrail constraint prevents shipping a net-negative change.

Novelty effects: users engage more with new things simply because they are new. A recommendation algorithm change may show a short-term CTR lift that disappears in 2 weeks as users habituate. Run experiments long enough to see past the novelty peak — at least 2 business cycles.

Primacy effects (opposite): users may initially resist change (e.g., a redesigned UI) and only adopt it after familiarity. Both novelty and primacy effects argue for running experiments longer than the minimum sample size calculation suggests.`,
  },
  {
    heading: 'Network Effects and SUTVA Violations',
    body: `The Stable Unit Treatment Value Assumption (SUTVA) states that the treatment received by one user does not affect outcomes for other users. Most A/B testing frameworks assume SUTVA holds.

SUTVA fails in social networks, marketplaces, and any system with user-to-user interaction. If you show better recommendations to user A, user A may share more content, which affects user B in the control group.

This is called spillover or interference. The result: treatment effect estimates are biased — you cannot cleanly separate "what would have happened with no treatment" from the spillover effect.

Mitigation strategies:
  • Cluster randomization: randomize by network cluster instead of individual users
  • Geographic randomization: assign regions to treatment or control
  • Time-based switching: alternate between treatment and control in time windows (only valid for fast-mixing systems)
  • Graph cluster A/B: use community detection to identify minimally connected groups

SUTVA violations are the hardest problem in online experimentation and are still an active research area.`,
  },
  {
    heading: 'Common A/B Testing Mistakes in ML',
    body: `Multiple comparisons: testing 20 metrics at α=0.05 gives an expected 1 false positive even if nothing works. Correct with Bonferroni (divide α by number of tests) or use FDR control (Benjamini-Hochberg).

Stopping early: running the experiment until you see p < 0.05, then stopping. Inflates Type I error to 30–40% for a 20-day experiment.

Imbalanced randomization: forgetting to stratify on confounders (device type, geography, new/returning users). Leads to selection bias if one group systematically gets different users.

Label leakage in offline pre-evaluation: computing "expected business impact" from offline metrics on data the new model was trained on. The online experiment is the ground truth — offline estimates are frequently misleading.

Excluding outliers post-hoc: removing "bot traffic" or "outlier users" after seeing which group they are in creates bias. Define exclusion criteria before the experiment starts.

Running the experiment too short: not enough samples to detect realistic effect sizes. Under-powered experiments produce "no significant difference" conclusions that get incorrectly interpreted as "the new model is not better."`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is the purpose of randomization in an A/B test?',
    keyPoints: [
      'Ensures pre-existing differences between users are balanced across groups',
      'Makes the observed outcome difference attributable to the treatment, not selection bias',
      'Without randomization, you cannot make causal claims — only correlational',
      'Poor randomization (e.g., by signup date) can confound with seasonal effects',
    ],
    trap: 'Treating random assignment as optional when you have "representative" samples — representative is not the same as randomly assigned.',
  },
  {
    difficulty: 'junior',
    question: 'What is a p-value and what does it tell you?',
    keyPoints: [
      'Probability of observing a result at least as extreme as measured, assuming no real effect',
      'p < 0.05 means there is a 5% chance of seeing this result by random chance alone',
      'Does NOT mean 95% probability the treatment is effective',
      'Small p-value is evidence against the null hypothesis, not proof of the alternative',
    ],
    trap: 'Saying "p < 0.05 means there is a 95% chance the treatment works" — this is the base rate fallacy; it ignores prior probability.',
  },
  {
    difficulty: 'junior',
    question: 'What is statistical power and why does it matter for A/B tests?',
    keyPoints: [
      'Power = probability of detecting a real effect if one exists (1 - Type II error rate)',
      'Typical target: 80% power — 20% chance of missing a real improvement',
      'Low-powered experiments frequently conclude "no difference" when there is a real effect',
      'Power increases with sample size, decreasing with smaller effect sizes',
    ],
    trap: 'Running an underpowered experiment and concluding the new model is no better when the experiment simply lacked enough data to detect the improvement.',
  },
  {
    difficulty: 'junior',
    question: 'How do you compute the required sample size for an A/B test?',
    keyPoints: [
      'Need: baseline rate, minimum detectable effect, significance level (α), power (1-β)',
      'n = (z_α + z_β)² × (p1(1-p1) + p2(1-p2)) / (p1-p2)²',
      'Sample size scales quadratically with inverse effect size — smaller MDE → much larger sample',
      'Per variant, not total — double for 50/50 split',
    ],
    trap: 'Computing total sample size and splitting it between groups, rather than computing the required sample size per variant.',
  },
  {
    difficulty: 'junior',
    question: 'What are guardrail metrics and why do you need them?',
    keyPoints: [
      'Metrics that must not be harmed by the treatment (e.g., latency, error rate, session length)',
      'Prevent shipping a change that wins on the primary metric but harms user experience',
      'Pre-specify guardrails before the experiment — not after seeing results',
      'A treatment that improves CTR but breaks latency SLOs should not ship',
    ],
    trap: 'Only measuring the primary metric and shipping changes that inadvertently harm other dimensions of user experience.',
  },
  {
    difficulty: 'mid',
    question: 'What is the peeking problem and how do you handle it?',
    keyPoints: [
      'Checking p-values while experiment is running and stopping when p < 0.05 inflates Type I error',
      'Peeking daily for 20 days raises Type I error from 5% to 30–40%',
      'Fix: pre-commit to sample size, test only at end',
      'Or: use sequential testing (mSPRT, always-valid p-values) that remains valid at any point',
      'Or: Bayesian methods where you can stop at any time without inflating error rates',
    ],
    trap: 'Peeking and stopping early, then reporting p < 0.05 as a valid significance result.',
  },
  {
    difficulty: 'mid',
    question: 'How do you handle multiple comparisons in an A/B test where you are tracking 15 metrics?',
    keyPoints: [
      'Pre-specify a single primary metric — use it to determine winner/loser',
      'Apply Bonferroni correction if you must test multiple metrics: α/k for k tests',
      'Or use Benjamini-Hochberg FDR control for a less conservative correction',
      'Treat secondary metrics as exploratory, not confirmatory',
      'Expected false positives at α=0.05 with 15 independent tests: 15 × 0.05 = 0.75 expected false discoveries',
    ],
    trap: 'Declaring a winner based on whichever of 15 metrics crossed α=0.05 — this is p-hacking even if unintentional.',
  },
  {
    difficulty: 'mid',
    question: 'When would you use a multi-armed bandit instead of an A/B test?',
    keyPoints: [
      'When the cost of showing a worse variant is high (revenue loss per request matters)',
      'When you want to minimize regret during the experiment, not just after it',
      'MAB adaptively shifts traffic toward the winning arm as evidence accumulates',
      'Trade-off: harder to make clean causal inference from MAB data vs A/B test',
      'Do not apply frequentist hypothesis tests to MAB data — use Bayesian inference',
    ],
    trap: 'Using a MAB and then running a standard t-test on the final data — the adaptive allocation violates independent sampling assumptions.',
  },
  {
    difficulty: 'mid',
    question: 'What is a novelty effect and how does it affect A/B test results?',
    keyPoints: [
      'Users engage more with new experiences simply because they are new, not because they are better',
      'Short experiments may show inflated lifts that disappear as novelty fades',
      'Run experiments for at least 2 business cycles (2 weeks minimum for weekly-pattern products)',
      'Segment analysis: does the lift hold for returning users who have passed the novelty window?',
      'Compare first-week vs second-week lift — if novelty-driven, lift decays over time',
    ],
    trap: 'Running a 3-day experiment and shipping based on a lift that is entirely driven by novelty.',
  },
  {
    difficulty: 'mid',
    question: 'What is SUTVA and when is it violated in ML systems?',
    keyPoints: [
      'SUTVA: treatment of one unit does not affect outcomes for other units',
      'Violated in: social networks (shared content), marketplaces (supply/demand), collaborative filtering (shared signals)',
      'Violation means treatment effect estimate is biased — cannot cleanly separate direct and spillover effects',
      'Mitigation: cluster randomization, geographic randomization, time-based switching',
      'In recommenders: showing better recommendations to user A can indirectly affect user B via shared content',
    ],
    trap: 'Running a user-level A/B test on a social platform and assuming SUTVA holds — spillover effects in social networks are well-documented.',
  },
  {
    difficulty: 'mid',
    question: 'How do Bayesian A/B tests differ from frequentist A/B tests? When would you prefer each?',
    keyPoints: [
      'Bayesian: models conversion rate as a distribution, produces probability that treatment is better',
      'Frequentist: hypothesis test, produces p-value (probability of data given null hypothesis)',
      'Bayesian allows early stopping without inflating Type I error; frequentist does not',
      'Bayesian results are more intuitive ("87% probability treatment is better") vs p-value',
      'Frequentist requires no prior; Bayesian requires specifying a prior (risk of bias with sparse data)',
    ],
    trap: 'Claiming Bayesian tests are always better — they require a prior that can dominate results when data is sparse.',
  },
  {
    difficulty: 'senior',
    question: 'Design an experimentation system for a recommendation engine at a company running 500+ experiments per year.',
    keyPoints: [
      'Experiment management: UI for creating experiments, defining metrics, setting sample sizes, scheduling',
      'Randomization service: consistent hash assignment, stratified sampling by user cohort',
      'Metric computation: streaming (Flink/Spark) for fast metrics, batch for complex business metrics',
      'Statistical engine: sequential testing for early stopping, power analysis tool, FDR correction for multiple metrics',
      'Experiment registry: prevents conflicting overlapping experiments, tracks dependencies',
    ],
    trap: 'Building experiment infrastructure without a mechanism to prevent conflicting experiments from running on the same user population simultaneously.',
  },
  {
    difficulty: 'senior',
    question: 'A new recommendation model shows +3% CTR in an A/B test but the business does not observe the expected revenue increase. Why might this happen?',
    keyPoints: [
      'CTR and revenue are not always correlated — the model may drive low-quality clicks (browsing without buying)',
      'Novelty effect: users click new recommendations out of curiosity, not intent',
      'Cannibalization: the new model recommends items that users would have purchased anyway via search',
      'Attribution model may not capture the full purchase journey (multi-touch attribution)',
      'Check conversion rate per click — if CTR is up but conversion per click is down, CTR is misleading',
    ],
    trap: 'Using CTR as the primary success metric without validating that CTR improvements translate to revenue for your specific product.',
  },
  {
    difficulty: 'senior',
    question: 'How do you detect and prevent p-hacking in an organization running many A/B tests?',
    keyPoints: [
      'Require pre-registration: primary metric, sample size, and stopping criteria must be defined before data collection starts',
      'Enforce pre-commit in experimentation platform — lock analysis parameters before results are visible',
      'Require experiment pre-approval via peer review for high-stakes decisions',
      'Monitor calibration: run A/A tests periodically; if more than 5% show p < 0.05, the testing infrastructure has bugs or p-hacking is endemic',
      'Track experiment history: if a team consistently ships experiments on the second or third try, investigate',
    ],
    trap: 'Treating p-hacking as an individual integrity problem rather than a system design problem — good experiment platforms make p-hacking structurally difficult.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle experiments where the sample size is too small to detect the effect you care about (underpowered experiment)?',
    keyPoints: [
      'CUPED (Controlled-experiment Using Pre-Experiment Data): reduce variance by conditioning on pre-experiment behavior',
      'Stratified randomization: balance key confounders across groups to reduce variance',
      'Longer experiment duration if possible — more samples directly increases power',
      'Focus the experiment on high-propensity segments where effect size is larger',
      'Do not ship based on a trending but non-significant result — wait for sufficient data',
    ],
    trap: 'Shipping a non-significant result because it "looks positive" — this negates the purpose of statistical testing.',
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between A/B testing and canary deployment?',
    keyPoints: [
      'Canary deployment: safety mechanism to catch regressions before full rollout — goal is to reach 100% traffic',
      'A/B test: controlled experiment to measure causal effect of a change — goal is to compare two variants',
      'Canary watches for degradation (error rate, latency, business metric drop)',
      'A/B test measures improvement (lift in primary business metric)',
      'Often run in sequence: canary to validate safety, then hold at 50/50 for A/B significance',
    ],
    trap: 'Using canary deployment as a substitute for A/B testing — canary detects regressions but does not produce statistically valid causal estimates of improvement.',
  },
  {
    difficulty: 'mid',
    question: 'How do you account for seasonality when running a long-duration A/B test?',
    keyPoints: [
      'Include at least one full business cycle (typically 1–2 weeks) to average out day-of-week effects',
      'Run treatment and control simultaneously — not sequentially — to eliminate time confounding',
      'Stratify analysis by time period if the experiment spans seasonal transitions',
      'Compare holdout period metrics in both groups to verify baseline equivalence',
      'Avoid running experiments that start on Monday and end on Friday — missing weekend traffic creates bias',
    ],
    trap: 'Running a Tuesday-to-Thursday test and assuming it generalizes to weekend behavior.',
  },
  {
    difficulty: 'senior',
    question: 'Your team ships 20 experiments per month. What is the expected number of false positives per month if all experiments use α=0.05 and none of the treatments are truly effective?',
    keyPoints: [
      '20 × 0.05 = 1 expected false positive per month even if nothing works',
      'This argues for using α=0.01 for high-stakes decisions or requiring replication',
      'FDR control (Benjamini-Hochberg) allows more tests while controlling the false discovery rate',
      'In practice, not all experiments are truly null — the expected false discovery rate depends on the prior probability that an experiment has a real effect',
      'A good experiment culture reduces false discoveries through better pre-screening of ideas before running',
    ],
    trap: 'Not accounting for the multiple testing problem when operating at high experiment velocity — treating each experiment as independent from a family-wise error perspective.',
  },
  {
    difficulty: 'mid',
    question: 'What is CUPED and how does it improve A/B test sensitivity?',
    keyPoints: [
      'CUPED (Controlled-experiment Using Pre-Experiment Data): reduces variance using pre-experiment covariate',
      'Regress post-experiment metric on pre-experiment behavior, use residual as outcome',
      'Equivalent to subtracting a fraction of the pre-experiment mean from each user\'s metric',
      'Can reduce variance by 40–70% — equivalent to 1.5–3× more data without running longer',
      'Requires pre-experiment data (prior metric for the same users) — not available for new users',
    ],
    trap: 'Applying CUPED without checking whether the pre-experiment covariate is actually correlated with the outcome — if the correlation is near zero, CUPED provides no benefit.',
  },
];
