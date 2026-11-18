"""Scénario → scènes, lieux, personnages (contrat de POST /planner/parse).

1. Lecture du fichier ou du texte (reader).
2. Découpage sur les en-têtes INT./EXT. (chunker), sans IA. Sans en-tête (un récit) : le texte
   est coupé en phrases, l'IA choisit où commencent les scènes, le programme coupe.
3. Personnages qui parlent et lieux, par règles (extractor). Dans un récit, les prénoms.
4. Si l'IA est disponible : titres, résumés, personnages présents, fusion des graphies d'un même
   personnage, description de chaque lieu pour la recherche de lieux (RAG). Tout est vérifié.
5. Si l'IA échoue, on renvoie le résultat par règles avec un avertissement : jamais d'erreur 5xx.
"""

import math
import uuid
from collections import Counter

import structlog

from app.schemas.screenplay import Location, ParseScreenplayResult, Scene
from app.services.llm_service import LLMUnavailable
from app.services.screenplay import enrich
from app.services.screenplay.chunker import (
    Chunk,
    chunks_from_boundaries,
    display_name,
    norm_key,
    prose_units,
    split_scenes,
    whole_text_chunk,
)
from app.services.screenplay.extractor import (
    first_action_line,
    full_sentence,
    group_locations,
    prose_names,
    speaking_characters,
)
from app.services.screenplay.llm import ScreenplayLLM

log = structlog.get_logger()

# Valeurs v0 (à ajuster sur le terrain), comme la calibration du Coach : pas des faits sourcés.
LINES_PER_PAGE = 55
CHARS_PER_PAGE = 1_100
HOURS_PER_PAGE = 2.0  # un court-métrage indépendant tourne ~4 à 5 pages par journée de 10 h
MAX_HOURS_PER_SCENE = 10.0  # au-delà, ce n'est plus une scène mais plusieurs : on plafonne


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def page_eighths(chunk: Chunk) -> int:
    body = chunk.body
    lines = len([ln for ln in chunk.body_lines if ln.strip()]) + 2  # + en-tête et blanc
    pages = max(lines / LINES_PER_PAGE, len(body) / CHARS_PER_PAGE)
    return max(1, round(pages * 8))


def estimated_hours(eighths: int) -> float:
    return min(MAX_HOURS_PER_SCENE, max(0.5, math.ceil(eighths / 8 * HOURS_PER_PAGE * 2) / 2))


def _resolve_moments(chunks: list[Chunk]) -> list[bool]:
    """Remplit les moments absents (« CONTINU », « PLUS TARD », rien) avec la scène précédente."""
    guessed = []
    prev = "jour"
    for c in chunks:
        if c.moment is None:
            c.moment = prev
            guessed.append(True)
        else:
            guessed.append(False)
        prev = c.moment
    return guessed


def _unique_numbers(chunks: list[Chunk]) -> list[str]:
    nums, seen = [], Counter()
    for i, c in enumerate(chunks, start=1):
        n = c.number or str(i)
        seen[n] += 1
        nums.append(n if seen[n] == 1 else f"{n}-{seen[n]}")
    return nums


def _fallback_title(chunk: Chunk, place_name: str, action: str) -> str:
    if action:
        first = action.split(".")[0].split("!")[0].split("?")[0].strip()
        if first:
            return first if len(first) <= 48 else first[:47].rstrip() + "…"
    return f"{'Extérieur' if chunk.setting == 'EXT' else 'Intérieur'} {place_name}"


def _merge_aliases(groups: list[tuple[str, list[str]]]) -> dict[str, str]:
    """Union des groupes (de plusieurs lots) → {nom: nom canonique}."""
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        while parent.setdefault(x, x) != x:
            x = parent[x]
        return x

    for canonical, aliases in groups:
        for a in aliases:
            ra, rc = find(a), find(canonical)
            if ra != rc:
                parent[ra] = rc
    return {name: find(name) for name in parent}


