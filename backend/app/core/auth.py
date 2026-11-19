"""Qui appelle l'API : un utilisateur Supabase (jeton JWT vérifié) ou la connexion de démo.

Le backend se connecte à Postgres avec un rôle qui ignore les règles RLS de Supabase : c'est donc
ici, puis dans chaque requête SQL (`owner_id = …`), que l'on garantit qu'un utilisateur ne voit
que ses propres projets.
"""

import asyncio
import secrets
from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
import structlog
from fastapi import Request

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.postgres import ensure_pool

log = structlog.get_logger()

_ASYMMETRIC = {"RS256", "ES256"}
_demo_lock = asyncio.Lock()


@dataclass(frozen=True)
class Caller:
    owner_id: UUID
    is_demo: bool


def _unauthorized(message: str = "Connexion requise.") -> AppError:
    return AppError(message, 401, "non_autorise")


@lru_cache
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json")


async def verify_supabase_jwt(token: str, settings: Settings) -> UUID:
    """Identifiant de l'utilisateur d'un jeton Supabase, après vérification de la signature."""
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        if alg == "HS256":
            key = settings.supabase_jwt_secret.get_secret_value()
            if not key:
                raise _unauthorized("Vérification des connexions non configurée.")
        elif alg in _ASYMMETRIC and settings.supabase_url:
            signing = await asyncio.to_thread(
                _jwks_client(settings.supabase_url).get_signing_key_from_jwt, token
            )
            key = signing.key
        else:
            raise _unauthorized()
        claims = jwt.decode(token, key, algorithms=[alg], audience="authenticated")
        return UUID(claims["sub"])
    except AppError:
        raise
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        log.info("jwt_rejected", reason=type(exc).__name__)
        raise _unauthorized("Ta session a expiré. Reconnecte-toi.") from None


async def demo_owner_id(request: Request, settings: Settings) -> UUID:
    """Utilisateur Supabase de démo, retrouvé par e-mail ou créé une fois (avec son profil)."""
    state = request.app.state
    cached = getattr(state, "demo_owner_id", None)
    if cached:
        return cached
    pool = await ensure_pool(request.app, settings)
    if pool is None:
        raise AppError("Base de données indisponible.", 503, "db_unavailable")
    async with _demo_lock:
        if getattr(state, "demo_owner_id", None):
            return state.demo_owner_id
        email = settings.demo_user_email.lower()
        found = await pool.fetchval("select id from auth.users where lower(email) = $1", email)
        if found is None:
            if getattr(state, "supabase", None) is None:
                raise AppError("Supabase non configuré.", 503, "supabase_unavailable")
            # Le déclencheur on_auth_user_created crée la ligne profiles correspondante.
            res = await state.supabase.auth.admin.create_user(
                {
                    "email": email,
                    "password": secrets.token_urlsafe(32),  # jamais utilisé pour se connecter
                    "email_confirm": True,
                    "user_metadata": {"name": "Démo"},
                }
            )
            found = UUID(str(res.user.id))
            log.info("demo_user_created")
        await pool.execute("update profiles set is_demo = true where id = $1", found)
        state.demo_owner_id = found
        return found


async def get_caller(request: Request) -> Caller:
    """Dépendance FastAPI : l'appelant authentifié, ou 401."""
    settings = get_settings()
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise _unauthorized()
    if token.startswith("demo."):
        if not settings.allow_demo_login or settings.is_production:
            raise _unauthorized("Connexion de démo désactivée.")
        return Caller(await demo_owner_id(request, settings), is_demo=True)
    return Caller(await verify_supabase_jwt(token, settings), is_demo=False)
