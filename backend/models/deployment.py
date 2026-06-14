from pydantic import BaseModel, Field


# ── Traffic Split ─────────────────────────────────────────────────────────────

class VersionProfile(BaseModel):
    p50:        float = 44
    p99:        float = 245
    error_rate: float = 0.2


class TrafficSplitRequest(BaseModel):
    v1_traffic:       int = Field(..., ge=0, le=100)
    v1_degraded:      bool = False
    v2_degraded:      bool = False
    degradation_mode: str  = 'latency'
    v1_profile:       VersionProfile = Field(default_factory=VersionProfile)
    v2_profile:       VersionProfile = Field(default_factory=VersionProfile)
    total_rps:        int = 1000
    ticks_v1:         int = 0
    ticks_v2:         int = 0


class VersionSnapshot(BaseModel):
    p50:        float
    p95:        float
    p99:        float
    error_rate: float
    rps:        int
    status:     str


class TrafficSplitResponse(BaseModel):
    v1: VersionSnapshot
    v2: VersionSnapshot


# ── Canary Release ────────────────────────────────────────────────────────────

class CanarySimRequest(BaseModel):
    stage_pct: int  = Field(..., ge=0, le=100)
    fault:     str  = 'none'   # none | latency | errors | drift


class CanaryMetrics(BaseModel):
    p99:        float
    error_rate: float
    psi:        float


class CanaryGates(BaseModel):
    p99:        str   # pass | fail
    error_rate: str
    psi:        str


class CanarySimResponse(BaseModel):
    champion: CanaryMetrics
    canary:   CanaryMetrics
    gates:    CanaryGates


# ── Shadow Mode ───────────────────────────────────────────────────────────────

class ShadowSimRequest(BaseModel):
    mirror_pct: int = Field(..., ge=5, le=100)
    fault:      str = 'none'   # none | latency | divergence | errors


class ChampionSnapshot(BaseModel):
    p99:        float
    error_rate: float
    rps:        int


class ShadowSnapshot(BaseModel):
    p99:        float
    error_rate: float
    rps:        int


class DivergenceSnapshot(BaseModel):
    exact_match: float   # %
    delta_p95:   float
    ndcg:        float


class ShadowGates(BaseModel):
    latency:    str   # pass | fail
    errors:     str
    divergence: str
    ndcg:       str


class ShadowSimResponse(BaseModel):
    champion:   ChampionSnapshot
    shadow:     ShadowSnapshot
    divergence: DivergenceSnapshot
    gates:      ShadowGates


# ── Latency Optimizer ─────────────────────────────────────────────────────────

class LatencyOptRequest(BaseModel):
    batch_size:      int   = Field(1, ge=1, le=32)
    quantization:    str   = 'fp32'   # fp32 | fp16 | int8
    caching_enabled: bool  = False
    cache_size_mb:   int   = Field(256, ge=64, le=4096)
    tensorrt_enabled: bool = False
    async_enabled:   bool  = False


class LatencyOptResponse(BaseModel):
    p50:            float
    p95:            float
    p99:            float
    throughput:     int
    cost_per_1k:    float
    memory_mb:      int
    cache_hit_rate: float
