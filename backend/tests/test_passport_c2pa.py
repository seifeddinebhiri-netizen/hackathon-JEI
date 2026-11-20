import json
import re
from datetime import UTC, datetime
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.schemas.ai_tool import Fact, Tool
from app.schemas.passport import Declaration, PassportDocument
from app.services import c2pa_service as c2
from app.services.passport_pdf_service import clean, render_pdf
from scripts.make_test_cert import make_certs

NOW = datetime(2026, 11, 19, 12, 0, tzinfo=UTC)


def fact(field="training_data", verified=True, confirmed=False) -> Fact:
    return Fact(
        field=field, plan="all", value_fr="Le fournisseur le dit.", quote="Une phrase exacte de la page",
        source_url="https://tool.example/terms", quote_verified=verified, human_confirmed=confirmed,
    )  # fmt: skip


def tool(
    slug="claude", status="documente", review="verifie", facts=None, reviewer="Amira B."
) -> Tool:
    return Tool(
        id=slug, slug=slug, name=slug.capitalize(), vendor="Vendor", status=status, review_state=review,
        research_state="complete", reviewed_by=reviewer if review == "verifie" else None,
        reviewed_at="2026-11-19T10:00:00" if review == "verifie" else None,
        facts=[fact()] if facts is None else facts,
    )  # fmt: skip


def document(**kw) -> PassportDocument:
    base = dict(  # noqa: C408
        passport_id="p1", badge_code="EN-DRHM-T1", film_title="Dar Hmeti", director="Amira Ben Salah",
        issued_at=NOW, film_sha256="b" * 64,
        declarations=[
            Declaration(department="scenario", used_ai=True, tool_slug="claude", level="assistance",
                        what="Dialogues.", human_decisions="Tout le reste."),
            Declaration(department="image", used_ai=False),
        ],
    )  # fmt: skip
    base.update(kw)
    return PassportDocument(**base)


def text_of(pdf: bytes) -> str:
    """Texte lisible du PDF : on lit les chaînes `(...) Tj` (accents en codes octaux), lignes recollées."""
    raw = pdf.decode("latin-1")
    runs = re.findall(r"\(((?:[^()\\]|\\.)*)\) Tj", raw)

    def decode(run: str) -> str:
        run = re.sub(
            r"\\([0-7]{3})", lambda m: bytes([int(m.group(1), 8)]).decode("cp1252", "replace"), run
        )
        return re.sub(r"\\(.)", r"\1", run)

    return " ".join(decode(r) for r in runs)


# --- PDF ---------------------------------------------------------------------------------
def test_pdf_has_the_mandatory_disclaimer_and_the_declaration():
    pdf = render_pdf(document(), {"claude": tool()}, compress=False)
    assert pdf.startswith(b"%PDF")
    t = text_of(pdf)
    assert "Déclaration fondée sur la documentation publique. Ce n'est pas un avis juridique." in t
    assert "Dar Hmeti" in t and "EN-DRHM-T1" in t and "Une phrase exacte de la page" in t
    assert "https://tool.example/terms" in t  # la source est imprimée


def test_pdf_is_reproducible_byte_for_byte():
    a = render_pdf(document(), {"claude": tool()})
    b = render_pdf(document(), {"claude": tool()})
    assert a == b


def test_pdf_never_claims_more_than_the_catalog_knows():
    unreviewed = render_pdf(document(), {"claude": tool(review="a_verifier")}, compress=False)
    assert "NON relue par une personne" in text_of(unreviewed)
    reviewed = text_of(render_pdf(document(), {"claude": tool()}, compress=False))
    assert "relue par une personne par Amira B." in reviewed and "NON relue" not in reviewed
    unverified = text_of(
        render_pdf(document(), {"claude": tool(facts=[fact(verified=False)])}, compress=False)
    )
    assert "[non vérifié]" in unverified


def test_pdf_custom_and_unknown_tools_are_honest_not_accusing():
    doc = document(declarations=[
        Declaration(department="musique", used_ai=True, custom_tool="Mon outil maison"),
        Declaration(department="vfx", used_ai=True, tool_slug="inconnu"),
    ])  # fmt: skip
    t = text_of(render_pdf(doc, {}, compress=False))
    assert "outil hors catalogue" in t and "Non documenté" in t and "pas une accusation" in t
    assert "statut valide" in t  # explique que « non divulgué » n'est pas un reproche


def test_pdf_survives_hostile_and_unsupported_text():
    doc = document(film_title="A & B <b>gras</b> مرحبا", declarations=[
        Declaration(department="scenario", used_ai=True, tool_slug="claude", what="x" * 1400, human_decisions="<script>"),
    ])  # fmt: skip
    long_quote = tool(facts=[fact().model_copy(update={"quote": "q" * 480})])
    pdf = render_pdf(doc, {"claude": long_quote})
    assert pdf.startswith(b"%PDF")
    assert clean("é « » œ") == "é « » œ"  # le français passe tel quel
    assert (
        clean("مرحبا") == "?????"
    )  # l'arabe n'est pas pris en charge : pas de carré, pas de plantage
    assert clean("<i>&") == "&lt;i&gt;&amp;"


