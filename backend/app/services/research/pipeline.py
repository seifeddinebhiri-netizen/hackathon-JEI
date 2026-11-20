import asyncio
from collections import Counter
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from urllib.parse import urlparse

import structlog

from app.core.errors import AppError
from app.prompts import tool_research as prompts
from app.schemas.ai_tool import Fact, LLMDiscovery, LLMExtraction
from app.services.research.fetcher import FetchError, check_url, fetch_page_text
from app.services.research.quotes import quote_in_page
from app.services.tool_names import make_slug, normalize_name
from app.services.tool_status import compute_status

log = structlog.get_logger()

MAX_PAGES = 6
PAGE_CHARS_FOR_LLM = 60_000
MAX_FACTS_PER_PAGE = 12
MIN_PAGE_CHARS = 200  # en dessous, la page est une coquille (contenu chargé par JavaScript)
RESEARCH_TEMPERATURE = 0.0  # lecture et extraction : la même page doit donner les mêmes faits

Fetcher = Callable[[str], Awaitable[str]]


def _squash(text: str) -> str:
    return " ".join(text.split())


def usable_pages(texts: dict[str, str], root_text: str | None) -> tuple[dict[str, str], str | None]:
    """Écarte les pages qui ne sont pas de la vraie documentation.

    - coquille vide (< 200 caractères) : le contenu est chargé par JavaScript, on ne peut pas le lire ;
    - « soft 404 » : le site répond la page d'accueil (ou deux fois le même texte) à une adresse qui
      n'existe pas. Le modèle devine souvent des adresses comme /terms ou /privacy.
    Retourne les pages utilisables, et la raison de l'échec si aucune ne l'est."""
    squashed = {u: _squash(t) for u, t in texts.items()}
    counts = Counter(squashed.values())
    root = _squash(root_text) if root_text else None
    keep: dict[str, str] = {}
    empty = soft = 0
    for url, text in squashed.items():
        if len(text) < MIN_PAGE_CHARS:
            empty += 1
        elif text == root or counts[text] > 1:
            soft += 1
        else:
            keep[url] = texts[url]
    if keep:
        return keep, None
    if soft:
        return {}, (
            "Les adresses officielles proposées renvoient la page d'accueil du site : "
            "la documentation n'a pas été trouvée automatiquement."
        )
    return {}, (
        "Les pages officielles se chargent par JavaScript : "
        "nous ne pouvons pas les lire automatiquement."
    )


class ResearchFailed(Exception):
    """Aucune documentation exploitable trouvée : rien n'est enregistré au catalogue."""


@dataclass
class ResearchResult:
    slug: str
    name: str
    vendor: str
    official_site: str | None
    categories: list[str]
    terms_url: str | None
    privacy_url: str | None
    terms_updated: str | None
    status: str
    facts: list[Fact]
    aliases: list[str]
    pages_read: list[str] = field(default_factory=list)
    rejected: int = 0


def _registrable(host: str) -> str:
    parts = host.lower().split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host.lower()


def same_site(url: str, official_site: str) -> bool:
    """Une page n'est lue que si elle est sur le site officiel proposé : le modèle ne peut pas nous
    envoyer lire n'importe quel domaine."""
    try:
        return _registrable(urlparse(url).hostname or "") == _registrable(
            urlparse(official_site).hostname or ""
        )
    except ValueError:
        return False


def _kind_of(url: str) -> str:
    u = url.lower()
    if "privacy" in u:
        return "privacy"
    if "terms" in u or "tos" in u or "licen" in u or "legal" in u:
        return "terms"
    if "help" in u or "support" in u or "faq" in u:
        return "help"
    if "huggingface" in u or "model" in u:
        return "model_card"
    return "policy"


