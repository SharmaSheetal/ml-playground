from fastapi import APIRouter

router = APIRouter()


@router.get("/")
def list_simulators() -> dict:
    return {
        "simulators": [
            "recommender",
            "fraud-detection",
            "scalability",
            "precision-recall",
            "build-vs-buy",
        ]
    }
