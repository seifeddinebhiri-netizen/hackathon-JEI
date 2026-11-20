import io
import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import c2pa
import structlog

from app.core.config import Settings
from app.schemas.ai_tool import Tool
from app.schemas.passport import DISCLAIMER_FR, PassportDocument
from app.services.passport_fingerprint import passport_fingerprint

log = structlog.get_logger()

PDF = "application/pdf"
ASSERTION_LABEL = "org.premierplan.ai-passport"  # assertion personnalisée (nom de domaine inversé)
DIGITAL_CREATION = "http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation"
GENERATOR = {"name": "Premier Plan", "version": "0.1"}
UNTRUSTED = "signingCredential.untrusted"


class C2paNotConfigured(Exception):
    """Certificat ou clé absents : on ne signe pas, et on ne fait pas semblant de signer."""


class C2paSigningFailed(Exception):
    pass


@dataclass(frozen=True)
class SignedPdf:
    data: bytes
    manifest_id: str | None
    signed_at: datetime
    simulated: bool  # true : signature de TEST (certificat hors liste de confiance)


@dataclass
class Verification:
    # none : pas de signature C2PA ; invalid : fichier modifié ou signature cassée ;
    # valid : intact mais signataire inconnu de nous ; trusted : intact et signataire de confiance
    state: str
    signer: str | None = None
    issuer: str | None = None
    manifest_id: str | None = None
    cert_serial: str | None = None  # numéro de série du certificat de signature (décimal)
    claims: dict = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)

    @property
    def intact(self) -> bool:
        return self.state in ("valid", "trusted")


_ALGS = {
    a: getattr(c2pa.C2paSigningAlg, a)
    for a in ("ES256", "ES384", "ES512", "PS256", "PS384", "PS512", "ED25519")
}


def _read(path: str, what: str) -> bytes:
    if not path:
        raise C2paNotConfigured(f"{what} non configuré (voir C2PA_* dans .env).")
    file = Path(path)
    if not file.is_file():
        raise C2paNotConfigured(f"{what} introuvable : {path}")
    return file.read_bytes()


def load_signer(settings: Settings) -> c2pa.Signer:
    """Signataire fabriqué depuis la configuration. Pour une clé gardée dans un coffre (KMS, HSM) qui ne
    sort jamais du coffre, remplacer ce seul bloc par `c2pa.Signer.from_callback` (voir docs/C2PA.md)."""
    alg = _ALGS.get(settings.c2pa_signing_alg.upper())
    if alg is None:
        raise C2paNotConfigured(f"Algorithme C2PA inconnu : {settings.c2pa_signing_alg}")
    chain = _read(settings.c2pa_cert_chain_path, "Certificat de signature")
    key = _read(settings.c2pa_private_key_path, "Clé privée")
    tsa = settings.c2pa_tsa_url or None
    try:
        return c2pa.Signer.from_info(c2pa.C2paSignerInfo(alg, chain, key, tsa))
    except Exception as exc:
        raise C2paNotConfigured(f"Certificat ou clé refusés : {type(exc).__name__}") from exc


def _manifest(doc: PassportDocument, tools: dict[str, Tool], simulated: bool) -> dict:
    declared = {d.tool_slug for d in doc.declarations if d.used_ai and d.tool_slug}
    return {
        "claim_generator_info": [GENERATOR],
        "title": f"Passeport IA — {doc.film_title}",
        "assertions": [
            {
                "label": "c2pa.actions",
                "data": {
                    "actions": [{"action": "c2pa.created", "digitalSourceType": DIGITAL_CREATION}]
                },
            },
            {
                "label": ASSERTION_LABEL,
                "data": {
                    "passport_id": doc.passport_id,
                    "badge_code": doc.badge_code,
                    "film_title": doc.film_title,
                    "film_sha256": doc.film_sha256,
                    "passport_sha256": passport_fingerprint(
                        doc.film_title, doc.director, doc.declarations
                    ),
                    "issued_at": doc.issued_at.isoformat(),
                    "tools": [
                        {
                            "slug": slug,
                            "status": tools[slug].status if slug in tools else None,
                            "reviewed": slug in tools and tools[slug].review_state == "verifie",
                        }
                        for slug in sorted(s for s in declared if s)
                    ],
                    "signing_mode": "test" if simulated else "production",
                    "disclaimer": DISCLAIMER_FR,
                },
            },
        ],
    }


