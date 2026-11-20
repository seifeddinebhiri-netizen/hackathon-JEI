import ipaddress
import socket
from html.parser import HTMLParser
from typing import ClassVar
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


def _is_public(host: str) -> bool:
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        return False
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


async def fetch_page_text(url: str, client: httpx.AsyncClient | None = None) -> str:
    """Texte lisible d'une page publique (redirections vérifiées une à une, taille bornée)."""
    own = client is None
    client = client or httpx.AsyncClient(
        timeout=TIMEOUT_S, follow_redirects=False, headers={"User-Agent": USER_AGENT}
    )
    try:
        current = check_url(url)
        for _ in range(MAX_REDIRECTS + 1):
            async with client.stream("GET", current) as resp:
                if resp.is_redirect:
                    location = resp.headers.get("location", "")
                    current = check_url(str(resp.url.join(location)))
                    continue
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
                text = body.decode(resp.encoding or "utf-8", errors="replace")
                return (
                    html_to_text(text)[:MAX_TEXT_CHARS] if "html" in kind else text[:MAX_TEXT_CHARS]
                )
        raise FetchError("trop de redirections")
    except httpx.HTTPError as exc:
        raise FetchError(f"réseau : {type(exc).__name__}") from exc
    finally:
        if own:
            await client.aclose()
