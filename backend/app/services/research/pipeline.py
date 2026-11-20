import asyncio
import re
from collections import Counter
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from urllib.parse import urlparse

import structlog

from app.core.errors import AppError
from app.prompts import tool_research as prompts
from app.schemas.ai_tool import Fact, LLMDiscovery, LLMExtraction
from app.services.llm_service import LLMUnavailable
from app.services.research import sources
from app.services.research.discovery import (
    COMMON_PATHS,
    legal_links,
    same_site,
    site_matches,
    urls_in_text,
)
from app.services.research.fetcher import (
    FetchBlocked,
    FetchError,
    FetchUnreachable,
    Page,
    check_url,
    fetch_page,
)
from app.services.research.quotes import quote_in_page
from app.services.tool_names import make_slug, normalize_name
from app.services.tool_status import compute_status

log = structlog.get_logger()

MAX_PAGES = 6  # pages lues par l'IA
MAX_CANDIDATES = 12  # adresses essayées au total
PAGE_CHARS_FOR_LLM = 40_000  # par page ; 6 pages au plus dans un seul appel
MAX_FACTS = 40  # faits retenus au total, toutes pages confondues
MIN_PAGE_CHARS = 200  # en dessous, la page est une coquille (contenu chargé par JavaScript)
RESEARCH_TEMPERATURE = 0.0  # lecture et extraction : la même page doit donner les mêmes faits

Reader = Callable[[str], Awaitable[Page]]
KnownLookup = Callable[[str], "sources.KnownSource | None"]


def _squash(text: str) -> str:
    return " ".join(text.split())


