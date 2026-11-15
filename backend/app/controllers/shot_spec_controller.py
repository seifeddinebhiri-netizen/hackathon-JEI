from fastapi import Request

from app.schemas.shot_spec import ShotSpec, ShotSpecRequest
from app.services import shot_spec_service


async def create_shot_spec(body: ShotSpecRequest, request: Request) -> ShotSpec:
    return await shot_spec_service.create_shot_spec(request.app.state.llm, body)
