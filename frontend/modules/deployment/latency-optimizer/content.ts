export interface StudySection { heading: string; body: string; }

export interface InterviewQ {
  difficulty: 'junior' | 'mid' | 'senior';
  question:   string;
  keyPoints:  string[];
  trap?:      string;
}

export const STUDY_CONTENT: StudySection[] = [
  {
    heading: 'Sources of ML Serving Latency - The Full Stack',
    body: `Every ML serving request passes through a latency stack with multiple contributors: network transit between client and gateway, queue wait time under high concurrency, preprocessing (tokenization, normalization, feature extraction), model inference, postprocessing (business rule application, score formatting), and response serialization. No single component dominates universally - the bottleneck shifts by model type, traffic level, and infrastructure configuration.

At low traffic, model inference itself dominates. Under high concurrency when request rate approaches capacity, queue time and preprocessing can dwarf inference latency. Network is consistently underestimated: a round-trip between microservices on the same VPC adds 1–5ms per hop, compounding in multi-stage pipelines. A three-stage pipeline (feature server → model server → postprocessing) adds 15ms of pure network overhead even when inference takes only 10ms.

The critical failure mode in ML serving performance engineering is measuring only "model inference time" in benchmarks, then being surprised that production P99 latency is 3–5× higher due to the full stack. This happens because ML teams measure inference with frameworks like PyTorch's model.eval() + time.perf_counter(), which counts only the forward pass with warm CPU/GPU caches and no concurrent load. Production latency includes everything: feature lookup latency from the online store (5–30ms depending on implementation), network hops between microservices, serialization/deserialization overhead, and the tail latency caused by concurrent request interference under real traffic.

The correct benchmarking approach measures end-to-end latency from the client perspective - HTTP request sent to HTTP response received - under a realistic concurrent load profile with bursty traffic patterns. Google's Site Reliability Engineering book calls this "black-box monitoring": measure what the user actually experiences, not what the components report about themselves. For ML serving, this means load testing with a traffic generator that simulates real request patterns, measuring P50, P95, and P99 at the client, and breaking down the latency into components using distributed tracing (Jaeger, Zipkin, AWS X-Ray) to identify which stage dominates.`,
  },
  {
    heading: 'P50 vs P95 vs P99 - Why Tail Latency Matters',
    body: `P50 (median) is deeply misleading in distributed ML systems. Google's canonical internal finding, described by Jeff Dean and Luiz Barroso in "The Tail at Scale" (Communications of the ACM, 2013): a service with P99 = 10ms produces approximately 140ms user-visible latency under real fan-out conditions with 100 parallel backend calls - a 14× amplification from a single component's tail latency.

The mathematics of tail latency amplification are stark. If a user request fans out to N parallel backend ML scoring calls, the probability that at least one call exceeds the P99 threshold is 1 - (0.99)^N. For N=50, this is 1 - (0.99)^50 ≈ 39% - nearly every other user request hits a tail event. For N=100, it is 63%. For N=200 (common in large-scale ad ranking systems where hundreds of model calls happen in parallel), it exceeds 86%. The user's perceived response time is the maximum across all parallel calls - the slowest call determines the user's wait.

ML inference latency distributions are heavily right-skewed, not normally distributed. The median (P50) can be 15ms while the P99 is 150ms - a 10× difference. The long tail is caused by transient events: garbage collection pauses in JVM-based feature servers, model loading events when a container starts cold, cache misses on the model's embedding table or feature store, and GPU kernel scheduling delays under concurrent load. These events are individually rare but are precisely what users experience at their most frustrating - slow responses on sites where speed matters tend to hurt conversion and retention more than consistently fast responses help.

Optimization priorities should be set at the percentile that matters for the SLA and use case. For a user-facing recommendation API with a 200ms end-to-end budget, P99 optimization is the relevant target. P50 optimization is the wrong target - improving the median while the tail remains at 500ms means 1% of users still experience terrible latency. For batch scoring pipelines with throughput targets rather than latency SLAs, P50 and throughput per dollar become the relevant metrics. Understanding which percentile is the relevant target determines which optimizations are worth pursuing.`,
  },
  {
    heading: 'Dynamic Batching - Throughput vs. Latency Trade-off',
    body: `Dynamic batching aggregates multiple concurrent individual requests into a batch before sending to the model for inference, all transparently to each individual client. NVIDIA Triton Inference Server's dynamic batcher (the most widely deployed implementation in ML serving) has two primary configuration parameters: max_batch_size (the maximum number of requests to aggregate) and max_queue_delay_microseconds (the maximum time to wait for a batch to fill before processing whatever requests are in queue).

The fundamental trade-off is the throughput-latency trade-off. At one extreme, batch_size=1 (no batching) processes each request as soon as it arrives - zero queue delay, minimum per-request latency, but maximum cost-per-inference because the GPU is poorly utilized. At the other extreme, waiting for a large batch maximizes GPU utilization and throughput but adds queue delay to every request: if max_batch_size=128 and the service processes 10 requests per second at baseline, filling a batch of 128 takes 12.8 seconds of queue wait - completely unacceptable for any user-facing service. The optimal configuration sits between these extremes, tuned to the traffic level and latency SLA.

The key insight about GPU compute utilization explains why batching is beneficial at all: modern GPUs are highly parallel processors that are most efficient when performing the same operation on many data elements simultaneously (SIMD parallelism). A single input inference on a GPU uses only a small fraction of the available parallel compute units - the overhead of launching a GPU kernel, transferring data, and retrieving results dominates the actual computation for small inputs. Batching amortizes this fixed overhead across many inputs, allowing the GPU's compute units to be fully occupied. For a ResNet-50 image classification model on a T4 GPU: batch size 1 achieves roughly 3% GPU utilization, while batch size 64 achieves approximately 85% utilization - a 28× improvement in compute efficiency at the cost of queue delay.

Continuous batching (also called iteration-level scheduling) is a newer technique developed for LLM serving that differs from static dynamic batching. In traditional dynamic batching, all requests in a batch must complete before new requests are added. In continuous batching, new requests are added to the batch at each model forward pass iteration, immediately replacing completed requests. For LLMs that generate tokens autoregressively (one token per forward pass), continuous batching means requests that complete early free their batch slots immediately rather than waiting for the slowest request in the batch to finish. vLLM's implementation of continuous batching demonstrated 23× throughput improvement over naive batching for LLM serving, largely because LLM output lengths vary widely - some requests generate 10 tokens, some generate 2,000 - and continuous batching prevents short completions from being bottlenecked by long ones.`,
  },
  {
    heading: 'Quantization - INT8, FP16, and the Accuracy-Latency Trade-off',
    body: `Quantization reduces model weight and activation precision from the default FP32 representation to lower bit-width representations. This reduces memory footprint (enabling larger models to fit on given hardware), increases arithmetic throughput (more operations per second on hardware with native lower-precision support), and reduces memory bandwidth consumption (a critical bottleneck for many production serving scenarios where memory bandwidth limits throughput more than compute).

FP32 → FP16 is the lowest-risk quantization option. Memory reduction is 50% (FP32 uses 4 bytes per parameter; FP16 uses 2 bytes). On NVIDIA GPUs with Tensor Cores (Volta architecture and later: V100, T4, A100, H100), FP16 Tensor Core operations are 2–8× faster than FP32 operations depending on the model. Accuracy impact is typically below 0.1% for standard architectures on standard tasks. For a 7B parameter LLM in FP32 requiring 28GB of GPU memory, FP16 requires 14GB - enabling deployment on a single A100 80GB GPU where FP32 would have required multiple GPUs.

FP32 → INT8 is the higher-risk, higher-reward option. Memory reduction is 75% versus FP32. On hardware with native INT8 support (NVIDIA Turing/Ampere/Hopper GPUs, Intel Cascade Lake and later CPUs with VNNI support, Google TPUs), INT8 matrix multiplication can achieve 4× the throughput of FP32. The catch: accuracy impact is larger (typically 0.5–2% on most tasks) and requires calibration - a calibration dataset of 100–1,000 representative production samples must be used to determine the appropriate quantization range for each layer's activations.

The counterintuitive failure mode: INT8 quantization can increase latency on hardware without native INT8 compute support. On such hardware, the runtime dequantizes INT8 weights back to FP32 before matrix multiplication, adding overhead instead of reducing it. This is a common mistake: quantizing a model, deploying it on the same CPU server without checking for AVX-512 VNNI support, and observing higher latency than the unquantized model. Always verify that the target hardware has native support for the quantization precision before applying quantization.

Mixed-precision quantization applies different precisions to different layers, trading accuracy for speed granularly. The standard heuristic: apply INT8 to middle transformer layers and large embedding lookups (where the volume is high and sensitivity is lower), and retain FP16 for the first and final layers, attention layers with high sensitivity to numerical precision, and any layer with poorly conditioned weight distributions. TensorRT's layer-wise calibration tool automates this by profiling each layer's sensitivity to quantization and choosing the precision that meets the accuracy constraint with minimum latency.`,
  },
  {
    heading: 'Model Pruning and Knowledge Distillation',
    body: `Pruning and distillation are complementary model compression techniques that reduce model size and inference cost at the model architecture level, before hardware optimization or quantization. They address different aspects of the size-quality trade-off and are most effective when combined with quantization in a prune → quantize → distill pipeline.

Structured pruning removes entire architectural units: convolutional filters, attention heads in transformer models, layers, or neurons. The removed units are gone - the model is architecturally smaller, with fewer parameters and fewer floating-point operations per forward pass. This produces real, hardware-agnostic latency reductions on any hardware, because the model simply has less computation to perform. A BERT-base transformer with 6 attention heads removed from each layer has fewer FLOPs per layer and genuinely runs faster on any CPU or GPU without requiring specialized hardware support. Structured pruning during training (iterative magnitude pruning) typically allows 20–30% model size reduction with less than 1% accuracy degradation when fine-tuning on the target task.

Unstructured pruning sets individual weight values to zero, creating sparse weight matrices. This is the failure mode that trips many ML engineers: unstructured sparsity does NOT reduce inference latency on standard hardware. Standard GPU matrix multiplication libraries (cuBLAS, cuDNN) operate on dense matrices and do not accelerate sparse inputs. A 70% sparse matrix runs at the same speed as a 70% dense matrix on a standard GPU. Real latency reduction from unstructured pruning requires specialized hardware (NVIDIA Ampere's 2:4 structured sparsity pattern in Sparse Tensor Cores) or specialized inference libraries (NVIDIA's cuSPARSELt). Without these, unstructured pruning reduces memory footprint only, not latency.

Knowledge distillation trains a smaller student model to reproduce the behavior of a larger teacher model by training on the teacher's soft output probabilities (temperature-scaled softmax outputs) rather than hard labels. Soft probability distributions encode similarity information between classes that hard labels discard: a teacher model that assigns 60% probability to class A, 35% to class B, and 5% to class C is providing richer training signal than a hard label of "class A." The student learns these inter-class relationships, achieving accuracy close to the teacher's despite having fewer parameters. DistilBERT (Hugging Face) demonstrates the ceiling: 40% smaller than BERT-base, 60% faster inference, retaining 97% of BERT's performance on GLUE benchmarks.

Distillation is a training technique, not a deployment optimization. At inference time, only the student is deployed. The teacher is never used at inference. This distinction is important for understanding the computational cost of distillation: it increases training cost (the teacher must generate soft labels for the entire training dataset) but reduces inference cost (only the smaller student runs in production). For a team with many serving instances, the inference cost savings amortize the one-time training overhead rapidly.`,
  },
  {
    heading: 'Caching Strategies for ML Serving',
    body: `Caching exploits the observation that many real-world ML workloads have significant input repetition or reusable computation structure. A cache hit eliminates inference entirely (prediction cache), eliminates expensive computation for part of the model (embedding cache), or eliminates preprocessing (feature cache). Each tier targets a different stage of the inference pipeline and applies to a different class of input patterns.

Prediction caching stores the full model output keyed on an exact hash of the model inputs. It works whenever inputs repeat exactly: search queries (the same query string submitted multiple times by different users), templated API requests (a finite set of input configurations), or user profiles that update infrequently. The latency benefit is maximal - a cache hit delivers sub-millisecond latency instead of 50–200ms model inference. The hit rate depends entirely on input diversity: a recommendation model with billions of unique users has a low hit rate for full prediction caching, but a search relevance model on a vocabulary of 10 million popular queries may achieve 60–80% hit rates.

Embedding caching stores intermediate representations from the model's embedding layers. This is valuable when inputs share substructure across different downstream queries: the same user's learned embedding, the same document's dense vector representation, or the same product's feature embedding. Rather than re-running the full model for each query, the pre-computed embedding is retrieved from cache and only the later stages (ranking, dot product scoring) are computed. Pinterest's embedding service and Airbnb's item embedding cache operate on this principle, pre-computing and caching dense embeddings for all items in the catalog and updating them on a scheduled basis.

Semantic caching extends prediction caching to semantically similar (not just exactly identical) inputs via approximate nearest neighbor lookup. For LLMs and embedding models, GPT Semantic Cache (Redis) and similar systems find cached responses to queries that are semantically similar to the current query and return them without running inference. Research published by Zhu et al. (2023) on semantic caching for LLM inference showed 68.8% reduction in API calls and up to 50% reduction in time-per-output-token. The technique applies particularly well to customer support chatbots, FAQ systems, and any application where users ask similar questions with different phrasing.

The critical failure mode after any model update: embedding cache invalidation. When a model is retrained and its weights change, all previously cached embeddings are stale - they were computed by the old model and are no longer valid inputs for the new model's subsequent computation stages. A serving system that serves old cached embeddings to a new model produces systematically wrong predictions without any error being raised, because the stale embeddings are valid tensor values - just wrong ones. Cache invalidation protocols must be built into the model deployment pipeline: before switching traffic to a new model, flush the embedding cache, or route cache misses to the new model while allowing old cache entries to expire naturally within a bounded time window.`,
  },
  {
    heading: 'Serving Frameworks - TensorRT, Triton, ONNX Runtime, TorchServe',
    body: `The serving framework determines how model artifacts are loaded, optimized at inference time, batched, and exposed via a serving API. Different frameworks make different trade-offs between portability, peak performance, operational complexity, and hardware vendor lock-in. The correct choice depends on the hardware fleet, the frameworks used for training, the performance requirements, and the team's operational capacity.

TensorRT (NVIDIA) produces the highest single-GPU inference throughput of any production serving option by applying aggressive hardware-specific optimizations that generic frameworks cannot perform. The two primary optimization techniques are kernel/layer fusion and kernel auto-tuning. Layer fusion combines sequential operations - Conv2D, BatchNormalization, and ReLU activation - into a single CUDA kernel rather than three separate kernels. Each unfused operation writes its intermediate output to GPU global memory, which other operations then read back - this memory round-trip creates latency that fusion eliminates by keeping intermediate values in fast on-chip registers. TensorRT's auto-tuning benchmarks hundreds of CUDA kernel implementations for each operation on the specific target GPU and selects the fastest one. The result is up to 40× speedup over CPU and up to 18× over unoptimized TensorFlow on the same GPU. The trade-off: TensorRT models must be re-compiled for each GPU architecture (A100 optimizations are not portable to T4), and the compilation process can take minutes for large models.

Triton Inference Server (NVIDIA) is the production-grade serving orchestrator that most teams should reach for as their default serving infrastructure. It is not a model optimizer like TensorRT - it is a serving system that supports multiple backends (TensorFlow, PyTorch, ONNX, TensorRT, Python custom backends) simultaneously in a single server. Triton's key serving-level features: concurrent model execution (multiple models loaded in parallel, each handling requests), model ensembles (chain multiple models in a pipeline as a single Triton endpoint), sequence batching for stateful models (RNNs, time-series models), and dynamic batching. TensorRT models running on Triton achieve TensorRT's optimization benefits with Triton's production operational features - this combination is the highest-performance configuration for NVIDIA GPU serving.

ONNX Runtime (Microsoft) prioritizes hardware portability over maximum single-hardware performance. It runs on NVIDIA GPUs, AMD GPUs (via ROCm), Intel CPUs with AVX-512, ARM processors, and edge devices. When deploying models across a heterogeneous fleet - cloud GPUs for peak traffic, ARM-based instances for baseline traffic, edge devices for offline use cases - ONNX Runtime's portability eliminates the need to maintain separate serving codebases for each hardware type. Performance on NVIDIA GPUs is lower than TensorRT (ONNX Runtime with TensorRT execution provider bridges this gap for NVIDIA-only workloads), but the cross-platform model format means the same .onnx file runs on any supported hardware without recompilation.

TorchServe (Meta) is the PyTorch ecosystem's native model server. Its primary advantages are tight PyTorch integration (no model export step required for most architectures) and Python-native custom handlers for models with complex pre/postprocessing logic. Baseline latency of 15–20ms for typical models. The operational simplicity of deploying directly from a PyTorch checkpoint without conversion to ONNX or TensorRT makes TorchServe appropriate for teams with moderate performance requirements and strong PyTorch investment, but it is increasingly superseded by Triton for teams that need maximum throughput.`,
  },
  {
    heading: 'GPU vs. CPU Serving - When GPU Is Actually Slower',
    body: `GPU serving dominates for large models at high concurrency because GPUs have massive parallel compute capacity (thousands of CUDA cores) and high memory bandwidth optimized for the matrix multiplications that dominate neural network inference. However, GPUs introduce fixed overhead that makes them slower than CPUs in specific scenarios that ML engineers frequently encounter in practice.

GPU kernel launch latency is the fixed overhead for initiating any GPU computation. Even a trivial matrix multiplication requires the CPU to schedule the GPU kernel, transfer the computation parameters to the GPU, and wait for the GPU to confirm receipt. This overhead is approximately 5–15 microseconds per kernel launch. For very small models at batch size 1, this kernel launch latency can exceed the actual computation time - a 5-layer MobileNetV2 at batch size 1 may take only 2ms to compute but incur 8ms of kernel launch and data transfer overhead. In such cases, a CPU implementation that avoids the data transfer round-trip is faster end-to-end.

CPU-to-GPU memory transfer is a separate overhead dimension. Before GPU computation can begin, input data must be transferred from CPU memory (where Python/Java application code runs) to GPU memory (where CUDA computation runs) over the PCIe bus. PCIe Gen4 achieves approximately 32 GB/s bandwidth in each direction. For large inputs (high-resolution images, long text sequences, large feature vectors), this transfer takes milliseconds. Pinterest found that CPU-to-GPU data copying was the dominant latency contributor for their recommendation model: each inference call was paying 10ms just for data transfer. The fix - batching hundreds of individual tensor transfers into a single contiguous buffer transfer before sending to the GPU - reduced this to sub-1ms. The lesson: PCIe bandwidth is the bottleneck, not GPU FLOPS.

NUMA (Non-Uniform Memory Access) architecture effects are an advanced but real latency contributor on multi-socket CPU systems. On servers with multiple CPU sockets, each socket has local memory banks that it accesses with low latency and remote memory banks it accesses via inter-socket links with 20–50% higher latency. If the ML serving process is scheduled on Socket 0 but its model weights are in Socket 1's memory, every model weight access incurs remote NUMA penalty. The fix is CPU affinity and memory binding via numactl: pin the serving process to a specific NUMA node and allocate model memory on the same node. Teams running high-throughput CPU inference on multi-socket servers routinely achieve 15–25% latency reduction from NUMA affinity alone.

The practical decision framework: use GPU serving when batch size exceeds 8, model parameter count exceeds 100M, or throughput requirements exceed 100 RPS with P99 < 200ms targets. Below these thresholds, benchmark CPU serving directly before assuming GPU is necessary. Many embedding models, lightweight classifiers, and small gradient-boosted ensemble models serve faster and more cost-effectively on CPU than on GPU once PCIe transfer overhead is accounted for.`,
  },
  {
    heading: 'Async vs. Synchronous Serving',
    body: `Synchronous serving means the client submits a request and blocks, waiting for the model prediction before proceeding. The connection is held open, the response is returned when inference completes, and the client's thread is blocked during inference. This is the correct pattern when the user experience or business logic is blocked on the model's output: fraud detection for payment authorization (the payment cannot proceed without the fraud decision), real-time recommendation rendering (the page cannot render without knowing which items to show), or medical diagnosis support (the physician is waiting for the prediction to inform their next question).

Asynchronous serving means the client submits a request and receives an acknowledgment (a job ID, a 202 Accepted response), then polls or receives a callback when the prediction is ready. The client thread is not blocked during inference. This is the correct pattern when the downstream action can proceed without an immediate prediction: content moderation (the content is posted immediately, moderation runs within minutes), email personalization (the email goes out tomorrow, models can run overnight), or recommendation pre-computation (user's homepage recommendations are pre-computed daily). Asynchronous serving dramatically improves throughput under high concurrency because threads are not held waiting for inference - a single thread can submit thousands of requests without blocking.

The common misconception is that async serving reduces latency. It does not - it increases per-request latency by adding queue wait time on top of inference time. A request that waits 500ms in a queue before 50ms inference has 550ms end-to-end latency, worse than a synchronous 50ms call. Async serving's latency benefit is resilience under overload: when a synchronous system reaches capacity, excess requests are immediately rejected (connection refused or 503). When an async system reaches capacity, excess requests wait in queue rather than failing - latency increases but requests still complete. The right question is not "is async faster?" but "can my users tolerate variable latency in exchange for higher reliability under load?"

Streaming token generation for LLMs represents a hybrid pattern that combines synchronous connection semantics with asynchronous delivery. The client opens a long-lived HTTP connection (streaming response) or WebSocket and receives tokens as they are generated, one at a time, rather than waiting for the full response. Total generation time is identical to a synchronous request, but the user perceives much lower latency because Time to First Token (TTFT) can be 200–500ms while Time to Last Token (TTLT) may be 10–30 seconds for long responses. TTFT is what users perceive as "speed" in conversational AI interfaces - seeing the first word appear within half a second feels responsive even if the full answer takes 15 seconds to complete. This pattern is supported by all major LLM serving frameworks (vLLM, TGI, Triton with streaming) and is essentially mandatory for any LLM chatbot user experience.`,
  },
  {
    heading: 'Latency Budget Design and SLA Setting',
    body: `Latency budgets are designed top-down from user experience requirements, not bottom-up from current infrastructure performance. Designing bottom-up means inheriting all existing inefficiencies as constraints and optimizing within them, which prevents the structural changes that produce large improvements. Designing top-down starts from "what does the user experience require?" and works backward to what each pipeline component must deliver.

A concrete top-down example for a customer-facing recommendation API with a 200ms end-to-end P99 SLA: network (client → gateway) 20ms, gateway authentication and request parsing 5ms, feature retrieval from online feature store 30ms, retrieval model (approximate nearest neighbor search over 1M items) 30ms, ranking model inference on top-100 candidates 50ms, postprocessing and business rules (deduplication, filter rules, A/B flag checking) 10ms, response serialization and network (gateway → client) 20ms, and buffer for variance events (GC pauses, cold starts, cache misses) 35ms. Total: 200ms. The buffer is not an afterthought - it is an explicit allocation for the tail events that make P99 different from P50. Setting no buffer means the system operates at the edge of the SLA under normal conditions and breaches it under any minor perturbation.

Latency budget propagation across service hops is the mechanism that enforces the budget operationally. When the gateway receives a request with a 200ms SLA, it sets a deadline header (gRPC deadline or a custom X-Request-Deadline header) in all downstream service calls. Each downstream service receives this header, computes how much of the budget remains, and either processes the request within the remaining budget or fails fast (returning a cached default value or error) if the remaining budget is insufficient to complete processing. Fail-fast behavior prevents a slow downstream service from causing the entire pipeline to breach SLA - without propagated deadlines, a feature store taking 150ms would cause the full pipeline to take 200ms+ just for feature retrieval, leaving no time for inference.

SLO setting requires load testing with realistic traffic patterns, not uniform synthetic load. Uniform load (a constant stream of requests at the target QPS) systematically underestimates real-world latency because real traffic is bursty: sudden spikes of 5–10× the baseline rate occur regularly in production. A system that meets P99 < 100ms at uniform 100 QPS may breach P99 = 500ms during a 500 QPS burst, because requests queue during the burst and the queue takes time to drain. Load tests should use realistic distributions: a Poisson arrival process with periodic burst multipliers derived from actual production traffic patterns. Meta found that models beyond 5 minutes old produce measurably lower engagement in their recommendation systems - this freshness constraint must be built into the latency budget at the feature retrieval stage, ensuring that feature store latency is budgeted conservatively enough that fresh features are always served.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'Your ML model benchmarks at 15ms inference time in isolation, but production P99 latency is 90ms. What are the likely contributors to this gap?',
    keyPoints: [
      'Network hops between microservices: each hop on the same VPC adds 1-5ms, compounding in multi-stage pipelines',
      'Queue wait time under load: when request rate approaches processing capacity, requests wait before inference begins',
      'Preprocessing latency: feature extraction, tokenization, normalization - often not included in "model inference" benchmarks',
      'Postprocessing and response serialization: business rule application, score formatting, JSON encoding',
      'Cold-start effects: model loading, JIT compilation, cache warming on first requests',
    ],
    trap: 'Assuming inference time is the same as serving latency. Benchmarks measure inference in isolation; production latency includes the full stack. Always measure end-to-end.',
  },
  {
    difficulty: 'mid',
    question: 'How would you build a latency benchmark for an ML serving system that accurately reflects production conditions?',
    keyPoints: [
      'Measure end-to-end from client perspective - not just model inference time in isolation',
      'Use realistic traffic patterns: bursty load (10× baseline spikes), not uniform synthetic load',
      'Capture P50, P95, and P99 - not just average latency. P99 is what SLAs and user experience are determined by',
      'Include all pipeline stages: feature retrieval, model inference, postprocessing, serialization',
      'Run under the same hardware and load profile as production - different CPU/GPU generations produce very different results',
    ],
  },
  {
    difficulty: 'junior',
    question: 'A recommendation system makes 50 parallel model scoring calls per user request. Why does P99 latency of individual calls matter more than P50?',
    keyPoints: [
      'The user\'s response waits for ALL 50 calls to complete - the slowest call determines user-perceived latency',
      'Probability of at least one call exceeding P99: 1 - (0.99)^50 ≈ 40% - nearly every other user request will hit a P99 tail event',
      'This is fan-out amplification: individual P99s compound, making user-visible latency higher than any single call\'s P99',
      'Google\'s finding: a service with P99=10ms produces ~140ms user-visible latency under real 100-way fan-out conditions',
    ],
    trap: 'Optimizing P50 (median) while ignoring P99. In fan-out architectures, the median is irrelevant - the slowest call wins.',
  },
  {
    difficulty: 'senior',
    question: 'You measure P99 = 50ms for your recommendation model in isolation. Under what fan-out conditions would users actually experience latency worse than 50ms on more than 50% of requests?',
    keyPoints: [
      'If the system fans out to N parallel calls, probability of at least one exceeding P99: 1 - (0.99)^N',
      'For N=70: 1 - (0.99)^70 ≈ 50% - at 70-way fan-out, half of all user requests will experience at least one 50ms+ call',
      'User-visible latency is the maximum across all parallel calls (serialized fan-in), so the user waits for that slowest call',
      'This means your effective user-facing P50 latency is approximately the same as your individual call P99 under sufficient fan-out',
    ],
  },
  {
    difficulty: 'junior',
    question: 'True or false: increasing batch size in ML serving always reduces latency. Explain.',
    keyPoints: [
      'False. Increasing batch size reduces cost-per-inference and improves throughput (better GPU utilization), but increases individual request latency',
      'Each request must wait for the batch to fill before inference begins - this adds queue delay proportional to batch size × inter-arrival time',
      'Larger batch = faster throughput (more inferences per second per dollar) but slower user-perceived latency (each user waits longer)',
      'Optimal batch size must be tuned per model, per hardware, and per traffic level - there is no universal "bigger is better"',
    ],
    trap: 'Saying larger batch is always better. This is true for throughput/cost optimization but false for latency-sensitive user-facing services.',
  },
  {
    difficulty: 'senior',
    question: 'Design a dynamic batching configuration for a ranking model that handles 100 RPS baseline with 10× burst peaks. What parameters would you tune and how?',
    keyPoints: [
      'max_batch_size: set based on GPU memory and throughput benchmarks - start at 32, test latency at each size under peak load',
      'max_queue_delay_microseconds: set to 90% of latency budget ÷ number of pipeline stages - bounds the maximum wait for batch fill',
      'At burst (1000 RPS): batches will fill quickly, latency stays near inference time. At baseline (100 RPS): batches may be small or size=1, latency stays low but throughput is underutilized',
      'Consider adaptive batch size: dynamically scale max batch size up under sustained high load, down under low load, based on queue depth monitoring',
    ],
  },
  {
    difficulty: 'mid',
    question: 'You apply INT8 quantization to a model and observe latency increased. What is the most likely cause and how do you fix it?',
    keyPoints: [
      'Most likely cause: the hardware lacks native INT8 compute support (no AVX-512 VNNI on CPU, no Tensor Cores on older GPUs)',
      'Without hardware-accelerated INT8, the runtime dequantizes weights to FP32 before computation - adding overhead rather than reducing it',
      'Fix: switch to FP16 quantization (more broadly supported), or use hardware that has native INT8 support (NVIDIA Turing/Ampere GPUs, Intel Cascade Lake CPUs)',
      'Always benchmark quantization on the actual target deployment hardware before assuming speedup',
    ],
    trap: 'Assuming quantization always speeds up inference regardless of hardware. INT8 benefits are hardware-dependent - verify support before applying.',
  },
  {
    difficulty: 'senior',
    question: 'Design a quantization strategy for a BERT-large model that must serve 500 RPS at P99 < 100ms on a single A100 GPU. What precision levels, calibration, and validation steps would you use?',
    keyPoints: [
      'Start with FP16: low risk, ~47% latency reduction, < 0.1% accuracy drop - often sufficient to meet SLA without complex calibration',
      'If FP16 is insufficient: INT8 via TensorRT post-training quantization with calibration dataset (1000+ representative examples from production traffic)',
      'Mixed precision: keep embedding layers and final classification layers in FP16, apply INT8 to middle transformer layers',
      'Validation: compare F1/accuracy on held-out test set, regression test on distribution of scores (not just average accuracy), check performance on edge-case segments',
      'Load test at 500 RPS before deploying - quantized models can behave differently under memory pressure than in single-request benchmarks',
    ],
  },
  {
    difficulty: 'junior',
    question: 'What is the difference between structured and unstructured pruning, and which one actually reduces GPU inference latency?',
    keyPoints: [
      'Structured pruning removes entire components (channels, filters, attention heads, layers) - produces a smaller dense model that runs faster on standard hardware',
      'Unstructured pruning sets individual weights to zero (sparse matrices) - memory efficient but does NOT reduce GPU latency without specialized sparse kernel support',
      'Standard GPU GEMM operations are not accelerated for sparse inputs - unstructured sparsity requires NVIDIA Ampere sparse tensor cores or custom sparse libraries',
      'For GPU latency reduction: use structured pruning (guaranteed speedup on all hardware) rather than unstructured pruning (requires specialized hardware)',
    ],
    trap: 'Saying any pruning reduces inference latency. Unstructured pruning typically does not reduce GPU latency without specialized hardware support.',
  },
  {
    difficulty: 'mid',
    question: 'Explain knowledge distillation. What does the student model do at inference time?',
    keyPoints: [
      'Distillation trains a smaller student model to match the soft output probability distributions of a larger teacher model',
      'The student learns "dark knowledge" from the teacher - the relative probabilities between classes encode information about similarities that hard labels do not',
      'At inference time: only the student model is deployed. The teacher is not used at inference - it was only used during the student\'s training',
      'Distillation is a training technique, not a deployment optimization - it produces a separate, smaller model; it does not compress or modify the teacher',
    ],
    trap: 'Saying both student and teacher are used at inference, or that distillation compresses the teacher. The teacher exists only during student training.',
  },
  {
    difficulty: 'junior',
    question: 'What are the three tiers of ML caching? When would each tier be appropriate?',
    keyPoints: [
      'Prediction caching: cache full model output keyed on exact input hash - works when inputs repeat exactly (search queries, templated requests, repeated user lookups)',
      'Embedding caching: cache intermediate model representations - works when inputs share substructure (same user profile, same document) across different downstream queries',
      'Feature caching: cache preprocessed feature vectors before model inference - eliminates preprocessing cost, works when features don\'t change frequently (user features updated hourly)',
      'Combine tiers for maximum coverage: feature cache reduces preprocessing cost, embedding cache reuses partial computation, prediction cache eliminates full inference for exact repeats',
    ],
  },
  {
    difficulty: 'senior',
    question: 'You retrain a recommendation model weekly. What cache invalidation strategy is required, and what latency impact should you expect during the transition?',
    keyPoints: [
      'Embedding cache must be invalidated on model update: old embedding vectors are incompatible with the new model\'s learned representation space',
      'Prediction cache can be partially preserved only if the new model is a minor update - major architectural changes require full cache flush',
      'Transition strategy: flush embedding and prediction caches before switching traffic to new model, or accept cache misses during warm-up by routing to new model with cold cache',
      'Latency spike at retraining: 0% cache hit rate immediately after cache flush causes all requests to pay full inference cost. Expect P99 to spike 2-5× for 15-60 minutes until cache re-warms at normal traffic patterns',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Compare TensorRT and ONNX Runtime. When would you choose each for production ML serving?',
    keyPoints: [
      'TensorRT: maximum performance on NVIDIA GPUs (layer fusion, kernel auto-tuning, hardware-specific optimizations), up to 18× faster than unoptimized TensorFlow. Choose when: NVIDIA GPU is guaranteed, maximum single-GPU throughput is the priority',
      'ONNX Runtime: cross-platform (NVIDIA, AMD, Intel, ARM, CPU, edge). Choose when: multi-cloud deployment, heterogeneous hardware fleet, or edge/CPU serving where GPU is not available',
      'ONNX Runtime with TensorRT execution provider: best of both worlds on NVIDIA hardware - cross-framework model format with TensorRT acceleration',
      'Operational trade-off: TensorRT requires re-optimization per GPU architecture; ONNX Runtime is architecture-agnostic',
    ],
  },
  {
    difficulty: 'junior',
    question: 'What is kernel fusion in TensorRT, and why does it reduce latency?',
    keyPoints: [
      'Kernel fusion combines multiple neural network operations (e.g., Conv → BatchNorm → ReLU) into a single GPU kernel execution',
      'Without fusion: each operation writes its output to global GPU memory and the next operation reads it back - global memory bandwidth becomes the bottleneck',
      'With fusion: intermediate results stay in fast GPU registers or L1 cache between operations - no global memory round-trips',
      'Result: significant latency reduction from eliminating memory bandwidth bottlenecks, especially for memory-bound (not compute-bound) models',
    ],
  },
  {
    difficulty: 'mid',
    question: 'Under what conditions can GPU serving be slower than CPU serving for ML inference?',
    keyPoints: [
      'Small models at batch size 1: GPU kernel launch latency and CPU-to-GPU memory transfer overhead dominate inference time for tiny models',
      'Example: MobileNetV2 at batch size 1 - 8ms on CPU vs 11ms on GPU including transfer overhead',
      'Models with highly irregular control flow (dynamic computation graphs, variable-length inputs) that cannot efficiently utilize GPU parallelism',
      'When GPU memory bandwidth is the bottleneck and the model is too small to amortize fixed GPU overhead: benchmark both before assuming GPU is faster',
    ],
    trap: 'Assuming GPU is always faster for ML. GPU dominates at large batch sizes and large models - at batch size 1 with small models, CPU is often competitive or faster.',
  },
  {
    difficulty: 'senior',
    question: 'Pinterest reduced GPU inference latency from 10ms to sub-1ms for memory transfer. What did they do and what does this teach about optimization priorities?',
    keyPoints: [
      'Pinterest batched hundreds of individual tensor transfers into a single contiguous buffer transfer before sending to GPU',
      'Original: hundreds of separate CPU→GPU memory copy calls, each with kernel launch overhead and PCIe transfer latency',
      'Optimized: a single large contiguous buffer copy - far more efficient on PCIe bandwidth and eliminates per-copy kernel overhead',
      'Lesson: the bottleneck was not compute (GPU FLOPS) but data movement (PCIe memory transfer). Optimizing data movement can outperform model optimization. Always profile before optimizing.',
    ],
  },
  {
    difficulty: 'junior',
    question: 'True or false: asynchronous ML serving always reduces latency for individual requests. Explain.',
    keyPoints: [
      'False. Async serving improves throughput and system resilience, but adds queue delay to individual requests',
      'A request waiting 200ms in an async queue before 50ms inference = 250ms total latency vs. 50ms synchronous call',
      'Async reduces latency only under overload conditions where synchronous serving would time out or drop requests - by smoothing the request stream',
      'Use async when: downstream action does not need immediate result (content moderation, batch scoring, email personalization). Use sync when: user is waiting (fraud scoring, real-time recommendations)',
    ],
    trap: 'Thinking async is always faster. Async trades per-request latency for improved throughput and resilience - it is not inherently lower latency.',
  },
  {
    difficulty: 'mid',
    question: 'For LLM chatbot serving, why is streaming token-by-token output considered a latency optimization even if total generation time is unchanged?',
    keyPoints: [
      'Users perceive Time To First Token (TTFT) as "speed" - a response that starts appearing in 200ms feels faster than one that appears all at once after 5 seconds',
      'Streaming reduces perceived latency without reducing actual compute time - it is a UX optimization, not a hardware optimization',
      'Non-streaming: user waits the full generation time before seeing any output - a 10-second wait for a long response is very poor UX',
      'Streaming: user sees tokens appearing progressively, can start reading while generation continues - dramatically improves perceived responsiveness and reduces abandonment',
    ],
  },
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
      'Network (client → gateway): 10ms - minimal, same datacenter or low-latency region',
      'Gateway + auth: 5ms - lightweight processing',
      'Feature retrieval (online feature store): 25ms - P99 budget, Redis or Cassandra lookup',
      'Retrieval model (ANN search, 1M items): 30ms - vector similarity search, HNSW index',
      'Ranking model inference (top 100 candidates): 40ms - transformer reranker on GPU',
      'Postprocessing + business rules: 10ms - deduplication, filter rules, A/B flag checking',
      'Response serialization + network back: 10ms',
      'Buffer for variance (GC, cache miss, cold start): 20ms',
      'Total: 150ms. Largest allocations justified by retrieval and ranking being the computation-intensive steps.',
    ],
  },
];

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
