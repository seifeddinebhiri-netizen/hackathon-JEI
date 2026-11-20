import asyncio

import pytest

from app.schemas.ai_tool import LLMDiscovery, LLMExtraction, LLMFact
from app.services.llm_service import GroundedResult, LLMUnavailable
from app.services.research import pipeline
from app.services.research.discovery import (
    COMMON_PATHS,
    extract_links,
    legal_links,
    legal_score,
    site_matches,
    urls_in_text,
)
from app.services.research.fetcher import (
    FetchBlocked,
    FetchError,
    FetchUnreachable,
    Page,
    html_to_text,
)
from app.services.research.pipeline import MAX_CANDIDATES, MAX_PAGES, ResearchFailed, run_research
from app.services.research.sources import KnownSource

SITE = "https://zorbo.example"
FILLER = (
    " Other sections describe accounts, billing, acceptable use and termination of the service." * 4
)
TERMS = f"<html><body><h1>Terms of Service</h1><p>We may use your Inputs and Outputs to train our models. You own your Outputs.{FILLER}</p></body></html>"
PRIVACY = f"<html><body><h1>Privacy</h1><p>We keep your data for thirty days and never sell it.{FILLER}</p></body></html>"
HOME = (
    "<html><body><h1>Zorbo Studio</h1><p>Make things with Zorbo.</p>"
    '<footer><a href="/legal/terms">Terms of Service</a> <a href="/legal/privacy">Privacy Policy</a>'
    '<a href="/blog">Blog</a><a href="https://other.example/terms">Terms</a></footer></body></html>'
)
OK_FACT = LLMFact(
    field="input_training_use", plan="all", value_fr="Tes contenus servent à entraîner.",
    quote="We may use your Inputs and Outputs to train our models",
    source_url=f"{SITE}/legal/terms", source_kind="terms",
)  # fmt: skip
OWN_FACT = LLMFact(
    field="output_rights", plan="all", value_fr="Tu possèdes les sorties.",
    quote="You own your Outputs", source_url=f"{SITE}/legal/terms", source_kind="terms",
)  # fmt: skip
INVENTED = LLMFact(
    field="training_data", plan="all", value_fr="Entraîné sur des données sous licence.",
    quote="Our models are trained exclusively on licensed data",
    source_url=f"{SITE}/legal/terms", source_kind="terms",
)  # fmt: skip


class Web:
    """Faux web : adresse -> HTML (ou erreur). Enregistre chaque lecture."""

    def __init__(self, pages: dict[str, object]):
        self.pages, self.reads = pages, []

    async def __call__(self, url: str) -> Page:
        self.reads.append(url)
        value = self.pages.get(url)
        if value is None:
            raise FetchError("HTTP 404")
        if isinstance(value, Exception):
            raise value
        if isinstance(value, Page):
            return value
        return Page(url=url, html=str(value), text=html_to_text(str(value)))


class FakeLLM:
    def __init__(self, extractions, discovery=None, search=None, retry_discovery=None):
        self.extractions = extractions
        self.discovery = discovery or LLMDiscovery(
            vendor="Zorbo Inc.", official_site=SITE, page_urls=[]
        )
        self.search = search  # None : la recherche web est indisponible
        self.retry_discovery, self._discoveries = retry_discovery, 0
        self.calls: list[tuple[str, str]] = []
        self.temperatures: list[float | None] = []

    async def grounded_search(self, query):
        self.calls.append(("search", query))
        if self.search is None:
            raise LLMUnavailable("pas de recherche")
        return self.search

    async def generate_structured(self, system, user, schema, temperature=None):
        self.calls.append((schema.__name__, user))
        self.temperatures.append(temperature)
        if schema is LLMDiscovery:
            self._discoveries += 1
            if self._discoveries > 1 and self.retry_discovery is not None:
                return self.retry_discovery
            return self.discovery
        return self.extractions.pop(0)

    def kinds(self):
        return [c[0] for c in self.calls]


def extraction(*facts):
    return LLMExtraction(
        vendor="Zorbo Inc.", terms_updated="2026-10-01", categories=["image"], facts=list(facts)
    )


def research(llm, web, known=None, name="Zorbo X"):
    return asyncio.run(
        run_research(name, llm, read=web, page_check=lambda u: u, known_lookup=lambda _n: known)
    )


FULL_WEB = {SITE: HOME, f"{SITE}/legal/terms": TERMS, f"{SITE}/legal/privacy": PRIVACY}


