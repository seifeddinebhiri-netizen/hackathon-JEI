import asyncio
import time

import jwt
import pytest

from app.core.auth import verify_token
from app.core.config import Settings
from app.core.errors import AppError

SECRET = "test-secret-test-secret-test-secret-123"


def _token(secret=SECRET, aud="authenticated", exp_in=3600, alg="HS256"):
    claims = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "aud": aud,
        "exp": time.time() + exp_in,
    }
    return jwt.encode(claims, secret, algorithm=alg)


def _settings():
    return Settings(supabase_jwt_secret=SECRET, supabase_url="")


def test_valid_token():
    claims = asyncio.run(verify_token(_token(), _settings()))
    assert claims["sub"].startswith("1111")


@pytest.mark.parametrize(
    "token",
    [_token(secret="x" * 40), _token(aud="other"), _token(exp_in=-10), "not-a-jwt"],
)
def test_invalid_tokens_rejected(token):
    with pytest.raises(AppError) as exc:
        asyncio.run(verify_token(token, _settings()))
    assert exc.value.status_code == 401


def test_hs256_rejected_when_no_secret_configured():
    with pytest.raises(AppError):
        asyncio.run(verify_token(_token(), Settings(supabase_jwt_secret="", supabase_url="")))
