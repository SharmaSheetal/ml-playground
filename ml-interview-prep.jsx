import { useState, useEffect, useRef } from "react";

const SECTIONS = {
  guide: "Study Guide",
  mock: "Mock Interview",
};

const TOPICS = [
  {
    id: "deployment",
    label: "Production Deployment & Serving",
    color: "#00e5ff",
    icon: "🚀",
    subtopics: [
      {
        title: "Model Serving Patterns",
        content: `**Online (Real-time) Serving**
REST/gRPC endpoints that return predictions in milliseconds. Use when latency matters (recommendations, fraud detection). Stack: FastAPI + Uvicorn, TorchServe, TF Serving, Triton Inference Server.

**Batch Serving**
Pre-compute predictions for known entities (e.g., nightly user scores). Use when freshness isn't critical and throughput matters. Stack: Spark, Ray, Airflow DAGs.

**Streaming**
Predictions computed as events arrive (Kafka consumers). Use for near-real-time with high event volume (clickstream scoring, anomaly detection).

**Edge / On-device**
Model runs on device (mobile, IoT). Requires quantization + pruning. Stack: TFLite, ONNX Runtime, CoreML.`,
      },
      {
        title: "Deployment Strategies",
        content: `**Blue/Green Deployment**
Two identical environments; traffic switches instantly. Zero downtime. Easy rollback. Expensive (2× infra).

**Canary Releases**
Gradually shift traffic (1% → 10% → 50% → 100%). Catch regressions early in production with real users. Monitor business metrics at each step before proceeding.

**Shadow Mode**
New model receives production traffic but responses are discarded. Used to compare outputs before live rollout. Zero risk.

**A/B Testing**
Randomized traffic split between models. Measure business KPIs (CTR, revenue, engagement) statistically. Needs sufficient traffic for significance.

**Champion/Challenger**
Incumbent model (champion) vs. experimental model (challenger) run in parallel. Champion serves production; challenger is evaluated. Challenger promotes only if it wins.`,
      },
      {
        title: "Containerization & Scaling",
        content: `**Docker**: Package model + dependencies into an image. Base images: python:3.11-slim, nvidia/cuda for GPU.

**Kubernetes**: Orchestrate containers. Key resources: Deployment (replicas), Service (load balancing), HPA (Horizontal Pod Autoscaler - scale on CPU/custom metrics), VPA (Vertical Pod Autoscaler - resize containers).

**GPU Serving**: Request GPU limits in K8s; use NVIDIA device plugin. Multi-instance GPU (MIG) for sharing a single GPU across pods.

**Model Registries**: MLflow, Weights & Biases, SageMaker Model Registry - version control for models, store artifacts + metadata.

**Serverless**: AWS Lambda, Google Cloud Run - auto-scale to zero. Good for infrequent predictions; cold start latency is the tradeoff.`,
      },
      {
        title: "Latency Optimization",
        content: `**Quantization**: FP32 → INT8 or FP16. Reduces model size and speeds up inference. Post-training quantization (PTQ) vs. quantization-aware training (QAT). QAT recovers more accuracy.

**Pruning**: Remove low-magnitude weights. Structured pruning (entire filters) gives hardware speedups; unstructured is harder to accelerate.

**Knowledge Distillation**: Train a smaller "student" model to mimic a large "teacher." Student inherits soft labels (logits), not just hard labels.

**Model Compilation**: TorchScript, ONNX, TensorRT, XLA - convert to optimized runtimes. TensorRT can give 3–5× speedup on NVIDIA GPUs.

**Caching**: Cache predictions for frequent identical inputs. Use Redis/Memcached. Be careful: stale cache can mask model drift.

**Batching Inference**: Group concurrent requests into a batch. Maximizes GPU utilization. Dynamic batching (configurable max_batch_size and max_latency in Triton).`,
      },
    ],
  },
  {
    id: "metrics",
    label: "Metrics & Monitoring",
    color: "#ff6b6b",
    icon: "📊",
    subtopics: [
      {
        title: "The Four Layers of ML Metrics",
        content: `**1. Infrastructure Metrics** (always monitor)
- Latency: p50, p95, p99 (not just mean - tail latency kills UX)
- Throughput: requests/sec, tokens/sec
- CPU/GPU utilization, memory usage
- Error rate: 4xx/5xx responses

**2. Model Performance Metrics** (model-specific)
- Classification: Accuracy, Precision, Recall, F1, AUC-ROC, AUC-PR
- Regression: MAE, RMSE, MAPE
- Ranking: NDCG, MRR, MAP
- NLP: BLEU, ROUGE, BERTScore, perplexity
- Use the metric that matches your business objective (imbalanced classes → AUC-PR over accuracy)

**3. Data Quality Metrics**
- Feature drift (input distribution shift)
- Missing values, nulls, out-of-range values
- Schema violations (type mismatches, unexpected cardinalities)

**4. Business Metrics** (the ones that matter most)
- Revenue, conversion rate, CTR, engagement time
- These are your ultimate success criteria. Model metrics are proxies.`,
      },
      {
        title: "Drift Detection",
        content: `**Data Drift (Covariate Shift)**
Input distribution P(X) changes. Model sees inputs unlike its training data. Detection: statistical tests on feature distributions over time windows.

**Concept Drift**
The relationship P(Y|X) changes. The world changes, making old patterns stale. Harder to detect - requires ground truth labels which arrive with delay.

**Label Drift**
The marginal distribution P(Y) changes (e.g., more fraud during holidays).

**Prediction Drift**
Monitoring output distribution as a proxy when labels are unavailable. If predictions shift, inputs or model behavior changed.

**Statistical Tests**
- Kolmogorov-Smirnov test: compare continuous distributions
- Population Stability Index (PSI): common in banking/credit; PSI > 0.2 = significant drift
- Chi-squared: categorical features
- Jensen-Shannon Divergence: symmetric KL divergence, bounded [0,1]
- Wasserstein Distance: Earth Mover's Distance, good for multivariate drift

**Windowing strategies**: Tumbling windows (fixed non-overlapping), sliding windows (overlapping), landmark windows (compare vs. training baseline).`,
      },
      {
        title: "Monitoring Stack",
        content: `**Metrics Collection**
- Prometheus: time-series scraping, powerful query language (PromQL)
- StatsD / Datadog: push-based metrics
- OpenTelemetry: vendor-neutral instrumentation standard

**Visualization**
- Grafana: dashboards on top of Prometheus, ClickHouse, etc.
- Datadog, New Relic: managed observability platforms

**ML-Specific Monitoring Tools**
- Evidently AI: open-source drift detection + dashboards
- Arize AI, Fiddler AI: commercial ML observability
- WhyLabs: data profiling + drift monitoring
- Seldon Alibi Detect: open-source drift/outlier detection

**Alerting**
- Set alert thresholds on p99 latency, error rates, PSI scores
- Alert on label quality degradation if ground truth is delayed
- Use anomaly detection for alerts (vs. static thresholds) for noisy metrics

**Logging**
- Log prediction inputs + outputs (with sampling for high-volume)
- Critical for debugging and building evaluation datasets
- Be careful with PII - anonymize/hash sensitive fields`,
      },
      {
        title: "Ground Truth & Feedback Loops",
        content: `**Delayed Labels Problem**
Ground truth often arrives long after prediction (e.g., fraud confirmed days later, loan default months later). Solutions:
- Proxy labels (user clicks as proxy for relevance)
- Label collection infrastructure (annotation pipelines)
- Semi-supervised approaches

**Feedback Loops**
Model predictions influence future training data, creating bias:
- Exposure bias: if model only shows top-ranked items, data only reflects those items
- Popularity bias in recommender systems
- Filter bubbles

**Shadow Logging**
Log all model inputs/outputs for offline analysis. Enables offline evaluation before deploying a new model.

**Online Evaluation**
Measure real-world business metrics. A/B tests, interleaving experiments (for ranking systems).`,
      },
    ],
  },
  {
    id: "mlops",
    label: "Training Pipelines & MLOps",
    color: "#a78bfa",
    icon: "⚙️",
    subtopics: [
      {
        title: "ML Pipeline Architecture",
        content: `**Data Ingestion**: Pull from data warehouse (Snowflake, BigQuery), data lake (S3 + Delta/Iceberg), or streaming sources. Validate schema on arrival.

**Feature Engineering**: Compute features from raw data. Feature Stores (Feast, Tecton, Vertex Feature Store) separate feature computation from model training, enable feature reuse, and provide online/offline consistency.

**Training**: Orchestrate with Airflow, Prefect, Kubeflow Pipelines, or ZenML. Use experiment tracking (MLflow, W&B) to log hyperparameters, metrics, and artifacts every run.

**Evaluation**: Automated offline evaluation against held-out test set + behavioral tests (slicing, fairness checks, adversarial examples).

**Promotion**: If evaluation passes thresholds, promote to staging → production. Gate on: performance metrics, data quality checks, latency benchmarks.

**Retraining**: Triggered by schedule, drift detection, or performance degradation. Full retraining vs. fine-tuning vs. continual learning.`,
      },
      {
        title: "Feature Stores",
        content: `**Problem they solve**: Same feature computed differently offline (training) vs. online (serving) causes training-serving skew - a major production bug.

**Architecture**
- Offline Store: Historical features for training (data warehouse / Parquet files)
- Online Store: Low-latency feature retrieval for serving (Redis, DynamoDB, Bigtable)
- Feature Registry: Metadata catalog of features, owners, definitions

**Key benefits**
1. Feature reuse across teams and models
2. Point-in-time correct feature retrieval for training (no data leakage)
3. Consistent online/offline feature computation

**Tools**: Feast (open-source), Tecton (managed), Vertex AI Feature Store, AWS SageMaker Feature Store, Hopsworks.

**Training-Serving Skew**: Occurs when training features differ from serving features. Causes: different preprocessing code paths, feature staleness, schema drift. Prevention: single feature computation path, automated skew detection.`,
      },
      {
        title: "CI/CD for ML",
        content: `**Continuous Integration (CI)**
- Unit tests for data processing functions
- Data validation tests (schema, stats)
- Model training in a reduced environment (smoke tests)
- Offline model evaluation (performance gates)

**Continuous Delivery (CD)**
- Automated model deployment to staging
- Integration tests against staging environment
- Canary deployment with automated rollback on metric degradation

**CT - Continuous Training**
Triggered retraining on drift detection, data freshness, or scheduled cadence. Different from software CI/CD - data and model artifacts need versioning too.

**Tools**: GitHub Actions + DVC (data versioning), MLflow + Airflow, Kubeflow, Vertex AI Pipelines, SageMaker Pipelines.

**Model Versioning**
- Version models with semantic versioning (v1.2.0)
- Store model artifacts with metadata: training data hash, hyperparameters, eval metrics, training date
- Never overwrite - always append new versions`,
      },
      {
        title: "Data Management",
        content: `**Data Versioning**: DVC (Data Version Control) - tracks dataset changes in Git, stores data in S3/GCS. Enables reproducibility.

**Data Lineage**: Track where data comes from, transformations applied, which models used it. Tools: Apache Atlas, DataHub, OpenLineage, Marquez.

**Data Validation**: Great Expectations, TFX Data Validation - define expectations (column types, value ranges, no nulls) and run them in the pipeline.

**Experiment Reproducibility**
- Fix random seeds
- Log library versions (requirements.txt, conda env)
- Version training data
- Log all hyperparameters
- Store training code hash alongside model artifact

**Data Splits Best Practices**
- Temporal split for time-series (never shuffle before splitting)
- Stratified split for imbalanced classes
- Group split when data points are correlated (same user → same split)
- Never use future data to predict past (data leakage)`,
      },
    ],
  },
  {
    id: "sysdesign",
    label: "System Design (End-to-End)",
    color: "#34d399",
    icon: "🏗️",
    subtopics: [
      {
        title: "ML System Design Framework",
        content: `**Step 1: Clarify Requirements (5 min)**
- What is the business problem? What does success look like?
- Scale: QPS, DAU, data volume?
- Latency requirements: real-time (<100ms) vs. batch?
- Freshness: how quickly must model adapt to new data?
- Constraints: budget, team size, existing infrastructure?

**Step 2: Define the ML Problem**
- Formulate as supervised/unsupervised/RL
- Define label: what are you predicting?
- Define evaluation metric (offline + online)
- Identify key challenges: data imbalance, cold start, label scarcity

**Step 3: Data Pipeline**
- Sources, collection, labeling strategy
- Feature engineering + feature store
- Training/validation/test splits

**Step 4: Modeling**
- Baseline model (simple, interpretable)
- Model architecture + training strategy
- Offline evaluation plan

**Step 5: Serving Architecture**
- Online vs. batch vs. hybrid?
- Latency budget per component
- Fallback strategy (model fails → default)

**Step 6: Monitoring & Iteration**
- What metrics to monitor?
- Retraining triggers?
- A/B testing plan?`,
      },
      {
        title: "Common System Design Problems",
        content: `**Recommendation System**
Two-stage: Candidate Generation (fast retrieval, ANN search over embeddings - Faiss, ScaNN) → Ranking (precision model scores top-K candidates). Feature store for user/item embeddings. Offline: NDCG, online: CTR/engagement.

**Real-Time Fraud Detection**
Low latency is critical (<50ms). Feature engineering over event streams (Flink, Kafka). Rule engine + ML model hybrid. Heavily imbalanced (fraud is rare) → use AUC-PR, focal loss, oversampling. Shadow mode before live deploy.

**Search Ranking**
Query understanding (intent classification, NER) → Retrieval (BM25 + dense retrieval) → Reranking (cross-encoder or LTR model). Evaluation: NDCG@10, MRR. Online eval: click-through rate, time-to-click.

**Demand Forecasting**
Time series prediction. Feature: lags, seasonality, promotions, holidays. Models: ARIMA, Prophet, LightGBM with lag features, N-BEATS, TFT. Evaluation: MAPE, WAPE, bias. Batch inference, output to inventory systems.

**LLM-Powered Feature**
RAG: embedding store (Pinecone, Weaviate, pgvector) + retriever + LLM generator. Evaluation: retrieval recall, generation faithfulness (using LLM as judge). Serving: streaming tokens via SSE, caching frequent queries.`,
      },
      {
        title: "Scalability Patterns",
        content: `**Horizontal Scaling**
Add more replicas behind a load balancer. Stateless serving pods scale easily. Use HPA in Kubernetes with custom ML metrics (queue depth, GPU utilization).

**Caching Strategies**
- Prediction cache: hash input → cache output (for identical inputs)
- Embedding cache: pre-compute and store entity embeddings
- Feature cache: warm feature values in Redis before serving

**Async Processing**
For non-latency-critical tasks: put prediction requests on a queue (SQS, Kafka), worker pool processes them, results stored in DB. Decouples ingestion from processing.

**Data Sharding**
Shard model storage and feature lookups by entity ID (user_id, item_id). Consistent hashing for shard assignment.

**Multi-Region**
Deploy serving to multiple regions for low latency globally. Models replicated per region. Consider: which region's model is truth for retraining?

**Load Shedding**
Under extreme load: drop lower-priority requests or serve cached/default predictions. Circuit breaker pattern to prevent cascade failures.`,
      },
      {
        title: "Trade-offs to Discuss in Interviews",
        content: `**Accuracy vs. Latency**
More complex model → higher accuracy, higher latency. Solution: two-stage (fast retrieval + precise reranking), model compression, caching.

**Freshness vs. Stability**
Frequent retraining → fresher model but risk of regression. Less retraining → stable but can drift. Solution: automated eval gates + canary releases.

**Recall vs. Precision**
Fraud detection: high recall (catch fraud) at cost of precision (false positives). Content moderation: depends on business risk appetite. Adjust classification threshold, not just model.

**Online vs. Batch Features**
Online features (real-time user context) are powerful but expensive. Batch features (precomputed) are cheap but stale. Use both: base features batch-precomputed, last-N-actions online.

**Build vs. Buy**
Feature stores, monitoring tools, orchestrators - build only what gives competitive advantage. Buy/open-source commodity infrastructure.

**Explainability vs. Performance**
Regulators often require explainability (SHAP, LIME, model cards). Deep models perform better but are black boxes. Gradient Boosted Trees give good perf + SHAP out of the box.`,
      },
    ],
  },
];

