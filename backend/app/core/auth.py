"""Qui appelle l'API : un utilisateur Supabase (jeton JWT vérifié) ou la connexion de démo.

Le backend se connecte à Postgres avec un rôle qui ignore les règles RLS de Supabase : c'est donc
ici, puis dans chaque requête (`owner_id = …`), que l'on garantit qu'un utilisateur ne voit que
ses propres projets.
"""

import asyncio
import secrets
from dataclasses import dataclass
from functools import lru_cache
from uuid import UUID

import jwt
import structlog
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.db.postgres import ensure_pool

log = structlog.get_logger()

bearer = HTTPBearer(auto_error=False)

ASYMMETRIC_ALGS = ("RS256", "ES256", "EdDSA")
_demo_lock = asyncio.Lock()


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    is_demo: bool = False


def _unauthorized(message: str = "Session invalide ou expirée.") -> AppError:
    return AppError(message, status_code=401, code="non_autorise")


@lru_cache
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=3600)


async def verify_token(token: str, settings: Settings) -> dict:
    """Vérifie un jeton Supabase. L'algorithme accepté dépend de NOTRE configuration, jamais
    seulement de l'en-tête du jeton (évite les attaques par confusion d'algorithme)."""
    try:
        alg = jwt.get_unverified_header(token).get("alg")
        secret = settings.supabase_jwt_secret.get_secret_value()
        if alg == "HS256" and secret:
            return jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
        if alg in ASYMMETRIC_ALGS and settings.supabase_url:
            url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            key = await asyncio.to_thread(_jwks_client(url).get_signing_key_from_jwt, token)
            return jwt.decode(token, key.key, algorithms=[alg], audience="authenticated")
    except jwt.PyJWTError:
        pass
    raise _unauthorized()


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


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized()
    settings = get_settings()
    token = credentials.credentials
    # Connexion de démo du front (jeton « demo.… ») : tous ses projets sont à un même utilisateur.
    if token.startswith("demo."):
        if not settings.allow_demo_login or settings.is_production:
            raise _unauthorized("Connexion de démo désactivée.")
        owner = await demo_owner_id(request, settings)
        return CurrentUser(id=str(owner), email=settings.demo_user_email, is_demo=True)
    claims = await verify_token(token, settings)
    sub = claims.get("sub")
    if not sub:
        raise _unauthorized()
    return CurrentUser(id=sub, email=claims.get("email"))