def _context(settings: Settings) -> c2pa.Context | None:
    anchors = settings.c2pa_trust_anchors_path
    if not anchors:
        return None
    pem = _read(anchors, "Autorités de confiance").decode()
    return c2pa.Context(
        c2pa.Settings.from_dict({"trust": {"user_anchors": pem}, "verify": {"verify_trust": True}})
    )


def sign_pdf(
    pdf: bytes, doc: PassportDocument, tools: dict[str, Tool], settings: Settings, now: datetime
) -> SignedPdf:
    """Signe le PDF et RELIT le résultat : une signature qu'on ne sait pas relire n'est jamais livrée."""
    signer = load_signer(settings)
    simulated = settings.c2pa_test_mode
    out = io.BytesIO()
    try:
        builder = c2pa.Builder.from_json(json.dumps(_manifest(doc, tools, simulated)))
        builder.sign(signer, PDF, io.BytesIO(pdf), out)
    except c2pa.C2paError as exc:
        log.warning("c2pa_sign_failed", error=type(exc).__name__)
        raise C2paSigningFailed("La signature C2PA a échoué.") from exc
    signed = out.getvalue()
    check = verify_pdf(signed, settings)
    if not check.intact:
        raise C2paSigningFailed("Le PDF signé ne passe pas sa propre vérification.")
    return SignedPdf(signed, check.manifest_id, now, simulated)


def verify_pdf(pdf: bytes, settings: Settings | None = None) -> Verification:
    """Lit la signature d'un PDF. N'affirme jamais plus que ce que C2PA établit : le fichier n'a pas
    été modifié, et tel signataire l'a émis. Pas que les déclarations sont vraies."""
    context = _context(settings) if settings else None
    try:
        reader = c2pa.Reader(PDF, io.BytesIO(pdf), context=context)
    except c2pa.C2paError as exc:
        if "ManifestNotFound" in type(exc).__name__ or "no JUMBF" in str(exc):
            return Verification(state="none")
        return Verification(state="invalid", problems=[type(exc).__name__])
    data = json.loads(reader.json())
    manifest = data.get("manifests", {}).get(data.get("active_manifest", ""), {})
    sig = manifest.get("signature_info", {})
    codes = [s["code"] for s in data.get("validation_status") or []]
    state = {"Trusted": "trusted", "Valid": "valid"}.get(
        str(reader.get_validation_state()), "invalid"
    )
    claims = next(
        (
            a["data"]
            for a in manifest.get("assertions", [])
            if a.get("label", "").startswith(ASSERTION_LABEL)
        ),
        {},
    )
    return Verification(
        state=state,
        signer=sig.get("common_name"),
        issuer=sig.get("issuer"),
        manifest_id=data.get("active_manifest"),
        cert_serial=sig.get("cert_serial_number"),
        claims=claims,
        problems=[c for c in codes if c != UNTRUSTED or state == "invalid"],
    )


def our_cert_serial(settings: Settings) -> str | None:
    """Numéro de série (décimal) de NOTRE certificat de signature, ou None s'il n'est pas configuré.
    Sert à dire si un PDF a été signé par nous, et non par quelqu'un qui aurait copié nos informations."""
    from cryptography import x509

    try:
        pem = _read(settings.c2pa_cert_chain_path, "Certificat de signature")
        return str(x509.load_pem_x509_certificate(pem).serial_number)
    except (C2paNotConfigured, ValueError):
        return None
