from collections.abc import Iterable

from app.schemas.ai_tool import CORE_FIELDS, Fact, ToolStatus


def compute_status(facts: Iterable[Fact]) -> ToolStatus:
    """Statut calculé par des RÈGLES, jamais par l'IA.

    Seuls comptent les faits dont la phrase a été retrouvée dans la page par le serveur
    (`quote_verified`) ou confirmés par une personne qui a relu la source (`human_confirmed`).
    - documenté : le fournisseur répond, source à l'appui, aux trois questions de base
      (sur quoi il entraîne, ce qu'il fait de tes contenus, à qui appartiennent les sorties) ;
    - partiel : il répond à une partie ;
    - non divulgué : aucune réponse sourcée n'a été trouvée.
    « Documenté » ne veut jamais dire « légal » ni « sûr ».
    """
    answered = {f.field for f in facts if f.quote_verified or f.human_confirmed}
    count = sum(1 for field in CORE_FIELDS if field in answered)
    if count == len(CORE_FIELDS):
        return "documente"
    return "partiel" if count else "non_divulgue"
