from fastapi import Depends, Request, Response

from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.services import passport_service


async def signed_pdf(
    project_id: str, request: Request, user: CurrentUser = Depends(get_current_user)
) -> Response:
    signed, filename = await passport_service.signed_pdf(
        request.app.state.db_pool, get_settings(), user, project_id
    )
    return Response(
        content=signed.data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "X-C2PA-Manifest-Id": signed.manifest_id or "",
            "X-C2PA-Simulated": "true" if signed.simulated else "false",
            "X-Signed-At": signed.signed_at.isoformat(),
            "Cache-Control": "no-store",
        },
    )
