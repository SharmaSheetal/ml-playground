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
    heading: 'Scalability Dimensions for ML Systems',
    body: `Scalability in ML systems has three dimensions that must be addressed independently: throughput (how many requests per second), latency (how fast each individual request is served), and cost efficiency (how much compute you need per unit of throughput).

These three dimensions create inherent tradeoffs. Larger batch sizes increase throughput and improve GPU utilization but add queuing latency per request. More model replicas increase throughput but scale costs linearly. Model compression (quantization, pruning) reduces cost and latency but may degrade accuracy.

An ML system is scalable when it can handle 10× more traffic by adding resources without redesigning the architecture, and when the marginal cost per additional request decreases (or at least stays constant) as traffic grows.`,
  },
  {
    heading: 'Horizontal vs Vertical Scaling',
    body: `Vertical scaling: upgrade the server running your model — more CPU cores, more memory, a larger GPU. Simple, requires no code changes, but has hard limits (largest available GPU) and creates single points of failure.

Horizontal scaling: add more servers running the same model. Requires stateless serving (each server can handle any request independently) and a load balancer distributing traffic. No hard upper bound on total capacity. Standard approach for production ML systems.

When to use vertical scaling: when the bottleneck is a single operation that cannot be parallelized (e.g., memory bandwidth for a very large model). Scale up until you hit the machine limit, then scale out horizontally.

GPU-specific consideration: a single A100 GPU handles 80GB of model weights. For models larger than 80GB, you must shard across multiple GPUs (model parallelism) — this is neither simple horizontal nor vertical scaling and requires specialized infrastructure.

Kubernetes HPA (Horizontal Pod Autoscaler): automatically adjusts the number of serving pods based on CPU, memory, or custom metrics (queue depth, requests per second). Standard for cloud-deployed model servers.`,
  },
  {
    heading: 'Model Serving Frameworks',
    body: `The serving framework determines how efficiently your hardware resources are used. The wrong choice can leave GPU utilization below 20% while your P99 latency is still breaching SLOs.

TorchServe: PyTorch's official model server. Supports batching, multiple model versions, and custom handlers. Good for PyTorch models that need customization. Handler code controls preprocessing, inference, and postprocessing.

Triton Inference Server (NVIDIA): supports multiple backends (PyTorch, TensorFlow, ONNX, TensorRT, custom C++ backends). Provides dynamic batching, concurrent model execution, and GPU metric collection. The production standard for GPU inference at scale.

vLLM: specifically designed for large language model serving. Implements PagedAttention for efficient KV cache management. Achieves near-theoretical GPU utilization for autoregressive generation. Not suitable for non-LLM models.

BentoML: Python-first serving framework. Good for rapid deployment and development. Less optimized for raw throughput than Triton. Better for teams that prioritize deployment speed over maximum efficiency.

ONNX Runtime: convert any framework's model to ONNX format and serve with Microsoft's optimized runtime. Good for CPU inference and for interoperability between training frameworks.`,
  },
  {
    heading: 'Request Batching — Throughput vs Latency',
    body: `GPU utilization is maximized when processing many requests simultaneously. A GPU designed to process a batch of 64 images runs at 3–5% utilization when processing one image at a time.

Static batching: wait for a fixed number of requests before processing them as a batch. Simple but inflexible — either the batch fills up (good GPU utilization) or you wait a fixed timeout (adds latency during low traffic).

Dynamic batching: accept requests as they arrive, process them as soon as a configurable batch size or timeout is reached. Standard in Triton and TorchServe. Configuring max_batch_size and max_queue_delay_microseconds are the key knobs.

Batching trade-offs:
  • Large batch size → higher GPU utilization → higher throughput, but adds queuing time per request
  • Small batch size → lower utilization → lower throughput, but lower tail latency
  • Timeout → guarantees maximum wait time, but adds constant latency floor during low traffic

For interactive user-facing models: max_batch_size = 4–8, timeout = 5–10ms. For batch inference jobs: max_batch_size = 64–256, no timeout.

Sequence length batching (for NLP): pad all sequences to the same length for batching, or use packing (concatenate and use attention masks). Padding wastes compute on padding tokens; packing is more efficient but more complex.`,
  },
  {
    heading: 'Caching Strategies for ML Serving',
    body: `Caching reduces compute cost by serving pre-computed results for repeated inputs. Three caching layers are relevant for ML systems.

Prediction cache: store (input, prediction) pairs in Redis or Memcached. Cache hit serves the prediction in < 1ms with no GPU required. Cache miss triggers model inference. Best for high-repeat-rate inputs (search queries, product recommendations for popular items).

Embedding cache: for two-tower or retrieval models, cache item or user embeddings that are expensive to compute. The embedding lookup is amortized across many requests. Works when embeddings are computed infrequently (user embeddings updated daily, item embeddings updated hourly).

KV cache (for LLMs): cache intermediate attention key-value tensors across generation steps. Eliminates recomputing attention for the prompt on each token generation step. Essential for autoregressive LLM serving — without it, each token generation is O(n²) in sequence length.

Cache invalidation: prediction caches must be invalidated when the model is updated. A new model version with stale cached predictions produces inconsistent results. Use model version as part of the cache key, and flush on model promotion.

Cache hit rate monitoring: measure and alert on cache hit rate. Sudden drops indicate a change in traffic patterns or a cache configuration issue.`,
  },
  {
    heading: 'GPU Fleet Management',
    body: `A model serving fleet typically has many GPU instances of different types. Efficient fleet management determines whether you pay 2× or 20× for the same throughput.

GPU type selection: A100 (training and large model inference), T4 (cost-effective inference for smaller models), A10G (mid-tier, good for medium LLMs). Cost per token or cost per prediction varies 5–10× across GPU types for the same workload.

Multi-GPU inference strategies:
  • Data parallelism: replicate the model on multiple GPUs, each handling different requests
  • Tensor parallelism: split weight matrices across GPUs (Megatron-style) for models that exceed single GPU memory
  • Pipeline parallelism: split model layers across GPUs, request flows through pipeline stages

Bin packing: assign multiple small models to the same GPU to maximize utilization. A GPU running three 5GB models at 70% memory utilization is much more efficient than a GPU running one 5GB model at 24% utilization.

Spot instances: 60–80% cheaper than on-demand GPU instances. Acceptable for batch inference. Not suitable for real-time serving due to interruption risk — use a small on-demand base capacity + spot for overflow.

Cold start: loading a large model onto GPU takes 30–300 seconds. Keep minimum instances warm to avoid cold start latency. Auto-scaling should preemptively scale up before anticipated traffic peaks.`,
  },
  {
    heading: 'Auto-scaling for Model Serving',
    body: `Auto-scaling automatically adjusts the number of serving replicas based on current load. Critical for handling traffic variability without either over-provisioning (wasting money) or under-provisioning (degrading latency).

Kubernetes HPA (Horizontal Pod Autoscaler): scales pods based on CPU, memory, or custom metrics. Custom metrics (requests per second, GPU utilization, queue depth) are more appropriate for ML serving than CPU — GPU inference can be at 100% GPU utilization while CPU utilization is low.

Scale-up vs scale-down asymmetry: scale up fast (add replicas proactively when queue depth grows) and scale down slowly (wait 5–10 minutes before removing replicas to avoid oscillation). Scaling up too slowly causes latency spikes; scaling down too quickly causes cold start churn.

Predictive auto-scaling: if traffic follows a predictable pattern (daily peak, weekly seasonality), pre-scale before the expected peak rather than reacting to it. Eliminates the lag between traffic spike and scale-up.

Scale-to-zero: scale to zero replicas during extended idle periods (overnight for internal tools, weekends for batch systems). Combined with cold start warming on schedule, this significantly reduces cost for low-traffic periods.

KEDA (Kubernetes Event-Driven Autoscaler): extends HPA with support for scaling based on Kafka queue depth, SQS queue length, and other external metrics. Better for batch inference pipelines than HPA.`,
  },
  {
    heading: 'Load Testing and Capacity Planning',
    body: `You cannot know your system's limits without testing them. Load testing simulates production traffic patterns at scale to find breaking points before real users do.

Tools: Locust (Python, scriptable), k6 (JavaScript, good for complex scenarios), Apache JMeter (Java, enterprise), Gatling (Scala, very high throughput).

Load testing protocol for ML systems:
  1. Baseline: measure P50/P95/P99 latency and max sustained RPS at 50% of expected peak
  2. Ramp: gradually increase load until P99 exceeds SLO. This is your system's saturation point.
  3. Spike: sudden 10× traffic spike. Measures auto-scaling response time and system resilience.
  4. Soak: sustained load at 80% of saturation for 24 hours. Finds memory leaks and gradual degradation.

Capacity planning: from load test results, compute the number of replicas needed at expected peak traffic with 20% headroom. Document this in a capacity plan and review quarterly.

Realistic traffic simulation: production requests have payload size distributions, think times, and concurrency patterns that differ from "hammer the endpoint with 1000 concurrent users." Use production request logs to build realistic load test scenarios.`,
  },
  {
    heading: 'Tail Latency Optimization',
    body: `P99 and P999 latency (tail latency) is often 3–10× higher than P50 latency. For user-facing applications, tail latency is what users experience on bad requests, not the median.

Sources of tail latency in ML serving:
  • GC pauses: Java-based serving stacks (JVM) have garbage collection pauses. Use G1GC or ZGC; tune heap sizes.
  • NUMA effects: if a model is loaded on one NUMA node's memory but inference runs on another, memory latency doubles.
  • Thermal throttling: GPUs and CPUs reduce clock speed when hot. Ensure adequate cooling in on-prem deployments.
  • Queue head-of-line blocking: one slow request blocks subsequent requests. Use per-request timeouts and request prioritization.

Hedged requests: send the same request to two replicas simultaneously, use the first response, cancel the other. Reduces tail latency at the cost of 2× compute. Use for very latency-sensitive services where the 99th percentile matters more than cost.

Circuit breakers: if a downstream service (feature store, model server) is slow, fail fast instead of waiting for timeout. Return a default prediction rather than accumulating latency. Prevents tail latency cascades.

Timeout budgets: set aggressive request timeouts at each layer (feature retrieval: 10ms, model inference: 50ms, total: 100ms). Return default response on timeout rather than letting the request hang.`,
  },
  {
    heading: 'Cost Optimization for ML Infrastructure',
    body: `Model serving costs are dominated by compute (GPU/CPU hours) and data transfer. Cost optimization without sacrificing performance is a core engineering challenge.

Model compression reduces both latency and cost:
  • Quantization: INT8 reduces memory footprint 4×, inference compute 2–3×, with < 1% accuracy drop for most models
  • Pruning: zero out unimportant weights, then fine-tune. 50% sparsity can achieve 2× throughput with < 1% degradation
  • Distillation: train a smaller student model to mimic a larger teacher. 5–10× smaller, 5–10× faster

Right-sizing instances: measure actual GPU memory utilization and compute utilization separately. If a model uses 6GB of a 40GB A100, move to a 16GB T4 — same performance at 40% of the cost.

Spot/Preemptible instances: 60–80% cheaper. Use for batch inference, model training, and overflow capacity. Implement checkpointing to handle interruptions.

Multi-tenancy: run multiple models on the same GPU if their memory requirements allow. Triton model repository supports concurrent model execution. Increases utilization from 20% to 80% for small models.

Request routing optimization: route similar-length requests to the same batch. Route high-priority (paying, enterprise) users to dedicated GPU pools. Route cache-hit requests to CPU only.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is the difference between horizontal and vertical scaling in ML serving?',
    keyPoints: [
      'Vertical: upgrade the server (larger GPU, more memory) — simple, limited by hardware ceiling',
      'Horizontal: add more servers — requires stateless serving and load balancer, no hard upper limit',
      'Horizontal is standard for production ML — it allows cost-linear scaling and eliminates single points of failure',
      'For models larger than single GPU memory, tensor/pipeline parallelism is required',
    ],
    trap: 'Assuming vertical scaling is always simpler — for models that already use the largest available GPU, vertical scaling is impossible.',
  },
  {
    difficulty: 'junior',
    question: 'What is dynamic batching and why does it matter for GPU efficiency?',
    keyPoints: [
      'Dynamic batching: group multiple requests together and process them as a single GPU operation',
      'GPUs achieve peak efficiency when processing large batches — single requests waste most GPU capacity',
      'Trade-off: larger batches improve throughput but add queuing latency per request',
      'Max batch size and timeout are the key configuration parameters',
    ],
    trap: 'Setting max batch size very high without accounting for tail latency — a request may wait 100ms for a batch to fill, which is unacceptable for interactive serving.',
  },
  {
    difficulty: 'junior',
    question: 'What is model quantization and how does it affect serving scalability?',
    keyPoints: [
      'Quantization: convert model weights from FP32 to FP16 or INT8, reducing memory and compute',
      'FP16: ~2× memory reduction, ~2× speedup, < 0.1% accuracy drop for most models',
      'INT8: ~4× memory reduction, ~2–3× speedup, < 1% accuracy drop with proper calibration',
      'Enables running larger models on the same hardware, or the same model on cheaper hardware',
    ],
    trap: 'Applying INT8 quantization to any model without calibration — quantization without proper calibration on representative data can cause significant accuracy degradation.',
  },
  {
    difficulty: 'junior',
    question: 'What types of caching are useful for ML model serving?',
    keyPoints: [
      'Prediction cache: store (input, output) pairs — serves repeated queries at sub-millisecond latency',
      'Embedding cache: store pre-computed embeddings to avoid recomputing them per request',
      'KV cache (LLMs): cache attention key-value tensors to avoid recomputing the prompt at each token step',
      'Cache invalidation: clear cache when model is updated — stale predictions from old model version',
    ],
    trap: 'Caching predictions without including model version in the cache key — model updates silently serve stale predictions to users.',
  },
  {
    difficulty: 'mid',
    question: 'How do you auto-scale a model serving system in Kubernetes?',
    keyPoints: [
      'HPA (Horizontal Pod Autoscaler): scales pods based on CPU, memory, or custom metrics',
      'Custom metrics better than CPU: GPU utilization, request queue depth, RPS per replica',
      'Scale up aggressively, scale down slowly — 5-10 minute cooldown prevents oscillation',
      'KEDA for event-driven scaling (Kafka queue depth, SQS length) for async batch inference',
      'Pre-scale for predicted traffic peaks rather than reacting to them',
    ],
    trap: 'Using CPU utilization as the auto-scaling metric for GPU inference — the GPU can be at 100% while CPU is at 10%, causing HPA to think capacity is fine when it is not.',
  },
  {
    difficulty: 'mid',
    question: 'How would you load test a model serving endpoint?',
    keyPoints: [
      'Baseline: measure P50/P95/P99 at 50% expected peak to establish normal performance',
      'Ramp test: gradually increase load until P99 exceeds SLO — this is your saturation point',
      'Spike test: sudden 10× traffic — measures auto-scaling response and resilience',
      'Soak test: 24-hour sustained load at 80% saturation — reveals memory leaks',
      'Use realistic request payloads from production logs, not synthetic uniform requests',
    ],
    trap: 'Only running a short ramp test and missing the 24-hour soak — memory leaks and gradual degradation only appear in long-duration tests.',
  },
  {
    difficulty: 'mid',
    question: 'What is a hedged request and when would you use it?',
    keyPoints: [
      'Send the same request to two replicas simultaneously, use the first response, cancel the other',
      'Significantly reduces P99/P999 latency at the cost of ~2× compute',
      'Use for very latency-sensitive endpoints where tail latency matters more than cost',
      'Set a delay before sending the hedge (e.g., after P90 expected response time) to reduce wasted compute',
      'Not appropriate for stateful operations or operations with side effects',
    ],
    trap: 'Using hedged requests for all endpoints — the 2× compute cost is only justified for latency-critical paths where P99 directly impacts user experience.',
  },
  {
    difficulty: 'mid',
    question: 'How do you right-size GPU instances for a model serving workload?',
    keyPoints: [
      'Measure actual GPU memory utilization — if using 6GB of a 40GB A100, move to a 16GB T4',
      'Measure compute utilization — if at 20% GPU compute, you are over-provisioned or need dynamic batching',
      'GPU cost vs inference latency: larger GPU has faster inference but costs more — compare cost per successful request at SLO',
      'Benchmark the model on multiple GPU types at your target batch size and concurrency',
      'Factor in memory bandwidth, not just TFLOPS — transformer models are often memory-bandwidth-bound',
    ],
    trap: 'Choosing the largest GPU by default — right-sizing requires benchmarking on the specific model and workload, not picking the fastest hardware.',
  },
  {
    difficulty: 'mid',
    question: 'Compare TorchServe, Triton Inference Server, and vLLM. When do you use each?',
    keyPoints: [
      'TorchServe: PyTorch-native, flexible custom handlers, good for PyTorch models with custom preprocessing',
      'Triton: multi-backend (PyTorch, TF, ONNX, TensorRT), dynamic batching, concurrent execution, GPU metrics — production standard at scale',
      'vLLM: LLM-specific, PagedAttention for KV cache efficiency, near-theoretical GPU utilization for autoregressive generation',
      'TorchServe for simple PyTorch deployment; Triton for high-throughput production at scale; vLLM for LLM serving',
    ],
    trap: 'Using vLLM for non-LLM models — vLLM is designed specifically for autoregressive text generation and provides no benefit for other model types.',
  },
  {
    difficulty: 'senior',
    question: 'Design a model serving infrastructure that can handle 100k RPS for a recommendation model with P99 < 50ms.',
    keyPoints: [
      'Stateless serving: each request is fully self-contained, no shared state between replicas',
      'Feature store: Redis Cluster for online features with P99 < 3ms',
      'Model: XGBoost on CPU (1–2ms) or small DNN on GPU with dynamic batching',
      'Prediction cache: Redis for top-k popular requests — 30–40% cache hit rate reduces GPU load significantly',
      'Horizontal scaling: auto-scale based on queue depth, target 60% GPU utilization headroom',
      'CDN for static responses (popular item embeddings), connection pooling for feature store',
    ],
    trap: 'Proposing a single model server without horizontal scaling — 100k RPS requires a distributed fleet, not a single high-spec machine.',
  },
  {
    difficulty: 'senior',
    question: 'How do you reduce model serving cost by 50% without degrading latency SLOs?',
    keyPoints: [
      'Quantize to INT8 — reduces GPU memory 4×, increases throughput 2–3×, lower cost per request',
      'Increase batch size — better GPU utilization, lower cost per inference at same throughput',
      'Right-size instances — benchmark on smaller GPU types (T4 vs A100), often 60–70% cost reduction',
      'Spot/preemptible for non-latency-sensitive portions — 60–80% cheaper',
      'Prediction caching for high-repeat-rate requests — cached requests cost ~0 compute',
    ],
    trap: 'Only focusing on quantization — model compression alone rarely achieves 50% cost reduction; infrastructure right-sizing and caching are often larger levers.',
  },
  {
    difficulty: 'senior',
    question: 'How do you handle a traffic spike 10× larger than expected without pre-scaling?',
    keyPoints: [
      'Auto-scaling response: detect the spike within 30 seconds via queue depth metric, add replicas',
      'Cold start mitigation: keep a small warm pool of pre-loaded replicas that can immediately handle overflow',
      'Graceful degradation: if replicas cannot scale fast enough, return cached predictions or default fallback',
      'Load shedding: drop low-priority requests (analytics, A/B test shadow traffic) to protect high-priority user requests',
      'Circuit breaker: fail fast on downstream feature store if it is overloaded rather than queuing requests',
    ],
    trap: 'Expecting auto-scaling to fully handle a sudden 10× spike — scaling takes 2–5 minutes minimum; the system must have graceful degradation during the scaling window.',
  },
  {
    difficulty: 'senior',
    question: 'How do you implement model parallelism for a model too large to fit on a single GPU?',
    keyPoints: [
      'Tensor parallelism: split weight matrices across GPUs, each GPU computes a subset of the output, all-reduce to combine — requires high-bandwidth interconnect (NVLink)',
      'Pipeline parallelism: split transformer layers across GPUs, request flows through GPU pipeline stages — adds pipeline latency',
      'Combination: tensor parallelism within a node (fast NVLink), pipeline parallelism across nodes (slower inter-node)',
      'Frameworks: Megatron-LM, DeepSpeed, vLLM with tensor parallelism built in',
      'Trade-off: more GPUs = more parallelism = lower per-request latency, but all-reduce communication is an overhead',
    ],
    trap: 'Using pipeline parallelism alone for interactive serving — pipeline parallelism adds pipeline bubble latency and is more suited for batch inference than real-time serving.',
  },
  {
    difficulty: 'junior',
    question: 'What is a cold start problem in model serving and how do you mitigate it?',
    keyPoints: [
      'Cold start: loading a model onto GPU the first time takes 30–300 seconds (weights transfer from disk to GPU memory)',
      'New serving replicas added by auto-scaling have cold start delay before they can serve traffic',
      'Mitigation: keep a minimum number of warm replicas always running',
      'Mitigation: predictive pre-scaling before expected traffic peaks to allow warm-up time',
      'Mitigation: minimize model load time with optimized model format (TorchScript, TensorRT engines)',
    ],
    trap: 'Scaling to zero replicas for a latency-sensitive service — cold start latency makes scale-to-zero unsuitable for interactive serving.',
  },
  {
    difficulty: 'mid',
    question: 'How do you monitor a model serving system in production?',
    keyPoints: [
      'Infrastructure: GPU utilization, GPU memory, CPU, P50/P95/P99 request latency, error rate, throughput',
      'Batching efficiency: average batch size, batch fill rate — low fill rate wastes GPU capacity',
      'Queue depth: requests waiting for a replica — rising queue depth is the first signal of saturation',
      'Model quality: prediction distribution, output range, null response rate',
      'Cost metrics: cost per 1000 requests, GPU-hours per day, cache hit rate',
    ],
    trap: 'Only monitoring request latency without monitoring GPU utilization and queue depth — latency problems often start as queue saturation before becoming latency SLO violations.',
  },
  {
    difficulty: 'senior',
    question: 'How do you design a serving system that degrades gracefully under extreme load?',
    keyPoints: [
      'Load shedding: prioritize requests by importance (real-time user requests > analytics > batch), drop lowest priority first',
      'Adaptive timeouts: reduce request timeout under high load to prevent queue backup',
      'Fallback predictions: serve cached or default predictions when model server is overloaded',
      'Circuit breakers: fail fast on overloaded dependencies rather than queuing and amplifying the spike',
      'Admission control: limit accepted request rate at the API gateway, reject excess with 429 Too Many Requests',
    ],
    trap: 'Designing for nominal load only — graceful degradation must be designed from the start, not added as an afterthought during an incident.',
  },
  {
    difficulty: 'mid',
    question: 'What is NUMA and how can it affect ML inference latency?',
    keyPoints: [
      'NUMA (Non-Uniform Memory Access): multi-CPU servers have multiple memory banks; accessing memory attached to another CPU socket has higher latency',
      'If a model is loaded in one NUMA node\'s memory but inference runs on threads from another NUMA node, memory latency doubles',
      'Fix: pin model serving processes to NUMA node containing the model memory (numactl --membind --cpunodebind)',
      'On GPU servers: NUMA effects apply between CPU and GPU — ensure GPU is on the same PCIe root complex as the CPU handling inference',
    ],
    trap: 'Ignoring NUMA on multi-socket servers — NUMA effects can add 20–50% latency that is invisible from GPU metrics alone.',
  },
];
