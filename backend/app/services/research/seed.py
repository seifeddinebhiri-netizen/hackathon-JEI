from app.schemas.ai_tool import Fact
from app.services.research.quotes import quote_in_page
from app.services.tool_names import normalize_name
from app.services.tool_status import compute_status


def evaluate_seed_tool(tool: dict, pages: dict[str, str]) -> dict:
    """Prépare un outil du jeu de départ. `pages` : texte des pages lues par NOTRE serveur (url -> texte).

    Une phrase n'est comptée (`quote_verified`) que si elle figure vraiment dans la page. Si aucune
    page n'a pu être lue, le statut reste vide (« pas évalué ») : on ne dit pas « non divulgué »
    quand c'est nous qui n'avons pas pu lire."""
    facts: list[Fact] = []
    for raw in tool["facts"]:
        text = pages.get(raw["source_url"])
        verified = text is not None and quote_in_page(raw["quote"], text)
        facts.append(Fact(**raw, quote_verified=verified))
    any_verified = any(f.quote_verified for f in facts)
    pages_read = [u for u in {f.source_url for f in facts} if u in pages]
    return {
        "slug": tool["slug"],
        "name": tool["name"],
        "vendor": tool["vendor"],
        "official_site": tool.get("official_site"),
        "categories": tool.get("categories", []),
        "terms_url": tool.get("terms_url"),
        "privacy_url": tool.get("privacy_url"),
        "terms_updated": tool.get("terms_updated"),
        "status": compute_status(facts) if any_verified else None,
        "review_state": "a_verifier",
        "research_state": "complete" if pages_read and any_verified else "incomplete_access",
        "note_fr": tool.get("note_fr", ""),
        "aliases": sorted(
            {normalize_name(a) for a in tool.get("aliases", [])} | {normalize_name(tool["name"])}
        ),
        "facts": facts,
    }


def seed_row_to_tool(row: dict):
    """Fiche du jeu de départ sous la forme renvoyée par l'API (pour les démonstrations et les tests)."""
    from app.schemas.ai_tool import Tool

    return Tool(
        id=row["slug"],
        slug=row["slug"],
        name=row["name"],
        vendor=row["vendor"],
        official_site=row["official_site"],
        categories=row["categories"],
        terms_url=row["terms_url"],
        privacy_url=row["privacy_url"],
        terms_updated=row["terms_updated"],
        status=row["status"],
        review_state=row["review_state"],
        research_state=row["research_state"],
        note_fr=row["note_fr"],
        checked_at=None,
        facts=row["facts"],
    )
