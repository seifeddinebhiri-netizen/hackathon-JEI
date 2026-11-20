from app.repositories import ai_tool_repository as repo
from app.schemas.ai_tool import Fact
from app.services.tool_status import compute_status


class ReviewError(Exception):
    """Relecture impossible : le message dit quoi faire."""


def _facts(rows: list[dict]) -> list[Fact]:
    keys = (
        "id", "field", "plan", "value_fr", "quote", "source_url", "source_kind",
        "quote_verified", "human_confirmed",
    )  # fmt: skip
    return [Fact(**{k: r[k] for k in keys}) for r in rows]


async def _tool_and_facts(pool, slug: str):
    tool = await repo.get_by_slug(pool, slug)
    if tool is None:
        raise ReviewError(f"Outil « {slug} » introuvable.")
    facts = (await repo.facts_for(pool, [tool["id"]])).get(tool["id"], [])
    return tool, _facts(facts)


async def pending(pool) -> list[dict]:
    """Outils à relire, avec ce qu'il reste à trancher."""
    out = []
    for tool in await repo.list_by_review_state(pool, "a_verifier"):
        facts = _facts((await repo.facts_for(pool, [tool["id"]])).get(tool["id"], []))
        out.append(
            {
                "slug": tool["slug"],
                "name": tool["name"],
                "facts": len(facts),
                "unconfirmed": sum(not (f.quote_verified or f.human_confirmed) for f in facts),
                "status": tool["status"],
            }
        )
    return out


async def show(pool, slug: str) -> tuple[dict, list[Fact]]:
    return await _tool_and_facts(pool, slug)


async def reject_fact(pool, slug: str, fact_id: str) -> str | None:
    """Supprime un fait faux ou douteux, puis recalcule le statut. Retourne le nouveau statut."""
    tool, facts = await _tool_and_facts(pool, slug)
    if fact_id not in {f.id for f in facts}:
        raise ReviewError("Ce fait n'appartient pas à cet outil.")
    await repo.delete_fact(pool, fact_id)
    remaining = [f for f in facts if f.id != fact_id]
    status = (
        compute_status(remaining)
        if any(f.quote_verified or f.human_confirmed for f in remaining)
        else None
    )
    await repo.set_review(pool, tool["id"], tool["review_state"], None, status)
    return status


async def confirm_fact(pool, slug: str, fact_id: str) -> None:
    """La personne a ouvert la page source et constate que le fait est exact."""
    _, facts = await _tool_and_facts(pool, slug)
    if fact_id not in {f.id for f in facts}:
        raise ReviewError("Ce fait n'appartient pas à cet outil.")
    await repo.confirm_fact(pool, fact_id)


async def approve(pool, slug: str, reviewer: str) -> str | None:
    """Marque la fiche « vérifiée ». Refusée s'il reste un fait que ni le serveur ni une personne
    n'a confirmé : il faut le confirmer ou le rejeter d'abord."""
    reviewer = reviewer.strip()
    if len(reviewer) < 2:
        raise ReviewError(
            "Indique ton nom (--reviewer) : une fiche vérifiée porte le nom de son relecteur."
        )
    tool, facts = await _tool_and_facts(pool, slug)
    if tool["research_state"] == "incomplete_access" and not facts:
        raise ReviewError(
            "Fiche vide (pages illisibles) : remplis-la à la main avant de l'approuver."
        )
    open_facts = [f for f in facts if not (f.quote_verified or f.human_confirmed)]
    if open_facts:
        raise ReviewError(
            f"{len(open_facts)} fait(s) non confirmé(s) : confirme-les (confirm) ou rejette-les (reject)."
        )
    status = compute_status(facts) if facts else None
    await repo.set_review(pool, tool["id"], "verifie", reviewer, status)
    return status


async def reopen(pool, slug: str) -> None:
    tool, facts = await _tool_and_facts(pool, slug)
    status = (
        compute_status(facts) if any(f.quote_verified or f.human_confirmed for f in facts) else None
    )
    await repo.set_review(pool, tool["id"], "a_verifier", None, status)
