from fastapi import APIRouter

from app.controllers import subtitle_controller
from app.schemas.subtitle import SubtitleDraft

router = APIRouter(prefix="/subtitles", tags=["subtitles"])

# response_model_exclude_none : le front attend `note` / `en` absents plutôt que null.
router.add_api_route(
    "/{project_id}/draft",
    subtitle_controller.create_draft,
    methods=["POST"],
    response_model=SubtitleDraft,
    response_model_exclude_none=True,
)
router.add_api_route(
    "/{project_id}",
    subtitle_controller.get_draft,
    methods=["GET"],
    response_model=SubtitleDraft,
    response_model_exclude_none=True,
)
router.add_api_route(
    "/{project_id}",
    subtitle_controller.save_subtitles,
    methods=["PUT"],
    response_model=SubtitleDraft,
    response_model_exclude_none=True,
)
