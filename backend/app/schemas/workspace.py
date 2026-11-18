from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field, StringConstraints

MAX_WORKSPACES = 12
MAX_DATA_BYTES = 256_000  # un espace (scène + plan + sources) pèse quelques dizaines de Ko

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]


class WorkspaceIn(BaseModel):
    name: Name
    # { request, spec, overrides, notes } : le front le valide à la lecture.
    data: dict[str, Any]
    # Version sur laquelle la modification est fondée ; None pour créer l'espace.
    base_version: int | None = Field(default=None, ge=1)


class WorkspaceOut(BaseModel):
    id: str
    name: str
    data: dict[str, Any]
    version: int
    created_at: datetime
    updated_at: datetime
