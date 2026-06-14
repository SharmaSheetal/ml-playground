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
    body: `Scalability in ML systems is not a single dimension - it is three interlocking properties that must be managed simultaneously and that trade off against each other in non-obvious ways. Throughput is the number of requests the system can process per unit time (requests per second, or RPS). Latency is the time to complete a single request, measured at percentile levels - P50 for the typical case, P99 for the tail. Cost efficiency is the compute cost per unit of useful work (cost per 1,000 predictions, cost per user-day of recommendations). A system optimized for one dimension often regresses on the others: larger batch sizes improve throughput and reduce cost per request but add queuing latency; more GPU replicas increase throughput but scale costs linearly; model quantization reduces cost and latency but may degrade accuracy.

The fundamental cause of these tradeoffs is that GPUs are massively parallel processors designed for throughput, not latency. An NVIDIA A100 has 6,912 CUDA cores and delivers 312 TFLOPS of FP16 throughput - but only if you give it work commensurate with that parallelism. A single image classification request on a ResNet-50 uses perhaps 3% of the available CUDA cores, leaving 97% idle. The GPU finishes the request in 1 ms but is wildly underutilized. Processing a batch of 64 images simultaneously uses roughly the same wall-clock time (1.5 ms) but amortizes the GPU cost across 64 requests, achieving 40x better cost efficiency. This is why batching is the central mechanism for GPU cost efficiency, and why increasing batch size is always in tension with latency.

Practical scalability planning requires characterizing both the peak traffic load and the acceptable latency SLO before making any architectural decisions. A recommendation serving system with 50,000 RPS and a P99 SLO of 50 ms has different architectural implications than a batch feature engineering pipeline with 1 million records per hour and no latency requirement. The former needs a stateless horizontally scalable serving fleet with aggressive batching and feature caching; the latter needs a distributed processing framework like Spark or Flink optimized for throughput. Conflating these two profiles - trying to use a batch-oriented architecture for real-time serving, or over-engineering a real-time serving architecture for a batch pipeline - is one of the most common and expensive mistakes in ML infrastructure design.`,
  },
  {
    heading: 'Horizontal vs Vertical Scaling',
    body: `Vertical scaling means upgrading the machine running the model: more CPU cores, more RAM, a larger or newer GPU. It is the instinctive first response to a capacity problem because it requires no application code changes, but it has hard physical limits and serious operational risks. The largest generally available GPU as of 2025 is the NVIDIA H100 with 80 GB of HBM3 memory. A model that fits in 80 GB memory cannot be vertically scaled further - there is no bigger single GPU to move to. Vertical scaling also creates single points of failure: if the machine crashes, all traffic is dropped rather than redistributed. For latency-critical serving paths, this is usually unacceptable.

Horizontal scaling adds more instances running the same model rather than upgrading individual instances. This requires two design constraints: the serving code must be stateless (any replica can handle any request without shared mutable state), and a load balancer must distribute incoming requests across replicas. When both conditions are met, horizontal scaling has no hard upper bound - you can add replicas until you hit the load balancer's capacity, then replicate the load balancer itself. The cost scales linearly with throughput, which is predictable and budget-friendly. Kubernetes Horizontal Pod Autoscaler (HPA) automates this at the infrastructure level: it monitors specified metrics (CPU, memory, or custom metrics like GPU utilization or request queue depth) and adds or removes replica pods to maintain a target metric value. For ML serving specifically, custom metrics are almost always necessary because GPU inference can peg GPU utilization at 95% while CPU utilization remains at 10%, leaving HPA with CPU metrics to believe the system is idle.

Models that exceed the memory capacity of a single GPU introduce a third category: model parallelism. A 175-billion-parameter model like the original GPT-3 requires approximately 350 GB in FP16, which cannot fit on a single 80 GB H100. Tensor parallelism shards the weight matrices across multiple GPUs within a single node - each GPU holds a horizontal slice of each weight matrix, computes its slice of the output, and an all-reduce operation combines the results. This requires high-bandwidth interconnects (NVLink between GPUs in a node provides 600 GB/s; PCIe provides only 32 GB/s) to make the all-reduce communication efficient relative to the compute. Pipeline parallelism assigns entire transformer layers to different GPUs, with activations passed from one GPU to the next. This works across slower inter-node connections but adds pipeline bubble latency proportional to the number of pipeline stages. Production large-model deployments typically combine tensor parallelism within a node with pipeline parallelism across nodes.`,
  },
  {
    heading: 'Model Serving Frameworks',
    body: `The serving framework is the software layer between your trained model weights and the production traffic. It handles request batching, model loading, versioning, preprocessing, inference execution, and health checking. Choosing the wrong serving framework is one of the most expensive infrastructure mistakes in ML deployment - switching frameworks after the system is live requires significant re-engineering effort - so understanding the tradeoffs is critical before committing to a choice.

NVIDIA Triton Inference Server is the production standard for GPU inference at scale. It supports multiple model backends natively - PyTorch, TensorFlow, ONNX Runtime, TensorRT, and custom C++ or Python backends - which means heterogeneous model fleets can be managed from a single control plane. Triton's dynamic batching groups requests into batches server-side without any coordination required from clients, configurable via max batch size and maximum queue delay (the amount of time a request can wait for its batch to fill before being processed at a smaller batch size). Triton also supports concurrent model execution - multiple models can run simultaneously on the same GPU if memory permits - and provides GPU memory utilization, throughput, and latency metrics via Prometheus. Its main downside is that it requires model export to a supported format and has a steeper initial setup curve than pure Python frameworks.

TorchServe is the official PyTorch serving framework. Its handler-based architecture - a Python class with initialize, preprocess, inference, and postprocess methods - is familiar to PyTorch engineers and allows arbitrary custom preprocessing logic without fighting the framework. It supports model versioning, multiple models per server instance, and A/B testing at the serving layer. It is a good choice for PyTorch models with custom preprocessing requirements or dynamic input shapes that are awkward to express in TorchScript. Its throughput and GPU utilization metrics are less detailed than Triton's, and it is generally slower than Triton for high-throughput workloads with standard model types.

vLLM is purpose-built for large language model serving and should not be used for other model types. Its key innovation is PagedAttention, which manages the KV cache using a paged memory system inspired by virtual memory in operating systems. Standard LLM serving allocates a contiguous block of GPU memory for each request's KV cache at the beginning of the request, wasting memory on tokens not yet generated. PagedAttention allocates KV cache memory in fixed-size pages on demand, dramatically reducing memory waste and allowing the system to maintain 3-5x more concurrent sequences on the same GPU. Combined with continuous batching - where the scheduler fills GPU compute with new token generation steps from different sequences rather than waiting for a complete sequence to finish before starting the next - vLLM achieves near-theoretical GPU utilization for autoregressive generation workloads. Anyscale reported 23x throughput improvement over naive batching for certain LLM workloads with continuous batching.`,
  },
  {
    heading: 'Request Batching - Throughput vs Latency',
    body: `Request batching is the mechanism by which GPU utilization is lifted from the low single digits to 60-90%, and understanding it in depth is prerequisite to designing any GPU serving system. The core insight is that matrix multiplications - the dominant operation in neural network inference - are designed for parallelism at the batch dimension. Processing a batch of N examples takes only marginally more time than processing a single example, because the GPU's thousands of cores process all N examples simultaneously rather than sequentially. For a typical vision model like ResNet-50 on an NVIDIA T4, processing batch size 1 takes 3 ms and achieves 5% GPU utilization; processing batch size 64 takes 8 ms and achieves 85% GPU utilization. The throughput per ms improves by over 20x by batching 64 requests together, while the per-request latency increases from 3 ms to 8 ms - a 2.7x latency penalty for a 20x throughput gain.

Static batching, where the server waits until exactly N requests have arrived before processing them as a batch, is simple to implement but has two failure modes. During high traffic, the batch fills quickly and latency is low; but during low traffic, a request may sit waiting for its batch to fill long past any reasonable latency SLO. The most common implementation mitigation is a timeout: process the batch when either the batch is full or the oldest request has waited longer than the timeout. Triton and TorchServe both implement this as max_batch_size and max_queue_delay (or max_queue_delay_microseconds). Setting these correctly for a given traffic pattern requires profiling: a system with 1,000 RPS and max_batch_size 8 will fill batches in 8 ms on average, so a timeout of 5 ms would rarely trigger; a system with 100 RPS and max_batch_size 8 will take 80 ms to fill a batch and needs a shorter timeout (10-20 ms) to maintain latency SLOs.

Continuous batching, developed specifically for LLM serving in the vLLM and Orca projects, changes the unit of batching from request to generation step. In static batching for autoregressive LLMs, all sequences in a batch must complete before the next batch begins - a long sequence holds the GPU hostage while short sequences wait. Continuous batching allows new sequences to join the active batch at each generation step, replacing sequences that just finished. This eliminates the "stuck behind a long request" problem and achieves much higher throughput at the same latency for mixed short-and-long sequence workloads. Sequence length padding is another LLM-specific batching concern: to form a batch, all sequences must be the same length, so shorter sequences are padded with special tokens to match the longest sequence in the batch. Padding wastes compute proportional to the padding fraction. Sequence packing - concatenating multiple short sequences into a single long sequence with attention masks that prevent attention across sequence boundaries - eliminates padding waste but adds implementation complexity.`,
  },
  {
    heading: 'Caching Strategies for ML Serving',
    body: `Caching is one of the highest-leverage cost reduction and latency improvement strategies in ML serving because ML inference is expensive (requiring GPU compute and memory bandwidth) while cache lookups are cheap (requiring only a hash computation and a key-value store read). The challenge is identifying what to cache, at what granularity, and how to handle cache invalidation when models are updated or inputs change.

Prediction caching stores the model output for a given input in Redis or Memcached. A cache hit returns the stored prediction in under 1 ms with no GPU required; a cache miss triggers model inference and stores the result. Prediction caching is highly effective when input distributions are skewed - when a small number of inputs account for a large fraction of requests. For a search system, the top 1,000 queries might account for 30-40% of daily query volume; caching predictions for these queries eliminates 30-40% of inference cost immediately. The cache key must include not just the input but also the model version: a new model deployment must invalidate the cache for all inputs, or the serving system will return predictions from the old model for cached inputs. Using a composite cache key of (model_version, input_hash) ensures that model updates automatically invalidate all cached predictions. Cache eviction policy (LRU is standard) and TTL must be configured to match the prediction freshness requirements: a product recommendation for a query that changes slowly can be cached for hours; a news feed recommendation must be invalidated within minutes as new articles are published.

Embedding caching is appropriate for the retrieval stage of two-tower and similar models. Item embeddings are the output of the item tower of the model - they change only when the item tower is retrained, which happens daily or weekly in most systems. Rather than computing item embeddings on-demand at serving time, they are precomputed offline and stored in a vector index (FAISS, HNSW) for ANN retrieval. User embeddings are similarly cacheable: the user tower embedding changes as the user's interaction history changes, but not faster than the feature store is refreshed (typically hourly). Caching user embeddings in a local in-process cache with a 60-second TTL avoids recomputing them on every page load within a browsing session.

KV cache in LLMs is a fundamentally different type of cache that operates at the model internals level rather than the input-output level. Transformer models compute key and value tensors for each token in the input sequence during the attention mechanism. In autoregressive generation, the prompt tokens are processed once at the beginning, and their key-value tensors are needed again at every subsequent generation step. Without the KV cache, these tensors would be recomputed from scratch at every generation step, making generation cost scale quadratically with sequence length. The KV cache stores these computed key-value tensors and reuses them across generation steps. Managing KV cache memory efficiently is the central engineering challenge of LLM serving: the cache size for a single request is proportional to the sequence length, and a serving system handling hundreds of concurrent 4,096-token sequences needs tens of gigabytes of GPU memory just for KV cache. PagedAttention in vLLM addresses this by managing KV cache in fixed pages that can be allocated, reused, and reclaimed dynamically rather than requiring contiguous pre-allocated blocks per request.`,
  },
  {
    heading: 'GPU Fleet Management',
    body: `Managing a production GPU fleet for ML serving is a continuous optimization problem that spans hardware selection, multi-tenancy strategy, spot instance management, and cold-start mitigation. Getting GPU fleet management wrong means either paying 2-5x more than necessary for the same throughput or running the fleet at unsustainably low utilization that cannot absorb traffic spikes.

GPU type selection has massive cost implications. As of 2025, common inference GPU options span a 10x+ cost range: the NVIDIA T4 (16 GB GDDR6, $0.50-0.70/hour spot) is well-suited for medium-sized models and CPU-bounded preprocessing; the A10G (24 GB, $0.90-1.20/hour spot) offers better compute for larger models; the A100 (40 or 80 GB HBM2e, $2.50-4.00/hour spot) is the production standard for large models and high-throughput workloads; the H100 (80 GB HBM3, $3.50-5.50/hour spot) offers 2-3x better throughput than the A100 for large transformer models but at significantly higher cost. The right GPU is the cheapest one that fits the model in memory and meets the latency SLO at the required throughput. Running a 6 GB model on an 80 GB A100 is paying for 13x more GPU memory than needed. Benchmarking the model on multiple GPU types at the target batch size and concurrency is the only reliable way to select the right hardware - documentation FLOP counts do not translate directly to real-world inference throughput because inference is often memory-bandwidth-bound rather than compute-bound for mid-size models.

Multi-tenancy - running multiple models on the same GPU - is one of the most effective ways to improve GPU utilization for smaller models. A GPU running a single 6 GB classification model at 20% memory utilization and 15% compute utilization is running at a tiny fraction of its capacity. Triton's concurrent model execution feature allows multiple models to be loaded on the same GPU and execute simultaneously, sharing the GPU's compute and memory bandwidth. If three independent 6 GB models each receive traffic at 33% of a single GPU's capacity, running them on a single GPU instead of three separate GPUs reduces the fleet size by 3x. The constraint is memory: the sum of all model weights must fit within the GPU's HBM, with additional headroom for activation memory during inference.

Spot instances (AWS) or preemptible instances (GCP) provide the same hardware as on-demand instances at 60-80% discount in exchange for the possibility of interruption with 30-120 seconds of notice. They are acceptable for batch inference workloads (training, offline prediction scoring, feature computation) where the job can checkpoint and resume after an interruption. They are not suitable as the primary serving fleet for real-time inference, where an instance interruption removes capacity immediately and triggers a latency spike while auto-scaling adds replacements. The standard pattern is a base capacity of on-demand instances sized to handle 70-80% of expected peak traffic, with spot instances filling the remainder for cost efficiency. When spot instances are interrupted, the on-demand base absorbs the load at reduced headroom until replacement spot instances are provisioned.`,
  },
  {
    heading: 'Auto-scaling for Model Serving',
    body: `Auto-scaling for ML serving must navigate constraints that do not exist in typical web service auto-scaling. Model servers are not stateless compute services - each replica must load the model weights into GPU memory before serving traffic, a process that can take 30-300 seconds depending on model size. This cold-start latency means that scaling decisions must be made proactively rather than reactively: by the time a traffic spike is detected and scaling is triggered, the new replicas may still be loading their model weights while users experience degraded latency. Understanding this cold-start constraint is prerequisite to designing an effective auto-scaling strategy.

Kubernetes HPA is the standard auto-scaling mechanism for containerized model serving. Standard HPA uses CPU or memory utilization as the scaling metric, but neither is appropriate for GPU inference: GPU compute utilization can be 95% while CPU utilization is 5%, leading HPA to believe the system has plenty of capacity when it is actually saturated. Custom metrics are necessary: GPU utilization (via DCGM, NVIDIA's Data Center GPU Manager), request queue depth (number of requests waiting for a replica), or requests per second per replica. Queue depth is arguably the most direct measure of saturation - if requests are queuing, the system does not have enough serving capacity. Scaling up when queue depth exceeds 10 pending requests and scaling down when it drops below 2 pending requests for 5 consecutive minutes is a reasonable starting policy. KEDA (Kubernetes Event-Driven Autoscaler) extends HPA with native support for Kafka consumer lag, SQS queue length, and other external metrics, making it better suited for batch inference pipelines where the work queue is the natural scaling signal.

Scale-up and scale-down should be asymmetric. Scale-up should be aggressive: detect saturation early (queue depth growing), add replicas quickly, and accept some over-provisioning during the scaling window rather than letting latency spike. Scale-down should be conservative: wait 5-10 minutes of sustained low load before removing replicas to avoid oscillation - rapidly cycling replicas on and off wastes cold-start time and creates instability. Predictive auto-scaling for predictable traffic patterns (daily user activity peaks, weekly seasonality, scheduled batch jobs) pre-scales the fleet before the expected peak rather than reacting to it. A serving fleet that historically peaks at 10am on weekdays can be pre-scaled to peak capacity by 9:45am, eliminating the lag period where traffic is growing faster than the auto-scaler can add capacity.

The minimum replica floor is a critical configuration that is frequently set incorrectly. Setting minimum replicas to 0 (scale-to-zero) for a latency-sensitive serving system means that any period of zero traffic results in all instances being terminated. The first request after an idle period triggers a cold start that takes 30-300 seconds - a completely unacceptable user experience for an interactive serving endpoint. Scale-to-zero is appropriate only for internal tooling, development environments, or batch workloads with predictable start times. Production serving floors should be set to the number of replicas needed to handle 20-30% of expected peak traffic, ensuring there is always warm capacity available for the transition from quiet periods to normal traffic.`,
  },
  {
    heading: 'Load Testing and Capacity Planning',
    body: `The only reliable way to know a serving system's capacity limits is to test them explicitly, under realistic traffic conditions, before production traffic discovers them under the worst possible circumstances. Load testing for ML serving has specific requirements that differ from standard web service load testing: the request payload distributions, model input shapes, cache hit rates, and concurrent user patterns of a production ML service must all be faithfully simulated to produce meaningful results.

The four essential load test types for ML serving are baseline, ramp, spike, and soak. Baseline testing measures the system's behavior at 50% of expected peak load - this establishes the "healthy" operating point and identifies any issues with the current setup before you push to its limits. Ramp testing gradually increases load at a constant rate (for example, adding 100 RPS every 60 seconds) until P99 latency exceeds the SLO or error rate exceeds 0.1%. The load at which this occurs is the system's saturation point - the maximum throughput achievable while meeting SLOs. Spike testing injects a sudden 5-10x traffic increase in a single step. This tests auto-scaling response time, the behavior of circuit breakers, and whether graceful degradation (fallbacks, load shedding) activates correctly during the period before auto-scaling adds capacity. Soak testing maintains steady-state load at 80% of the saturation point for 24-72 hours. Memory leaks in model serving code, gradual cache eviction pattern changes, and connection pool exhaustion are examples of issues that only appear under sustained load and are missed by shorter tests.

Realistic traffic simulation is more important for ML serving than for typical web services because model inference cost and latency are input-shape-dependent. A text classification model that processes 50-word documents has very different latency than when processing 500-word documents; both sequence lengths appear in production. An image recognition model running inference on JPEG images of varying sizes has different batch formation dynamics depending on the image size distribution. Using production request logs (with sensitive data scrubbed) to generate realistic load test scenarios produces far more predictive results than generating synthetic uniform requests of constant size. Locust and k6 both support custom load generation from data files; Gatling's Scala DSL supports complex probabilistic request shape distributions.

Capacity planning translates load test results into infrastructure sizing decisions. The output of a load test is: system saturates at X RPS, with latency P99 of Y ms at X-20% RPS (leaving 20% headroom). Divide peak expected traffic by (X * 0.8) to get the number of replica sets needed. Multiply by 1.2 for headroom, round up to the nearest integer, and document this as the minimum fleet size at peak. Review the capacity plan quarterly as traffic grows and when major model changes are deployed, since a new model version can have significantly different inference latency and memory requirements than the previous version.`,
  },
  {
    heading: 'Tail Latency Optimization',
    body: `P99 latency in a production ML serving system is routinely 3-10x higher than P50 latency, and P999 can be 10-30x higher than P50. For a serving system with P50 latency of 10 ms, P99 at 80 ms and P999 at 200 ms is common if tail latency is not explicitly engineered for. Since user-facing applications are judged by the latency the worst-served users experience - not the median user - tail latency optimization is as important as median latency optimization, and it requires different techniques because the sources of tail latency are qualitatively different from the sources of median latency.

The sources of tail latency in ML serving span the entire stack. At the hardware level, NUMA (Non-Uniform Memory Access) effects add 20-50% latency when a serving process accesses memory on a different CPU socket than the one executing the thread. On multi-socket GPU servers, if the model is loaded in memory attached to socket 0 but inference runs on threads from socket 1, every memory access crosses the NUMA boundary at increased latency. The fix is pinning the serving process to the NUMA node containing the GPU: "numactl --membind=0 --cpunodebind=0" ensures that both the process's threads and its allocated memory reside on the same NUMA node. Thermal throttling is another hardware-level tail latency source: GPUs and CPUs reduce their clock frequency when they approach their thermal design limit. A data center at 80% cooling capacity in summer can produce intermittent throttling events that add 20-40% latency on affected requests. Monitoring GPU and CPU temperature alongside latency metrics makes this correlation visible.

At the software level, garbage collection pauses are a common source of latency spikes in JVM-based serving stacks (TensorFlow Serving uses C++, avoiding this, but Java-based API gateways and feature stores often do not). A GC pause of 50-100 ms is not unusual in a JVM with 8 GB heap using the default G1GC configuration, and it appears as a tail latency spike on any request that arrives during the pause. Tuning GC settings (ZGC for Java 11+, which achieves pauses under 1 ms at the cost of higher CPU overhead) or switching to a non-JVM feature store eliminates this class of tail latency. Queue head-of-line blocking occurs when a large or computationally expensive request monopolizes the inference server's GPU batch, blocking smaller requests that arrived later. Per-request timeouts at the model server level ensure that any single slow request does not hold up the entire queue indefinitely.

Hedged requests are the most aggressive tail latency mitigation technique. The serving client sends the same request to two different replicas simultaneously and uses the response from whichever replica responds first, canceling the second request. This effectively converts P99 latency to approximately P80 latency at the cost of 2x compute. Google's engineering blog documents hedged requests as a standard technique for latency-sensitive RPCs: sending the hedge after a delay equal to the 95th percentile expected response time (rather than immediately) limits the wasted compute to roughly 5% while still eliminating the worst tail latency outcomes.`,
  },
  {
    heading: 'Cost Optimization for ML Infrastructure',
    body: `ML infrastructure costs are dominated by GPU compute, which is expensive - a single A100 GPU costs $2-4/hour on-demand in AWS or GCP. A serving fleet of 50 A100 instances running 24/7 costs $900,000 to $1.75 million per year before data transfer and storage costs. At this cost level, every percentage point of GPU utilization improvement and every unnecessary instance eliminated translates to real dollars at the scale most engineering teams care about. Cost optimization is not a nice-to-have - it is an engineering discipline that directly determines the budget available for model development and infrastructure improvements.

Model compression is the highest-leverage single lever because it reduces both memory requirements (enabling smaller, cheaper GPUs) and inference compute (enabling higher throughput per GPU). Quantization converts FP32 weights (4 bytes per parameter) to FP16 (2 bytes) or INT8 (1 byte), with corresponding reductions in memory footprint and, for INT8, a 2-3x improvement in inference throughput on hardware with INT8 tensor cores (T4, A10G, A100). FP16 quantization carries essentially no accuracy risk for most production models; INT8 quantization requires careful calibration on a representative dataset to minimize accuracy degradation and typically results in under 1% degradation for vision and NLP models that are quantization-friendly. For a 7-billion-parameter model, INT8 quantization reduces memory from 28 GB (FP32) to 14 GB (FP16) to 7 GB (INT8), enabling the model to run on a single 16 GB T4 GPU instead of an 80 GB A100 - a 4-5x cost reduction per inference.

Knowledge distillation trains a smaller student model to mimic the output distribution of a larger teacher model, producing a model that is 5-10x smaller and 5-10x faster while retaining 90-95% of the teacher's accuracy. DistilBERT, distilled from BERT-base, is 40% smaller, 60% faster, and retains 97% of BERT's accuracy on downstream tasks. For production systems where model latency is the primary cost driver, distillation is more effective than quantization because it reduces model size proportionally in all dimensions (memory, compute, parameter count) rather than only reducing numerical precision.

Right-sizing and multi-tenancy improvements typically have a larger absolute dollar impact than model compression because they address utilization directly rather than model efficiency. A serving fleet running at 20% average GPU utilization is paying for 5x more compute than it needs. Measuring GPU utilization (via DCGM metrics exported to Prometheus) and identifying the utilization gap is the first step. Solutions include increasing batch size to improve per-GPU throughput, co-locating multiple small models on the same GPU (Triton concurrent model execution), right-sizing to a smaller GPU tier, and implementing a prediction cache to eliminate redundant inference for repeated inputs. A prediction cache on a recommender with 30% repeat-query rate effectively reduces inference cost by 30% with no model changes and no latency penalty on cache-hit requests.`,
  },
];

