"""Kit Festival : lecture des fiches festivals, filtres et classement pour un film.

Source des données :
- Supabase Postgres (table `festivals`) quand DATABASE_URL est configurée ;
- sinon le fichier `data/festivals.json` (développement local et tests).
Les deux contiennent les mêmes fiches : le seed SQL est généré depuis ce fichier
(scripts/build_festival_seed.py), qui reste la source de vérité.

Le score indique la compatibilité avec les critères écrits du festival.
Il ne prédit jamais la sélection.
"""

import json
import unicodedata
from datetime import date
from functools import lru_cache
from pathlib import Path
from typing import Any

import asyncpg
import structlog

from app.core.errors import AppError
from app.schemas.festival import (
    DeadlineStatus,
    Festival,
    FestivalFilters,
    FestivalMatch,
    FilmProfile,
)

log = structlog.get_logger()

FESTIVALS_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "festivals.json"
URGENT_DAYS = 14

_COLUMNS = (
    "id, name, country, city, edition, deadline, deadline_note, fee, max_duration_min, "
    "subtitle_langs, ai_policy, ai_policy_detail, eligibility, requirements, source_url, checked_at"
)


# --- Chargement --------------------------------------------------------------------
def deadline_status(deadline: date | None, today: date) -> DeadlineStatus:
    if deadline is None:
        return "a_confirmer"
    return "passee" if deadline < today else "ouverte"


def _to_festival(raw: dict[str, Any], today: date) -> Festival | None:
    """Fiche brute → Festival. Une fiche sans source ni date de vérification n'est pas affichée."""
    if not raw.get("source_url") or not raw.get("checked_at"):
        return None
    data = dict(raw)
    data.pop("deadline_status", None)
    if isinstance(data.get("requirements"), str):  # jsonb renvoyé en texte par asyncpg
        data["requirements"] = json.loads(data["requirements"])
    data["subtitle_langs"] = list(data.get("subtitle_langs") or [])
    fest = Festival.model_validate({**data, "deadline_status": "a_confirmer"})
    fest.deadline_status = deadline_status(fest.deadline, today)
    return fest


@lru_cache
def _load_file() -> tuple[dict[str, Any], ...]:
    return tuple(json.loads(FESTIVALS_PATH.read_text(encoding="utf-8")))


_file_source_logged = False


async def _load_raw(pool: asyncpg.Pool | None) -> list[dict[str, Any]]:
    global _file_source_logged
    if pool is None:
        # Une seule fois par processus : le repli sur le fichier ne doit pas être silencieux.
        if not _file_source_logged:
            log.warning(
                "festivals_source_file",
                reason="base non configurée ou injoignable",
                path=str(FESTIVALS_PATH),
            )
            _file_source_logged = True
        return list(_load_file())
    try:
        rows = await pool.fetch(f"select {_COLUMNS} from public.festivals")
    except Exception as exc:
        log.error("festivals_query_failed", error=repr(exc))
        raise AppError(
            "Impossible de charger les festivals pour le moment.", 503, "festivals_unavailable"
        ) from exc
    return [dict(r) for r in rows]


async def list_festivals(pool: asyncpg.Pool | None, today: date | None = None) -> list[Festival]:
    today = today or date.today()
    out = [_to_festival(r, today) for r in await _load_raw(pool)]
    return [f for f in out if f is not None]


async def get_festival(pool: asyncpg.Pool | None, festival_id: str) -> Festival:
    for f in await list_festivals(pool):
        if f.id == festival_id:
            return f
    raise AppError("Festival introuvable.", 404, "festival_not_found")


