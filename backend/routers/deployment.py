from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def list_simulators() -> dict:
    return {
        "simulators": [
            "traffic-split",
            "canary-release",
            "shadow-mode",
            "latency-optimizer",
        ]
    }
