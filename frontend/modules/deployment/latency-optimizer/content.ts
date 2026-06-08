export interface StudySection {
  heading:  string;
  body:     string;
  keyTerms: string[];
  quiz:     { q: string; a: string }[];
  practice: string[];
}

export interface InterviewQ {
  difficulty: 'junior' | 'mid' | 'senior';
  question:   string;
  keyPoints:  string[];
  trap?:      string;
}

// ── Study Content ──────────────────────────────────────────────────────────────

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'Sources of ML Serving Latency — The Full Stack',
    body: `Every ML serving request passes through a latency stack with multiple contributors: network transit, queue wait, preprocessing (tokenization, normalization, feature extraction), model inference, postprocessing, and response serialization. No single component dominates universally — the bottleneck shifts by model type and load level.\n\nAt low traffic, model inference itself dominates. Under high concurrency, queue time and preprocessing can dwarf inference latency. Network is consistently underestimated: round-trip between microservices on the same VPC adds 1–5ms per hop, compounding in multi-stage pipelines. A model serving pipeline with three microservice hops (feature server → model server → postprocessing) can add 15ms of pure network overhead even if inference takes 10ms.\n\nThe critical failure mode: measuring only "model inference time" in benchmarks, then being surprised that production P99 latency is 3–5× higher due to the full stack overhead. Always measure and benchmark the full end-to-end latency from client request to client response — not just the model inference step.`,
    keyTerms: ['End-to-end latency', 'Inference latency', 'Preprocessing latency', 'Queue latency', 'Network hop overhead', 'Full stack benchmark'],
    quiz: [
      { q: 'Your model benchmarks at 15ms inference time. Production P99 is 85ms. What are likely contributors to the gap?', a: 'Network hops between microservices (1-5ms each), queue wait time under load, preprocessing (feature extraction, tokenization), postprocessing, response serialization, and cold-start latency on model loading. Never measure only inference time — benchmark the full end-to-end latency.' },
      { q: 'At what traffic level does queue wait time tend to dominate over inference latency in ML serving?', a: 'Under high concurrency — when request rate approaches or exceeds the system\'s processing capacity. At low traffic, inference dominates. Under heavy load, requests queue and wait, which can make queue time larger than inference time.' },
    ],
    practice: [
      'Map the full latency stack for a recommendation API: list every component from user click to model prediction returned, and estimate the latency budget for each.',
      'You have 200ms total end-to-end SLA. Model inference is 50ms. Allocate the remaining 150ms budget across preprocessing, network hops, postprocessing, and buffer for variance.',
    ],
  },
  {
    heading: 'P50 vs P95 vs P99 — Why Tail Latency Matters',
    body: `P50 (median) is deeply misleading in distributed ML systems. Google\'s canonical finding: a service with P99 = 10ms produces 140ms user-visible latency under real fan-out conditions — a 14× amplification.\n\nThe math: if a user request triggers 100 parallel backend ML scoring calls (common in recommendation or ad ranking systems), the probability that at least one call exceeds the P99 threshold approaches 63%. The user's experience is determined by the slowest call, not the median.\n\nLatency distributions for ML inference are heavily right-skewed. A slow garbage collection pause, model loading event, cache miss on a cold model, or feature store timeout can produce outliers 10–100× the median. These tail events are rare but are what users actually experience when they matter most.\n\nOptimizing median latency while ignoring tail latency is one of the most common and costly ML infrastructure mistakes. SLOs should be set at P95 or P99 on the user-facing critical path, not at P50 on individual model inference components.`,
    keyTerms: ['P50 / P95 / P99', 'Fan-out amplification', 'Tail latency', 'Right-skewed distribution', 'SLO (Service Level Objective)', 'User-facing critical path'],
    quiz: [
      { q: 'A recommendation system makes 50 parallel model calls per user request. Explain why P99 latency of individual calls matters more than P50 for user-perceived latency.', a: 'The user\'s response waits for all 50 calls to complete (the maximum, not the average). If each call has P99 = 20ms, the probability of at least one of 50 calls exceeding 20ms is 1-(0.99)^50 ≈ 40%. The user\'s actual experience is dominated by tail latency of the fan-out.' },
      { q: 'Should you set your model serving SLO at P50 or P99? Why?', a: 'P99 (or at minimum P95) on the user-facing critical path. P50 is the experience of the median request — it hides the experience of the worst 50% of users. Under fan-out, even individual P99s compound into higher user-visible percentiles.' },
    ],
    practice: [
      'A search ranking system fans out to 200 model scoring calls. If each model has P99 = 5ms, what is the probability the user\'s response takes longer than 5ms? Explain the math.',
      'Your current SLO is P50 < 100ms. A business partner wants sub-200ms for all users. Translate this to an appropriate percentile SLO target.',
    ],
  },
  {
    heading: 'Dynamic Batching — Throughput vs. Latency Trade-off',
    body: `Dynamic batching aggregates multiple concurrent individual requests into a batch before sending to the model for inference, transparent to the client. Triton Inference Server\'s dynamic batcher has two primary knobs: max_batch_size and max_queue_delay_microseconds.\n\nThe fundamental trade-off: minimizing latency means scheduling batch size = 1 as soon as the request arrives — zero wait, zero batching benefit. Maximizing throughput means waiting longer to accumulate a larger batch, which inflates per-request latency (each request waits for the batch to fill).\n\nStatic batching treats batch size as a fixed hyperparameter and breaks under variable-length sequences (LLMs, variable-length NLP inputs) and bursty traffic. Dynamic batching adapts batch size based on what requests are available at queue time.\n\nCounterintuitive fact: larger batch size reduces cost-per-inference (better GPU utilization) but increases individual request latency. "Larger batch = faster" is true only for throughput and cost, not for user-perceived latency. Optimal batch size is not a universal constant — it must be tuned per model, per hardware, and per traffic pattern.`,
    keyTerms: ['Dynamic batching', 'max_batch_size', 'max_queue_delay', 'Static batching', 'Throughput vs latency trade-off', 'Triton dynamic batcher'],
    quiz: [
      { q: 'True or false: increasing batch size always reduces latency for ML serving. Explain.', a: 'False. Increasing batch size reduces cost-per-inference and improves throughput (GPU utilization), but it increases individual request latency because each request must wait for the batch to fill before inference begins. There is a fundamental throughput-latency trade-off.' },
      { q: 'What is the difference between dynamic and static batching in Triton?', a: 'Static batching requires a fixed batch size — all requests must wait for the batch to fill and inputs must have compatible shapes. Dynamic batching adapts batch size based on available requests, accommodates variable-size inputs, and respects a maximum queue delay to bound latency.' },
    ],
    practice: [
      'Describe how you would tune max_batch_size and max_queue_delay for a ranking model that serves bursty traffic with peaks 10× the baseline rate.',
      'A model achieves 500 RPS throughput at batch size 16 but P99 latency is 300ms. The SLA requires P99 < 100ms. What batch size changes would you explore, and what throughput trade-off would you accept?',
    ],
  },
  {
    heading: 'Quantization — INT8, FP16, and the Accuracy-Latency Trade-off',
    body: `Quantization reduces model weight and activation precision from FP32 to lower bit representations:\n\nFP32 → FP16: Cuts model memory by 50%, reduces inference latency approximately 30–47% on modern GPU hardware (NVIDIA GPUs have dedicated Tensor Core hardware for FP16 operations). Accuracy impact is typically < 0.1% on most tasks. This is the lowest-risk quantization option.\n\nFP32 → INT8: Cuts model memory by 75% compared to FP32. Latency reduction depends heavily on hardware — on CPUs with AVX-512 and on NVIDIA Tensor Cores, INT8 can achieve 2–4× the throughput of FP32. Accuracy impact is typically < 1% with proper calibration.\n\nCritical counterintuitive fact: INT8 quantization can increase latency on hardware without native INT8 compute support. On such hardware, INT8 operations require dequantization (INT8 → FP32) before computation, which adds overhead rather than reducing it.\n\nMixed-precision strategies: apply INT8 to tolerant layers (embedding lookups, linear layers with stable weight distributions) and keep FP16 on sensitive layers (first and final layers, layers with highly variable activations). TensorRT and PyTorch quantization toolkits support layer-wise precision configuration.\n\nQuantization calibration: INT8 quantization requires a calibration dataset to determine the clipping range for activations. Poor calibration (using an unrepresentative dataset) causes accuracy degradation beyond the expected < 1%.`,
    keyTerms: ['FP32 / FP16 / INT8', 'Tensor Cores', 'Dequantization overhead', 'Mixed-precision quantization', 'Calibration dataset', 'TensorRT post-training quantization'],
    quiz: [
      { q: 'You quantize a model to INT8 on a CPU and observe latency increased instead of decreased. What is the likely cause?', a: 'The CPU may lack native INT8 compute support (AVX-512 VNNI or equivalent). Without hardware-accelerated INT8 execution, the runtime must dequantize weights to FP32 before computation — adding overhead instead of reducing it. INT8 speedups are hardware-dependent.' },
      { q: 'What determines whether FP16 quantization causes meaningful accuracy degradation?', a: 'The model architecture and task sensitivity. Most standard architectures (transformers, CNNs) tolerate FP16 with < 0.1% accuracy drop. Sensitive cases: models with very large activation magnitudes, tasks requiring high numerical precision (financial scoring), or models with poorly conditioned weight matrices.' },
    ],
    practice: [
      'A 7B parameter LLM in FP32 requires 28GB of GPU memory. What memory requirement would FP16 and INT8 quantization yield? Which GPU SKUs become viable?',
      'Design a mixed-precision quantization strategy for a transformer-based ranking model: which layers would you keep in FP16 and which would you quantize to INT8?',
    ],
  },
  {
    heading: 'Model Pruning and Knowledge Distillation',
    body: `Pruning removes weights, neurons, or entire model components to produce smaller, faster models. Two types with very different properties:\n\nStructured pruning: removes entire channels, filters, attention heads, or layers. Produces a smaller but still dense model. Results in real latency reductions on standard hardware because the smaller model has fewer operations. A ResNet with 30% of attention heads removed actually runs faster.\n\nUnstructured pruning: sets individual weight values to zero (sparse weight matrices). Memory-efficient but does NOT reduce GPU inference latency without specialized sparse kernel support (e.g., NVIDIA\'s SPARSITY feature in Ampere architecture). This is the most common interview trap: candidates assume unstructured pruning directly speeds up inference, which is false on most hardware.\n\nKnowledge distillation: trains a smaller student model to mimic the outputs (soft labels) of a larger teacher model. Produces a genuinely smaller model with better accuracy than training from scratch at the same size. Key point: distillation is a training technique, not a deployment optimization. The deployed student model is a separate smaller model — it does not change the teacher.\n\nRecommended pipeline order: prune → quantize → distill (to recover accuracy lost by pruning and quantization). Distillation applied after compression can recover 50–90% of accuracy lost in the compression step.`,
    keyTerms: ['Structured pruning', 'Unstructured pruning', 'Sparse matrices', 'Knowledge distillation', 'Student model', 'Teacher model', 'Prune-quantize-distill pipeline'],
    quiz: [
      { q: 'You prune a model to 70% sparsity (70% of weights set to zero). Will this reduce GPU inference latency? Why or why not?', a: 'Not necessarily — and usually not on standard GPUs. Unstructured pruning creates sparse weight matrices, but standard GPU GEMM operations are not accelerated for sparse inputs. Real latency reduction requires NVIDIA Ampere sparse tensor core support or specialized sparse inference libraries.' },
      { q: 'Is knowledge distillation a training technique or a deployment optimization? What does it produce?', a: 'Distillation is a training technique. It trains a smaller student model using soft outputs from a larger teacher. The result is a new, smaller deployed model. It does not affect the teacher model at all — the teacher is only used during student training, not at inference time.' },
    ],
    practice: [
      'A team claims they reduced inference latency by 40% by applying unstructured pruning to 80% of weights. What questions would you ask to verify this claim?',
      'Design a model compression pipeline for a BERT-large (340M params) ranking model that must achieve P99 < 50ms at 1000 RPS on a single A100 GPU.',
    ],
  },
  {
    heading: 'Caching Strategies for ML Serving',
    body: `Caching can dramatically reduce effective latency by serving stored results for previously seen or similar inputs. Three tiers:\n\nPrediction caching: Cache the full model output keyed on an exact input hash. Works for identical inputs — effective for search queries (same query string), templated inputs, or user profiles that update infrequently. Cache hit delivers sub-millisecond latency instead of 50–200ms model inference.\n\nEmbedding caching: Cache intermediate representations from the first N layers of the model. Useful when inputs share substructure — the same user's embedding, the same document's dense vector. Allows reuse across different downstream queries without re-running the expensive embedding computation.\n\nFeature caching: Cache the preprocessed feature vector upstream of the model. Eliminates preprocessing cost entirely on cache hit (tokenization, normalization, feature extraction). Combined with prediction caching, a user whose features haven\'t changed in the last hour can be served with near-zero compute.\n\nSemantic caching: Extends prediction caching to near-duplicate inputs via embedding similarity search (ANN lookup). For LLMs, GPT Semantic Cache reduces API calls by up to 68.8% and can cut time-per-output-token by 50%. Semantic caches in recommendation domains achieve 60–90% hit rates.\n\nCritical failure mode: cache invalidation after model retraining. Stale predictions from pre-retrain embeddings cached in the embedding cache are a real production problem — the old cached embeddings may be inconsistent with the new model's learned representations.`,
    keyTerms: ['Prediction cache', 'Embedding cache', 'Feature cache', 'Semantic caching', 'ANN lookup', 'Cache invalidation', 'Cache hit rate'],
    quiz: [
      { q: 'You enable prediction caching with a 90% cache hit rate. What is the user-perceived latency if cache hits take 1ms and cache misses take 100ms (model inference)?', a: 'Average: 0.9 × 1ms + 0.1 × 100ms = 0.9ms + 10ms = 10.9ms. But 10% of users still pay full 100ms latency — the system must be designed to serve both paths within SLA. A 90% hit rate is excellent but does not eliminate the need to optimize the miss path.' },
      { q: 'You retrain and redeploy a recommendation model. What must happen to the embedding cache?', a: 'The embedding cache must be invalidated or flushed. The new model has different weight matrices and therefore produces different embedding spaces — cached embeddings from the old model are semantically incompatible with the new model\'s inference path.' },
    ],
    practice: [
      'Design a multi-tier caching strategy for a real-time personalization API: which inputs would you cache at each tier, and what are the invalidation strategies?',
      'Calculate the expected latency reduction for a fraud scoring model (100ms inference) with a 70% semantic cache hit rate and 2ms cache lookup latency.',
    ],
  },
  {
    heading: 'Serving Frameworks — TensorRT, Triton, ONNX Runtime, TorchServe',
    body: `Each serving framework has distinct trade-offs:\n\nTensorRT (NVIDIA): Most aggressive GPU optimization — kernel/layer fusion (combining Conv + BatchNorm + ReLU into a single CUDA kernel eliminates intermediate global memory writes), precision calibration (FP16/INT8), kernel auto-tuning for specific GPU architectures. Achieves up to 40× speedup over CPU and up to 18× over unoptimized TensorFlow. Best choice for maximum single-GPU inference throughput. Limitation: NVIDIA-only, requires re-optimization for each GPU architecture.\n\nTriton Inference Server (NVIDIA): Production-grade, multi-framework serving orchestrator. Supports TensorFlow, PyTorch, ONNX, TensorRT, and custom backends. Key features: dynamic batching, concurrent model execution, model ensembles, and Kubernetes-native deployment. Best for teams serving multiple models with mixed frameworks. TensorRT backends on Triton are the highest-performance configuration.\n\nONNX Runtime (Microsoft): Cross-platform portability is its primary value — runs on CPU, GPU, Intel, AMD, ARM, and edge devices. Latency: 2–10ms for small models, 20–100ms for large models. Not as performant as TensorRT on NVIDIA hardware, but model portability across hardware vendors is a significant operational advantage.\n\nTorchServe (PyTorch/Meta): Python-native, easy custom handlers, mature integration with the PyTorch ecosystem. Baseline latency 15–20ms. Appropriate for teams staying within the PyTorch ecosystem without extreme latency requirements. Not growing as fast as Triton in adoption.`,
    keyTerms: ['TensorRT', 'Layer/kernel fusion', 'Triton Inference Server', 'ONNX Runtime', 'TorchServe', 'Cross-platform serving', 'Model ensemble'],
    quiz: [
      { q: 'What is kernel fusion in TensorRT, and why does it reduce latency?', a: 'Kernel fusion combines multiple neural network operations (e.g., Conv → BatchNorm → ReLU) into a single CUDA kernel. This eliminates intermediate global memory writes between operations — the output of Conv is kept in fast register or shared memory and fed directly to BatchNorm without writing to/reading from global GPU memory. Eliminating these memory round-trips reduces latency.' },
      { q: 'When would you choose ONNX Runtime over TensorRT for a production ML serving deployment?', a: 'When hardware heterogeneity is required: ONNX Runtime runs on NVIDIA, AMD, Intel, ARM, and CPU — ideal for multi-cloud, hybrid cloud, or edge deployments where you cannot guarantee a specific GPU SKU. TensorRT requires NVIDIA GPUs and must be re-optimized per GPU architecture.' },
    ],
    practice: [
      'You are migrating a PyTorch model to production serving. Compare TorchServe vs. Triton+TensorRT for: latency, throughput, operational complexity, and hardware flexibility.',
      'Describe the steps to convert a PyTorch model to TensorRT and serve it via Triton Inference Server.',
    ],
  },
  {
    heading: 'GPU vs. CPU Serving — When GPU Is Actually Slower',
    body: `GPUs excel when models are large, request volumes are high, and batch sizes allow parallelism to fill GPU compute. However, GPUs are slower or break even in several well-documented scenarios.\n\nSmall models at batch size 1: MobileNetV2 can run 8ms on CPU vs. 11ms on GPU when including CPU-to-GPU memory transfer overhead and kernel launch latency. For tiny models or batch size = 1 with strict latency SLAs, CPU is competitive or superior.\n\nGPU warm-up cost: GPU kernel launch adds overhead to every inference call, even when the model is small. At batch size = 1, kernel launch latency can dominate inference latency for small models.\n\nMemory transfer bottleneck: Pinterest found that CPU-to-GPU data copying was costing 10ms per inference call. By batching hundreds of individual tensor transfers into a single contiguous buffer transfer, they reduced this to sub-1ms — a 10× improvement. The lesson: memory transfer is often the bottleneck, not compute.\n\nReal-world example: Pinterest reduced GPU recommendation inference costs by 100× through GPU acceleration at scale — but this required large batch sizes (GPU needs high parallelism to amortize fixed overhead). For the same model at batch size 1, CPU would have been competitive.\n\nRule of thumb: use GPU for inference when batch size ≥ 8, model size ≥ 100M parameters, or throughput requirements exceed 100 RPS with latency < 200ms. Below these thresholds, benchmark both before assuming GPU is faster.`,
    keyTerms: ['GPU kernel launch latency', 'CPU-to-GPU memory transfer', 'Batch size threshold', 'Amortized GPU overhead', 'CPU inference', 'Small model serving'],
    quiz: [
      { q: 'Your team deploys a small classification model (5M parameters) at batch size 1 on GPU, observing 15ms latency. A colleague suggests trying CPU inference. Is this reasonable? Why?', a: 'Yes, very reasonable. Small models at batch size 1 on GPU often underperform CPU because GPU kernel launch overhead and CPU-to-GPU memory transfer latency dominate inference latency. For a 5M parameter model, the actual compute is trivial — the overhead is what takes time. Always benchmark both.' },
      { q: 'What is the Pinterest example of GPU memory transfer optimization, and what does it teach us?', a: 'Pinterest was paying 10ms per inference call for CPU-to-GPU data copying. By batching hundreds of individual tensor transfers into a single contiguous buffer transfer before sending to GPU, they cut this to sub-1ms. The lesson: the bottleneck is often memory bandwidth and transfer overhead, not compute. Optimizing data movement can outperform optimizing the model.' },
    ],
    practice: [
      'Design a benchmark to determine whether GPU or CPU serving is better for a 20M parameter NLP classifier at your traffic levels (1000 RPS, P99 target < 50ms).',
      'Explain why GPU serving scales better than CPU serving as batch size and traffic volume increase.',
    ],
  },
  {
    heading: 'Async vs. Synchronous Serving',
    body: `The choice between synchronous and asynchronous serving depends on the user experience requirements and downstream action timing.\n\nSynchronous serving: the client waits for the model prediction before proceeding. Required when the user experience is blocked on the prediction — fraud detection (transaction must be approved/declined before completing), real-time recommendations (page renders based on the result), chatbots (user waiting for response). SLA must be met on every request, or the user experiences a timeout.\n\nAsynchronous serving: the client submits a request and receives a job ID; the prediction is delivered via callback, polling, or webhook when complete. Appropriate when the downstream action can proceed before the prediction is needed (content moderation queue, overnight batch scoring, email personalization where the email goes out tomorrow).\n\nKey nuance: async improves throughput under high concurrency but does not inherently reduce latency — it adds queue delay. A request that waits in a queue for 500ms before inference is not faster than a synchronous 500ms call. Async architectures are more resilient (requests don\'t drop on transient overload — they queue), but introduce complexity in result delivery.\n\nFor streaming LLM responses: async/streaming is essential. Begin sending tokens before full generation completes — this reduces perceived Time To First Token (TTFT), which is what users actually perceive as "speed" in chatbot UIs. A 10-second full response can feel faster if the first token arrives in 200ms.`,
    keyTerms: ['Synchronous serving', 'Asynchronous serving', 'Queue delay', 'Time To First Token (TTFT)', 'Streaming inference', 'Result delivery patterns'],
    quiz: [
      { q: 'True or false: asynchronous serving always reduces latency for individual requests compared to synchronous serving.', a: 'False. Async serving improves throughput and resilience under load, but each individual request incurs additional queue delay. A request waiting 200ms in a queue before 50ms inference completes in 250ms total — potentially worse than a synchronous 50ms synchronous call with no queue.' },
      { q: 'For a real-time fraud scoring API that blocks payment completion, should you use sync or async serving?', a: 'Synchronous serving. The payment transaction cannot complete until the fraud decision is made — async delivery via callback/polling would mean the payment is stuck waiting for the callback anyway. Sync serving with a tight SLA (< 100ms) is the correct pattern here.' },
    ],
    practice: [
      'A content moderation system scores 5M pieces of user-generated content per day. Each piece is scored within 24 hours of posting. Should this use sync or async serving? Design the architecture.',
      'For an LLM chatbot, explain why streaming token-by-token output reduces perceived latency even if total generation time is the same.',
    ],
  },
  {
    heading: 'Latency Budget Design and SLA Setting',
    body: `Latency budgets start from the user experience requirement or upstream timeout — not from what the current infrastructure delivers.\n\nExample budget design for a customer-facing recommendation API with 200ms end-to-end SLA:\n- Network (client → gateway): 20ms\n- Gateway processing: 5ms\n- Feature retrieval (feature store): 30ms\n- Model inference: 80ms\n- Postprocessing / business rules: 10ms\n- Response serialization + network (gateway → client): 20ms\n- Buffer (jitter, GC pauses, cold starts): 35ms\nTotal: 200ms\n\nKey principles:\n\nMeasure at P99, not P50: the budget at each stage should be set to the P99 contribution, because P99 stages compound. If each of five stages runs at their P99 simultaneously, the combined latency can breach SLA even when individual components "look fine."\n\nLoad test with bursty patterns: uniform synthetic load systematically underestimates real-world latency variance. Production traffic is bursty — use realistic burst patterns in load testing.\n\nStructured latency propagation: pass a "remaining budget" field in request headers across service hops. Any stage that detects budget exhaustion can fail fast rather than attempting full processing that will time out anyway.\n\nMeta\'s model freshness finding: stale models beyond 5 minutes measurably reduce ad engagement. Latency budgets must also account for feature freshness requirements — a fast model serving stale features can be worse than a slightly slower model serving fresh ones.`,
    keyTerms: ['Latency budget', 'SLA / SLO', 'P99 budget allocation', 'Remaining budget propagation', 'Bursty load testing', 'Feature freshness trade-off'],
    quiz: [
      { q: 'You set a 200ms end-to-end SLA and allocate 80ms to model inference, 30ms to feature retrieval, and 50ms to other components. A load test shows the system meets SLA at P50 but breaches at P99. What is the likely cause?', a: 'P99 latency at each stage is higher than the average (P50) — especially under load, where GC pauses, cache misses, and lock contention spike. When you set your budget at P50 values, you have no headroom for variance. The latency budget should be designed at P95-P99 for each stage, with explicit buffer for variance.' },
      { q: 'What does "passing remaining budget in request headers" accomplish in a multi-service ML pipeline?', a: 'It allows downstream services to fail fast if the budget is already exhausted. A downstream feature store that receives a request with 5ms remaining budget knows it cannot complete a 30ms operation and can immediately return a cached/default value or error, rather than spending full processing time before timing out.' },
    ],
    practice: [
      'Design a 150ms end-to-end latency budget for a mobile app API that uses a two-stage recommendation system (retrieval + ranking). List every component and its budget allocation.',
      'A service meets P95 latency in load tests but breaches P99 in production. List five possible causes and how you would diagnose each.',
    ],
  },
];