async def run_research(
    name: str,
    llm,
    fetch: Fetcher = fetch_page_text,
    page_check: Callable[[str], str] = check_url,
) -> ResearchResult:
    """Recherche guidée d'UN outil. Étapes : découvrir les pages officielles, les lire, extraire des
    faits citant la page, VÉRIFIER chaque citation en code, calculer le statut par des règles."""
    discovery = await llm.generate_structured(
        prompts.DISCOVERY_SYSTEM,
        prompts.discovery_user(name),
        LLMDiscovery,
        temperature=RESEARCH_TEMPERATURE,
    )
    site = discovery.official_site.strip()
    if not site:
        raise ResearchFailed("Outil non reconnu : aucun site officiel trouvé.")
    try:
        page_check(site)
    except FetchError as exc:
        raise ResearchFailed(f"Site officiel refusé : {exc}") from exc

    urls: list[str] = []
    for u in discovery.page_urls:
        if u not in urls and same_site(u, site):
            urls.append(u)
    urls = urls[:MAX_PAGES]

    texts: dict[str, str] = {}
    sem = asyncio.Semaphore(3)

    async def read(url: str) -> None:
        async with sem:
            try:
                texts[url] = await fetch(url)
            except FetchError as exc:
                log.info("tool_research_page_failed", url=url, reason=str(exc))

    await asyncio.gather(*(read(u) for u in urls))
    if not texts:
        raise ResearchFailed("Aucune page officielle n'a pu être lue.")
    try:
        root_text = await fetch(site)
    except FetchError:
        root_text = None
    texts, why = usable_pages(texts, root_text)
    if not texts:
        raise ResearchFailed(why or "Aucune page officielle exploitable.")

    verified: list[Fact] = []
    rejected = 0
    returned = 0  # faits proposés par le modèle, vérifiés ou non
    categories: list[str] = []
    vendor = discovery.vendor
    terms_updated = None
    for url, text in texts.items():
        extraction = await llm.generate_structured(
            prompts.EXTRACTION_SYSTEM,
            prompts.extraction_user(name, url, _kind_of(url), text[:PAGE_CHARS_FOR_LLM]),
            LLMExtraction,
            temperature=RESEARCH_TEMPERATURE,
        )
        categories = categories or extraction.categories
        terms_updated = terms_updated or extraction.terms_updated
        for f in extraction.facts[:MAX_FACTS_PER_PAGE]:
            returned += 1
            # La source doit être une page réellement lue, et la phrase doit s'y trouver mot pour mot.
            source = f.source_url if f.source_url in texts else url
            if not quote_in_page(f.quote, texts[source]):
                rejected += 1
                continue
            verified.append(
                Fact(
                    field=f.field,
                    plan=f.plan or "all",
                    value_fr=f.value_fr,
                    quote=f.quote[:500],
                    source_url=source,
                    source_kind=f.source_kind,
                    quote_verified=True,
                )
            )
    if not verified and returned == 0:
        raise ResearchFailed(
            "Les pages officielles lues ne répondent à aucune de nos questions "
            "(entraînement, usage de tes contenus, droits sur les sorties)."
        )
    if not verified:
        raise ResearchFailed(
            "Aucune information vérifiable (les citations du modèle étaient absentes des pages)."
        )

    seen: set[tuple[str, str, str]] = set()
    facts = []
    for f in verified:
        key = (f.field, f.plan, f.quote)
        if key not in seen:
            seen.add(key)
            facts.append(f)

    terms = next((u for u in texts if _kind_of(u) == "terms"), None)
    privacy = next((u for u in texts if _kind_of(u) == "privacy"), None)
    slug = make_slug(name)
    return ResearchResult(
        slug=slug,
        name=name.strip(),
        vendor=vendor,
        official_site=site,
        categories=categories[:6],
        terms_url=terms,
        privacy_url=privacy,
        terms_updated=terms_updated,
        status=compute_status(facts),
        facts=facts,
        aliases=sorted({normalize_name(name), normalize_name(slug)}),
        pages_read=list(texts),
        rejected=rejected,
    )


def ensure_ok(name: str) -> None:
    if len(normalize_name(name)) < 2:
        raise AppError("Nom d'outil trop court.", status_code=422, code="nom_invalide")
