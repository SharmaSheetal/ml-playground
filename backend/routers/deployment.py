from fastapi import APIRouter

from models.deployment import TrafficSplitRequest, TrafficSplitResponse
from services.traffic_split import simulate

router = APIRouter()


@router.post("/traffic-split/simulate", response_model=TrafficSplitResponse)
def traffic_split_simulate(req: TrafficSplitRequest) -> TrafficSplitResponse:
    result = simulate(
        v1_traffic       = req.v1_traffic,
        v1_degraded      = req.v1_degraded,
        v2_degraded      = req.v2_degraded,
        degradation_mode = req.degradation_mode,
        v1_profile       = req.v1_profile,
        v2_profile       = req.v2_profile,
        total_rps        = req.total_rps,
    )
    return TrafficSplitResponse(**result)
