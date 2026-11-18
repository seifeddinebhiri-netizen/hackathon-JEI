"""Diagnostic Gemini : UN appel isolé, chronométré (hors application, sans relance).

Usage :
  uv run python -m scripts.diag_gemini minimal  --model gemini-3.8-flash --timeout 20
  uv run python -m scripts.diag_gemini lot PROJECT_ID --model gemini-3.8-flash --thinking low

« minimal » : traduit « bonjour ». « lot » : traduit les lignes du brouillon PROJECT_ID
(table subtitle_drafts) avec le prompt réel des sous-titres. Affiche la durée, le statut et,
pour un lot, la validité du JSON. N'affiche jamais la clé ni le texte des répliques.
"""

import argparse
import asyncio
import json
import sys
import time

import asyncpg

from app.core.config import get_settings
from app.schemas.subtitle import Cue, TranslationBatch, TranslationContext
from app.services import glossary_service
from app.services.translation_service import SYSTEM_PROMPT, build_user_prompt, parse_output


async def load_cues(project_id: str) -> list[Cue]:
    conn = await asyncpg.connect(
        get_settings().database_url.get_secret_value(), statement_cache_size=0
    )
    try:
        raw = await conn.fetchval(
            "select lines from public.subtitle_drafts where project_id = $1", project_id
        )
    finally:
        await conn.close()
    if raw is None:
        sys.exit(f"Aucun brouillon pour {project_id}.")
    lines = json.loads(raw) if isinstance(raw, str) else raw
    return [
        Cue(
            id=li["id"],
            start=li["start"],
            end=li["end"],
            source=li["source"],
            speaker=li.get("speaker"),
            asr_confidence=1.0,
        )
        for li in lines
    ]


async def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("mode", choices=["minimal", "lot"])
    p.add_argument("project_id", nargs="?")
    p.add_argument("--model", required=True)
    p.add_argument("--thinking", help="minimal | low | medium | high (thinking_level)")
    p.add_argument("--timeout", type=float, default=60)
    args = p.parse_args()

    from google import genai
    from google.genai import types

    key = get_settings().gemini_api_key.get_secret_value()
    if not key:
        sys.exit("GEMINI_API_KEY absente.")
    client = genai.Client(api_key=key)

    cues: list[Cue] = []
    if args.mode == "minimal":
        system, user, schema = None, 'Traduis "bonjour" en anglais. Réponds par un seul mot.', None
    else:
        if not args.project_id:
            sys.exit("project_id requis pour le mode lot.")
        cues = await load_cues(args.project_id)
        glossary = {e.id: e for c in cues for e in glossary_service.find_entries(c.source)}
        context = TranslationContext(glossary=list(glossary.values()))
        system, user, schema = SYSTEM_PROMPT, build_user_prompt(cues, context), TranslationBatch

    config = types.GenerateContentConfig(
        system_instruction=system,
        response_mime_type="application/json" if schema else None,
        response_schema=schema,
        temperature=0.2,
        thinking_config=types.ThinkingConfig(thinking_level=args.thinking)
        if args.thinking
        else None,
    )
    print(
        f"modèle={args.model} mode={args.mode} thinking={args.thinking or 'défaut'} "
        f"délai={args.timeout:.0f}s lignes={len(cues)}"
    )
    started = time.monotonic()
    try:
        resp = await asyncio.wait_for(
            client.aio.models.generate_content(model=args.model, contents=user, config=config),
            timeout=args.timeout,
        )
    except TimeoutError:
        print(f"ÉCHEC : délai dépassé après {time.monotonic() - started:.1f} s")
        return
    except Exception as exc:  # noqa: BLE001 — diagnostic
        print(
            f"ÉCHEC : {type(exc).__name__} code={getattr(exc, 'code', None)} "
            f"status={getattr(exc, 'status', None)} après {time.monotonic() - started:.1f} s"
        )
        return
    elapsed = time.monotonic() - started
    usage = resp.usage_metadata
    tokens = {
        "entree": getattr(usage, "prompt_token_count", None),
        "sortie": getattr(usage, "candidates_token_count", None),
        "reflexion": getattr(usage, "thoughts_token_count", None),
    }
    print(f"OK en {elapsed:.1f} s · jetons {tokens}")
    if args.mode == "minimal":
        print(f"réponse : {(resp.text or '').strip()[:40]!r}")
        return
    parsed = parse_output(resp.text or "", [c.id for c in cues], set())
    try:
        json.loads(resp.text or "")
        valid = True
    except json.JSONDecodeError:
        valid = False
    print(f"JSON valide : {valid} · lignes traduites et validées : {len(parsed)}/{len(cues)}")


if __name__ == "__main__":
    asyncio.run(main())