# --- les liens de la page d'accueil remplacent la devinette du modèle -------------------------
def test_homepage_footer_links_are_used_when_the_model_guesses_wrong_urls():
    llm = FakeLLM(
        [extraction(OK_FACT, OWN_FACT), extraction()],
        discovery=LLMDiscovery(
            vendor="Zorbo Inc.", official_site=SITE, page_urls=[f"{SITE}/terms-of-service"]
        ),
    )
    web = Web(FULL_WEB)  # /terms-of-service n'existe pas : le modèle s'est trompé
    result = research(llm, web)
    assert {f.field for f in result.facts} == {"input_training_use", "output_rights"}
    assert f"{SITE}/legal/terms" in result.pages_read
    assert f"{SITE}/terms-of-service" in web.reads  # essayé, absent : sans conséquence
    assert not any(
        "other.example" in u for u in web.reads
    )  # lien vers un autre domaine : jamais lu
    assert f"{SITE}/blog" not in web.reads  # pas une page juridique


def test_common_paths_are_probed_only_when_the_homepage_shows_nothing():
    plain_home = "<html><body><h1>Zorbo</h1><p>Hello.</p></body></html>"
    web = Web(
        {SITE: plain_home, f"{SITE}/terms-of-service": TERMS, f"{SITE}/privacy-policy": PRIVACY}
    )
    result = research(FakeLLM([extraction(OK_FACT)]), web)
    assert f"{SITE}/terms-of-service" in result.pages_read
    assert any(r.endswith(path) for r in web.reads for path in COMMON_PATHS)

    probed = Web(FULL_WEB)
    research(FakeLLM([extraction(OK_FACT)]), probed)
    # Les conditions et la confidentialité sont déjà annoncées par l'accueil : rien à deviner.
    assert not any(r in probed.reads for r in (f"{SITE}/terms", f"{SITE}/tos", f"{SITE}/privacy"))


def test_at_most_a_few_pages_are_tried_and_all_go_to_the_ai_in_one_single_call():
    many = {
        SITE: "<html><body>"
        + "".join(f'<a href="/legal/terms-{i}">Terms {i}</a>' for i in range(30))
        + "</body></html>"
    }
    for i in range(30):
        many[f"{SITE}/legal/terms-{i}"] = (
            TERMS.replace("Terms of Service", f"Terms {i}") + f" page {i}"
        )
    llm = FakeLLM([extraction(OK_FACT)])
    web = Web(many)
    research(llm, web)
    assert len(web.reads) <= MAX_CANDIDATES + 1  # + la page d'accueil
    assert (
        llm.kinds().count("LLMExtraction") == 1
    )  # un appel, pas un par page (quota gratuit limité)
    prompt = next(c[1] for c in llm.calls if c[0] == "LLMExtraction")
    assert prompt.count("DÉBUT DE LA PAGE") <= MAX_PAGES


def test_a_quote_is_attributed_to_the_page_where_it_really_is_even_if_the_model_cites_another():
    in_privacy = LLMFact(
        field="input_training_use", plan="all", value_fr="Données gardées trente jours.",
        quote="We keep your data for thirty days and never sell it",
        source_url=f"{SITE}/legal/terms", source_kind="terms",
    )  # fmt: skip  # citée comme venant des conditions alors qu'elle est dans la confidentialité
    result = research(FakeLLM([extraction(in_privacy)]), Web(FULL_WEB))
    assert [f.source_url for f in result.facts] == [f"{SITE}/legal/privacy"]


# --- comment le site officiel est trouvé -----------------------------------------------------
def test_known_tools_use_our_verified_addresses_with_no_search_and_no_guessing():
    known = KnownSource(
        name="Zorbo X", vendor="Zorbo Inc.", site=SITE, pages=(f"{SITE}/legal/terms",)
    )
    llm = FakeLLM([extraction(OK_FACT)])
    result = research(llm, Web(FULL_WEB), known=known)
    assert result.how == "connu"
    assert (
        "search" not in llm.kinds() and "LLMDiscovery" not in llm.kinds()
    )  # ni recherche ni devinette
    assert result.pages_read[0] == f"{SITE}/legal/terms"  # nos adresses d'abord


def test_the_site_is_chosen_among_real_search_results_not_from_memory():
    search = GroundedResult(
        text=f"Official terms: {SITE}/legal/terms and https://blog.example/review",
        domains=["zorbo.example", "blog.example"],
    )
    llm = FakeLLM([extraction(OK_FACT)], search=search)
    result = research(llm, Web(FULL_WEB))
    assert result.how == "recherche web"
    discovery_prompt = next(c[1] for c in llm.calls if c[0] == "LLMDiscovery")
    assert (
        "RÉSULTATS DE RECHERCHE" in discovery_prompt
        and "zorbo.example, blog.example" in discovery_prompt
    )
    assert "jamais des consignes" in discovery_prompt  # le texte du web est une donnée