// ── Interview Q&A ──────────────────────────────────────────────────────────────

export const INTERVIEW_QA: InterviewQ[] = [
  // ── Section 1: Sources of Latency ─────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'Your ML model benchmarks at 15ms inference time in isolation, but production P99 latency is 90ms. What are the likely contributors to this gap?',
    keyPoints: [
      'Network hops between microservices: each hop on the same VPC adds 1-5ms, compounding in multi-stage pipelines',
      'Queue wait time under load: when request rate approaches processing capacity, requests wait before inference begins',
      'Preprocessing latency: feature extraction, tokenization, normalization — often not included in "model inference" benchmarks',
      'Postprocessing and response serialization: business rule application, score formatting, JSON encoding',
      'Cold-start effects: model loading, JIT compilation, cache warming on first requests',
    ],
    trap: 'Assuming inference time is the same as serving latency. Benchmarks measure inference in isolation; production latency includes the full stack. Always measure end-to-end.',
  },
  {
    difficulty: 'mid',
    question: 'How would you build a latency benchmark for an ML serving system that accurately reflects production conditions?',
    keyPoints: [
      'Measure end-to-end from client perspective — not just model inference time in isolation',
      'Use realistic traffic patterns: bursty load (10× baseline spikes), not uniform synthetic load',
      'Capture P50, P95, and P99 — not just average latency. P99 is what SLAs and user experience are determined by',
      'Include all pipeline stages: feature retrieval, model inference, postprocessing, serialization',
      'Run under the same hardware and load profile as production — different CPU/GPU generations produce very different results',
    ],
  },

  // ── Section 2: Tail Latency ────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'A recommendation system makes 50 parallel model scoring calls per user request. Why does P99 latency of individual calls matter more than P50?',
    keyPoints: [
      'The user\'s response waits for ALL 50 calls to complete — the slowest call determines user-perceived latency',
      'Probability of at least one call exceeding P99: 1 - (0.99)^50 ≈ 40% — nearly every other user request will hit a P99 tail event',
      'This is fan-out amplification: individual P99s compound, making user-visible latency higher than any single call\'s P99',
      'Google\'s finding: a service with P99=10ms produces ~140ms user-visible latency under real 100-way fan-out conditions',
    ],
    trap: 'Optimizing P50 (median) while ignoring P99. In fan-out architectures, the median is irrelevant — the slowest call wins.',
  },
  {
    difficulty: 'senior',
    question: 'You measure P99 = 50ms for your recommendation model in isolation. Under what fan-out conditions would users actually experience latency worse than 50ms on more than 50% of requests?',
    keyPoints: [
      'If the system fans out to N parallel calls, probability of at least one exceeding P99: 1 - (0.99)^N',
      'For N=70: 1 - (0.99)^70 ≈ 50% — at 70-way fan-out, half of all user requests will experience at least one 50ms+ call',
      'User-visible latency is the maximum across all parallel calls (serialized fan-in), so the user waits for that slowest call',
      'This means your effective user-facing P50 latency is approximately the same as your individual call P99 under sufficient fan-out',
    ],
  },

  // ── Section 3: Dynamic Batching ───────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'True or false: increasing batch size in ML serving always reduces latency. Explain.',
    keyPoints: [
      'False. Increasing batch size reduces cost-per-inference and improves throughput (better GPU utilization), but increases individual request latency',
      'Each request must wait for the batch to fill before inference begins — this adds queue delay proportional to batch size × inter-arrival time',
      'Larger batch = faster throughput (more inferences per second per dollar) but slower user-perceived latency (each user waits longer)',
      'Optimal batch size must be tuned per model, per hardware, and per traffic level — there is no universal "bigger is better"',
    ],
    trap: 'Saying larger batch is always better. This is true for throughput/cost optimization but false for latency-sensitive user-facing services.',
  },
  {
    difficulty: 'senior',
    question: 'Design a dynamic batching configuration for a ranking model that handles 100 RPS baseline with 10× burst peaks. What parameters would you tune and how?',
    keyPoints: [
      'max_batch_size: set based on GPU memory and throughput benchmarks — start at 32, test latency at each size under peak load',
      'max_queue_delay_microseconds: set to 90% of latency budget ÷ number of pipeline stages — bounds the maximum wait for batch fill',
      'At burst (1000 RPS): batches will fill quickly, latency stays near inference time. At baseline (100 RPS): batches may be small or size=1, latency stays low but throughput is underutilized',
      'Consider adaptive batch size: dynamically scale max batch size up under sustained high load, down under low load, based on queue depth monitoring',
    ],
  },

  // ── Section 4: Quantization ────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'You apply INT8 quantization to a model and observe latency increased. What is the most likely cause and how do you fix it?',
    keyPoints: [
      'Most likely cause: the hardware lacks native INT8 compute support (no AVX-512 VNNI on CPU, no Tensor Cores on older GPUs)',
      'Without hardware-accelerated INT8, the runtime dequantizes weights to FP32 before computation — adding overhead rather than reducing it',
      'Fix: switch to FP16 quantization (more broadly supported), or use hardware that has native INT8 support (NVIDIA Turing/Ampere GPUs, Intel Cascade Lake CPUs)',
      'Always benchmark quantization on the actual target deployment hardware before assuming speedup',
    ],
    trap: 'Assuming quantization always speeds up inference regardless of hardware. INT8 benefits are hardware-dependent — verify support before applying.',
  },
  {
    difficulty: 'senior',
    question: 'Design a quantization strategy for a BERT-large model that must serve 500 RPS at P99 < 100ms on a single A100 GPU. What precision levels, calibration, and validation steps would you use?',
    keyPoints: [
      'Start with FP16: low risk, ~47% latency reduction, < 0.1% accuracy drop — often sufficient to meet SLA without complex calibration',
      'If FP16 is insufficient: INT8 via TensorRT post-training quantization with calibration dataset (1000+ representative examples from production traffic)',
      'Mixed precision: keep embedding layers and final classification layers in FP16, apply INT8 to middle transformer layers',
      'Validation: compare F1/accuracy on held-out test set, regression test on distribution of scores (not just average accuracy), check performance on edge-case segments',
      'Load test at 500 RPS before deploying — quantized models can behave differently under memory pressure than in single-request benchmarks',
    ],
  },

  // ── Section 5: Pruning and Distillation ───────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is the difference between structured and unstructured pruning, and which one actually reduces GPU inference latency?',
    keyPoints: [
      'Structured pruning removes entire components (channels, filters, attention heads, layers) — produces a smaller dense model that runs faster on standard hardware',
      'Unstructured pruning sets individual weights to zero (sparse matrices) — memory efficient but does NOT reduce GPU latency without specialized sparse kernel support',
      'Standard GPU GEMM operations are not accelerated for sparse inputs — unstructured sparsity requires NVIDIA Ampere sparse tensor cores or custom sparse libraries',
      'For GPU latency reduction: use structured pruning (guaranteed speedup on all hardware) rather than unstructured pruning (requires specialized hardware)',
    ],
    trap: 'Saying any pruning reduces inference latency. Unstructured pruning typically does not reduce GPU latency without specialized hardware support.',
  },
  {
    difficulty: 'mid',
    question: 'Explain knowledge distillation. What does the student model do at inference time?',
    keyPoints: [
      'Distillation trains a smaller student model to match the soft output probability distributions of a larger teacher model',
      'The student learns "dark knowledge" from the teacher — the relative probabilities between classes encode information about similarities that hard labels do not',
      'At inference time: only the student model is deployed. The teacher is not used at inference — it was only used during the student\'s training',
      'Distillation is a training technique, not a deployment optimization — it produces a separate, smaller model; it does not compress or modify the teacher',
    ],
    trap: 'Saying both student and teacher are used at inference, or that distillation compresses the teacher. The teacher exists only during student training.',
  },

  // ── Section 6: Caching ─────────────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What are the three tiers of ML caching? When would each tier be appropriate?',
    keyPoints: [
      'Prediction caching: cache full model output keyed on exact input hash — works when inputs repeat exactly (search queries, templated requests, repeated user lookups)',
      'Embedding caching: cache intermediate model representations — works when inputs share substructure (same user profile, same document) across different downstream queries',
      'Feature caching: cache preprocessed feature vectors before model inference — eliminates preprocessing cost, works when features don\'t change frequently (user features updated hourly)',
      'Combine tiers for maximum coverage: feature cache reduces preprocessing cost, embedding cache reuses partial computation, prediction cache eliminates full inference for exact repeats',
    ],
  },
  {
    difficulty: 'senior',
    question: 'You retrain a recommendation model weekly. What cache invalidation strategy is required, and what latency impact should you expect during the transition?',
    keyPoints: [
      'Embedding cache must be invalidated on model update: old embedding vectors are incompatible with the new model\'s learned representation space',
      'Prediction cache can be partially preserved only if the new model is a minor update — major architectural changes require full cache flush',
      'Transition strategy: flush embedding and prediction caches before switching traffic to new model, or accept cache misses during warm-up by routing to new model with cold cache',
      'Latency spike at retraining: 0% cache hit rate immediately after cache flush causes all requests to pay full inference cost. Expect P99 to spike 2-5× for 15-60 minutes until cache re-warms at normal traffic patterns',
    ],
  },

  // ── Section 7: Serving Frameworks ─────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Compare TensorRT and ONNX Runtime. When would you choose each for production ML serving?',
    keyPoints: [
      'TensorRT: maximum performance on NVIDIA GPUs (layer fusion, kernel auto-tuning, hardware-specific optimizations), up to 18× faster than unoptimized TensorFlow. Choose when: NVIDIA GPU is guaranteed, maximum single-GPU throughput is the priority',
      'ONNX Runtime: cross-platform (NVIDIA, AMD, Intel, ARM, CPU, edge). Choose when: multi-cloud deployment, heterogeneous hardware fleet, or edge/CPU serving where GPU is not available',
      'ONNX Runtime with TensorRT execution provider: best of both worlds on NVIDIA hardware — cross-framework model format with TensorRT acceleration',
      'Operational trade-off: TensorRT requires re-optimization per GPU architecture; ONNX Runtime is architecture-agnostic',
    ],
  },
  {
    difficulty: 'junior',
    question: 'What is kernel fusion in TensorRT, and why does it reduce latency?',
    keyPoints: [
      'Kernel fusion combines multiple neural network operations (e.g., Conv → BatchNorm → ReLU) into a single GPU kernel execution',
      'Without fusion: each operation writes its output to global GPU memory and the next operation reads it back — global memory bandwidth becomes the bottleneck',
      'With fusion: intermediate results stay in fast GPU registers or L1 cache between operations — no global memory round-trips',
      'Result: significant latency reduction from eliminating memory bandwidth bottlenecks, especially for memory-bound (not compute-bound) models',
    ],
  },

  // ── Section 8: GPU vs CPU ─────────────────────────────────────────────────
  {
    difficulty: 'mid',
    question: 'Under what conditions can GPU serving be slower than CPU serving for ML inference?',
    keyPoints: [
      'Small models at batch size 1: GPU kernel launch latency and CPU-to-GPU memory transfer overhead dominate inference time for tiny models',
      'Example: MobileNetV2 at batch size 1 — 8ms on CPU vs 11ms on GPU including transfer overhead',
      'Models with highly irregular control flow (dynamic computation graphs, variable-length inputs) that cannot efficiently utilize GPU parallelism',
      'When GPU memory bandwidth is the bottleneck and the model is too small to amortize fixed GPU overhead: benchmark both before assuming GPU is faster',
    ],
    trap: 'Assuming GPU is always faster for ML. GPU dominates at large batch sizes and large models — at batch size 1 with small models, CPU is often competitive or faster.',
  },
  {
    difficulty: 'senior',
    question: 'Pinterest reduced GPU inference latency from 10ms to sub-1ms for memory transfer. What did they do and what does this teach about optimization priorities?',
    keyPoints: [
      'Pinterest batched hundreds of individual tensor transfers into a single contiguous buffer transfer before sending to GPU',
      'Original: hundreds of separate CPU→GPU memory copy calls, each with kernel launch overhead and PCIe transfer latency',
      'Optimized: a single large contiguous buffer copy — far more efficient on PCIe bandwidth and eliminates per-copy kernel overhead',
      'Lesson: the bottleneck was not compute (GPU FLOPS) but data movement (PCIe memory transfer). Optimizing data movement can outperform model optimization. Always profile before optimizing.',
    ],
  },

  // ── Section 9: Async vs Sync ──────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'True or false: asynchronous ML serving always reduces latency for individual requests. Explain.',
    keyPoints: [
      'False. Async serving improves throughput and system resilience, but adds queue delay to individual requests',
      'A request waiting 200ms in an async queue before 50ms inference = 250ms total latency vs. 50ms synchronous call',
      'Async reduces latency only under overload conditions where synchronous serving would time out or drop requests — by smoothing the request stream',
      'Use async when: downstream action does not need immediate result (content moderation, batch scoring, email personalization). Use sync when: user is waiting (fraud scoring, real-time recommendations)',
    ],
    trap: 'Thinking async is always faster. Async trades per-request latency for improved throughput and resilience — it is not inherently lower latency.',
  },
  {
    difficulty: 'mid',
    question: 'For LLM chatbot serving, why is streaming token-by-token output considered a latency optimization even if total generation time is unchanged?',
    keyPoints: [
      'Users perceive Time To First Token (TTFT) as "speed" — a response that starts appearing in 200ms feels faster than one that appears all at once after 5 seconds',
      'Streaming reduces perceived latency without reducing actual compute time — it is a UX optimization, not a hardware optimization',
      'Non-streaming: user waits the full generation time before seeing any output — a 10-second wait for a long response is very poor UX',
      'Streaming: user sees tokens appearing progressively, can start reading while generation continues — dramatically improves perceived responsiveness and reduces abandonment',
    ],
  },

  // ── Section 10: Latency Budget ────────────────────────────────────────────
  {
    difficulty: 'junior',
    question: 'What is a latency budget and why should it be designed top-down (from user SLA) rather than bottom-up (from current infrastructure performance)?',
    keyPoints: [
      'Latency budget: allocation of the total end-to-end SLA across each pipeline component (network, feature retrieval, inference, postprocessing)',
      'Top-down design: start from what the user experience requires (200ms end-to-end) and allocate component budgets based on requirements',
      'Bottom-up risk: if you design from current infrastructure performance, you inherit all existing inefficiencies as hard constraints and optimize around them instead of challenging them',
      'Top-down forces each team to justify their component\'s latency allocation and exposes where the biggest opportunities for improvement are',
    ],
  },
  {
    difficulty: 'senior',
    question: 'Design a 150ms end-to-end latency budget for a two-stage recommendation system (retrieval → ranking). Include buffer for P99 variance and explain your allocation rationale.',
    keyPoints: [
      'Network (client → gateway): 10ms — minimal, same datacenter or low-latency region',
      'Gateway + auth: 5ms — lightweight processing',
      'Feature retrieval (online feature store): 25ms — P99 budget, Redis or Cassandra lookup',
      'Retrieval model (ANN search, 1M items): 30ms — vector similarity search, HNSW index',
      'Ranking model inference (top 100 candidates): 40ms — transformer reranker on GPU',
      'Postprocessing + business rules: 10ms — deduplication, filter rules, A/B flag checking',
      'Response serialization + network back: 10ms',
      'Buffer for variance (GC, cache miss, cold start): 20ms',
      'Total: 150ms. Largest allocations justified by retrieval and ranking being the computation-intensive steps.',
    ],
  },
];

// ── AI Prompt ──────────────────────────────────────────────────────────────────

export const AI_PROMPT_TEMPLATE = (
  p99: number,
  p50: number,
  throughput: number,
  cacheHitRate: number,
  batchSize: number,
  quantization: string,
  tensorrtEnabled: boolean,
) =>
  `I am optimizing ML serving latency. Current metrics: P99=${p99}ms, P50=${p50}ms, throughput=${throughput} RPS. Configuration: batch size=${batchSize}, quantization=${quantization}, TensorRT=${tensorrtEnabled ? 'enabled' : 'disabled'}, cache hit rate=${cacheHitRate}%. In 2-3 sentences: what is the highest-impact optimization I should apply next? Be specific and direct.`;
