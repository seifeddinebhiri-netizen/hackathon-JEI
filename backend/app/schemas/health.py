from typing import Literal

from pydantic import BaseModel


class LiveResponse(BaseModel):
    status: Literal["ok"]


class ReadyResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["up", "down", "not_configured"]
    supabase: Literal["configured", "not_configured"]