export const INTERVIEW_QA: InterviewQ[] = [
  {
    difficulty: 'junior',
    question: 'What is the difference between horizontal and vertical scaling in ML serving?',
    keyPoints: [
      'Vertical: upgrade the server (larger GPU, more memory) - simple, limited by hardware ceiling',
      'Horizontal: add more servers - requires stateless serving and load balancer, no hard upper limit',
      'Horizontal is standard for production ML - it allows cost-linear scaling and eliminates single points of failure',
      'For models larger than single GPU memory, tensor/pipeline parallelism is required',
    ],
    trap: 'Assuming vertical scaling is always simpler - for models that already use the largest available GPU, vertical scaling is impossible.',
  },
  {
    difficulty: 'junior',
    question: 'What is dynamic batching and why does it matter for GPU efficiency?',
    keyPoints: [
      'Dynamic batching: group multiple requests together and process them as a single GPU operation',
      'GPUs achieve peak efficiency when processing large batches - single requests waste most GPU capacity',
      'Trade-off: larger batches improve throughput but add queuing latency per request',
      'Max batch size and timeout are the key configuration parameters',
    ],
    trap: 'Setting max batch size very high without accounting for tail latency - a request may wait 100ms for a batch to fill, which is unacceptable for interactive serving.',
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
    trap: 'Applying INT8 quantization to any model without calibration - quantization without proper calibration on representative data can cause significant accuracy degradation.',
  },
  {
    difficulty: 'junior',
    question: 'What types of caching are useful for ML model serving?',
    keyPoints: [
      'Prediction cache: store (input, output) pairs - serves repeated queries at sub-millisecond latency',
      'Embedding cache: store pre-computed embeddings to avoid recomputing them per request',
      'KV cache (LLMs): cache attention key-value tensors to avoid recomputing the prompt at each token step',
      'Cache invalidation: clear cache when model is updated - stale predictions from old model version',
    ],
    trap: 'Caching predictions without including model version in the cache key - model updates silently serve stale predictions to users.',
  },
  {
    difficulty: 'mid',
    question: 'How do you auto-scale a model serving system in Kubernetes?',
    keyPoints: [
      'HPA (Horizontal Pod Autoscaler): scales pods based on CPU, memory, or custom metrics',
      'Custom metrics better than CPU: GPU utilization, request queue depth, RPS per replica',
      'Scale up aggressively, scale down slowly - 5-10 minute cooldown prevents oscillation',
      'KEDA for event-driven scaling (Kafka queue depth, SQS length) for async batch inference',
      'Pre-scale for predicted traffic peaks rather than reacting to them',
    ],
    trap: 'Using CPU utilization as the auto-scaling metric for GPU inference - the GPU can be at 100% while CPU is at 10%, causing HPA to think capacity is fine when it is not.',
  },
  {
    difficulty: 'mid',
    question: 'How would you load test a model serving endpoint?',
    keyPoints: [
      'Baseline: measure P50/P95/P99 at 50% expected peak to establish normal performance',
      'Ramp test: gradually increase load until P99 exceeds SLO - this is your saturation point',
      'Spike test: sudden 10× traffic - measures auto-scaling response and resilience',
      'Soak test: 24-hour sustained load at 80% saturation - reveals memory leaks',
      'Use realistic request payloads from production logs, not synthetic uniform requests',
    ],
    trap: 'Only running a short ramp test and missing the 24-hour soak - memory leaks and gradual degradation only appear in long-duration tests.',
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
    trap: 'Using hedged requests for all endpoints - the 2× compute cost is only justified for latency-critical paths where P99 directly impacts user experience.',
  },
  {
    difficulty: 'mid',
    question: 'How do you right-size GPU instances for a model serving workload?',
    keyPoints: [
      'Measure actual GPU memory utilization - if using 6GB of a 40GB A100, move to a 16GB T4',
      'Measure compute utilization - if at 20% GPU compute, you are over-provisioned or need dynamic batching',
      'GPU cost vs inference latency: larger GPU has faster inference but costs more - compare cost per successful request at SLO',
      'Benchmark the model on multiple GPU types at your target batch size and concurrency',
      'Factor in memory bandwidth, not just TFLOPS - transformer models are often memory-bandwidth-bound',
    ],
    trap: 'Choosing the largest GPU by default - right-sizing requires benchmarking on the specific model and workload, not picking the fastest hardware.',
  },
  {
    difficulty: 'mid',
    question: 'Compare TorchServe, Triton Inference Server, and vLLM. When do you use each?',
    keyPoints: [
      'TorchServe: PyTorch-native, flexible custom handlers, good for PyTorch models with custom preprocessing',
      'Triton: multi-backend (PyTorch, TF, ONNX, TensorRT), dynamic batching, concurrent execution, GPU metrics - production standard at scale',
      'vLLM: LLM-specific, PagedAttention for KV cache efficiency, near-theoretical GPU utilization for autoregressive generation',
      'TorchServe for simple PyTorch deployment; Triton for high-throughput production at scale; vLLM for LLM serving',
    ],
    trap: 'Using vLLM for non-LLM models - vLLM is designed specifically for autoregressive text generation and provides no benefit for other model types.',
  },
  {
    difficulty: 'senior',
    question: 'Design a model serving infrastructure that can handle 100k RPS for a recommendation model with P99 < 50ms.',
    keyPoints: [
      'Stateless serving: each request is fully self-contained, no shared state between replicas',
      'Feature store: Redis Cluster for online features with P99 < 3ms',
      'Model: XGBoost on CPU (1–2ms) or small DNN on GPU with dynamic batching',
      'Prediction cache: Redis for top-k popular requests - 30–40% cache hit rate reduces GPU load significantly',
      'Horizontal scaling: auto-scale based on queue depth, target 60% GPU utilization headroom',
      'CDN for static responses (popular item embeddings), connection pooling for feature store',
    ],
    trap: 'Proposing a single model server without horizontal scaling - 100k RPS requires a distributed fleet, not a single high-spec machine.',
  },
  {
    difficulty: 'senior',
    question: 'How do you reduce model serving cost by 50% without degrading latency SLOs?',
    keyPoints: [
      'Quantize to INT8 - reduces GPU memory 4×, increases throughput 2–3×, lower cost per request',
      'Increase batch size - better GPU utilization, lower cost per inference at same throughput',
      'Right-size instances - benchmark on smaller GPU types (T4 vs A100), often 60–70% cost reduction',
      'Spot/preemptible for non-latency-sensitive portions - 60–80% cheaper',
      'Prediction caching for high-repeat-rate requests - cached requests cost ~0 compute',
    ],
    trap: 'Only focusing on quantization - model compression alone rarely achieves 50% cost reduction; infrastructure right-sizing and caching are often larger levers.',
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
    trap: 'Expecting auto-scaling to fully handle a sudden 10× spike - scaling takes 2–5 minutes minimum; the system must have graceful degradation during the scaling window.',
  },
  {
    difficulty: 'senior',
    question: 'How do you implement model parallelism for a model too large to fit on a single GPU?',
    keyPoints: [
      'Tensor parallelism: split weight matrices across GPUs, each GPU computes a subset of the output, all-reduce to combine - requires high-bandwidth interconnect (NVLink)',
      'Pipeline parallelism: split transformer layers across GPUs, request flows through GPU pipeline stages - adds pipeline latency',
      'Combination: tensor parallelism within a node (fast NVLink), pipeline parallelism across nodes (slower inter-node)',
      'Frameworks: Megatron-LM, DeepSpeed, vLLM with tensor parallelism built in',
      'Trade-off: more GPUs = more parallelism = lower per-request latency, but all-reduce communication is an overhead',
    ],
    trap: 'Using pipeline parallelism alone for interactive serving - pipeline parallelism adds pipeline bubble latency and is more suited for batch inference than real-time serving.',
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
    trap: 'Scaling to zero replicas for a latency-sensitive service - cold start latency makes scale-to-zero unsuitable for interactive serving.',
  },
  {
    difficulty: 'mid',
    question: 'How do you monitor a model serving system in production?',
    keyPoints: [
      'Infrastructure: GPU utilization, GPU memory, CPU, P50/P95/P99 request latency, error rate, throughput',
      'Batching efficiency: average batch size, batch fill rate - low fill rate wastes GPU capacity',
      'Queue depth: requests waiting for a replica - rising queue depth is the first signal of saturation',
      'Model quality: prediction distribution, output range, null response rate',
      'Cost metrics: cost per 1000 requests, GPU-hours per day, cache hit rate',
    ],
    trap: 'Only monitoring request latency without monitoring GPU utilization and queue depth - latency problems often start as queue saturation before becoming latency SLO violations.',
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
    trap: 'Designing for nominal load only - graceful degradation must be designed from the start, not added as an afterthought during an incident.',
  },
  {
    difficulty: 'mid',
    question: 'What is NUMA and how can it affect ML inference latency?',
    keyPoints: [
      'NUMA (Non-Uniform Memory Access): multi-CPU servers have multiple memory banks; accessing memory attached to another CPU socket has higher latency',
      'If a model is loaded in one NUMA node\'s memory but inference runs on threads from another NUMA node, memory latency doubles',
      'Fix: pin model serving processes to NUMA node containing the model memory (numactl --membind --cpunodebind)',
      'On GPU servers: NUMA effects apply between CPU and GPU - ensure GPU is on the same PCIe root complex as the CPU handling inference',
    ],
    trap: 'Ignoring NUMA on multi-socket servers - NUMA effects can add 20–50% latency that is invisible from GPU metrics alone.',
  },
];
