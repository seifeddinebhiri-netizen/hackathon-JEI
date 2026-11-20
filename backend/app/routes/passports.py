from fastapi import APIRouter, Depends, Response

from app.controllers import passport_controller as c
from app.core.rate_limit import limit_passport_pdf

router = APIRouter(prefix="/passports", tags=["passports"])

# Le PDF est fabriqué ET signé par le serveur, à partir du Passeport enregistré : le navigateur ne
# fournit ni le contenu ni la signature, seulement l'identifiant du projet.
router.add_api_route(
    "/{project_id}/pdf",
    c.signed_pdf,
    methods=["POST"],
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
    dependencies=[Depends(limit_passport_pdf)],
)
