"""Démonstration de bout en bout : PDF du Passeport IA -> signature C2PA -> vérification.

    uv run python -m scripts.make_test_cert        # une seule fois
    uv run python -m scripts.demo_passport

Écrit dans backend/_essais/ (ignoré par git) :
  passeport-exemple.pdf          le PDF non signé
  passeport-exemple-signe.pdf    le PDF signé C2PA (à ouvrir sur https://contentcredentials.org/verify)
  passeport-exemple-altere.pdf   le même, avec UN octet modifié (la vérification doit échouer)
Les outils et les citations viennent du jeu de départ ; les films et personnes sont inventés."""

import json
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings
from app.schemas.passport import Declaration, PassportDocument
from app.services import c2pa_service as c2
from app.services.passport_pdf_service import render_pdf
from app.services.research.seed import evaluate_seed_tool, seed_row_to_tool

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "_essais"


def sample_tools() -> dict:
    data = json.loads((ROOT / "data" / "ai_tools_seed.json").read_text(encoding="utf-8"))
    tools = {}
    for t in data["tools"]:
        # Démonstration : on suppose les pages lues telles quelles (les phrases du jeu de départ).
        pages: dict[str, str] = {}
        for f in t["facts"]:
            pages[f["source_url"]] = pages.get(f["source_url"], "") + " " + f["quote"]
        tools[t["slug"]] = seed_row_to_tool(evaluate_seed_tool(t, pages))
    return tools


def sample_document() -> PassportDocument:
    return PassportDocument(
        passport_id="demo-0001",
        badge_code="EN-DRHM-T1",
        film_title="Dar Hmeti (exemple)",
        director="Amira Ben Salah (exemple)",
        issued_at=datetime(2026, 11, 19, 12, 0, tzinfo=UTC),
        verify_url="https://exemple.invalid/verifier/EN-DRHM-T1",
        film_sha256="a" * 64,
        declarations=[
            Declaration(department="scenario", used_ai=True, tool_slug="claude", level="assistance",
                        what="Relecture et reformulation de dialogues.", human_decisions="Toute l'histoire et les dialogues finaux."),
            Declaration(department="image", used_ai=False),
            Declaration(department="son_voix", used_ai=True, tool_slug="elevenlabs", level="generation_partielle",
                        what="Voix off de la bande-annonce.", human_decisions="Texte, ton et montage."),
            Declaration(department="musique", used_ai=True, custom_tool="Générateur de musique maison", level="assistance",
                        what="Maquette d'ambiance.", human_decisions="Composition finale par une musicienne."),
            Declaration(department="sous_titres", used_ai=True, tool_slug="deepl", level="assistance",
                        what="Première traduction.", human_decisions="Relecture complète par le réalisateur."),
        ],
    )  # fmt: skip


def main() -> None:
    settings = get_settings()
    OUT.mkdir(exist_ok=True)
    doc, tools = sample_document(), sample_tools()
    pdf = render_pdf(doc, tools)
    (OUT / "passeport-exemple.pdf").write_bytes(pdf)
    print(f"PDF : {len(pdf)} octets")
    try:
        signed = c2.sign_pdf(pdf, doc, tools, settings, datetime.now(UTC))
    except c2.C2paNotConfigured as exc:
        print(
            f"Signature impossible : {exc}\n-> uv run python -m scripts.make_test_cert, puis remplir C2PA_* dans .env"
        )
        return
    (OUT / "passeport-exemple-signe.pdf").write_bytes(signed.data)
    v = c2.verify_pdf(signed.data, settings)
    print(f"Signé : {len(signed.data)} octets · signature de test : {signed.simulated}")
    print(f"Vérification : état={v.state} signataire={v.signer} problèmes={v.problems}")
    print(f"Déclaré dans la signature : {json.dumps(v.claims.get('tools'), ensure_ascii=False)}")
    bad = bytearray(signed.data)
    bad[bad.find(b"stream") + 10] ^= 0xFF
    (OUT / "passeport-exemple-altere.pdf").write_bytes(bytes(bad))
    print(f"PDF altéré d'un octet : état={c2.verify_pdf(bytes(bad), settings).state}")
    print(f"PDF non signé : état={c2.verify_pdf(pdf, settings).state}")


if __name__ == "__main__":
    main()