# --- Filtres -----------------------------------------------------------------------
def _norm(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def is_free(fee: str) -> bool:
    return _norm(fee).strip().startswith("gratuit")


def apply_filters(festivals: list[Festival], f: FestivalFilters) -> list[Festival]:
    q = _norm(f.q or "").strip()
    out = []
    for fest in festivals:
        if q and q not in _norm(f"{fest.name} {fest.country} {fest.city or ''}"):
            continue
        if f.country and _norm(fest.country) != _norm(f.country):
            continue
        # Garde les festivals sans durée maximale connue (on ne les exclut pas sans preuve).
        if (
            f.max_duration_min
            and fest.max_duration_min is not None
            and fest.max_duration_min < f.max_duration_min
        ):
            continue
        if f.fee and (f.fee == "gratuit") != is_free(fest.fee):
            continue
        if f.deadline_before and (fest.deadline is None or fest.deadline > f.deadline_before):
            continue
        if f.subtitle_lang and f.subtitle_lang not in fest.subtitle_langs:
            continue
        if f.ai_policy and fest.ai_policy != f.ai_policy:
            continue
        if f.open_only and fest.deadline_status != "ouverte":
            continue
        out.append(fest)
    return out


# --- Classement --------------------------------------------------------------------
def rank_festival(fest: Festival, film: FilmProfile | None, today: date) -> FestivalMatch:
    """Port de `rankFestival` (web/src/api/mocks/handlers.ts), avec deux ajouts :
    une date limite inconnue n'est pas « dépassée », et un appel clos renvoie au prochain."""
    reasons: list[str] = []
    warnings: list[str] = []
    score = 3
    # Un critère bloquant (trop long, IA refusée, appel clos) fixe le score à 1 à la fin,
    # même si d'autres points (inscription gratuite…) l'auraient remonté.
    blocked = False

    if film is not None:
        if film.duration_min is not None and fest.max_duration_min is not None:
            if film.duration_min <= fest.max_duration_min:
                score += 1
                reasons.append(
                    f"Durée compatible ({film.duration_min} min pour "
                    f"{fest.max_duration_min} min maximum)."
                )
            else:
                blocked = True
                warnings.append(f"Durée au-delà du maximum ({fest.max_duration_min} min).")
        if film.declared_ai_departments > 0:
            if fest.ai_policy == "interdite":
                blocked = True
                warnings.append(
                    "Le festival refuse les films avec IA générative, et ton Passeport en déclare."
                )
            elif fest.ai_policy == "a_declarer":
                reasons.append(
                    "Le festival demande une déclaration IA : ton Passeport IA la prépare."
                )
            elif fest.ai_policy == "section_dediee":
                warnings.append(
                    "Les films faits entièrement par IA vont dans une section à part : "
                    "vérifie la bonne section."
                )
            elif fest.ai_policy == "acceptee":
                reasons.append("Le festival accepte l'usage de l'IA.")
            else:
                warnings.append(
                    "Le règlement ne dit rien sur l'IA : demande au festival avant de t'inscrire."
                )

    if is_free(fest.fee):
        score += 1
        reasons.append("Inscription gratuite.")

    if not fest.subtitle_langs:
        pass  # aucune exigence connue : on n'affirme rien
    elif "fr" in fest.subtitle_langs:
        reasons.append(
            "Sous-titres français acceptés : brouillon disponible dans l'onglet Sous-titres."
        )
    else:
        warnings.append(f"Sous-titres demandés en : {', '.join(fest.subtitle_langs)}.")

    if fest.deadline is None:
        warnings.append("Date limite à confirmer : vérifie le site officiel.")
    else:
        left = (fest.deadline - today).days
        if left < 0:
            blocked = True
            warnings.append("Appel clos pour cette édition : à garder pour le prochain appel.")
        elif left <= URGENT_DAYS:
            score -= 1
            warnings.append(f"Date limite dans {left} jours : dossier à préparer vite.")

    if blocked:
        score = 1
    return FestivalMatch(
        festival=fest, score=max(1, min(5, score)), reasons=reasons[:3], warnings=warnings
    )


def _sort_key(m: FestivalMatch, with_film: bool) -> tuple:
    """Ouverts d'abord (date limite la plus proche), puis à confirmer, puis clos (plus récents)."""
    fest = m.festival
    group = {"ouverte": 0, "a_confirmer": 1, "passee": 2}[fest.deadline_status]
    if fest.deadline is None:
        by_date = 0
    elif group == 2:
        by_date = -fest.deadline.toordinal()
    else:
        by_date = fest.deadline.toordinal()
    return ((-m.score if with_film else 0), group, by_date, fest.name)


async def search(
    pool: asyncpg.Pool | None,
    filters: FestivalFilters,
    film: FilmProfile | None = None,
    today: date | None = None,
) -> list[FestivalMatch]:
    today = today or date.today()
    festivals = apply_filters(await list_festivals(pool, today), filters)
    matches = [rank_festival(f, film, today) for f in festivals]
    return sorted(matches, key=lambda m: _sort_key(m, film is not None))
