import ipaddress
import socket
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import ClassVar
from urllib import robotparser
from urllib.parse import urlparse

import httpx

MAX_BYTES = 2_000_000
MAX_TEXT_CHARS = 120_000
TIMEOUT_S = 20.0
MAX_REDIRECTS = 4
USER_AGENT = (
    "PremierPlanBot/0.1 (recherche de documentation publique; contact: equipe Premier Plan)"
)


class FetchError(Exception):
    pass


class FetchUnreachable(FetchError):
    """Le site ne répond pas : domaine inexistant, certificat HTTPS invalide, connexion refusée.
    Souvent une faute de frappe dans le nom, ou un faux site : on ne lit rien."""


class FetchBlocked(FetchError):
    """Le site refuse la lecture automatique (401, 403, 429). On ne cherche pas à passer outre."""


BLOCKED_STATUS = (401, 403, 429)

# --- robots.txt : si un site demande aux robots de ne pas lire une page, on ne la lit pas -----------
ROBOT_TOKEN = "PremierPlanBot"
ROBOTS_TTL_S = 3600
_robots: dict[str, tuple[float, robotparser.RobotFileParser | None]] = {}


def clear_robots_cache() -> None:
    _robots.clear()


async def robots_allow(url: str, client: httpx.AsyncClient) -> bool:
    """Le robots.txt du site autorise-t-il notre robot à lire cette adresse ? En cas de doute
    (pas de fichier, erreur réseau), on autorise : c'est une lecture ponctuelle demandée par un utilisateur."""
    parts = urlparse(url)
    origin = f"{parts.scheme}://{parts.netloc}"
    cached = _robots.get(origin)
    if cached is None or cached[0] < time.monotonic():
        parser: robotparser.RobotFileParser | None = None
        try:
            target = f"{origin}/robots.txt"
            for _ in range(
                MAX_REDIRECTS + 1
            ):  # site.com -> www.site.com est courant : on suit, en revérifiant
                check_url(target)
                resp = await client.get(target, follow_redirects=False)
                if not resp.is_redirect:
                    break
                target = str(resp.url.join(resp.headers.get("location", "")))
            else:
                resp = None
            if (
                resp is not None
                and resp.status_code == 200
                and "html" not in resp.headers.get("content-type", "")
            ):
                parser = robotparser.RobotFileParser()
                parser.parse(resp.text.splitlines())
        except (httpx.HTTPError, FetchError):
            parser = None
        cached = (time.monotonic() + ROBOTS_TTL_S, parser)
        _robots[origin] = cached
    parser = cached[1]
    return True if parser is None else parser.can_fetch(ROBOT_TOKEN, url)


def _is_public(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError as exc:
        raise FetchUnreachable("domaine introuvable") from exc
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if not ip.is_global:  # privé, loopback, lien local, métadonnées cloud...
            return False
    return bool(infos)


def check_url(url: str) -> str:
    """Une page de recherche doit être en https, sur un domaine public. Évite qu'un nom d'outil
    ou une réponse du modèle fasse lire une adresse interne du serveur (SSRF)."""
    parts = urlparse(url)
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password:
        raise FetchError("URL refusée (https obligatoire).")
    if parts.port not in (None, 443):
        raise FetchError("URL refusée (port).")
    if not _is_public(parts.hostname):
        raise FetchError("URL refusée (adresse non publique).")
    return url


class _Text(HTMLParser):
    SKIP: ClassVar[set[str]] = {"script", "style", "noscript", "svg", "head"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        elif tag in {"p", "br", "li", "h1", "h2", "h3", "h4", "tr", "div", "section"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def html_to_text(html: str) -> str:
    parser = _Text()
    parser.feed(html)
    return "".join(parser.parts)


@dataclass(frozen=True)
class Page:
    """Une page lue : adresse finale (après redirections), HTML brut et texte lisible."""

    url: str
    html: str
    text: str


async def fetch_page(
    url: str, client: httpx.AsyncClient | None = None, respect_robots: bool = True
) -> Page:
    """Lit une page publique : redirections vérifiées une à une, taille bornée.

    Un site qui répond 401, 403 ou 429 à un robot qui se présente honnêtement refuse la lecture
    automatique : on le signale (`FetchBlocked`) et on s'arrête, sans chercher à contourner."""
    own = client is None
    client = client or httpx.AsyncClient(
        timeout=TIMEOUT_S, follow_redirects=False, headers={"User-Agent": USER_AGENT}
    )
    try:
        current = check_url(url)
        for _ in range(MAX_REDIRECTS + 1):
            if respect_robots and not await robots_allow(current, client):
                raise FetchBlocked("robots.txt")
            async with client.stream("GET", current) as resp:
                if resp.is_redirect:
                    location = resp.headers.get("location", "")
                    current = check_url(str(resp.url.join(location)))
                    continue
                if resp.status_code in BLOCKED_STATUS:
                    raise FetchBlocked(f"HTTP {resp.status_code}")
                if resp.status_code != 200:
                    raise FetchError(f"HTTP {resp.status_code}")
                kind = resp.headers.get("content-type", "")
                if "html" not in kind and "text" not in kind:
                    raise FetchError("type de contenu non pris en charge")
                body = b""
                async for chunk in resp.aiter_bytes():
                    body += chunk
                    if len(body) > MAX_BYTES:
                        break
                raw = body.decode(resp.encoding or "utf-8", errors="replace")
                text = html_to_text(raw) if "html" in kind else raw
                return Page(
                    url=current, html=raw if "html" in kind else "", text=text[:MAX_TEXT_CHARS]
                )
        raise FetchError("trop de redirections")
    except httpx.ConnectError as exc:
        raise FetchUnreachable(_why_unreachable(exc)) from exc
    except httpx.HTTPError as exc:
        raise FetchError(f"réseau : {type(exc).__name__}") from exc
    finally:
        if own:
            await client.aclose()


def _why_unreachable(exc: httpx.ConnectError) -> str:
    """Une raison lisible : « ConnectError » seul ne dit pas s'il s'agit d'un faux site ou d'un panne."""
    text = str(exc).lower()
    if "certificate" in text or "ssl" in text:
        return "certificat HTTPS invalide"
    if "name or service not known" in text or "nodename" in text or "getaddrinfo" in text:
        return "domaine introuvable"
    return "connexion impossible"


async def fetch_page_text(url: str, client: httpx.AsyncClient | None = None) -> str:
    """Texte lisible d'une page publique (voir `fetch_page`)."""
    return (await fetch_page(url, client)).text
