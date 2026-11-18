import time
from collections import defaultdict, deque

from fastapi import Depends

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


async def limit_shot_spec(user: CurrentUser = Depends(get_current_user)) -> None:
    shot_spec_limiter().check(user.id)
