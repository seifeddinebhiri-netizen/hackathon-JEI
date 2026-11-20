import time
from collections import defaultdict, deque

from fastapi import Depends, Request

from app.core.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.core.errors import AppError


class RateLimiter:
    """Fenêtre glissante en mémoire, par clé. Suffisant pour une seule instance du serveur
    (à remplacer par Redis si on passe à plusieurs instances)."""

    def __init__(self, limit: int, window_s: int):
        self.limit = limit
        self.window_s = window_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if len(hits) >= self.limit:
            raise AppError(
                "Trop de requêtes. Réessaie un peu plus tard.",
                status_code=429,
                code="trop_de_requetes",
            )
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()


_shot_spec_limiter: RateLimiter | None = None


def shot_spec_limiter() -> RateLimiter:
    global _shot_spec_limiter
    if _shot_spec_limiter is None:
        s = get_settings()
        _shot_spec_limiter = RateLimiter(s.shot_spec_rate_limit, s.shot_spec_rate_window_s)
    return _shot_spec_limiter


_tool_limiter: RateLimiter | None = None


def tool_resolve_limiter() -> RateLimiter:
    global _tool_limiter
    if _tool_limiter is None:
        s = get_settings()
        _tool_limiter = RateLimiter(s.tool_resolve_rate_limit, s.tool_resolve_rate_window_s)
    return _tool_limiter


async def limit_tool_resolve(user: CurrentUser = Depends(get_current_user)) -> None:
    tool_resolve_limiter().check(user.id)


_passport_limiter: RateLimiter | None = None


def passport_pdf_limiter() -> RateLimiter:
    global _passport_limiter
    if _passport_limiter is None:
        s = get_settings()
        _passport_limiter = RateLimiter(s.passport_pdf_rate_limit, s.passport_pdf_rate_window_s)
    return _passport_limiter


async def limit_passport_pdf(user: CurrentUser = Depends(get_current_user)) -> None:
    passport_pdf_limiter().check(user.id)


_verify_limiter: RateLimiter | None = None


def verify_pdf_limiter() -> RateLimiter:
    global _verify_limiter
    if _verify_limiter is None:
        s = get_settings()
        _verify_limiter = RateLimiter(s.verify_pdf_rate_limit, s.verify_pdf_rate_window_s)
    return _verify_limiter


async def limit_verify_pdf(request: Request) -> None:
    """Route publique : pas de compte, donc on limite par adresse IP (en mémoire, une instance)."""
    verify_pdf_limiter().check(request.client.host if request.client else "inconnue")


async def limit_shot_spec(user: CurrentUser = Depends(get_current_user)) -> None:
    shot_spec_limiter().check(user.id)
