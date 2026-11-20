import structlog

from app.services.research.browser import BrowserReader, BrowserUnavailable
from app.services.research.fetcher import FetchError, Page, fetch_page

log = structlog.get_logger()

SHELL_CHARS = (
    200  # moins de texte que ça : la page est une coquille, son contenu vient de JavaScript
)


class PageReader:
    """Lecture d'une page : HTTP d'abord, navigateur sans écran seulement pour une coquille JavaScript.

    Un blocage (401, 403, 429, robots.txt) interrompt tout : le navigateur n'est JAMAIS essayé après un
    refus, il ne sert qu'aux pages qui s'ouvrent normalement mais n'affichent rien sans JavaScript."""

    def __init__(self, browser: BrowserReader | None = None) -> None:
        self._browser = browser

    async def __call__(self, url: str) -> Page:
        page = await fetch_page(url)  # FetchBlocked passe tel quel
        if self._browser is None or len(" ".join(page.text.split())) >= SHELL_CHARS:
            return page
        try:
            rendered = await self._browser.render(page.url)
        except BrowserUnavailable as exc:
            log.warning(
                "browser_unavailable", reason=str(exc)
            )  # mal installé : on garde la page telle quelle
            return page
        except FetchError as exc:
            log.info("browser_render_failed", url=url, reason=str(exc))
            return page
        return rendered if len(rendered.text) > len(page.text) else page