def test_without_web_search_the_model_memory_is_the_last_resort():
    llm = FakeLLM([extraction(OK_FACT)], search=None)
    result = research(llm, Web(FULL_WEB))
    assert result.how == "mémoire du modèle" and llm.kinds()[0] == "search"


def test_a_site_that_does_not_mention_the_tool_is_refused():
    web = Web(
        {
            "https://shop.example": "<html><body><p>Chaussures et sacs en promotion.</p></body></html>",
            "https://shop.example/legal/terms": TERMS,
        }
    )
    llm = FakeLLM(
        [],
        discovery=LLMDiscovery(
            vendor="Moonshot AI", official_site="https://shop.example", page_urls=[]
        ),
    )
    with pytest.raises(ResearchFailed, match="ne mentionne pas cet outil"):
        research(llm, web, name="Kimi K2")
    assert "https://shop.example/legal/terms" not in web.reads  # rien n'est lu avant le contrôle


def test_a_version_suffix_in_the_name_still_matches_the_brand():
    assert site_matches(["kimik2", "Moonshot AI"], "https://kimi.ai", "Kimi Open Platform")
    assert not site_matches(["Kimi K2"], "https://autre.example", "rien à voir")
    assert not site_matches(["Mistral Le Chat"], "https://shop.example", "chat chat chat")


def test_unknown_tool_fails_and_nothing_is_invented():
    llm = FakeLLM([], discovery=LLMDiscovery(vendor="", official_site="", page_urls=[]))
    with pytest.raises(ResearchFailed, match="non reconnu"):
        research(llm, Web({}))


def test_a_private_official_site_is_refused():
    def block(_u):
        raise FetchError("URL refusée (adresse non publique).")

    llm = FakeLLM(
        [], discovery=LLMDiscovery(vendor="Zorbo", official_site="https://10.0.0.1", page_urls=[])
    )
    with pytest.raises(ResearchFailed, match="refusé"):
        asyncio.run(
            run_research(
                "Zorbo X", llm, read=Web({}), page_check=block, known_lookup=lambda _n: None
            )
        )


def test_pages_outside_the_official_site_are_never_read():
    search = GroundedResult(
        text="https://evil.example/terms and http://169.254.169.254/x", domains=["evil.example"]
    )
    llm = FakeLLM(
        [extraction(OK_FACT), extraction()],
        search=search,
        discovery=LLMDiscovery(
            vendor="Zorbo Inc.",
            official_site=SITE,
            page_urls=["https://evil.example/terms", f"{SITE}/legal/terms"],
        ),
    )
    web = Web(FULL_WEB)
    research(llm, web)
    assert all(u.startswith(SITE) for u in web.reads)


# --- un site qui refuse les robots : on le dit, on ne contourne pas --------------------------
def test_a_site_that_blocks_bots_is_reported_honestly_and_not_worked_around():
    web = Web(
        {
            SITE: FetchBlocked("HTTP 403"),
            **{f"{SITE}{p}": FetchBlocked("HTTP 403") for p in COMMON_PATHS},
        }
    )
    with pytest.raises(ResearchFailed, match="refuse la lecture automatique") as exc:
        research(FakeLLM([]), web)
    assert "ne contournons pas" in str(exc.value)
    assert all(r.startswith(SITE) for r in web.reads)  # aucun autre chemin tenté (pas de relais)


def test_one_blocked_page_does_not_stop_the_research():
    pages = {**FULL_WEB, f"{SITE}/legal/privacy": FetchBlocked("HTTP 403")}
    result = research(FakeLLM([extraction(OK_FACT)]), Web(pages))
    assert result.pages_read == [f"{SITE}/legal/terms"]


# --- pages inutilisables : on dit pourquoi, on n'invente rien --------------------------------
def test_a_site_that_answers_its_homepage_to_any_address_is_detected():
    same = HOME + FILLER

    class Everything(Web):
        async def __call__(self, url):
            self.reads.append(url)
            return Page(url=url, html=same, text=html_to_text(same))

    with pytest.raises(ResearchFailed, match="page d'accueil"):
        research(FakeLLM([]), Everything({}))