def usable_pages(texts: dict[str, str], root_text: str | None) -> tuple[dict[str, str], str | None]:
    """Écarte les pages qui ne sont pas de la vraie documentation.

    - coquille vide (< 200 caractères) : le contenu est chargé par JavaScript, on ne peut pas le lire ;
    - « soft 404 » : le site répond la page d'accueil (ou deux fois le même texte) à une adresse qui
      n'existe pas.
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
    how: str = ""  # comment le site a été trouvé : connu, recherche web, ou mémoire du modèle


def _host(url: str) -> str:
    return (urlparse(url).hostname or "").lower().removeprefix("www.")


def _kind_of(url: str) -> str:
    u = url.lower()
    if "privacy" in u or "confidential" in u:
        return "privacy"
    if "terms" in u or "tos" in u or "licen" in u or "legal" in u or "conditions" in u:
        return "terms"
    if "help" in u or "support" in u or "faq" in u:
        return "help"
    if "huggingface" in u or "model" in u:
        return "model_card"
    return "policy"


async def _find_site(
    name: str, llm, known: "sources.KnownSource | None"
) -> tuple[str, str, list[str], list[str], str]:
    """Site officiel, fournisseur, adresses proposées, adresses vues dans la recherche, et la méthode.

    1. outil connu : nos adresses vérifiées ; 2. recherche web : le site est choisi parmi de vrais
    résultats ; 3. en dernier recours seulement, la mémoire du modèle."""
    if known:
        return known.site, known.vendor, list(known.pages), [], "connu"

    search_text, domains = None, []
    try:
        grounded = await llm.grounded_search(prompts.grounded_query(name))
        search_text, domains = grounded.text, grounded.domains
    except (LLMUnavailable, AppError, AttributeError) as exc:
        log.info("tool_research_no_search", reason=str(exc)[:120])
    discovery = await llm.generate_structured(
        prompts.DISCOVERY_SYSTEM,
        prompts.discovery_user(name, search_text, domains),
        LLMDiscovery,
        temperature=RESEARCH_TEMPERATURE,
    )
    seen = urls_in_text(search_text) if search_text else []
    how = "recherche web" if search_text else "mémoire du modèle"
    return discovery.official_site.strip(), discovery.vendor, discovery.page_urls, seen, how


async def run_research(
    name: str,
    llm,
    read: Reader = fetch_page,
    page_check: Callable[[str], str] = check_url,
    known_lookup: KnownLookup = sources.lookup,
) -> ResearchResult:
    """Recherche guidée d'UN outil.

    Étapes : trouver le site officiel, lire sa page d'accueil (y repérer les liens « conditions » et
    « confidentialité »), lire les pages juridiques, faire extraire des faits citant la page, VÉRIFIER
    chaque citation en code, calculer le statut par des règles. Un site qui refuse la lecture
    automatique est signalé tel quel : on ne cherche pas à le contourner."""
    known = known_lookup(name)
    site, vendor, proposed, from_search, how = await _find_site(name, llm, known)
    if not site:
        raise ResearchFailed("Outil non reconnu : aucun site officiel trouvé.")
    try:
        page_check(site)
    except FetchError as exc:
        raise ResearchFailed(f"Site officiel refusé : {exc}") from exc

    blocked = 0
    unreachable: list[str] = []  # raisons : « certificat HTTPS invalide », « domaine introuvable »…

    async def safe_read(url: str) -> Page | None:
        nonlocal blocked
        try:
            return await read(url)
        except FetchBlocked:
            blocked += 1
        except FetchUnreachable as exc:
            unreachable.append(str(exc))
            log.info("tool_research_site_unreachable", url=url, reason=str(exc))
        except FetchError as exc:
            log.info("tool_research_page_failed", url=url, reason=str(exc))
        return None

    home = await safe_read(site)
    if home is None and unreachable and not known:
        # Site injoignable (faux site, certificat invalide, faute de frappe dans le nom) : on demande UNE
        # fois l'orthographe officielle au modèle, puis on reprend avec le nouveau site.
        why = unreachable[-1]
        retry = await llm.generate_structured(
            prompts.DISCOVERY_SYSTEM,
            prompts.discovery_retry_user(name, site, why),
            LLMDiscovery,
            temperature=RESEARCH_TEMPERATURE,
        )
        new_site = retry.official_site.strip()
        if new_site and _host(new_site) != _host(site):
            try:
                page_check(new_site)
            except FetchError as exc:
                raise ResearchFailed(f"Site officiel refusé : {exc}") from exc
            site, vendor, proposed, from_search = (
                new_site,
                retry.vendor or vendor,
                retry.page_urls,
                [],
            )
            how += ", orthographe corrigée"
            unreachable.clear()
            home = await safe_read(site)
    names = [name, vendor]
    # Le site parle-t-il de cet outil ? Si l'accueil est illisible, l'adresse seule doit le suggérer.
    if not known and not site_matches(names, site, home.text if home else ""):
        raise ResearchFailed(
            "Le site trouvé ne mentionne pas cet outil : nous préférons ne rien enregistrer plutôt qu'une "
            "fiche douteuse."
        )

    candidates: dict[str, None] = {}

    def add(urls) -> None:
        for u in urls:
            if u not in candidates and (known or same_site(u, site)):
                candidates[u] = None

    add(proposed if known else [])  # nos adresses vérifiées passent en premier
    if home and home.html:
        add(legal_links(home.html, home.url, site))
    add(u for u in from_search if same_site(u, site))
    add(proposed if not known else [])
    # Les chemins courants ne sont devinés que s'il manque les conditions OU la confidentialité.
    kinds = {_kind_of(u) for u in candidates}
    if not {"terms", "privacy"} <= kinds:
        base = site.rstrip("/")
        add(base + path for path in COMMON_PATHS)
    urls = list(candidates)[:MAX_CANDIDATES]

    pages: dict[str, Page] = {}
    gate = asyncio.Semaphore(4)

    async def load(url: str) -> None:
        async with gate:
            page = await safe_read(url)
            if page:
                pages[url] = page

    await asyncio.gather(*(load(u) for u in urls))
    if not pages:
        if unreachable and not blocked:
            raise ResearchFailed(
                f"Le site « {_host(site)} » est injoignable ({unreachable[-1]}). Le nom de l'outil est peut-être "
                "mal orthographié : vérifie-le et réessaie."
            )
        if blocked:
            raise ResearchFailed(
                "Le site de cet outil refuse la lecture automatique de ses conditions (accès bloqué). "
                "Nous ne contournons pas ce blocage."
            )
        raise ResearchFailed("Aucune page officielle n'a pu être lue.")

    texts, why = usable_pages({u: p.text for u, p in pages.items()}, home.text if home else None)
    if not texts:
        raise ResearchFailed(why or "Aucune page officielle exploitable.")
    texts = dict(list(texts.items())[:MAX_PAGES])
    final_url = {u: pages[u].url for u in texts}

    # UN seul appel pour toutes les pages : moins cher et plus rapide que un appel par page.
    by_final = {final_url[u]: u for u in texts}
    extraction = await llm.generate_structured(
        prompts.EXTRACTION_SYSTEM,
        prompts.extraction_user(
            name,
            [(final_url[u], _kind_of(u), t[:PAGE_CHARS_FOR_LLM]) for u, t in texts.items()],
        ),
        LLMExtraction,
        temperature=RESEARCH_TEMPERATURE,
    )
    categories = extraction.categories
    terms_updated = extraction.terms_updated
    returned = min(
        len(extraction.facts), MAX_FACTS
    )  # faits proposés par le modèle, vérifiés ou non
    verified: list[Fact] = []
    rejected = 0
    for f in extraction.facts[:MAX_FACTS]:
        # La phrase doit se trouver MOT POUR MOT dans une page réellement lue : d'abord celle que le modèle
        # cite, sinon n'importe quelle autre. La source enregistrée est la page où elle est vraiment.
        cited = by_final.get(f.source_url)
        order = ([cited] if cited else []) + [u for u in texts if u != cited]
        found = next((u for u in order if quote_in_page(f.quote, texts[u])), None)
        if found is None:
            rejected += 1
            continue
        verified.append(
            Fact(
                field=f.field,
                plan=f.plan or "all",
                value_fr=f.value_fr,
                quote=f.quote[:500],
                source_url=final_url[found],
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

    terms = next((final_url[u] for u in texts if _kind_of(u) == "terms"), None)
    privacy = next((final_url[u] for u in texts if _kind_of(u) == "privacy"), None)
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
        pages_read=list(final_url.values()),
        rejected=rejected,
        how=how,
    )


def ensure_ok(name: str) -> None:
    if len(re.sub(r"\W", "", name)) < 2:
        raise AppError("Nom d'outil trop court.", status_code=422, code="nom_invalide")
