from pydantic import BaseModel


class AskRequest(BaseModel):
    prompt: str
    max_tokens: int = 512


class AskResponse(BaseModel):
    text: str
