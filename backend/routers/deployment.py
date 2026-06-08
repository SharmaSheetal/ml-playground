from fastapi import APIRouter

from models.deployment import (
    TrafficSplitRequest, TrafficSplitResponse,
    CanarySimRequest, CanarySimResponse,
    ShadowSimRequest, ShadowSimResponse,
    LatencyOptRequest, LatencyOptResponse,
)
from services.traffic_split  import simulate as ts_simulate
from services.canary_release import simulate as canary_simulate
from services.shadow_mode    import simulate as shadow_simulate
from services.latency_optimizer import compute as latency_compute

router = APIRouter()


@router.post("/traffic-split/simulate", response_model=TrafficSplitResponse)
def traffic_split_simulate(req: TrafficSplitRequest) -> TrafficSplitResponse:
    result = ts_simulate(
        v1_traffic       = req.v1_traffic,
        v1_degraded      = req.v1_degraded,
        v2_degraded      = req.v2_degraded,
        degradation_mode = req.degradation_mode,
        v1_profile       = req.v1_profile,
        v2_profile       = req.v2_profile,
        total_rps        = req.total_rps,
        ticks_v1         = req.ticks_v1,
        ticks_v2         = req.ticks_v2,
    )
    return TrafficSplitResponse(**result)


@router.post("/canary-release/simulate", response_model=CanarySimResponse)
def canary_release_simulate(req: CanarySimRequest) -> CanarySimResponse:
    result = canary_simulate(stage_pct=req.stage_pct, fault=req.fault)
    return CanarySimResponse(
        champion=result['champion'],
        canary=result['canary'],
        gates=result['gates'],
    )


@router.post("/shadow-mode/simulate", response_model=ShadowSimResponse)
def shadow_mode_simulate(req: ShadowSimRequest) -> ShadowSimResponse:
    result = shadow_simulate(mirror_pct=req.mirror_pct, fault=req.fault)
    return ShadowSimResponse(
        champion=result['champion'],
        shadow=result['shadow'],
        divergence=result['divergence'],
        gates=result['gates'],
    )


@router.post("/latency-optimizer/compute", response_model=LatencyOptResponse)
def latency_optimizer_compute(req: LatencyOptRequest) -> LatencyOptResponse:
    result = latency_compute(
        batch_size       = req.batch_size,
        quantization     = req.quantization,
        caching_enabled  = req.caching_enabled,
        cache_size_mb    = req.cache_size_mb,
        tensorrt_enabled = req.tensorrt_enabled,
        async_enabled    = req.async_enabled,
    )
    return LatencyOptResponse(**result)