def test_pages_loaded_by_javascript_are_reported_as_unreadable():
    shell = "<html><body><div id='root'></div></body></html>"
    pages = {
        SITE: shell,
        f"{SITE}/terms": shell + "<!-- a -->",
        f"{SITE}/privacy": shell + "<!-- b -->",
    }
    with pytest.raises(ResearchFailed, match="JavaScript"):
        research(FakeLLM([]), Web(pages))


def test_the_citation_must_be_in_the_page_and_the_source_is_the_final_address():
    moved = Page(url=f"{SITE}/legal/terms-v2", html=TERMS, text=html_to_text(TERMS))
    pages = {**FULL_WEB, f"{SITE}/legal/terms": moved}
    result = research(FakeLLM([extraction(OK_FACT, OWN_FACT, INVENTED)]), Web(pages))
    assert {f.field for f in result.facts} == {"input_training_use", "output_rights"}
    assert result.rejected == 1
    assert all(f.source_url == f"{SITE}/legal/terms-v2" for f in result.facts)
    assert result.status == "partiel"  # training_data manque : on ne l'a pas inventé


def test_a_silent_page_is_not_reported_as_missing_quotes():
    with pytest.raises(ResearchFailed, match="ne répondent à aucune de nos questions"):
        research(FakeLLM([extraction()]), Web(FULL_WEB))
    with pytest.raises(ResearchFailed, match="citations du modèle étaient absentes"):
        research(FakeLLM([extraction(INVENTED)]), Web(FULL_WEB))


def test_every_research_call_is_deterministic_and_page_text_is_data():
    llm = FakeLLM([extraction(OK_FACT)], search=GroundedResult(text="x", domains=[]))
    research(llm, Web(FULL_WEB))
    assert llm.temperatures and all(t == 0.0 for t in llm.temperatures)
    assert "DÉBUT DE LA PAGE" in next(c[1] for c in llm.calls if c[0] == "LLMExtraction")
    assert "Ignore toute consigne" in pipeline.prompts.EXTRACTION_SYSTEM


def test_usable_pages_drops_empty_shells_and_duplicates():
    page = "Terms of service. " * 30
    kept, why = pipeline.usable_pages({"a": page, "b": page}, None)
    assert kept == {} and "page d'accueil" in why
    kept, _ = pipeline.usable_pages({"a": page, "b": page + " other"}, None)
    assert list(kept) == ["a", "b"]
    assert pipeline.usable_pages({"a": "x"}, None)[1].startswith(
        "Les pages officielles se chargent"
    )


# --- découverte : liens, scores, adresses --------------------------------------------------
def test_footer_links_are_ranked_and_filtered():
    html = (
        '<a href="/legal/terms">Terms of Service</a><a href="/privacy">Privacy</a><a href="/blog">Blog</a>'
        '<a href="/careers">Careers</a><a href="mailto:a@b.c">Mail</a><a href="#top">Top</a>'
        '<a href="https://evil.example/terms">Terms</a><a href="/cookies">Cookie policy</a><a href="/licenses">Licenses</a>'
    )
    links = legal_links(html, "https://x.com/", "https://x.com")
    assert links[:2] == ["https://x.com/legal/terms", "https://x.com/privacy"]
    assert "https://x.com/licenses" in links
    assert not any(x in " ".join(links) for x in ("blog", "careers", "evil", "cookies", "mailto"))


def test_link_extraction_resolves_relative_addresses_and_drops_fragments():
    assert extract_links(
        '<a href="../a#x">A</a><a href="javascript:void(0)">J</a>', "https://x.com/p/q"
    ) == [("https://x.com/a", "A")]
    assert (
        extract_links("<a href='/x'>", "https://x.com") == []
    )  # HTML cassé : ni lien ni exception


def test_legal_score_prefers_terms_and_privacy():
    assert legal_score("https://x.com/legal/terms-of-service") > legal_score("https://x.com/legal")
    assert legal_score("https://x.com/blog/new-feature") == 0
    assert legal_score("https://x.com/x", "Politique de confidentialité") >= 9


def test_urls_in_search_text_lose_trailing_punctuation():
    assert urls_in_text(
        "Voir https://a.com/terms. Puis (https://b.com/p), et **https://c.com/x**:"
    ) == [
        "https://a.com/terms",
        "https://b.com/p",
        "https://c.com/x",
    ]


# --- site injoignable : faute de frappe dans le nom, faux site, certificat invalide ----------------
BAD = "https://higsfield.example"
GOOD = "https://higgsfield.example"


def web_for(site: str) -> dict[str, object]:
    return {
        site: HOME.replace("Zorbo", "Higgsfield"),
        f"{site}/legal/terms": TERMS,
        f"{site}/legal/privacy": PRIVACY,
    }


