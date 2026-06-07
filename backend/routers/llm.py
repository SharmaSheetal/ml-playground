import os

import httpx
from fastapi import APIRouter, HTTPException

from models.llm import AskRequest, AskResponse

router = APIRouter()

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
_MODEL = "llama-3.1-8b-instant"


@router.post("/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="LLM not configured on server")

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            _GROQ_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json={
                "model": _MODEL,
                "max_tokens": req.max_tokens,
                "messages": [{"role": "user", "content": req.prompt}],
            },
        )

    if not res.is_success:
        raise HTTPException(status_code=502, detail="Upstream LLM error")

    data = res.json()
    return AskResponse(text=data["choices"][0]["message"]["content"])
