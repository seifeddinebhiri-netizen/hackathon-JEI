import hashlib
import json

from app.schemas.passport import Declaration


def passport_fingerprint(film_title: str, director: str, declarations: list[Declaration]) -> str:
    """Empreinte SHA-256 du contenu du Passeport (titre, réalisation, déclarations). Écrite dans la
    signature du PDF : on peut ensuite dire si le Passeport a changé depuis l'émission, même d'un mot."""
    canonical = json.dumps(
        {
            "film_title": film_title,
            "director": director,
            "declarations": [d.model_dump() for d in declarations],
        },
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