const MOCK_QUESTIONS = [
  {
    id: 1,
    topic: "deployment",
    question:
      "You're deploying a new recommendation model to production. Walk me through your rollout strategy and what could go wrong.",
    hints: [
      "Think about canary vs. A/B vs. shadow mode",
      "What metrics would you monitor?",
      "How do you roll back safely?",
    ],
    keyPoints: [
      "Shadow mode first to compare outputs with zero risk",
      "Canary at 1–5% with automated rollback if p99 latency spikes or business metrics degrade",
      "Full A/B test for business metric validation with statistical significance",
      "Rollback: re-route traffic to champion, don't delete challenger yet",
      "Monitor: latency percentiles, error rate, CTR, downstream business KPIs",
    ],
  },
  {
    id: 2,
    topic: "metrics",
    question:
      "Your model's accuracy hasn't changed, but your business team is reporting that revenue from recommendations has dropped 15%. How do you diagnose this?",
    hints: [
      "Accuracy is a proxy metric - what could diverge?",
      "Think about data drift, distribution shift",
      "Consider feedback loops",
    ],
    keyPoints: [
      "Accuracy on stale test set may not reflect current data distribution",
      "Check input feature drift - did user behavior or product catalog change?",
      "Check prediction distribution drift - are predictions shifting to different items?",
      "Investigate population segments - is drop concentrated in specific user cohorts?",
      "Check for feedback loops - model may have over-indexed on popular items",
      "Look at business metric at a finer grain: different user segments, device types, time of day",
    ],
  },
  {
    id: 3,
    topic: "metrics",
    question:
      "What metrics would you monitor for an LLM-powered customer support chatbot in production? How would you detect if it's degrading?",
    hints: [
      "Think infra, model quality, and business layers",
      "Ground truth is hard to get - what proxies can you use?",
      "LLM-specific concerns: hallucination, latency, cost",
    ],
    keyPoints: [
      "Infrastructure: token latency (TTFT + TBT), throughput, API error rate, cost per query",
      "Quality proxies: user thumbs up/down, escalation rate to human agent, session abandonment",
      "LLM-specific: hallucination rate (using LLM-as-judge or retrieval faithfulness score)",
      "Drift: topic distribution of incoming queries, response length distribution",
      "Safety: harmful content detection rate, refusal rate",
      "Business: resolution rate, CSAT score, handle time",
    ],
  },
  {
    id: 4,
    topic: "mlops",
    question:
      "Explain the training-serving skew problem. How does it happen and how do you prevent it?",
    hints: [
      "Think about where features are computed",
      "What's different between training time and serving time?",
      "Feature stores are relevant here",
    ],
    keyPoints: [
      "Skew: features computed differently in training pipeline vs. serving pipeline",
      "Causes: separate code paths, different data sources, feature staleness, preprocessing bugs",
      "Example: training uses raw data normalized one way; serving normalizes differently",
      "Prevention: single feature computation path used for both training and serving",
      "Feature stores solve this - define feature once, retrieve for both training and serving",
      "Detection: log serving features, compare distribution vs. training data periodically",
      "Add automated skew detection to CI/CD pipeline",
    ],
  },
  {
    id: 5,
    topic: "mlops",
    question:
      "When should you retrain your model? What triggers would you set up?",
    hints: [
      "Think about time-based vs. event-based triggers",
      "What signals indicate the model is stale?",
      "Cost vs. benefit of retraining frequency",
    ],
    keyPoints: [
      "Scheduled: time-based retraining (daily, weekly) - simple but may retrain unnecessarily",
      "Drift-triggered: retrain when PSI or KS test exceeds threshold on input features",
      "Performance-triggered: retrain when online model metrics degrade below threshold",
      "Data volume-triggered: retrain when N new labeled samples are available",
      "Consider: retraining is expensive - need gates (automated eval) before promotion",
      "Continual learning for fast-changing domains vs. periodic retraining for stable domains",
    ],
  },
  {
    id: 6,
    topic: "sysdesign",
    question:
      "Design a real-time fraud detection system for a payments company processing 50,000 transactions per second.",
    hints: [
      "Latency budget: must decide before payment clears",
      "Class imbalance: fraud is <0.1% of transactions",
      "What features can you compute in real-time?",
    ],
    keyPoints: [
      "Low latency requirement: <100ms total, model inference <20ms",
      "Streaming feature engineering: Flink/Kafka Streams for windowed aggregates (tx count/hour, avg amount)",
      "Feature store: pre-computed user/merchant embeddings + real-time features merged at serving",
      "Two-stage: fast rule engine (obvious fraud) → ML model (ambiguous cases)",
      "Imbalance handling: focal loss, AUC-PR as eval metric (not accuracy), oversampling",
      "Fallback: if model times out, apply conservative rule-based decision",
      "Monitoring: fraud catch rate, false positive rate, latency p99, model prediction drift",
      "Feedback loop: confirmed fraud labels (delayed) → retraining pipeline",
    ],
  },
  {
    id: 7,
    topic: "deployment",
    question:
      "Your model has high accuracy in offline evaluation but performs poorly in A/B test. What might explain this?",
    hints: [
      "Think about the gap between offline and online",
      "Is your offline eval set representative?",
      "Feedback loops, data leakage, population mismatch",
    ],
    keyPoints: [
      "Test set distribution doesn't match current production distribution (temporal split matters)",
      "Data leakage in training - model learned shortcut features not available in serving",
      "Feedback loop: offline eval doesn't capture that model predictions change user behavior",
      "Population mismatch: A/B test users differ from training data users (new users, new markets)",
      "Metric mismatch: accuracy measures what you train for, A/B measures business outcome",
      "Serving bugs: preprocessing differs from training (training-serving skew)",
      "Action: log serving features, compare with training data; audit preprocessing code",
    ],
  },
  {
    id: 8,
    topic: "sysdesign",
    question:
      "How would you design the ML infrastructure for a startup going from 0 to production ML in 3 months?",
    hints: [
      "Think about what to build vs. buy",
      "Start simple - what's the minimum viable MLOps stack?",
      "Prioritize by value delivered",
    ],
    keyPoints: [
      "Month 1: Get a model to production fast - managed services (SageMaker, Vertex AI), minimal custom infra",
      "Experiment tracking from day one: MLflow or W&B - cheap insurance for reproducibility",
      "Data versioning: DVC or cloud bucket versioning - prevents 'which data did we train on?' disasters",
      "Simple serving: FastAPI + Docker + managed container service (Cloud Run, ECS)",
      "Month 2: Add monitoring (Evidently or Datadog), automated retraining trigger, model registry",
      "Month 3: Feature store if features are reused across models; CI/CD for model deployment",
      "Principle: buy commodity (orchestration, storage, serving), build only what differentiates",
    ],
  },
];

