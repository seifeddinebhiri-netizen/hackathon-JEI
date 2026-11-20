from fastapi import APIRouter, Depends

from app.controllers import verify_controller as c
from app.core.rate_limit import limit_verify_pdf
from app.schemas.verify import PdfVerification

router = APIRouter(prefix="/verify", tags=["verify"])

# PUBLIC (un festival n'a pas de compte). Le PDF est lu puis oublié : rien n'est écrit, ni fichier ni base.
router.add_api_route(
    "/pdf",
    c.verify_pdf,
    methods=["POST"],
    response_model=PdfVerification,
    dependencies=[Depends(limit_verify_pdf)],
)
