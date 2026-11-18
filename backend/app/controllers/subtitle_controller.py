from typing import Annotated

from fastapi import File, Form, Path, Request, UploadFile

from app.core.config import get_settings
from app.schemas.subtitle import SubtitleDraft, SubtitleSaveRequest
from app.services import subtitle_service

ProjectId = Annotated[str, Path(min_length=1, max_length=100, pattern=r"^[A-Za-z0-9_-]+$")]


def _split(value: str | None) -> list[str]:
    """« Amira, Nour , Sidi Bou Saïd » → ["Amira", "Nour", "Sidi Bou Saïd"]."""
    return [v.strip() for v in (value or "").split(",") if v.strip()]


async def create_draft(
    project_id: ProjectId,
    request: Request,
    file: Annotated[UploadFile, File(description="Audio ou vidéo du film")],
    language_code: Annotated[str | None, Form(max_length=8)] = None,
    keyterms: Annotated[str | None, Form(max_length=5000)] = None,
    characters: Annotated[str | None, Form(max_length=2000)] = None,
) -> SubtitleDraft:
    """POST /subtitles/{project_id}/draft : transcription + traduction → brouillon à relire."""
    state = request.app.state
    return await subtitle_service.create_draft(
        state.db_pool,
        state.transcriber,
        state.translator,
        project_id,
        file,
        get_settings().subtitle_max_upload_mb,
        language_code=(language_code or "").strip() or None,
        keyterms=_split(keyterms),
        characters=_split(characters),
    )


async def get_draft(project_id: ProjectId, request: Request) -> SubtitleDraft:
    return await subtitle_service.get_draft(request.app.state.db_pool, project_id)


async def save_subtitles(
    project_id: ProjectId, body: SubtitleSaveRequest, request: Request
) -> SubtitleDraft:
    return await subtitle_service.save_lines(request.app.state.db_pool, project_id, body.lines)
