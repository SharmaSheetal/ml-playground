import random

BASELINE_P50  = 150.0
BASELINE_P99  = 450.0
BASELINE_TPUT = 80.0
BASELINE_MEM  = 4200.0
BASELINE_COST = 1.20

BATCH_LATENCY_MUL = {1: 1.0, 2: 1.08, 4: 1.18, 8: 1.40, 16: 1.70, 32: 2.10}
BATCH_TPUT_MUL    = {1: 1.0, 2: 1.8,  4: 3.2,  8: 5.5,  16: 8.0,  32: 11.0}


def _jitter(v: float, pct: float = 0.05) -> float:
    return round(v * (1 + (random.random() * 2 - 1) * pct), 1)


def compute(
    batch_size:       int  = 1,
    quantization:     str  = 'fp32',
    caching_enabled:  bool = False,
    cache_size_mb:    int  = 256,
    tensorrt_enabled: bool = False,
    async_enabled:    bool = False,
) -> dict:
    p50  = BASELINE_P50
    p99  = BASELINE_P99
    tput = BASELINE_TPUT
    mem  = BASELINE_MEM
    cost = BASELINE_COST
    cache_hit_rate = 0.0

    # Quantization
    if quantization == 'fp16':
        p50  *= 0.58; p99  *= 0.58
        tput *= 1.7;  mem  *= 0.5; cost *= 0.58
    elif quantization == 'int8':
        p50  *= 0.38; p99  *= 0.38
        tput *= 2.6;  mem  *= 0.25; cost *= 0.38

    # TensorRT
    if tensorrt_enabled:
        p50  *= 0.72
        p99  *= 0.72
        tput *= 1.4

    # Dynamic batching
    blat = BATCH_LATENCY_MUL.get(batch_size, 1.0)
    btpt = BATCH_TPUT_MUL.get(batch_size, 1.0)
    p50  *= blat
    p99  *= blat * 1.05
    tput *= btpt / batch_size

    # Caching
    if caching_enabled:
        hit_rate = min(85.0, 20.0 + (cache_size_mb / 512) * 40)
        cache_hit_rate = hit_rate
        miss_p50 = p50
        p50  = (hit_rate / 100) * 1.0 + ((100 - hit_rate) / 100) * miss_p50
        p99  = p99 * (1 - hit_rate / 200)
        tput *= 1 + (hit_rate / 100) * 3
        cost *= 1 - (hit_rate / 100) * 0.6

    # Async serving
    if async_enabled:
        tput *= 1.35
        cost *= 0.88
        p99  *= 1.08

    p50  = max(1.0, p50)
    p99  = max(1.0, p99)
    p95  = p50 + (p99 - p50) * 0.55

    return {
        'p50':            _jitter(p50),
        'p95':            _jitter(max(1.0, p95)),
        'p99':            _jitter(p99),
        'throughput':     max(1, round(_jitter(tput, 0.03))),
        'cost_per_1k':    round(max(0.01, _jitter(cost, 0.04)), 3),
        'memory_mb':      max(1, round(_jitter(mem, 0.02))),
        'cache_hit_rate': round(cache_hit_rate, 1),
    }
