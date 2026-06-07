from pydantic import BaseModel, Field


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
