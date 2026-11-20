import re
import unicodedata
from html.parser import HTMLParser
from urllib.parse import urldefrag, urljoin, urlparse

import structlog

log = structlog.get_logger()

# Mots qui annoncent une page juridique. Plus le total est haut, plus la page est utile à la recherche.
_SCORES: list[tuple[re.Pattern[str], int]] = [
    (
        re.compile(
            r"terms[\s-]*(of[\s-]*(service|use))?|\btos\b|conditions|cgu|cgv|agreement",
            re.IGNORECASE,
        ),
        10,
    ),
    (
        re.compile(
            r"privacy|confidentialit|data[\s-]*protection|donn[eé]es[\s-]*personnelles",
            re.IGNORECASE,
        ),
        9,
    ),
    (re.compile(r"licen[cs]e", re.IGNORECASE), 6),
    (re.compile(r"\blegal\b|mentions[\s-]*l[eé]gales", re.IGNORECASE), 5),
    (re.compile(r"polic(y|ies)|politique", re.IGNORECASE), 5),
    (re.compile(r"data[\s-]*(use|usage|control)|training|entra[iî]nement", re.IGNORECASE), 4),
    (
        re.compile(
            r"responsible|safety|trust|security|transparency|model[\s-]*card|copyright",
            re.IGNORECASE,
        ),
        3,
    ),
]
_NOT_LEGAL = re.compile(
    r"cookie|career|jobs|press|blog|pricing|download|login|signup|sign[\s-]*in", re.IGNORECASE
)
_SKIP_SCHEMES = ("javascript:", "mailto:", "tel:", "#", "data:")

# Chemins où les sites mettent leurs conditions : testés seulement si la page d'accueil n'en montre pas.
COMMON_PATHS = (
    "/terms",
    "/terms-of-service",
    "/terms-of-use",
    "/tos",
    "/legal",
    "/legal/terms",
    "/legal/terms-of-service",
    "/privacy",
    "/privacy-policy",
    "/legal/privacy",
    "/legal/privacy-policy",
    "/policies/terms-of-use",
    "/policies/privacy-policy",
    "/terms-and-conditions",
    "/conditions",
)

_GENERIC_WORDS = {
    "chat",
    "open",
    "tool",
    "tools",
    "studio",
    "labs",
    "video",
    "image",
    "music",
    "voice",
    "text",
    "speech",
    "app",
}


def _ascii(text: str) -> str:
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()


class _Anchors(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._href is not None:
            self.links.append((self._href, " ".join("".join(self._text).split())))
            self._href = None


def extract_links(html: str, base_url: str) -> list[tuple[str, str]]:
    """Liens (adresse absolue, texte) d'une page HTML, sans ancres, mailto ni javascript."""
    parser = _Anchors()
    try:
        parser.feed(html)
    except Exception:  # noqa: BLE001 - un HTML cassé ne doit pas arrêter la recherche
        log.info("tool_research_bad_html", base=base_url)
    out: list[tuple[str, str]] = []
    for href, text in parser.links:
        href = href.strip()
        if not href or href.lower().startswith(_SKIP_SCHEMES):
            continue
        url, _ = urldefrag(urljoin(base_url, href))
        if urlparse(url).scheme in ("http", "https"):
            out.append((url, text))
    return out


def legal_score(url: str, text: str = "") -> int:
    haystack = f"{urlparse(url).path} {text}"
    if _NOT_LEGAL.search(haystack) and not _SCORES[0][0].search(haystack):
        return 0
    # La meilleure catégorie, pas la somme : « Privacy Policy » ne doit pas passer devant « Terms ».
    return max((points for pattern, points in _SCORES if pattern.search(haystack)), default=0)


def _registrable(host: str) -> str:
    parts = host.lower().split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host.lower()


def same_site(url: str, site: str) -> bool:
    """Une page n'est lue que si elle est sur le site officiel : ni le modèle ni un lien trouvé ne
    peuvent nous envoyer lire un autre domaine."""
    try:
        return _registrable(urlparse(url).hostname or "") == _registrable(
            urlparse(site).hostname or ""
        )
    except ValueError:
        return False


def legal_links(html: str, base_url: str, site: str, limit: int = 8) -> list[str]:
    """Pages juridiques annoncées par la page d'accueil (pied de page, menu), les plus utiles d'abord."""
    scored: dict[str, int] = {}
    for url, text in extract_links(html, base_url):
        if not same_site(url, site):
            continue
        score = legal_score(url, text)
        if score > 0 and url.rstrip("/") != base_url.rstrip("/"):
            scored[url] = max(score, scored.get(url, 0))
    return [u for u, _ in sorted(scored.items(), key=lambda kv: -kv[1])][:limit]


def urls_in_text(text: str) -> list[str]:
    """Adresses écrites dans un texte (réponse de recherche), sans la ponctuation qui les suit."""
    found = re.findall(r"https?://[^\s)\]>\"'<]+", text)
    seen: dict[str, None] = {}
    for u in found:
        seen[u.rstrip(".,;:*")] = None
    return list(seen)


def site_matches(names: list[str], site: str, text: str) -> bool:
    """Le site parle-t-il bien de cet outil ? Un mot significatif du nom (ou du fournisseur) doit
    figurer dans l'adresse ou dans la page d'accueil : écarte un site voisin ou un faux site."""
    host = re.sub(r"[^a-z0-9]", "", _ascii(urlparse(site).hostname or ""))
    page = re.sub(r"[^a-z0-9]", "", _ascii(text))
    for name in names:
        for token in re.findall(r"[a-z0-9]{3,}", _ascii(name)):
            # « kimik2 » → aussi « kimi » : on ignore le suffixe de version (k2, v3, 4o...).
            stem = re.sub(r"[a-z]?\d+[a-z]*$", "", token)
            for word in {token, stem}:
                if len(word) >= 4 and word not in _GENERIC_WORDS and (word in host or word in page):
                    return True
    return False