def unreachable_web(site: str, reason="certificat HTTPS invalide") -> dict[str, object]:
    return {
        site: FetchUnreachable(reason),
        **{f"{site}{p}": FetchUnreachable(reason) for p in COMMON_PATHS},
    }


def typo_llm(**kw) -> FakeLLM:
    return FakeLLM(
        [extraction(OK_FACT)],
        discovery=LLMDiscovery(vendor="Higsfield", official_site=BAD, page_urls=[]),
        retry_discovery=LLMDiscovery(vendor="Higgsfield AI", official_site=GOOD, page_urls=[]),
        **kw,
    )


def test_a_typo_in_the_name_is_corrected_once_the_first_site_turns_out_unreachable():
    llm = typo_llm()
    web = Web({**unreachable_web(BAD), **web_for(GOOD)})
    result = research(llm, web, name="Higsfield")
    assert result.official_site == GOOD and "orthographe corrigée" in result.how
    assert {f.field for f in result.facts} == {"input_training_use"}
    retry_prompt = [c[1] for c in llm.calls if c[0] == "LLMDiscovery"][1]
    assert (
        BAD in retry_prompt
        and "certificat HTTPS invalide" in retry_prompt
        and "faute de frappe" in retry_prompt
    )
    assert llm.kinds().count("LLMDiscovery") == 2  # une seule nouvelle tentative


def test_if_the_retry_finds_nothing_better_the_reason_is_explained_in_plain_words():
    llm = FakeLLM(
        [],
        discovery=LLMDiscovery(vendor="Higsfield", official_site=BAD, page_urls=[]),
        retry_discovery=LLMDiscovery(vendor="", official_site="", page_urls=[]),
    )
    with pytest.raises(ResearchFailed, match="injoignable") as exc:
        research(llm, Web(unreachable_web(BAD)), name="Higsfield")
    assert "certificat HTTPS invalide" in str(exc.value) and "mal orthographié" in str(exc.value)


def test_a_retry_that_gives_the_same_site_or_another_dead_one_does_not_loop():
    same = FakeLLM([], discovery=LLMDiscovery(vendor="H", official_site=BAD, page_urls=[]),
                   retry_discovery=LLMDiscovery(vendor="H", official_site=f"{BAD}/", page_urls=[]))  # fmt: skip
    with pytest.raises(ResearchFailed, match="injoignable"):
        research(same, Web(unreachable_web(BAD)), name="Higsfield")
    assert same.kinds().count("LLMDiscovery") == 2
    other = typo_llm()
    with pytest.raises(ResearchFailed, match="injoignable"):
        research(
            other,
            Web({**unreachable_web(BAD), **unreachable_web(GOOD, "domaine introuvable")}),
            name="Higsfield",
        )
    assert other.kinds().count("LLMDiscovery") == 2  # jamais plus d'une nouvelle tentative


def test_a_known_tool_or_a_blocked_site_is_never_retried():
    known = KnownSource(
        name="Higsfield", vendor="Higgsfield AI", site=BAD, pages=(f"{BAD}/legal/terms",)
    )
    llm = typo_llm()
    with pytest.raises(ResearchFailed, match="injoignable"):
        research(llm, Web(unreachable_web(BAD)), known=known, name="Higsfield")
    assert "LLMDiscovery" not in llm.kinds()
    blocked_llm = typo_llm()
    blocked = {
        BAD: FetchBlocked("HTTP 403"),
        **{f"{BAD}{p}": FetchBlocked("HTTP 403") for p in COMMON_PATHS},
    }
    with pytest.raises(ResearchFailed, match="refuse la lecture automatique"):
        research(blocked_llm, Web(blocked), name="Higsfield")
    assert blocked_llm.kinds().count("LLMDiscovery") == 1  # un refus n'est pas une faute de frappe


def test_a_corrected_site_still_has_to_mention_the_tool():
    llm = FakeLLM(
        [],
        discovery=LLMDiscovery(vendor="Higsfield", official_site=BAD, page_urls=[]),
        retry_discovery=LLMDiscovery(
            vendor="Higgsfield AI", official_site="https://shop.example", page_urls=[]
        ),
    )
    web = Web(
        {
            **unreachable_web(BAD),
            "https://shop.example": "<html><body>Chaussures en promotion.</body></html>",
        }
    )
    with pytest.raises(ResearchFailed, match="ne mentionne pas cet outil"):
        research(llm, web, name="Higsfield")
