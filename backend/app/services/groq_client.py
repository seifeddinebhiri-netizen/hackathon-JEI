"""Appel Groq en sortie JSON structurée, partagé par l'analyse de scénario et le découpage.

Gère les limites de l'offre gratuite de Groq (jetons par minute) : on attend le délai indiqué par
Groq puis on réessaie, au lieu d'abandonner tout de suite. Les erreurs remontent avec la raison
donnée par Groq, pour que l'avertissement affiché dise vraiment ce qui ne va pas.
"""

import asyncio
import json
import re
from collections.abc import Callable
from typing import Any

import httpx
import structlog
from pydantic import BaseModel, ValidationError

from app.services.errors import LLMUnavailable

log = structlog.get_logger()


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MAX_ATTEMPTS = 4
MAX_WAIT_SECONDS = 30.0  # au-delà (limite par jour atteinte…), on abandonne avec un message clair

# « ms » d'abord : sinon « 847.5ms » est lu comme une durée vide
_WAIT_RE = re.compile(r"try again in ([\d.]+ms|(?:\d+h)?(?:\d+m(?!s))?(?:[\d.]+s)?)")
_PART_RE = re.compile(r"([\d.]+)(h|ms|m|s)")


def wait_seconds(response: httpx.Response) -> float | None:
    """Délai d'attente demandé par Groq (en-tête retry-after ou texte « try again in 1m2.5s »)."""
    header = response.headers.get("retry-after")
    if header:
        try:
            return float(header)
        except ValueError:
            pass
    m = _WAIT_RE.search(response.text)
    if not m or not m.group(1):
        return None
    factor = {"h": 3600, "m": 60, "s": 1, "ms": 0.001}
    return sum(float(v) * factor[u] for v, u in _PART_RE.findall(m.group(1)))


def groq_reason(response: httpx.Response) -> str:
    """Message d'erreur de Groq, raccourci (sans identifiant d'organisation ni lien de paiement)."""
    try:
        msg = response.json()["error"]["message"]
    except (ValueError, KeyError, TypeError):
        msg = response.text
    msg = re.sub(r" in organization `[^`]*`", "", msg)
    msg = msg.split(" Need more tokens?")[0].split(" Please try again")[0]
    return msg.strip()[:200]


def strict_schema(schema: dict) -> dict:
    """Schéma accepté par le mode strict de Groq : chaque objet interdit les champs en plus et
    rend tous ses champs obligatoires (Groq refuse le schéma sinon)."""

    def walk(node):
        if isinstance(node, dict):
            out = {k: walk(v) for k, v in node.items()}
            if isinstance(out.get("properties"), dict):
                out["additionalProperties"] = False
                out["required"] = list(out["properties"])
            return out
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)


def _supports_strict(model: str) -> bool:
    # Mode strict (sortie forcée à respecter le schéma) : modèles gpt-oss sur Groq
    return model.startswith("openai/gpt-oss")


def _is_rate_limit(response: httpx.Response) -> bool:
    if response.status_code == 429:
        return True
    # Groq renvoie parfois la limite de jetons par minute en 400
    return response.status_code == 400 and "rate_limit_exceeded" in response.text


async def groq_structured[T: BaseModel](
    *,
    api_key: str,
    model: str,
    timeout: float,
    max_completion_tokens: int,
    system: str,
    user: str,
    output_format: type[T],
    schema_name: str | None = None,
    repair: Callable[[Any], Any] | None = None,
    strict: bool | None = None,
) -> T:
    """Sortie structurée Groq validée par Pydantic. Le texte envoyé n'est jamais journalisé.

    `repair` corrige la réponse brute (dict) avant validation, pour les données qui se
    déduisent du reste et que le modèle recopie mal.
    `strict` : None = mode strict si le modèle le permet. False pour un grand schéma que le
    modèle remplit souvent de travers : Groq rejette alors toute la réponse, alors que `repair`
    peut la corriger."""
    if not api_key:
        raise LLMUnavailable("GROQ_API_KEY non configurée.")
    strict = _supports_strict(model) if strict is None else strict and _supports_strict(model)
    schema = output_format.model_json_schema()
    json_schema = {
        "name": schema_name or output_format.__name__,
        "strict": strict,
        # Sans le mode strict, Groq ne fait que suggérer le schéma : le modèle peut répondre
        # « INT/EXT » là où seuls INT, EXT ou UNKNOWN sont permis.
        "schema": strict_schema(schema) if strict else schema,
    }
    body: dict = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "max_completion_tokens": max_completion_tokens,
        "response_format": {"type": "json_schema", "json_schema": json_schema},
    }
    if model.startswith("openai/gpt-oss"):
        # Modèle qui raisonne avant de répondre : sans ça, le raisonnement mange la place de la
        # réponse et le JSON est coupé.
        body["reasoning_effort"] = "low"

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=10)) as client:
            for attempt in range(1, MAX_ATTEMPTS + 1):
                response = await client.post(
                    GROQ_URL, json=body, headers={"Authorization": f"Bearer {api_key}"}
                )
                if (
                    json_schema["strict"]
                    and response.status_code == 400
                    and "invalid JSON schema" in response.text
                ):
                    # Schéma refusé en mode strict : on réessaie sans, la validation Pydantic
                    # reste là pour écarter une réponse hors format.
                    log.warning("groq_strict_schema_rejected", reason=groq_reason(response))
                    json_schema.update(strict=False, schema=schema)
                    continue
                if not _is_rate_limit(response):
                    break
                wait = wait_seconds(response)
                if wait is None or wait > MAX_WAIT_SECONDS or attempt == MAX_ATTEMPTS:
                    raise LLMUnavailable(f"quota Groq atteint : {groq_reason(response)}")
                log.info("groq_rate_limited", wait_s=round(wait, 1), attempt=attempt)
                await asyncio.sleep(wait + 0.25)

            if response.status_code == 413:
                raise LLMUnavailable(f"texte trop long pour Groq : {groq_reason(response)}")
            if response.status_code == 400 and "json_validate_failed" in response.text:
                if "max completion tokens" in response.text:
                    raise LLMUnavailable("réponse de Groq coupée avant la fin (trop longue)")
                raise LLMUnavailable("Groq n'a pas réussi à produire une réponse au bon format")
            if response.status_code == 404:
                raise LLMUnavailable(f"modèle Groq « {model} » introuvable")
            if response.status_code in (400, 401, 403):
                raise LLMUnavailable(
                    f"Groq refuse la requête ({response.status_code}) : {groq_reason(response)}"
                )
            response.raise_for_status()
            data = response.json()
            choice = data["choices"][0]
            usage = data.get("usage", {})
            log.info(
                "llm_call",
                provider="groq",
                model=model,
                input_tokens=usage.get("prompt_tokens"),
                output_tokens=usage.get("completion_tokens"),
            )
            if choice.get("finish_reason") == "length":
                raise LLMUnavailable("réponse de Groq coupée avant la fin (trop longue)")
            content = choice["message"]["content"]
            if repair is None:
                return output_format.model_validate_json(content)
            return output_format.model_validate(repair(json.loads(content)))
    except LLMUnavailable:
        raise
    except httpx.TimeoutException as exc:
        raise LLMUnavailable(f"Groq n'a pas répondu en {timeout:.0f} s") from exc
    except ValidationError as exc:
        raise LLMUnavailable("Groq a répondu dans un format inattendu") from exc
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
        raise LLMUnavailable("Groq n'a pas produit une réponse exploitable.") from exc