def test_passport_document_validation():
    with pytest.raises(ValidationError):
        document(film_sha256="pas-un-hash")
    with pytest.raises(ValidationError):
        document(declarations=[])
    with pytest.raises(ValidationError):
        Declaration(department="cuisine", used_ai=True)


# --- signature C2PA ----------------------------------------------------------------------
@pytest.fixture(scope="module")
def certs(tmp_path_factory) -> Path:
    return make_certs(tmp_path_factory.mktemp("certs"))


def settings(certs: Path, **kw) -> Settings:
    base = dict(  # noqa: C408
        c2pa_cert_chain_path=str(certs / "test-signing-chain.pem"),
        c2pa_private_key_path=str(certs / "test-signing-key.pem"),
    )
    base.update(kw)
    return Settings(_env_file=None, **base)


@pytest.fixture(scope="module")
def pdf() -> bytes:
    return render_pdf(document(), {"claude": tool()})


def sign(pdf, certs, **kw):
    return c2.sign_pdf(pdf, document(), {"claude": tool()}, settings(certs, **kw), NOW)


def test_signed_pdf_verifies_and_carries_the_passport_claims(pdf, certs):
    signed = sign(pdf, certs)
    assert signed.data.startswith(b"%PDF") and signed.simulated is True and signed.manifest_id
    v = c2.verify_pdf(signed.data)
    assert v.state == "valid" and v.intact and v.problems == []
    assert v.signer == "Premier Plan TEST Passeport IA"
    assert v.claims["badge_code"] == "EN-DRHM-T1" and v.claims["film_sha256"] == "b" * 64
    assert v.claims["tools"] == [{"slug": "claude", "status": "documente", "reviewed": True}]
    assert v.claims["signing_mode"] == "test"
    assert "avis juridique" in v.claims["disclaimer"]


def test_one_changed_byte_breaks_the_signature(pdf, certs):
    signed = sign(pdf, certs).data
    bad = bytearray(signed)
    bad[bad.find(b"stream") + 10] ^= 0xFF
    v = c2.verify_pdf(bytes(bad))
    assert v.state == "invalid" and not v.intact
    assert "assertion.dataHash.mismatch" in v.problems


def test_an_unsigned_pdf_is_reported_as_unsigned_not_as_invalid(pdf):
    assert c2.verify_pdf(pdf).state == "none"
    assert c2.verify_pdf(b"%PDF-1.4 nimporte quoi").state in ("none", "invalid")


def test_trust_anchor_turns_valid_into_trusted_only_for_us(pdf, certs):
    signed = sign(pdf, certs).data
    assert c2.verify_pdf(signed).state == "valid"  # signataire inconnu
    trusting = settings(certs, c2pa_trust_anchors_path=str(certs / "test-root-ca.pem"))
    assert c2.verify_pdf(signed, trusting).state == "trusted"


def test_production_mode_is_written_into_the_signature(pdf, certs):
    signed = sign(pdf, certs, c2pa_test_mode=False)
    assert signed.simulated is False
    assert c2.verify_pdf(signed.data).claims["signing_mode"] == "production"


def test_signing_refuses_to_fake_it_when_not_configured(pdf, tmp_path):
    with pytest.raises(c2.C2paNotConfigured, match="non configuré"):
        c2.sign_pdf(pdf, document(), {}, Settings(_env_file=None), NOW)
    with pytest.raises(c2.C2paNotConfigured, match="introuvable"):
        c2.sign_pdf(pdf, document(), {}, Settings(_env_file=None, c2pa_cert_chain_path=str(tmp_path / "x.pem"), c2pa_private_key_path="x"), NOW)  # fmt: skip


def test_bad_algorithm_and_mismatched_key_are_refused(pdf, certs, tmp_path):
    with pytest.raises(c2.C2paNotConfigured, match="Algorithme"):
        sign(pdf, certs, c2pa_signing_alg="MD5")
    other = make_certs(tmp_path)  # une autre clé : ne correspond pas au certificat
    mismatched = settings(certs, c2pa_private_key_path=str(other / "test-signing-key.pem"))
    with pytest.raises((c2.C2paNotConfigured, c2.C2paSigningFailed)):
        c2.sign_pdf(pdf, document(), {}, mismatched, NOW)


def test_a_signature_that_fails_its_own_check_is_never_delivered(pdf, certs, monkeypatch):
    monkeypatch.setattr(c2, "verify_pdf", lambda *_a, **_k: c2.Verification(state="invalid"))
    with pytest.raises(c2.C2paSigningFailed, match="propre vérification"):
        sign(pdf, certs)


def test_unreviewed_tool_is_recorded_as_unreviewed_in_the_signature(pdf, certs):
    out = c2.sign_pdf(pdf, document(), {"claude": tool(review="a_verifier")}, settings(certs), NOW)
    assert c2.verify_pdf(out.data).claims["tools"][0]["reviewed"] is False


def test_the_signed_claims_are_valid_json_for_a_future_verify_page(pdf, certs):
    v = c2.verify_pdf(sign(pdf, certs).data)
    assert json.loads(json.dumps(v.claims))["passport_id"] == "p1"
