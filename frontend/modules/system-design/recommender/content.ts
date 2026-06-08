export interface StudySection {
  heading: string;
  body: string;
}

export interface InterviewQ {
  id?: string;
  difficulty: 'junior' | 'mid' | 'senior';
  question: string;
  answer?: string;
  modelAnswer?: string;
  keyPoints: string[];
  trap?: string;
}

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'Why Two Stages?',
    body: `A two-stage recommender exists because you cannot run a heavy ranking model over millions of items for every user request within a 100ms latency budget. The retrieval stage narrows the candidate pool from millions to a few hundred using cheap approximate algorithms. The ranking stage then scores those hundreds with a much richer feature set and a more expensive model, returning the final ordered list.

The two-stage design gives you a clean separation of concerns: retrieval optimizes for coverage and recall (do not miss anything the user might genuinely like), while ranking optimizes for precision and ordering (given these candidates, what is the exact right order?).

Without this separation the math is simply infeasible at scale. Scoring 10 million items per user at 1 ms each takes 10,000 seconds. Retrieval reduces that to 200 candidates, bringing ranking inference to under 10 ms even with a complex neural ranker.`,
  },
  {
    heading: 'Stage 1: Candidate Retrieval',
    body: `The retrieval stage must be both fast and high-recall. Its job is to produce a few hundred candidates that contain essentially all items a user would click on, at a cost the serving infrastructure can sustain.

The dominant retrieval approaches are:

  • Matrix factorization (MF): decomposes the user-item interaction matrix into dense user and item embeddings. ALS (Alternating Least Squares) is popular for implicit feedback. At query time, you compute the dot product between the user embedding and all item embeddings, then return the top-K.
  • Two-tower neural models: separate neural networks encode the user context and the item separately into a shared embedding space. Dot product or cosine similarity gives the retrieval score. Two-tower can incorporate richer features than vanilla MF (user history, item metadata, session context) while remaining compatible with ANN indexing.
  • Approximate Nearest Neighbor (ANN) search: brute-force dot product over millions of item embeddings is too slow. Libraries like FAISS (Facebook AI Similarity Search) and HNSW (Hierarchical Navigable Small World graphs) build offline indexes that return top-K approximate neighbors in sub-millisecond time. FAISS supports GPU acceleration for very large indexes; HNSW provides excellent recall-latency tradeoffs on CPU.

Item and user embeddings are computed offline (batch) and written to the ANN index. At serving time, only the user embedding needs to be computed (or looked up) to query the index.`,
  },
  {
    heading: 'Stage 2: Ranking',
    body: `The ranking stage takes the ~200 candidates from retrieval and produces a precisely ordered list. It can use much richer features and a more expensive model because the number of candidates to score is bounded.

Feature engineering for ranking draws from three sources:

  • User features: demographics, long-term preference embeddings, subscription tier, device type.
  • Item features: content embeddings, popularity statistics, recency, price, editorial quality signals.
  • Interaction (cross) features: user-item affinity estimated from past behavior, predicted completion rate, contextual signals (time of day, session depth, query intent).

Two dominant model families are used:

  • GBDT (Gradient Boosted Decision Trees, e.g., LightGBM, XGBoost): excellent on tabular feature sets, fast inference, very interpretable. Handles missing values gracefully. Preferred when features are well-engineered and interpretability matters.
  • DNN (Deep Neural Networks): learns feature interactions automatically, handles embedding inputs natively, capable of jointly learning representations end-to-end. Higher inference cost but can model complex non-linear patterns.

Loss functions drive ranking quality: pointwise loss (binary cross-entropy on click/no-click) is simplest but ignores position; pairwise loss (BPR, LambdaRank) penalizes putting a less-relevant item above a more-relevant one; listwise loss (LambdaLoss, SoftmaxLoss) directly optimizes ranking metrics like NDCG. Production systems often use pointwise loss for simplicity and supplement with listwise re-ranking or post-hoc adjustments.`,
  },
  {
    heading: 'Cold Start Problem',
    body: `Cold start is the fundamental challenge of recommending to users or items with little to no interaction history. The embedding-based retrieval and collaborative-filtering ranking models both depend on sufficient interaction data to produce meaningful representations.

New user cold start strategies:

  • Onboarding prompts: ask the user to select a few interests or favorite items to bootstrap an initial preference profile.
  • Demographic-based fallback: use population-level priors conditioned on demographics (age group, location, device) until enough personal signal accumulates.
  • Trending or editorial recommendations: show curated or popularity-ranked items as a neutral starting point that accrues implicit feedback quickly.

New item cold start strategies:

  • Content-based retrieval: represent new items using their metadata features (title, description, category, image embeddings) to compute an approximate embedding even before any interactions. Map this content embedding into the same space as the collaborative embedding using a learned projection.
  • Warm-up exploration: deliberately expose new items to a diverse set of users to accumulate interaction data quickly. Thompson Sampling or UCB can govern this exploration-exploitation balance.
  • Two-phase model: use content-based ranking for new items and switch to collaborative ranking once the interaction count crosses a threshold (e.g., 50 impressions).

Cold start is never fully solved — it is a continuous spectrum between pure content-based and pure collaborative filtering that every system navigates based on interaction count thresholds.`,
  },
  {
    heading: 'Real-time vs Batch Feature Serving',
    body: `Recommender systems require features from multiple sources with very different freshness requirements. Misclassifying which features need real-time serving is one of the most common production architecture mistakes.

Batch features (precomputed, refreshed hourly to daily):

  • Long-term user preference embeddings: user's historical watch history, purchase patterns, preference clusters.
  • Item-level aggregate statistics: 30-day click rate, average rating, content embeddings.
  • Computed at scale offline and stored in a low-latency feature store (Redis, Cassandra, DynamoDB) keyed by user ID or item ID.

Real-time features (computed at request time or streamed within seconds):

  • Session context: items viewed in the current session, last 5 clicks, current query or search intent.
  • User context: device type, time of day, geographic signal, referrer.
  • Real-time interaction counts: items trending in the last 10 minutes, sudden virality signals.

The online feature store serves batch features with sub-millisecond lookup. A streaming pipeline (Flink, Kafka Streams) continuously updates near-real-time aggregates. At serving time, the ranking model receives a feature vector that combines both: the stable user embedding from the batch store and the session-level context from the real-time layer.

A common trap is computing expensive user embeddings at request time for each inference call. Batch-precomputing them and serving from a low-latency store is almost always better.`,
  },
  {
    heading: 'Business Rule Injection',
    body: `Pure ML-ranked outputs cannot be shipped directly to users without applying business constraints. Rule injection is the layer between the ML ranker and the final result list.

Common injection types:

  • Freshness injection: boost or pin recently published items that have received insufficient exposure relative to their quality, preventing the system from always serving evergreen items that have accumulated more historical signal.
  • Diversity enforcement: apply MMR (Maximal Marginal Relevance) or a coverage constraint to ensure the result list does not present five items from the same category or creator.
  • Promoted item insertion: paid placements, partnership items, or editorially mandated content are inserted at specified positions, typically after the first N organic results.
  • Hard filtering: remove items that are out of stock, geo-restricted, or violate safety policies for the requesting user.
  • Deduplication: remove items the user has already seen or purchased.

The architectural pattern is to apply these rules as a post-processing step after ranking. The rules operate on the ranked list, not on scores. This keeps the ML model clean and makes business logic auditable and independently deployable.

Over-reliance on rule injection degrades recommendation quality. The goal is to encode as many business objectives as possible into the model (via multi-objective training) and reserve hard rules for constraints that genuinely cannot be learned, such as geo-compliance or contractual promotions.`,
  },
  {
    heading: 'Online Evaluation — A/B Testing Recommenders',
    body: `Offline metrics (precision@K, NDCG, AUC) are necessary but not sufficient for recommender evaluation. A model can improve offline metrics while degrading user experience and revenue. Online A/B testing is the authoritative evaluation method.

Key online metrics for recommenders:

  • Click-through rate (CTR): fraction of recommended items that receive a click. Noisy but responsive.
  • Engagement metrics: dwell time, session length, scroll depth. Less gameable than CTR.
  • Conversion rate: fraction of recommendations that lead to a purchase, subscription, or goal completion.
  • Revenue per user: the ultimate business metric, but requires larger sample sizes and longer windows to measure reliably.
  • NDCG@K (online): estimated using logged position-click data. Captures ranking quality beyond binary CTR.

A/B test design considerations:

  • Randomize at the user level, not the request level, to avoid within-session confounds.
  • Hold-out sizes: 5% per arm is often sufficient at large scale; smaller services may need 25-50% per arm for statistical power.
  • Metric lag: conversion signals may take 24-72 hours to materialize; do not call the experiment too early based on CTR alone.
  • Guard rail metrics: monitor latency, error rate, and coverage to ensure the new model does not regress on system health.

Recommendation experiments require special care because the model's outputs influence future training data — a good model increases engagement, which generates richer training data, which makes the next model better. This feedback loop must be accounted for in experiment design.`,
  },
  {
    heading: 'Scalability — Serving Latency Budget',
    body: `The end-to-end latency budget for a recommender typically targets 100-200 ms at P99. Each stage of the pipeline consumes part of that budget and must be engineered to stay within its allocation.

A typical latency budget breakdown:

  • User feature lookup (batch feature store): 5-10 ms
  • User embedding computation or lookup: 5-15 ms
  • ANN retrieval (FAISS or HNSW): 5-20 ms (depends on index size and recall setting)
  • Candidate feature enrichment: 10-20 ms
  • Ranking model inference: 10-30 ms
  • Business rule post-processing: 1-5 ms
  • Serialization and network: 5-15 ms

Fan-out is a major scalability concern: for each user request, the system may need to fetch features for 200+ candidate items from the feature store. Batching these lookups into a single multi-get call is critical. A naive implementation that makes 200 sequential feature lookups would blow the latency budget completely.

Caching strategies:

  • User embedding cache: cache the user embedding for N seconds to avoid recomputing it on every page load during a session.
  • Candidate cache: for a given user, the candidate set changes slowly. Cache the retrieval result for 30-60 seconds and re-rank against the cache for subsequent requests within the window.
  • Prediction cache: for non-personalized or lightly personalized recommendations (trending, top picks for a category), cache the entire ranked result list.`,
  },
  {
    heading: 'Feedback Loops — Popularity Bias and Filter Bubbles',
    body: `Recommender systems trained on their own outputs create reinforcing feedback loops that systematically bias the next generation of models.

Popularity bias: items that are shown more often accumulate more interactions simply because of higher exposure, not because they are intrinsically better. The model interprets the higher interaction count as a quality signal and recommends the item more. Over time, a small set of popular items dominates the recommendation space, suppressing long-tail content regardless of its quality relative to popular alternatives.

Filter bubbles: collaborative filtering learns that users who liked X also liked Y. If the model always recommends items similar to what the user already engaged with, it creates a narrowing feedback loop — the user's embedding drifts toward an ever-smaller region of the item space, and they are never exposed to content outside that region.

Mitigation strategies:

  • Inverse propensity scoring (IPS): weight training examples by the inverse probability of having been shown to the user, correcting for position and selection bias in the logged data.
  • Exploration: allocate a fraction of recommendation slots (e.g., 10%) to epsilon-greedy or Thompson Sampling exploration — items the model is uncertain about.
  • Debiased training data: correct for position bias by using position-aware click models (e.g., examination hypothesis) when constructing training labels.
  • Diversity in the objective: include a diversity penalty in the ranking objective so the model is penalized for showing very similar items.`,
  },
  {
    heading: 'Fairness and Diversity',
    body: `Fairness in recommenders has two distinct but related concerns: provider-side exposure fairness (are items, creators, or products receiving equitable exposure?) and user-side fairness (do all user groups receive equally relevant recommendations?).

Exposure fairness: a small set of dominant items or creators captures most of the recommendation traffic. Fairness-aware ranking imposes minimum exposure guarantees for underrepresented providers while staying within a bounded quality loss on relevance metrics. This is especially important on platforms where creator income depends on recommendation exposure.

Calibration: a user's recommendation feed should reflect the diversity of their stated interests. If a user engages 70% with comedy and 30% with drama, roughly 70% of their feed should be comedy. Miscalibration occurs when the system over-indexes on the user's strongest signal and starves weaker but genuine interests.

MMR (Maximal Marginal Relevance): a classic greedy post-processing algorithm for diversity. Given a ranked list, MMR re-ranks by selecting each next item to maximize a linear combination of (relevance to the user) and (dissimilarity to items already selected in the list). The lambda parameter trades off relevance against diversity.

  • lambda = 1: pure relevance, no diversity penalty
  • lambda = 0: pure diversity, ignore relevance scores
  • lambda = 0.5: balanced tradeoff, typical production setting

Fairness interventions always trade off against raw relevance metrics. The goal is not to maximize fairness at the expense of user experience but to operate at a point on the fairness-relevance frontier that satisfies business and ethical constraints.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    id: 'rec-001',
    difficulty: 'junior',
    question: 'Why do large-scale recommender systems use two stages instead of running a single ranking model over all items?',
    keyPoints: [
      'Scoring millions of items per request with a complex model exceeds any practical latency budget',
      'Retrieval is cheap and high-recall; ranking is expensive and high-precision — separation lets each stage do what it is good at',
      'ANN search over embeddings runs in sub-milliseconds for millions of items; a neural ranker runs in tens of milliseconds over hundreds',
      'The design allows each stage to be optimized and scaled independently',
    ],
    trap: 'Saying it is just about speed without explaining why a single stage fails: the math of scoring millions of items per user request at inference latency makes it physically impossible within a real-time budget.',
  },
  {
    id: 'rec-002',
    difficulty: 'junior',
    question: 'What is a two-tower model and how is it used in candidate retrieval?',
    keyPoints: [
      'Two separate neural networks encode user context and item features independently into a shared embedding space',
      'At training time, positive (user, item) pairs are pulled together and negative pairs pushed apart using contrastive loss',
      'At serving time, all item embeddings are precomputed and indexed in an ANN structure; only the user embedding is computed per request',
      'Dot product or cosine similarity between user and item embeddings gives the retrieval score',
    ],
    trap: 'Describing the two towers as interacting at inference time. The key property is that they are independent, which allows item embeddings to be precomputed offline and queried instantly at serving time.',
  },
  {
    id: 'rec-003',
    difficulty: 'junior',
    question: 'What is approximate nearest neighbor (ANN) search and why is it used in retrieval instead of exact nearest neighbor?',
    keyPoints: [
      'ANN returns the top-K most similar embeddings without exhaustively computing distances to every item — trades tiny recall loss for massive speed gain',
      'Exact nearest neighbor over 10M items at 128 dimensions is too slow for real-time serving',
      'FAISS and HNSW are the dominant libraries; HNSW provides excellent recall-latency on CPU, FAISS supports GPU',
      'The retrieval recall loss is acceptable because the ranking stage will re-score and reorder the candidates anyway',
    ],
  },
  {
    id: 'rec-004',
    difficulty: 'mid',
    question: 'Your retrieval stage returns 200 candidates but the ranking model only receives 150 candidates due to a feature enrichment failure. What happens to the missing 50, and how do you design the system to handle this gracefully?',
    keyPoints: [
      'Missing feature enrichment should not silently drop candidates; the system should log the failure and either serve a fallback feature vector or exclude with logging',
      'Fallback strategies: use default/mean feature values, use a degraded ranking model that does not require the missing feature, or fall back to retrieval score ordering for unenriched candidates',
      'Monitoring should track enrichment failure rate as a separate metric — silent candidate loss is a common source of quality regressions',
      'Design for partial failure: the ranker should accept and handle missing features rather than crashing or silently ignoring the candidate',
    ],
    trap: 'Ignoring the 50 missing candidates without logging or fallback. Silent candidate loss degrades recommendation quality without triggering any alert.',
  },
  {
    id: 'rec-005',
    difficulty: 'mid',
    question: 'When would you choose GBDT over a DNN for the ranking stage? When would you choose the other way?',
    keyPoints: [
      'GBDT when: features are primarily tabular and well-engineered, inference latency must be very low (< 5 ms), interpretability is required for audit or regulatory purposes',
      'DNN when: inputs include raw embeddings or image/text features that need learned representations, feature interaction complexity exceeds manual engineering capacity',
      'GBDT handles missing values natively; DNN requires explicit handling',
      'In practice, many production systems use a GBDT as the baseline and migrate to DNN only when offline and online experiments confirm a significant quality improvement justifying the added complexity',
    ],
    trap: 'Saying DNN is always better. GBDT consistently outperforms DNN on well-engineered tabular features, is faster to train and serve, and is far easier to debug.',
  },
  {
    id: 'rec-006',
    difficulty: 'mid',
    question: 'Explain the cold start problem for a new item. What is the first thing you would do when a new item is added to the catalog?',
    keyPoints: [
      'New items have no interaction history so collaborative filtering cannot produce a meaningful embedding for them',
      'Immediate fallback: compute a content-based embedding from the item\'s metadata (title, description, category, image) and map it into the collaborative embedding space using a learned projection',
      'Exploration: actively show the new item to a diverse set of users to accumulate interaction data; Thompson Sampling can govern how aggressively to explore',
      'Threshold-based transition: switch from content-based to collaborative ranking once the item has accumulated enough interactions (e.g., 50-100 impressions with logged outcomes)',
    ],
  },
  {
    id: 'rec-007',
    difficulty: 'mid',
    question: 'Why is offline NDCG improvement not sufficient to justify shipping a new recommender model?',
    keyPoints: [
      'Offline evaluation uses historical logged data which reflects the previous model\'s exposure decisions — it cannot tell you what users would do with recommendations the old model never showed them',
      'Offline metrics measure ranking quality on seen interactions; they do not capture session-level engagement, user satisfaction, or downstream conversion',
      'A model can improve NDCG on logged data while degrading CTR and revenue in production because it learned to better predict the past, not to better serve future users',
      'Online A/B test on production traffic is the authoritative signal — offline NDCG is a development tool, not a launch criterion',
    ],
    trap: 'Treating offline NDCG as a launch gate. It is a directional signal during development, not a substitute for controlled online experimentation.',
  },
  {
    id: 'rec-008',
    difficulty: 'mid',
    question: 'Describe how you would add a diversity constraint to a ranked list without retraining the ranking model.',
    keyPoints: [
      'Apply MMR (Maximal Marginal Relevance) as a post-processing step after the ranker outputs scores',
      'Greedily select each next item to maximize: lambda * relevance_score - (1-lambda) * max_similarity_to_already_selected',
      'Tune lambda on online experiments — values between 0.4 and 0.7 are typical starting points',
      'Define similarity using item category, creator ID, or content embedding distance depending on what diversity dimension matters most for the use case',
    ],
    trap: 'Retraining the model every time a diversity requirement changes. Post-processing MMR decouples diversity tuning from model training and allows much faster iteration.',
  },
  {
    id: 'rec-009',
    difficulty: 'mid',
    question: 'A new version of your two-tower retrieval model is 2% better in recall@200 on offline evaluation but increases ANN index build time from 1 hour to 4 hours. Is this a regression?',
    keyPoints: [
      'Depends on how often the index needs to be rebuilt — if it is rebuilt daily, 4 hours is a significant operational constraint',
      'ANN index build time directly affects how fresh item embeddings are in the retrieval stage; a 4-hour build means newly added items are delayed 4 hours from appearing in recommendations',
      'Evaluate whether the 2% recall improvement translates to online gains that justify the infrastructure cost and freshness latency',
      'Consider whether the new model can be distilled or quantized to reduce embedding dimensionality and restore build time',
    ],
  },
  {
    id: 'rec-010',
    difficulty: 'senior',
    question: 'How does inverse propensity scoring (IPS) correct for position bias in training data for a recommender?',
    keyPoints: [
      'Position bias: items shown at position 1 receive far more clicks than equally good items at position 10, purely due to visibility, not quality',
      'IPS weights each training example by 1/P(position=k) where P(position=k) is the probability of that item having been shown at position k — items at low-visibility positions get higher weight to correct for the fact that their true click rate is underestimated',
      'This requires knowing the examination probability for each position, estimated either from randomization experiments or from click models (PBM, cascade model)',
      'Without IPS, the ranker learns to predict clicks given the biased exposure distribution, not to predict relevance — it reinforces high-position items regardless of true quality',
    ],
    trap: 'Confusing IPS with oversampling. IPS reweights training examples to correct for selection/exposure bias; oversampling addresses class imbalance. They solve different problems.',
  },
  {
    id: 'rec-011',
    difficulty: 'senior',
    question: 'Design the feature serving architecture for a recommender that must rank 200 candidates per request at under 20 ms for ranking inference.',
    keyPoints: [
      'Batch all 200 candidate feature lookups into a single multi-get call to the feature store — sequential lookups would each cost 1-2 ms and blow the budget',
      'Precompute and cache user embeddings and long-term features; only compute session-level real-time features at request time',
      'Co-locate the feature store and inference service in the same availability zone to minimize network latency on multi-get calls',
      'Profile the feature serving contribution to total latency separately from inference latency — feature enrichment often dominates over model inference in production systems',
    ],
    trap: 'Focusing only on model inference optimization. Feature serving latency, not model inference, is the dominant cost in most production recommenders.',
  },
  {
    id: 'rec-012',
    difficulty: 'senior',
    question: 'Explain how a feedback loop causes popularity bias in a collaborative filtering recommender and describe two interventions.',
    keyPoints: [
      'Popular items receive more exposure, generating more interactions, which increases their interaction count, which makes the model rank them higher, increasing exposure further — a self-reinforcing cycle',
      'Intervention 1: exploration allocation — reserve 10-15% of recommendation slots for items the model is uncertain about, governed by Thompson Sampling or UCB over item uncertainty estimates',
      'Intervention 2: inverse propensity scoring — downweight popular items\' training examples by their exposure probability so the model does not misinterpret high click counts as high quality',
      'Both interventions reduce raw relevance metrics but improve long-tail coverage, user satisfaction breadth, and catalog equity',
    ],
    trap: 'Treating popularity bias as a pure fairness concern. It is also a model quality problem: the ranker learns a biased estimate of item quality that degrades relevance for users interested in non-popular items.',
  },
  {
    id: 'rec-013',
    difficulty: 'senior',
    question: 'A product manager wants the ranking model to optimize for both short-term CTR and long-term user retention. How do you incorporate both objectives?',
    keyPoints: [
      'Multi-objective training: add a retention proxy signal (e.g., 7-day return rate, session length on day+1) as an additional label alongside CTR',
      'Use a multi-task learning architecture: shared lower layers with separate prediction heads for each objective, combined with a weighted loss',
      'The objective weights are a business decision, not a purely technical one — tune via online experiments measuring both CTR and retention tradeoffs',
      'Watch for objective conflicts: a model that maximizes short-term CTR by surfacing clickbait may actively harm retention; the multi-objective framing makes this tension explicit and manageable',
    ],
    trap: 'Treating this as a single-metric problem and just adding a retention feature to the CTR model. That does not allow explicit control over the tradeoff — multi-task learning with explicit objective weights is the correct approach.',
  },
  {
    id: 'rec-014',
    difficulty: 'junior',
    question: 'What is the retrieval stage responsible for and what is the correct success metric for it?',
    keyPoints: [
      'Retrieval narrows millions of items down to a few hundred candidates for the ranker',
      'The correct metric is recall@K — what fraction of items the user would ultimately engage with are present in the candidate set',
      'Retrieval precision is less important than recall because the ranker will eliminate irrelevant candidates in the next stage',
      'A missed relevant item at retrieval cannot be recovered by the ranker — retrieval errors are final',
    ],
    trap: 'Optimizing retrieval for precision rather than recall. At the retrieval stage, missing a relevant item is worse than including a few irrelevant ones — the ranker handles filtering.',
  },
  {
    id: 'rec-015',
    difficulty: 'junior',
    question: 'What does it mean for a new user to have a "cold start" problem and what is a simple first solution?',
    keyPoints: [
      'A new user has no interaction history so the collaborative filtering model cannot produce a meaningful personal embedding',
      'Simple first solution: show trending or editorially curated content that is broadly engaging while recording implicit signals from the user\'s first interactions',
      'Onboarding surveys (select 3 topics you like) provide immediate preference signal to bootstrap a profile',
      'Switch to personalized recommendations once the user has accumulated enough interactions (typically 10-20 explicit signals)',
    ],
  },
  {
    id: 'rec-016',
    difficulty: 'mid',
    question: 'How do you evaluate a recommender system when users can only click on items they are shown? What bias does this introduce?',
    keyPoints: [
      'This is position/exposure bias — the training data only contains feedback on shown items, making it a biased sample of user preferences',
      'Items never shown have no labels, even if the user would have loved them — this is the missing-not-at-random (MNAR) problem',
      'Offline evaluation on logged data overestimates the quality of items the previous model liked to show (selection bias) and cannot evaluate items it suppressed',
      'Counterfactual evaluation (IPS, doubly robust estimators) and online experimentation with forced exposure of random items are the standard corrections',
    ],
    trap: 'Treating clicked items as positive labels and unclicked items as negative labels. Unclicked items may not have been seen by the user at all — they are missing, not negative.',
  },
  {
    id: 'rec-017',
    difficulty: 'senior',
    question: 'Your two-tower retrieval model is trained with in-batch negatives. What is this technique, why is it efficient, and what is its main risk?',
    keyPoints: [
      'In-batch negatives: treat all other items in the same training batch as negative examples for each user-item positive pair — eliminates the need to sample explicit negatives',
      'Efficiency: given a batch of B positive (user, item) pairs, you get B*(B-1) implicit negative pairs for free, making training extremely compute-efficient',
      'Risk: if the batch contains a positive pair (user_i, item_j) where item_j is also genuinely relevant to user_i, treating it as a hard negative creates false negatives in training',
      'Mitigation: filter known positives from the batch negatives (deduplication), and supplement with a small set of randomly sampled or hard-mined true negatives',
    ],
    trap: 'Thinking in-batch negatives are unbiased. They over-represent popular items as negatives (since popular items appear more frequently in batches), which causes the model to underrank popular items relative to their true relevance.',
  },
  {
    id: 'rec-018',
    difficulty: 'senior',
    question: 'Describe a production system design where real-time session features significantly improve recommendation quality. What engineering challenges does this introduce?',
    keyPoints: [
      'Session features like last-5-viewed items and current search query allow the model to capture immediate intent that long-term embeddings miss — e.g., a user browsing for a gift vs. for themselves',
      'Engineering challenge 1: the session context must be read and appended to the feature vector at request time with very low latency — any blocking call here adds directly to P99',
      'Engineering challenge 2: the serving system must maintain session state (typically in Redis with a TTL) and handle session expiry, new session detection, and cross-device session merging',
      'Engineering challenge 3: training-serving skew — if session features are not available during training time replay (because logs don\'t capture session context faithfully), the model trains on features it cannot access at serving time',
    ],
    trap: 'Treating session features as a simple add-on. The training-serving skew problem — where session features available at serving time are not faithfully reproduced during offline training — is one of the hardest operational challenges in production recommenders.',
  },
  {
    id: 'rec-019',
    difficulty: 'mid',
    question: 'What is calibration in the context of a ranking model and why does it matter even if NDCG is high?',
    keyPoints: [
      'Calibration: the model\'s predicted click probability should match the actual observed click rate at that predicted probability level',
      'A well-calibrated model with predicted score 0.3 should have approximately 30% of those items actually clicked',
      'Poor calibration matters even with high NDCG because downstream systems (bid optimization, budget allocation) use the raw predicted probabilities as inputs — miscalibrated scores lead to incorrect decisions',
      'Calibration is evaluated with reliability diagrams and expected calibration error (ECE); corrected with Platt scaling or isotonic regression applied post-training',
    ],
    trap: 'Assuming a model with good ranking metrics is automatically well-calibrated. Ranking quality and probability calibration are independent properties — a model can rank perfectly while being systematically miscalibrated.',
  },
  {
    id: 'rec-020',
    difficulty: 'senior',
    question: 'Walk through how you would design an A/B test for a new ranking model on a video recommendation platform. What are the key experimental design decisions?',
    keyPoints: [
      'Randomize at the user level to avoid within-session confounds — the same user should always see the control or treatment model, not a mix',
      'Primary metrics: 7-day retention, total watch time per session, CTR. Guard rails: latency P99, error rate, coverage (do not let the new model starve long-tail items of all exposure)',
      'Minimum detectable effect and sample size: calculate required user-days before starting — insufficient power causes false negatives where real improvements are missed',
      'Holdback strategy: keep 5% of users on the old model permanently as a long-term holdback to detect cumulative effects like filter bubble formation that only appear after weeks',
    ],
    trap: 'Measuring only short-term engagement metrics. Recommender A/B tests must include retention and session health metrics measured over 7+ days because short-term CTR gains can mask long-term user experience degradation.',
  },
  {
    id: 'rec-021',
    difficulty: 'junior',
    question: 'What is matrix factorization and how does it produce user and item embeddings?',
    keyPoints: [
      'Matrix factorization decomposes the user-item interaction matrix R (m users x n items) into two lower-rank matrices: user embedding matrix U (m x k) and item embedding matrix V (n x k)',
      'The product U * V^T approximates R; training minimizes reconstruction error on observed interactions',
      'k (embedding dimension) is a hyperparameter controlling capacity — typically 32-256 for production systems',
      'Once trained, the user embedding for user i and item embedding for item j allow relevance to be estimated as dot(U_i, V_j)',
    ],
  },
  {
    id: 'rec-022',
    difficulty: 'mid',
    question: 'Explain why business rule injection should happen after ranking rather than before retrieval.',
    keyPoints: [
      'Rules applied before retrieval reduce the candidate pool, potentially eliminating items that would have ranked very high and satisfied the rule anyway',
      'Post-ranking injection preserves the ML model\'s quality signal for all candidates and only overrides the final list for compliance or business constraints',
      'Pre-retrieval hard filters are still appropriate for absolute exclusions (out-of-stock, geo-restricted, safety-filtered) — these items should never enter the pipeline',
      'The principle: ML should rank freely; business rules should constrain the final output, not the model\'s input',
    ],
    trap: 'Applying all business rules as pre-retrieval filters. Filtering too aggressively before retrieval removes the ML model\'s ability to find the best items within constraints, degrading recommendation quality.',
  },
];
