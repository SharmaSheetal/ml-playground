from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def list_simulators() -> dict:
    return {
        "simulators": [
            "skew-detector",
            "retraining-trigger",
            "feature-store",
            "cicd-pipeline",
        ]
    }
