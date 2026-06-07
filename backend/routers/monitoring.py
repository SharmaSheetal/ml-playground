from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def list_simulators() -> dict:
    return {
        "simulators": [
            "drift-injector",
            "metrics-dashboard",
            "alert-threshold",
            "ab-significance",
            "feedback-loop",
        ]
    }