async def parse_screenplay(text: str, llm: ScreenplayLLM | None) -> ParseScreenplayResult:
    warnings: list[str] = []
    ai_used = False
    ai_failed = False
    ai_error = ""

    # --- 1. Découpage ---------------------------------------------------------
    chunks = split_scenes(text)
    prose = False
    if not chunks:
        lines = text.splitlines()
        probe = whole_text_chunk(lines)
        prose = not speaking_characters(probe)  # pas de noms au-dessus des répliques : un récit
        units = prose_units(text) if prose else lines
        boundaries: list[dict] = []
        if llm is not None:
            try:
                boundaries = await enrich.segment(llm, units)
                ai_used = bool(boundaries)
            except LLMUnavailable as exc:
                ai_failed, ai_error = True, str(exc)
            except Exception as exc:  # noqa: BLE001 — on garde le texte entier
                log.warning("screenplay_ai_error", step="segment", error=type(exc).__name__)
                ai_failed = True
        if boundaries:
            chunks = chunks_from_boundaries(units, boundaries)
            warnings.append(
                "L'IA a découpé ton texte en scènes. Vérifie où commence chaque scène, et fusionne "
                "ou sépare si besoin."
            )
        else:
            chunks = [whole_text_chunk(units)]
            warnings.append(
                "Ton texte n'est pas encore découpé : sans l'IA, il forme une seule scène. "
                "Active l'IA pour le découper, ou ajoute des en-têtes (INT. CAFÉ - JOUR)."
                if prose
                else "Aucun en-tête de scène (INT. / EXT.) trouvé : tout le texte forme une seule "
                "scène. Ajoute des en-têtes ou découpe à la main."
            )

    moment_guessed = _resolve_moments(chunks)
    numbers = _unique_numbers(chunks)

    # --- 2. Règles : personnages qui parlent, lieux ---------------------------
    speaking = [speaking_characters(c) for c in chunks]
    loc_drafts = group_locations(chunks, numbers)
    loc_ids = {k: _uid("loc") for k in loc_drafts}

    all_chars: list[str] = []
    for names in speaking:
        for n in names:
            if n not in all_chars:
                all_chars.append(n)
    # Récit : pas de noms au-dessus des répliques, on repère les prénoms qui reviennent.
    named_in_scene: list[list[str]] = [[] for _ in chunks]
    if prose:
        candidates = prose_names([u for c in chunks for u in c.body_lines])
        all_chars += [n for n in candidates if n not in all_chars]
        for i, c in enumerate(chunks):
            body = " " + c.body + " "
            named_in_scene[i] = [n for n in candidates if enrich.mentioned(n, body)]

    # --- 3. IA : annotations vérifiées ----------------------------------------
    enr = enrich.Enrichment()
    if llm is not None and not ai_failed:
        refs = [
            enrich.SceneForAI(
                number=numbers[i],
                setting=c.setting,
                moment=c.moment or "jour",
                location_key=norm_key(c.place) or "lieu a preciser",
                room=c.room,
                heading=c.heading,
                speaking=speaking[i],
                body=c.body,
            )
            for i, c in enumerate(chunks)
        ]
        try:
            enr = await enrich.analyze(
                llm, refs, all_chars, {k: d.name for k, d in loc_drafts.items()}
            )
            ai_used = True
        except LLMUnavailable as exc:
            ai_failed, ai_error = True, str(exc)
        except Exception as exc:  # noqa: BLE001 — réponse inattendue : on garde le résultat par règles
            log.warning("screenplay_ai_error", error=type(exc).__name__)
            ai_failed = True
        if enr.dropped:
            log.info("screenplay_ai_dropped", count=enr.dropped)

    alias_of = _merge_aliases(enr.alias_groups)

    def canon(name: str) -> str:
        return alias_of.get(name, name)

    # --- 4. Assemblage --------------------------------------------------------
    scenes: list[Scene] = []
    final_chars: list[str] = []
    for i, c in enumerate(chunks):
        num = numbers[i]
        key = norm_key(c.place) or "lieu a preciser"
        loc = loc_drafts[key]
        talking = list(dict.fromkeys(canon(n) for n in speaking[i]))
        # Avec l'IA : les personnages présents (vérifiés). Sans : les prénoms cités dans la scène.
        others = enr.present[num] if num in enr.present else named_in_scene[i]
        present = list(dict.fromkeys(talking + [canon(n) for n in others]))
        for n in present:
            if n not in final_chars:
                final_chars.append(n)
        action = full_sentence(c.body_lines, first_action_line(c, speaking[i]))
        eighths = page_eighths(c)
        scenes.append(
            Scene(
                id=_uid("sc"),
                number=num,
                title=enr.titles.get(num) or _fallback_title(c, loc.name, action),
                setting=c.setting,
                moment=c.moment,
                location_id=loc_ids[key],
                characters=present,
                estimated_hours=estimated_hours(eighths),
                summary=enr.summaries.get(num)
                or (action if len(action) <= 140 else action[:139].rstrip() + "…"),
                heading=c.heading,
                room=display_name(c.room) if c.room else None,
                speaking_characters=talking,
                page_eighths=eighths,
                location_brief=enr.scene_briefs.get(num),
                moment_guessed=moment_guessed[i],
            )
        )

    locations = [
        Location(
            id=loc_ids[k],
            name=d.name,
            notes=("Pièces : " + ", ".join(d.rooms)) if d.rooms else None,
            rooms=d.rooms,
            settings=d.settings,
            scene_numbers=d.scene_numbers,
            kind_fr=enr.location_kinds.get(k),
            brief_fr=enr.location_briefs.get(k),
        )
        for k, d in loc_drafts.items()
    ]

    # --- 5. Avertissements lisibles par un scénariste ---------------------------
    if ai_failed:
        reason = f" ({ai_error.rstrip('.')})" if ai_error else ""
        warnings.append(
            f"Analyse IA indisponible{reason} : découpage automatique simple, sans résumés ni "
            "descriptions de lieux. Tu peux relancer plus tard."
        )
    if any(c.interior_exterior for c in chunks):
        warnings.append(
            "Les scènes INT./EXT. (par exemple dans une voiture) sont rangées en extérieur, "
            "car la météo compte."
        )
    if any(c.setting_guessed for c in chunks) and chunks[0].heading:
        warnings.append("Pour certaines scènes, intérieur ou extérieur a été deviné : vérifie-les.")
    nb_guessed = sum(moment_guessed)
    if nb_guessed:
        warnings.append(
            f"{nb_guessed} scène(s) sans moment clair (jour, nuit…) : on a repris celui de la scène "
            "d'avant. Vérifie-les."
        )
    if prose and not enr.present:
        warnings.append(
            "Personnages repérés d'après les prénoms du texte (ceux qui sont seulement cités "
            "sont aussi comptés) : vérifie-les."
        )
    if any(s.estimated_hours >= MAX_HOURS_PER_SCENE for s in scenes):
        warnings.append(
            f"Au moins une scène est très longue : sa durée est plafonnée à "
            f"{MAX_HOURS_PER_SCENE:g} h. Elle contient sans doute plusieurs scènes."
        )
    if any(not s.characters for s in scenes):
        warnings.append("Certaines scènes n'ont aucun personnage détecté : vérifie-les.")
    warnings.append(
        "Les durées de tournage sont estimées d'après la longueur du texte (environ 2 h par page) : "
        "ajuste-les."
    )

    return ParseScreenplayResult(
        scenes=scenes,
        locations=locations,
        characters=final_chars,
        warnings=warnings,
        ai_used=ai_used and not ai_failed,
    )
