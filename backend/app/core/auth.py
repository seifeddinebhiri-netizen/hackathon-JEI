import asyncio
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import Settings, get_settings
from app.core.errors import AppError

bearer = HTTPBearer(auto_error=False)

ASYMMETRIC_ALGS = ("RS256", "ES256", "EdDSA")


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None


def _unauthorized() -> AppError:
    return AppError("Session invalide ou expirée.", status_code=401, code="non_autorise")


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


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CurrentUser:
    if credentials is None:
        raise _unauthorized()
    claims = await verify_token(credentials.credentials, get_settings())
    sub = claims.get("sub")
    if not sub:
        raise _unauthorized()
    return CurrentUser(id=sub, email=claims.get("email"))
