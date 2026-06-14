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
    body: `The core constraint that forces a two-stage architecture is simple arithmetic. Netflix has roughly 15,000 titles; YouTube has over 800 million videos; an e-commerce catalog may contain tens of millions of SKUs. A neural ranking model that takes 5 ms to score a single (user, item) pair would require 50,000 seconds to score every YouTube video for one user. Even a highly optimized model running at 0.1 ms per item still takes 22 hours to score 800 million items for a single request. The two-stage design exists to make that math tractable.

The retrieval stage reduces the item space from millions to a few hundred candidates using cheap, index-friendly algorithms - typically approximate nearest neighbor search over learned embeddings. This stage must complete in under 20 ms, which means it cannot use any model that requires per-item feature enrichment at query time. The ranking stage then scores those few hundred candidates with a much richer model, using features that would be prohibitively expensive to compute across the full catalog: cross-features between user history and item attributes, real-time session context, predicted completion rate, and interaction-based affinity signals.

The separation is not merely a latency trick - it is a division of optimization objectives. Retrieval optimizes for recall: you want zero false negatives. A relevant item that is not in the candidate set can never be surfaced by the ranker, making retrieval misses final and unrecoverable. Ranking optimizes for precision and ordering: given a bounded candidate set, what exact ordering maximizes user engagement and business outcomes? These two objectives require fundamentally different model architectures and training signals, and trying to collapse them into a single model forces an unworkable compromise.

In practice, production systems at companies like Pinterest, LinkedIn, and Airbnb have evolved beyond a simple two-stage design into a multi-stage funnel: a lightweight retrieval stage yields 1,000 candidates, a fast L1 ranker prunes to 200, a full L2 ranker orders those 200, and a re-ranker applies business constraints and diversity rules to produce the final list. Each stage in the funnel uses progressively richer features and more expensive models, with the cost justified by the progressively smaller candidate set.`,
  },
  {
    heading: 'Stage 1: Candidate Retrieval',
    body: `The retrieval stage must accomplish two things simultaneously: return candidates with very high recall (it cannot miss items the user would genuinely like) and do so in under 20 ms against a catalog of millions of items. This combination of constraints makes the choice of retrieval algorithm critical.

Matrix factorization was the first generation of industrial retrieval. Algorithms like ALS (Alternating Least Squares) decompose the user-item interaction matrix into user embeddings U and item embeddings V such that U * V^T approximates the observed interaction matrix. At serving time, you compute the dot product between the query user's embedding and all item embeddings, then return the top-K. This brute-force scan works up to a few hundred thousand items but becomes too slow beyond that. Two-tower neural models replaced matrix factorization as the dominant retrieval approach by encoding user context and item features through separate deep networks into a shared embedding space. The user tower can incorporate session context, device type, and recent interaction history; the item tower can incorporate content embeddings, popularity signals, and metadata. Because the towers are independent at inference time, item embeddings can be precomputed offline and stored in an index, and only the user embedding needs to be computed per request.

The enabling technology for fast retrieval at scale is Approximate Nearest Neighbor (ANN) search. FAISS (Facebook AI Similarity Search) supports both CPU and GPU index backends; its IVF (Inverted File) index partitions the embedding space into Voronoi cells, and at query time only searches the nearest cells - typically achieving 95%+ recall at 1 ms for 10 million items on a single CPU core. HNSW (Hierarchical Navigable Small World graphs) builds a layered graph structure where each node is connected to its approximate nearest neighbors; queries traverse from coarse to fine layers, achieving excellent recall-latency tradeoffs without the quantization loss of IVF. Google's ScaNN uses asymmetric quantization and anisotropic vector quantization to achieve the highest recall-per-latency ratio in benchmarks, and is the basis of Google's production retrieval systems. In practice, HNSW is the most commonly deployed choice because it supports dynamic insertions (critical for adding new items in real time) while FAISS IVF requires index rebuilds.

A production failure mode that is rarely discussed: ANN index staleness. When new items are added to the catalog, they are not immediately searchable via ANN - they first need to be embedded by the item tower and inserted into the index. If the index rebuild takes 4 hours, new items are invisible to retrieval for 4 hours after publication. For news platforms or live-content systems, this is unacceptable. Solutions include maintaining a separate "new item" retrieval path using content-based similarity that does not require ANN indexing, or using an HNSW index that supports real-time insertions.`,
  },
  {
    heading: 'Stage 2: Ranking',
    body: `The ranking stage receives the candidate set from retrieval - typically 200 to 1,000 items depending on the system - and must produce a precise ordering that maximizes engagement, revenue, or whatever objective the business has specified. Because the candidate set is bounded, ranking can use features and models that would be infeasible during retrieval.

Feature engineering for ranking draws from three sources with very different freshness requirements. User features include long-term preference embeddings (computed offline, refreshed daily), subscription tier, historical click-through rates by category, and device type. Item features include content embeddings, 30-day click rate, recency, editorial quality scores, and price. The most valuable features are cross features: user-item affinity estimated from past behavior with items in the same category, predicted video completion rate conditioned on the user's historical completion patterns, and time-of-day context (a user browsing at midnight has different intent than at 9am). These cross features are what justify the existence of the ranking stage - they cannot be precomputed offline for all user-item pairs, and they require the user context to be combined with item context at query time.

Two model families dominate production ranking. Gradient Boosted Decision Trees (LightGBM, XGBoost) are preferred when the feature set is primarily tabular and well-engineered. They train in hours rather than days, handle missing values without imputation, run inference in under 1 ms per candidate set, and produce interpretable feature importance scores that satisfy audit and regulatory requirements. Deep Neural Networks (DNNs) are preferred when inputs include raw embeddings or image/text features that need learned representations. DNNs learn feature interactions automatically through learned cross-layers, handle embedding inputs natively, and can jointly learn representations end-to-end in a way that GBDTs cannot. Many production systems use both: a GBDT as a strong baseline for launch, and a DNN as an aspirational upgrade that is shipped only when online experiments confirm a meaningful improvement in engagement metrics.

The loss function used during ranking training has significant practical consequences. Pointwise loss (binary cross-entropy on click/no-click) is easiest to implement but treats each item independently, ignoring its position relative to other items. Pairwise loss (BPR, LambdaRank) penalizes cases where a less-relevant item appears above a more-relevant one, which is more aligned with the actual ranking objective. Listwise loss (LambdaLoss, SoftmaxLoss) directly optimizes NDCG or similar ranking metrics across the full candidate list. In practice, most production ranking models use pointwise loss because it is simple, scales to large candidate sets, and can be extended to multi-task learning by adding additional label heads for auxiliary objectives like completion rate or share probability.`,
  },
  {
    heading: 'Cold Start Problem',
    body: `Cold start is the recommender system's version of the chicken-and-egg problem: collaborative filtering requires interaction history to make good recommendations, but new users and items have no history. The challenge is not merely a nuisance - at Spotify, approximately 60,000 new tracks are uploaded every day, and each one is invisible to collaborative filtering until it accumulates listening data. On a platform with 100 million monthly active users, the cold start period for a new item might be hours; on a platform with 10,000 users, it might be weeks.

For new users, the standard approach is a cascade of fallbacks ordered by quality of available signal. With zero signal, show editorially curated content or global popularity rankings - this at least gets the user into the funnel and generates the first implicit interaction signals. Onboarding prompts that ask the user to select interests or rate a few items from their known preferences accelerate the transition dramatically: even 5 explicit ratings can produce a usable user embedding via content-based projection. Demographic-based fallbacks (population-level priors conditioned on age group, geographic region, and device) provide a better starting point than global popularity but still underperform personalized recommendations. The transition from fallback to full personalization typically happens at 10-20 explicit interactions or 50-100 implicit signals (page views, partial watches).

For new items, the most important technique is content-based embedding with collaborative projection. You compute an embedding for the new item using its metadata - title, description, category tags, thumbnail image embeddings, audio features, or whatever content signals are available - and then map this content embedding into the same space as the collaborative item embeddings using a learned linear or nonlinear projection. This gives the item an initial collaborative-space position based on similar items that already have interaction history. The quality of this cold-start embedding depends entirely on the richness and relevance of the metadata. Pinterest uses visual embeddings from pin images to bootstrap new pin recommendations; Spotify uses audio features (tempo, key, danceability extracted from audio waveforms) to bootstrap new track recommendations before any listening data exists.

A subtle but important point: cold start is not a binary state but a continuous spectrum. An item with 5 interactions has better signal than one with 0, but far worse than one with 500. Most systems define a threshold (commonly 50-100 interactions) above which the item transitions from content-based to collaborative ranking, but the optimal threshold is workload-specific and should be validated on engagement metrics rather than assumed. The threshold also interacts with the exploration policy: systems that aggressively show new items to diverse users to accumulate interaction data faster will have items cross the threshold sooner, but risk degrading short-term recommendation quality for the users chosen as exploration targets.`,
  },
  {
    heading: 'Real-time vs Batch Feature Serving',
    body: `One of the most consequential architectural decisions in a production recommender is determining which features need real-time freshness and which can be precomputed in batch. Getting this wrong in either direction causes problems: computing too many features at request time blows the latency budget; not computing enough real-time features leaves valuable signal on the table.

Batch features are precomputed offline on a schedule - typically hourly to daily - and stored in a low-latency online feature store keyed by user ID or item ID. Long-term user preference embeddings are the canonical batch feature: they require the user's full interaction history to compute, a computation that takes seconds and cannot happen in the critical path of a request. Item-level aggregate statistics such as 30-day click rate, average watch duration, and content embeddings are similarly batch-computed. Redis, Cassandra, and DynamoDB are the standard choices for the online feature store, each offering sub-millisecond key-value lookup. The serving system retrieves batch features with a single multi-get call for all candidates - making 200 individual sequential lookups instead of one batched multi-get is a classic production mistake that adds 200-400 ms of latency.

Real-time features are computed at request time or maintained by a streaming pipeline that updates them within seconds of new events. Session context is the most impactful real-time feature: the items a user has viewed in the current session reveal immediate intent that long-term embeddings miss. A user who just watched three action thrillers has clearly shifted into a different consumption mode than their long-term preferences suggest. Session state is typically stored in Redis with a short TTL (15-30 minutes) and read at the start of each recommendation request. Streaming pipelines built on Flink or Kafka Streams maintain near-real-time aggregates such as per-item click rates in the last 10 minutes, trending topics in the last hour, and per-user session depth.

The hardest part of feature serving is avoiding training-serving skew. If a feature is available at serving time but was not faithfully logged during training data collection, the model will learn to use that feature during training but encounter different feature distributions at serving time - producing subtle, hard-to-diagnose quality degradations. For session features in particular, offline training typically cannot replay the exact session state that existed at the moment of each historical recommendation. Teams at Netflix and other large-scale recommendation systems have reported spending significant engineering effort on session feature logging pipelines specifically to ensure that training and serving pipelines see identical feature definitions.`,
  },
  {
    heading: 'Business Rule Injection',
    body: `A trained ML ranker optimizes for its training objective - usually a proxy for user engagement - and has no awareness of contractual obligations, inventory constraints, regulatory requirements, or strategic business goals. The business rule injection layer is the mechanism that reconciles the model's output with these real-world constraints while preserving as much of the model's quality signal as possible.

The most common injection types address fundamentally different concerns. Freshness injection is necessary because collaborative filtering inherently favors items with more historical interactions, which systematically disadvantages newly published content. Without intervention, a platform's recommendation surface will progressively fill with evergreen catalog items at the expense of recent publications. A common approach is to define a "freshness boost" that increases an item's effective ranking score as a function of its age relative to its expected discovery curve - items in their first 24-48 hours get a temporary boost that decays as they accumulate natural organic interaction data. Diversity enforcement prevents the ranker from filling the top-10 results with five items from the same creator or category, which optimizes aggregate engagement at the individual item level but degrades overall user experience. MMR (Maximal Marginal Relevance) is the standard algorithm for post-hoc diversity injection, greedily selecting each next item to maximize a weighted combination of relevance score and dissimilarity to already-selected items.

Promoted item insertion - placing paid placements or editorially mandated items at specified positions - requires careful position management to avoid cannibalizing the user experience too aggressively. A typical convention is to insert promoted items no earlier than position 3, with no more than one sponsored item in the first 10 results. Hard filtering removes items that must never be shown: out-of-stock products, geo-restricted content, content that violates safety policies for the requesting user's age group, or items the user has already purchased. These hard filters are appropriately applied before retrieval - there is no reason for an out-of-stock item to consume a candidate slot - whereas soft rules like diversity and freshness are applied after ranking to preserve the model's quality signal for the selection process.

The architectural principle is clean separation: the ML model ranks freely within the eligible item space, and business rules constrain the final output list. Systems that try to encode all business rules as training objectives end up with impossibly complex multi-objective training problems; systems that apply all business rules as pre-retrieval filters degrade the model's quality by artificially constraining the candidate space. The right boundary is absolute exclusions (safety, geo, inventory) before retrieval and preference-based soft constraints (freshness, diversity, promotions) after ranking.`,
  },
  {
    heading: 'Online Evaluation - A/B Testing Recommenders',
    body: `The fundamental limitation of offline evaluation for recommender systems is that it can only measure performance on items that were previously shown to users. The logged interaction data that forms the evaluation set was generated by a previous version of the system, which made its own decisions about what to show. A new model that would recommend entirely different items - potentially much better ones - cannot be evaluated on historical data because those items were never shown and therefore have no logged outcomes. This is the counterfactual evaluation problem, and it is why offline NDCG improvement is treated as a necessary but not sufficient condition for shipping a new recommender model.

Online A/B testing resolves the counterfactual problem by actually showing users the new model's recommendations and measuring their behavior. The primary metrics for recommender A/B tests are engagement metrics measured at the session and user level, not at the item level. CTR is informative but gameable and noisy. The metrics that capture long-term user value are session length (did users find enough interesting content to continue browsing?), 7-day and 30-day retention (did the new recommendations make users more likely to return?), and total content consumption per day. For platforms with monetization, revenue per user and subscription conversion are the north-star metrics that ultimately justify model development investment.

Experiment design for recommender A/B tests has several non-obvious requirements. Randomization must happen at the user level, not the request level: if the same user sees the control model on some requests and the treatment model on others, their session behavior is confounded and neither set of results is interpretable. Treatment arm size depends on traffic volume: at Netflix or YouTube scale, 1-2% of users per arm provides sufficient statistical power within a week; at smaller platforms, 20-25% per arm may be needed and experiments run for 2-4 weeks. Guard rail metrics - latency P99, error rate, candidate coverage, long-tail item exposure - must be monitored alongside engagement metrics to ensure the new model does not regress on system health or equity.

The deepest challenge in recommender experimentation is the feedback loop: a better model generates better recommendations, which increases engagement, which generates richer training data, which makes the next model better. This compounding effect means short-term A/B test gains often understate the long-term benefit of a model improvement. Some companies maintain permanent holdback groups - 5-10% of users who always see the previous generation of the model - to measure the cumulative effect of model improvements over months rather than weeks.`,
  },
  {
    heading: 'Scalability - Serving Latency Budget',
    body: `The end-to-end latency target for a production recommender is typically 100-200 ms at P99. This budget must be allocated across every component in the serving pipeline: feature lookup, embedding computation, ANN retrieval, candidate enrichment, model inference, business rule processing, and network serialization. Every component that exceeds its allocation causes the overall system to miss its SLO, and at P99, you are designing for the slowest 1 in 100 requests - not the average.

A realistic latency budget breakdown for a two-stage recommender serving 200 candidates: user feature batch lookup from Redis takes 5-10 ms with a properly configured multi-get call; user embedding lookup or computation takes 5-15 ms depending on whether it is cached or freshly computed; ANN retrieval via FAISS IVF or HNSW takes 5-20 ms depending on the index size, recall setting, and number of Voronoi cells or HNSW layers searched; candidate feature enrichment (fetching item features for 200 candidates in a single multi-get) takes 10-20 ms; ranking model inference (LightGBM on CPU or small DNN) takes 10-30 ms; business rule post-processing takes 1-5 ms; and serialization plus network round-trip takes 5-15 ms. This arithmetic constrains every architectural decision: there is no room for serial feature lookups, synchronous external API calls, or model inference that requires cold-loading weights from disk.

Fan-out is the most common latency trap in production recommender serving. When the system needs to fetch features for 200 candidate items from a feature store, a naive implementation issues 200 individual key-value requests. Even at 1 ms per lookup, that sequential approach consumes 200 ms by itself, blowing the entire latency budget before a single candidate is ranked. The solution is always a batched multi-get call that fetches all 200 item features in a single network round trip. This reduces the 200 ms to 5-10 ms but requires the feature store to support batched key-value access efficiently - which Redis, DynamoDB, and Cassandra all do, but only if the serving code uses the multi-get API rather than issuing individual gets in a loop.

Caching is the second major lever for latency and cost reduction. User embeddings should be cached in a local in-process cache with a TTL of 30-60 seconds so that multiple requests during a browsing session do not each recompute the embedding. For lightly personalized surfaces (trending, category top picks), the entire ranked result list can be cached and served to all users in that cohort without any per-user inference. Netflix has reported that caching retrieval results for 30 seconds on low-personalization surfaces reduces ML inference compute by 40-60% without measurable impact on recommendation quality. The cache key design - which user attributes and context signals to include in the key - determines the granularity of personalization that the cache preserves.`,
  },
  {
    heading: 'Feedback Loops - Popularity Bias and Filter Bubbles',
    body: `Recommender systems trained on their own logged outputs create closed feedback loops that systematically distort the next generation of models. Unlike most ML systems where the training data is generated by some external process, recommenders generate their own training data through the recommendations they serve. This creates a self-referential system where the model's current biases become amplified in the next model, which amplifies them further, in a cycle that can take months to become visibly problematic.

Popularity bias is the most pervasive consequence of this feedback loop. Items that are recommended more frequently accumulate more interactions, simply because they receive more exposure. The model interprets the higher interaction count as evidence of higher quality and ranks the item even higher in the next training iteration, increasing exposure further. Over time, a relatively small set of popular items monopolizes the recommendation surface. In a music platform context, studies of collaborative filtering systems have found that the top 1% of artists can capture 30-40% of all listening sessions generated by recommendations, even when those artists represent only 1% of content quality. The long tail of less-popular but potentially high-quality content is systematically suppressed not because users dislike it, but because it never receives enough exposure to demonstrate its quality.

Filter bubbles emerge from the collaborative filtering signal itself. The model learns that users who engaged with item A also engaged with item B, so it recommends B to users who liked A. If applied repeatedly, this narrows the user's recommendation space toward content that is increasingly similar to what they have already consumed. The user's embedding drifts toward a small region of the item space, and the model stops exploring the broader catalog on their behalf. This is a form of over-exploitation in the exploration-exploitation sense: the model is very good at finding more of what the user already likes but provides no mechanism for discovering content outside their established preferences.

The two most important mitigations are inverse propensity scoring (IPS) and structured exploration. IPS reweights training examples by the inverse probability of having been shown under the current policy, correcting for the selection bias in logged data. An item shown at position 1 has a much higher exposure probability than one shown at position 10; without IPS, the model learns that position-1 items are high quality, which is partly true but conflated with the position bias. Structured exploration reserves a fraction of recommendation slots - typically 5-15% - for items the model is uncertain about, governed by Thompson Sampling or upper confidence bound algorithms. These slots break the feedback loop by ensuring that items outside the current model's high-confidence recommendation zone receive some exposure and can accumulate interaction data. Both interventions reduce short-term raw engagement metrics but are necessary to maintain catalog breadth, user discovery, and the model's ability to learn beyond its current blind spots.`,
  },
  {
    heading: 'Fairness and Diversity',
    body: `Fairness in recommender systems has two distinct but interrelated dimensions: user-side fairness (do all demographic groups of users receive equally relevant and high-quality recommendations?) and provider-side fairness (do content creators, merchants, or item providers receive equitable exposure relative to the quality of their content?). Most ML teams focus on model accuracy metrics and encounter fairness concerns late, often after visible incidents, but the architectural choices made early in the system design determine how tractable fairness interventions will be later.

Provider-side exposure fairness is particularly acute on platforms where creator income or business viability depends directly on recommendation traffic. A small number of incumbent creators or sellers who accumulated interaction data early can dominate recommendation surfaces indefinitely through popularity bias, even as newer creators produce content of equal or superior quality. Fairness-aware ranking addresses this by imposing minimum exposure constraints on underrepresented providers. This is implemented as a post-ranking re-ordering step that ensures the result list satisfies exposure constraints while staying within a bounded degradation on relevance metrics. The mathematical framework is multi-objective optimization: maximize relevance subject to minimum exposure constraints per provider category. In practice, the quality degradation from reasonable fairness constraints (ensuring long-tail creators receive at least 20% of exposure) is small - often 1-3% in engagement metrics - while the creator ecosystem impact is significant.

Calibration in the context of user-side fairness means ensuring that the recommendation feed reflects the actual breadth of each user's interests, not just their strongest signal. A user who watches 70% comedy and 30% drama should receive a feed that roughly mirrors that ratio. Calibration failure - over-indexing on the user's strongest interest - occurs because collaborative filtering is greedy: given the choice between a comedy item with predicted CTR 0.15 and a drama item with predicted CTR 0.12, the ranker always chooses the comedy item, and over time the feed converges entirely to comedy even though the user has genuine drama interest. Calibration constraints can be applied as a post-ranking step using a greedy algorithm that ensures the selected result list's category distribution matches the user's historical consumption distribution.

MMR (Maximal Marginal Relevance) is the most widely deployed algorithm for list-level diversity. It greedily builds the ranked output list by selecting each next item to maximize a weighted combination of relevance score and dissimilarity to items already selected. The lambda hyperparameter controls the tradeoff: at lambda=1 the algorithm degenerates to pure relevance ranking; at lambda=0 it maximizes diversity without regard to relevance; at lambda=0.5 (the common production default) it balances the two. The similarity metric used in MMR can be defined over item categories (ensuring category diversity), creator identity (ensuring creator diversity), content embeddings (ensuring semantic diversity), or any combination. Tuning lambda is done through online A/B experiments measuring both diversity metrics and engagement metrics, since the goal is to find a value that maintains engagement while delivering meaningful diversity improvements.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    id: 'rec-001',
    difficulty: 'junior',
    question: 'Why do large-scale recommender systems use two stages instead of running a single ranking model over all items?',
    keyPoints: [
      'Scoring millions of items per request with a complex model exceeds any practical latency budget',
      'Retrieval is cheap and high-recall; ranking is expensive and high-precision - separation lets each stage do what it is good at',
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
      'ANN returns the top-K most similar embeddings without exhaustively computing distances to every item - trades tiny recall loss for massive speed gain',
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
      'Monitoring should track enrichment failure rate as a separate metric - silent candidate loss is a common source of quality regressions',
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
      'Offline evaluation uses historical logged data which reflects the previous model\'s exposure decisions - it cannot tell you what users would do with recommendations the old model never showed them',
      'Offline metrics measure ranking quality on seen interactions; they do not capture session-level engagement, user satisfaction, or downstream conversion',
      'A model can improve NDCG on logged data while degrading CTR and revenue in production because it learned to better predict the past, not to better serve future users',
      'Online A/B test on production traffic is the authoritative signal - offline NDCG is a development tool, not a launch criterion',
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
      'Tune lambda on online experiments - values between 0.4 and 0.7 are typical starting points',
      'Define similarity using item category, creator ID, or content embedding distance depending on what diversity dimension matters most for the use case',
    ],
    trap: 'Retraining the model every time a diversity requirement changes. Post-processing MMR decouples diversity tuning from model training and allows much faster iteration.',
  },
  {
    id: 'rec-009',
    difficulty: 'mid',
    question: 'A new version of your two-tower retrieval model is 2% better in recall@200 on offline evaluation but increases ANN index build time from 1 hour to 4 hours. Is this a regression?',
    keyPoints: [
      'Depends on how often the index needs to be rebuilt - if it is rebuilt daily, 4 hours is a significant operational constraint',
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
      'IPS weights each training example by 1/P(position=k) where P(position=k) is the probability of that item having been shown at position k - items at low-visibility positions get higher weight to correct for the fact that their true click rate is underestimated',
      'This requires knowing the examination probability for each position, estimated either from randomization experiments or from click models (PBM, cascade model)',
      'Without IPS, the ranker learns to predict clicks given the biased exposure distribution, not to predict relevance - it reinforces high-position items regardless of true quality',
    ],
    trap: 'Confusing IPS with oversampling. IPS reweights training examples to correct for selection/exposure bias; oversampling addresses class imbalance. They solve different problems.',
  },
  {
    id: 'rec-011',
    difficulty: 'senior',
    question: 'Design the feature serving architecture for a recommender that must rank 200 candidates per request at under 20 ms for ranking inference.',
    keyPoints: [
      'Batch all 200 candidate feature lookups into a single multi-get call to the feature store - sequential lookups would each cost 1-2 ms and blow the budget',
      'Precompute and cache user embeddings and long-term features; only compute session-level real-time features at request time',
      'Co-locate the feature store and inference service in the same availability zone to minimize network latency on multi-get calls',
      'Profile the feature serving contribution to total latency separately from inference latency - feature enrichment often dominates over model inference in production systems',
    ],
    trap: 'Focusing only on model inference optimization. Feature serving latency, not model inference, is the dominant cost in most production recommenders.',
  },
  {
    id: 'rec-012',
    difficulty: 'senior',
    question: 'Explain how a feedback loop causes popularity bias in a collaborative filtering recommender and describe two interventions.',
    keyPoints: [
      'Popular items receive more exposure, generating more interactions, which increases their interaction count, which makes the model rank them higher, increasing exposure further - a self-reinforcing cycle',
      'Intervention 1: exploration allocation - reserve 10-15% of recommendation slots for items the model is uncertain about, governed by Thompson Sampling or UCB over item uncertainty estimates',
      'Intervention 2: inverse propensity scoring - downweight popular items\' training examples by their exposure probability so the model does not misinterpret high click counts as high quality',
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
      'The objective weights are a business decision, not a purely technical one - tune via online experiments measuring both CTR and retention tradeoffs',
      'Watch for objective conflicts: a model that maximizes short-term CTR by surfacing clickbait may actively harm retention; the multi-objective framing makes this tension explicit and manageable',
    ],
    trap: 'Treating this as a single-metric problem and just adding a retention feature to the CTR model. That does not allow explicit control over the tradeoff - multi-task learning with explicit objective weights is the correct approach.',
  },
  {
    id: 'rec-014',
    difficulty: 'junior',
    question: 'What is the retrieval stage responsible for and what is the correct success metric for it?',
    keyPoints: [
      'Retrieval narrows millions of items down to a few hundred candidates for the ranker',
      'The correct metric is recall@K - what fraction of items the user would ultimately engage with are present in the candidate set',
      'Retrieval precision is less important than recall because the ranker will eliminate irrelevant candidates in the next stage',
      'A missed relevant item at retrieval cannot be recovered by the ranker - retrieval errors are final',
    ],
    trap: 'Optimizing retrieval for precision rather than recall. At the retrieval stage, missing a relevant item is worse than including a few irrelevant ones - the ranker handles filtering.',
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
      'This is position/exposure bias - the training data only contains feedback on shown items, making it a biased sample of user preferences',
      'Items never shown have no labels, even if the user would have loved them - this is the missing-not-at-random (MNAR) problem',
      'Offline evaluation on logged data overestimates the quality of items the previous model liked to show (selection bias) and cannot evaluate items it suppressed',
      'Counterfactual evaluation (IPS, doubly robust estimators) and online experimentation with forced exposure of random items are the standard corrections',
    ],
    trap: 'Treating clicked items as positive labels and unclicked items as negative labels. Unclicked items may not have been seen by the user at all - they are missing, not negative.',
  },
  {
    id: 'rec-017',
    difficulty: 'senior',
    question: 'Your two-tower retrieval model is trained with in-batch negatives. What is this technique, why is it efficient, and what is its main risk?',
    keyPoints: [
      'In-batch negatives: treat all other items in the same training batch as negative examples for each user-item positive pair - eliminates the need to sample explicit negatives',
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
      'Session features like last-5-viewed items and current search query allow the model to capture immediate intent that long-term embeddings miss - e.g., a user browsing for a gift vs. for themselves',
      'Engineering challenge 1: the session context must be read and appended to the feature vector at request time with very low latency - any blocking call here adds directly to P99',
      'Engineering challenge 2: the serving system must maintain session state (typically in Redis with a TTL) and handle session expiry, new session detection, and cross-device session merging',
      'Engineering challenge 3: training-serving skew - if session features are not available during training time replay (because logs don\'t capture session context faithfully), the model trains on features it cannot access at serving time',
    ],
    trap: 'Treating session features as a simple add-on. The training-serving skew problem - where session features available at serving time are not faithfully reproduced during offline training - is one of the hardest operational challenges in production recommenders.',
  },
  {
    id: 'rec-019',
    difficulty: 'mid',
    question: 'What is calibration in the context of a ranking model and why does it matter even if NDCG is high?',
    keyPoints: [
      'Calibration: the model\'s predicted click probability should match the actual observed click rate at that predicted probability level',
      'A well-calibrated model with predicted score 0.3 should have approximately 30% of those items actually clicked',
      'Poor calibration matters even with high NDCG because downstream systems (bid optimization, budget allocation) use the raw predicted probabilities as inputs - miscalibrated scores lead to incorrect decisions',
      'Calibration is evaluated with reliability diagrams and expected calibration error (ECE); corrected with Platt scaling or isotonic regression applied post-training',
    ],
    trap: 'Assuming a model with good ranking metrics is automatically well-calibrated. Ranking quality and probability calibration are independent properties - a model can rank perfectly while being systematically miscalibrated.',
  },
  {
    id: 'rec-020',
    difficulty: 'senior',
    question: 'Walk through how you would design an A/B test for a new ranking model on a video recommendation platform. What are the key experimental design decisions?',
    keyPoints: [
      'Randomize at the user level to avoid within-session confounds - the same user should always see the control or treatment model, not a mix',
      'Primary metrics: 7-day retention, total watch time per session, CTR. Guard rails: latency P99, error rate, coverage (do not let the new model starve long-tail items of all exposure)',
      'Minimum detectable effect and sample size: calculate required user-days before starting - insufficient power causes false negatives where real improvements are missed',
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
      'k (embedding dimension) is a hyperparameter controlling capacity - typically 32-256 for production systems',
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
      'Pre-retrieval hard filters are still appropriate for absolute exclusions (out-of-stock, geo-restricted, safety-filtered) - these items should never enter the pipeline',
      'The principle: ML should rank freely; business rules should constrain the final output, not the model\'s input',
    ],
    trap: 'Applying all business rules as pre-retrieval filters. Filtering too aggressively before retrieval removes the ML model\'s ability to find the best items within constraints, degrading recommendation quality.',
  },
];
