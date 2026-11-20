from fastapi import File, Request, UploadFile

from app.core.config import get_settings
from app.schemas.verify import PdfVerification
from app.services import verify_service


async def verify_pdf(request: Request, file: UploadFile = File(...)) -> PdfVerification:  # noqa: B008
    settings = get_settings()
    data = await verify_service.read_upload(file, settings.verify_pdf_max_mb * 1024 * 1024)
    return await verify_service.verify_uploaded_pdf(request.app.state.db_pool, settings, data)
