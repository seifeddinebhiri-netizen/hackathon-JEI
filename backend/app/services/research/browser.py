import asyncio

import structlog

from app.services.research.fetcher import (
    BLOCKED_STATUS,
    MAX_TEXT_CHARS,
    USER_AGENT,
    FetchBlocked,
    FetchError,
    Page,
    check_url,
)

log = structlog.get_logger()

NAVIGATION_TIMEOUT_MS = 25_000
SETTLE_TIMEOUT_MS = 6_000
SKIPPED_RESOURCES = {"image", "media", "font"}


def request_allowed(url: str, resource_type: str) -> bool:
    """Une requête faite PAR la page lue est-elle permise ? https, site public, et pas d'image, de média
    ni de police (inutiles pour lire du texte). Évite qu'une page fasse lire une adresse interne."""
    if resource_type in SKIPPED_RESOURCES:
        return False
    try:
        check_url(url)
    except FetchError:
        return False
    return True


class BrowserUnavailable(FetchError):
    """Navigateur sans écran non installé (`uv sync --extra browser`, puis `playwright install chromium`)."""


class BrowserReader:
    """Lit une page dont le texte est chargé par JavaScript, avec un navigateur sans écran LOCAL.

    Cadre strict, pour que ce ne soit jamais un moyen de contourner un refus :
    - utilisé seulement pour une page qui s'est ouverte normalement mais n'affiche rien sans JavaScript ;
    - il se présente avec le même nom de robot honnête, et s'arrête sur un 401, 403 ou 429 ;
    - chaque requête de la page (pas seulement l'adresse de départ) doit être en https vers un site
      public : une page ne peut pas faire lire une adresse interne du serveur ;
    - rien n'est gardé : contexte neuf à chaque page, pas de cookies, pas de téléchargement."""

    def __init__(self, concurrency: int = 2) -> None:
        self._gate = asyncio.Semaphore(max(1, concurrency))
        self._playwright = None
        self._browser = None
        self._start_lock = asyncio.Lock()

    async def _ensure(self):
        async with self._start_lock:
            if self._browser is None:
                try:
                    from playwright.async_api import async_playwright
                except ImportError as exc:
                    raise BrowserUnavailable(
                        "Navigateur non installé (extra « browser »)."
                    ) from exc
                self._playwright = await async_playwright().start()
                try:
                    self._browser = await self._playwright.chromium.launch(headless=True)
                except Exception as exc:  # binaire absent, droits, etc. (relancé plus bas)
                    await self._playwright.stop()
                    self._playwright = None
                    raise BrowserUnavailable(
                        "Navigateur sans écran introuvable (playwright install chromium)."
                    ) from exc
        return self._browser

    async def render(self, url: str) -> Page:
        await asyncio.to_thread(check_url, url)
        async with self._gate:
            browser = await self._ensure()
            context = await browser.new_context(
                user_agent=USER_AGENT, accept_downloads=False, service_workers="block"
            )
            try:
                page = await context.new_page()

                async def guard(route):
                    request = route.request
                    if await asyncio.to_thread(request_allowed, request.url, request.resource_type):
                        await route.continue_()
                    else:
                        await route.abort()  # http, adresse privée, port inhabituel : jamais

                await page.route("**/*", guard)
                response = await page.goto(
                    url, wait_until="domcontentloaded", timeout=NAVIGATION_TIMEOUT_MS
                )
                if response is not None and response.status in BLOCKED_STATUS:
                    raise FetchBlocked(f"HTTP {response.status}")
                try:
                    await page.wait_for_load_state("networkidle", timeout=SETTLE_TIMEOUT_MS)
                except Exception:  # noqa: BLE001 - un site qui ne se calme jamais : on lit ce qui est là
                    log.info("browser_not_idle", url=url)
                text = await page.evaluate("document.body ? document.body.innerText : ''")
                return Page(
                    url=page.url, html=await page.content(), text=str(text)[:MAX_TEXT_CHARS]
                )
            except FetchError:
                raise
            except Exception as exc:  # délai dépassé, page plantée... (relancé en FetchError)
                raise FetchError(f"navigateur : {type(exc).__name__}") from exc
            finally:
                await context.close()

    async def close(self) -> None:
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None