function StudyGuide() {
  const [activeTopic, setActiveTopic] = useState(TOPICS[0].id);
  const [activeSubtopic, setActiveSubtopic] = useState(0);

  const topic = TOPICS.find((t) => t.id === activeTopic);

  const renderContent = (content) => {
    return content.split("\n").map((line, i) => {
      if (line.startsWith("**") && line.endsWith("**")) {
        return (
          <h4 key={i} style={{ color: topic.color, margin: "1rem 0 0.3rem", fontSize: "0.85rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            {line.replace(/\*\*/g, "")}
          </h4>
        );
      }
      if (line.includes("**")) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} style={{ margin: "0.3rem 0", lineHeight: 1.7, color: "#cbd5e1" }}>
            {parts.map((part, j) =>
              j % 2 === 1 ? (
                <strong key={j} style={{ color: "#f1f5f9" }}>{part}</strong>
              ) : (
                part
              )
            )}
          </p>
        );
      }
      if (line.trim() === "") return <br key={i} />;
      return (
        <p key={i} style={{ margin: "0.3rem 0", lineHeight: 1.7, color: "#cbd5e1" }}>
          {line}
        </p>
      );
    });
  };

  return (
    <div style={{ display: "flex", gap: "1.5rem", height: "100%" }}>
      {/* Left: Topic Nav */}
      <div style={{ width: "220px", flexShrink: 0 }}>
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setActiveTopic(t.id); setActiveSubtopic(0); }}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "0.75rem 1rem",
              marginBottom: "0.5rem",
              background: activeTopic === t.id ? `${t.color}18` : "transparent",
              border: `1px solid ${activeTopic === t.id ? t.color : "#1e293b"}`,
              borderRadius: "8px",
              color: activeTopic === t.id ? t.color : "#64748b",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontFamily: "inherit",
              transition: "all 0.2s",
            }}
          >
            <span style={{ marginRight: "0.5rem" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Center: Subtopic tabs + content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {topic.subtopics.map((st, i) => (
            <button
              key={i}
              onClick={() => setActiveSubtopic(i)}
              style={{
                padding: "0.4rem 0.9rem",
                background: activeSubtopic === i ? topic.color : "transparent",
                border: `1px solid ${activeSubtopic === i ? topic.color : "#334155"}`,
                borderRadius: "20px",
                color: activeSubtopic === i ? "#0f172a" : "#94a3b8",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontFamily: "inherit",
                fontWeight: activeSubtopic === i ? "700" : "400",
                transition: "all 0.2s",
              }}
            >
              {topic.subtopics[i].title}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "#0f172a",
            border: `1px solid ${topic.color}30`,
            borderRadius: "12px",
            padding: "1.5rem",
            minHeight: "400px",
          }}
        >
          <h3 style={{ color: topic.color, marginBottom: "1rem", fontSize: "1rem", fontWeight: 700 }}>
            {topic.subtopics[activeSubtopic].title}
          </h3>
          {renderContent(topic.subtopics[activeSubtopic].content)}
        </div>
      </div>
    </div>
  );
}

function MockInterview() {
  const [filter, setFilter] = useState("all");
  const [currentQ, setCurrentQ] = useState(null);
  const [showHints, setShowHints] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answered, setAnswered] = useState({});
  const [userNotes, setUserNotes] = useState("");

  const filtered = filter === "all" ? MOCK_QUESTIONS : MOCK_QUESTIONS.filter((q) => q.topic === filter);

  const topicColors = { deployment: "#00e5ff", metrics: "#ff6b6b", mlops: "#a78bfa", sysdesign: "#34d399" };
  const topicLabels = { deployment: "Deployment", metrics: "Monitoring", mlops: "MLOps", sysdesign: "System Design" };

  const selectQuestion = (q) => {
    setCurrentQ(q);
    setShowHints(false);
    setShowAnswer(false);
    setUserNotes(answered[q.id]?.notes || "");
  };

  const markAnswered = (rating) => {
    setAnswered((prev) => ({ ...prev, [currentQ.id]: { rating, notes: userNotes } }));
  };

  const ratingColors = { good: "#34d399", ok: "#fbbf24", hard: "#ff6b6b" };

  return (
    <div style={{ display: "flex", gap: "1.5rem", height: "100%" }}>
      {/* Question List */}
      <div style={{ width: "260px", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {["all", "deployment", "metrics", "mlops", "sysdesign"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "0.25rem 0.6rem",
                background: filter === f ? (topicColors[f] || "#475569") : "transparent",
                border: `1px solid ${filter === f ? (topicColors[f] || "#475569") : "#334155"}`,
                borderRadius: "12px",
                color: filter === f ? "#0f172a" : "#64748b",
                cursor: "pointer",
                fontSize: "0.7rem",
                fontFamily: "inherit",
                fontWeight: filter === f ? "700" : "400",
              }}
            >
              {f === "all" ? "All" : topicLabels[f]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((q) => {
            const ans = answered[q.id];
            return (
              <button
                key={q.id}
                onClick={() => selectQuestion(q)}
                style={{
                  textAlign: "left",
                  padding: "0.75rem",
                  background: currentQ?.id === q.id ? "#1e293b" : "transparent",
                  border: `1px solid ${currentQ?.id === q.id ? topicColors[q.topic] : "#1e293b"}`,
                  borderRadius: "8px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontFamily: "inherit",
                  lineHeight: 1.5,
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.65rem", color: topicColors[q.topic], fontWeight: 700, textTransform: "uppercase" }}>
                    {topicLabels[q.topic]}
                  </span>
                  {ans && (
                    <span style={{ fontSize: "0.65rem", color: ratingColors[ans.rating], marginLeft: "auto" }}>
                      {ans.rating === "good" ? "✓ Got it" : ans.rating === "ok" ? "~ Partial" : "✗ Review"}
                    </span>
                  )}
                </div>
                {q.question.substring(0, 70)}…
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "1rem", padding: "0.75rem", background: "#0f172a", borderRadius: "8px", border: "1px solid #1e293b" }}>
          <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.5rem" }}>Progress</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["good", "ok", "hard"].map((r) => {
              const count = Object.values(answered).filter((a) => a.rating === r).length;
              return (
                <div key={r} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ color: ratingColors[r], fontSize: "1rem", fontWeight: 700 }}>{count}</div>
                  <div style={{ color: "#475569", fontSize: "0.6rem" }}>{r === "good" ? "Got it" : r === "ok" ? "Partial" : "Review"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Question Panel */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!currentQ ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px", color: "#334155", fontSize: "0.9rem" }}>
            ← Select a question to begin
          </div>
        ) : (
          <div>
            <div style={{ background: "#0f172a", border: `1px solid ${topicColors[currentQ.topic]}40`, borderRadius: "12px", padding: "1.5rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", color: topicColors[currentQ.topic], fontWeight: 700, textTransform: "uppercase", marginBottom: "0.75rem" }}>
                {topicLabels[currentQ.topic]} · Question {currentQ.id}
              </div>
              <p style={{ color: "#f1f5f9", fontSize: "1rem", lineHeight: 1.7, margin: 0 }}>{currentQ.question}</p>
            </div>

            {/* Hints */}
            <div style={{ marginBottom: "1rem" }}>
              <button
                onClick={() => setShowHints(!showHints)}
                style={{
                  padding: "0.5rem 1rem",
                  background: "transparent",
                  border: "1px solid #334155",
                  borderRadius: "8px",
                  color: "#94a3b8",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                  marginRight: "0.5rem",
                }}
              >
                {showHints ? "Hide Hints" : "💡 Show Hints"}
              </button>
              <button
                onClick={() => setShowAnswer(!showAnswer)}
                style={{
                  padding: "0.5rem 1rem",
                  background: showAnswer ? "#1e293b" : "transparent",
                  border: `1px solid ${showAnswer ? topicColors[currentQ.topic] : "#334155"}`,
                  borderRadius: "8px",
                  color: showAnswer ? topicColors[currentQ.topic] : "#94a3b8",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                }}
              >
                {showAnswer ? "Hide Answer" : "✓ Reveal Key Points"}
              </button>
            </div>

            {showHints && (
              <div style={{ background: "#1e1b0f", border: "1px solid #854d0e", borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ color: "#fbbf24", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>HINTS</div>
                {currentQ.hints.map((h, i) => (
                  <div key={i} style={{ color: "#fde68a", fontSize: "0.82rem", marginBottom: "0.3rem" }}>→ {h}</div>
                ))}
              </div>
            )}

            {showAnswer && (
              <div style={{ background: "#0a1a12", border: `1px solid ${topicColors[currentQ.topic]}40`, borderRadius: "8px", padding: "1rem", marginBottom: "1rem" }}>
                <div style={{ color: topicColors[currentQ.topic], fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.5rem" }}>KEY POINTS TO HIT</div>
                {currentQ.keyPoints.map((p, i) => (
                  <div key={i} style={{ color: "#94a3b8", fontSize: "0.82rem", marginBottom: "0.4rem", display: "flex", gap: "0.5rem" }}>
                    <span style={{ color: topicColors[currentQ.topic], flexShrink: 0 }}>▸</span>
                    {p}
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ color: "#64748b", fontSize: "0.75rem", marginBottom: "0.4rem" }}>YOUR NOTES</div>
              <textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Jot down your answer approach or gaps..."
                style={{
                  width: "100%",
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "0.75rem",
                  color: "#cbd5e1",
                  fontSize: "0.82rem",
                  fontFamily: "monospace",
                  resize: "vertical",
                  minHeight: "80px",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Self-rating */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ color: "#64748b", fontSize: "0.75rem", marginRight: "0.25rem" }}>HOW'D YOU DO?</span>
              {[
                { id: "good", label: "✓ Got it", color: "#34d399" },
                { id: "ok", label: "~ Partial", color: "#fbbf24" },
                { id: "hard", label: "✗ Need Review", color: "#ff6b6b" },
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => markAnswered(r.id)}
                  style={{
                    padding: "0.4rem 0.9rem",
                    background: answered[currentQ.id]?.rating === r.id ? `${r.color}20` : "transparent",
                    border: `1px solid ${answered[currentQ.id]?.rating === r.id ? r.color : "#334155"}`,
                    borderRadius: "20px",
                    color: answered[currentQ.id]?.rating === r.id ? r.color : "#64748b",
                    cursor: "pointer",
                    fontSize: "0.75rem",
                    fontFamily: "inherit",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeSection, setActiveSection] = useState("guide");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        fontFamily: "'IBM Plex Mono', 'Fira Code', 'Courier New', monospace",
        color: "#cbd5e1",
        padding: "0",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #1e293b",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          position: "sticky",
          top: 0,
          background: "#020617",
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ fontSize: "0.65rem", color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase" }}>
            Interview Prep
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f1f5f9", letterSpacing: "-0.02em" }}>
            ML Production Systems
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
          {Object.entries(SECTIONS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                padding: "0.5rem 1.2rem",
                background: activeSection === key ? "#f1f5f9" : "transparent",
                border: `1px solid ${activeSection === key ? "#f1f5f9" : "#334155"}`,
                borderRadius: "6px",
                color: activeSection === key ? "#020617" : "#64748b",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontFamily: "inherit",
                fontWeight: activeSection === key ? "700" : "400",
                transition: "all 0.15s",
              }}
            >
              {key === "guide" ? "📖 " : "🎯 "}{label}
            </button>
          ))}
        </div>
      </div>

      {/* Topic pills */}
      {activeSection === "guide" && (
        <div style={{ padding: "0.75rem 2rem", borderBottom: "1px solid #0f172a", display: "flex", gap: "1rem" }}>
          {TOPICS.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.7rem" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: t.color }} />
              <span style={{ color: "#475569" }}>{t.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div style={{ padding: "1.5rem 2rem", maxWidth: "1200px" }}>
        {activeSection === "guide" ? <StudyGuide /> : <MockInterview />}
      </div>
    </div>
  );
}
