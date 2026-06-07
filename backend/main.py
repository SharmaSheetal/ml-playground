import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import deployment, monitoring, mlops, system_design, llm

load_dotenv()

app = FastAPI(title="ML Ops Playground API", version="0.1.0")

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(deployment.router, prefix="/api/deployment", tags=["deployment"])
app.include_router(monitoring.router, prefix="/api/monitoring", tags=["monitoring"])
app.include_router(mlops.router, prefix="/api/mlops", tags=["mlops"])
app.include_router(system_design.router, prefix="/api/system-design", tags=["system-design"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
