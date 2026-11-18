"""Client LLM du découpage de scénario : Ollama (local), Gemini ou Anthropic.

Indépendant de `LLMService` pour ne pas modifier ce fichier. Choix du fournisseur :
- `SCREENPLAY_LLM=ollama`, `gemini` ou `anthropic` dans `.env` pour forcer ;
- sinon : Anthropic si `ANTHROPIC_API_KEY` est rempli, Gemini si `GEMINI_API_KEY` est rempli,
  Ollama dans les autres cas.

Gemini : `GEMINI_API_KEY` (Google AI Studio), `GEMINI_MODEL` (défaut gemini-3.8-flash).
Attention : sur l'offre gratuite, Google peut utiliser les textes envoyés pour améliorer ses
produits ; le texte du scénario quitte l'ordinateur. Ollama le garde en local.

Ollama : `OLLAMA_BASE_URL` (ou `OLLAMA_URL` / `OLLAMA_HOST`, défaut http://localhost:11434),
`OLLAMA_MODEL` (défaut : le premier modèle installé), `OLLAMA_NUM_CTX` (défaut 8192),
`OLLAMA_TIMEOUT` en secondes par appel (défaut 1800 : un modèle sur processeur est lent).
La sortie est contrainte par le schéma JSON (option `format` d'Ollama), puis validée par Pydantic.
"""

import json
import os
from pathlib import Path
from typing import TypeVar

import httpx
import structlog
from pydantic import BaseModel, ValidationError

from app.core.config import Settings
from app.services.llm_service import LLMUnavailable

log = structlog.get_logger()

T = TypeVar("T", bound=BaseModel)


def _env() -> dict[str, str]:
    """Variables de `.env` (pydantic-settings ne les met pas dans os.environ) + environnement."""
    values: dict[str, str] = {}
    try:
        from dotenv import dotenv_values

        if Path(".env").exists():
            values = {k: v for k, v in dotenv_values(".env").items() if v is not None}
    except ImportError:
        pass
    values.update({k: v for k, v in os.environ.items() if v})
    return values


def inline_refs(schema: dict) -> dict:
    """Remplace les `$ref` vers `$defs` par leur contenu (schéma autonome, accepté partout)."""
    defs = schema.get("$defs", {})

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node and node["$ref"].startswith("#/$defs/"):
                target = dict(defs[node["$ref"].split("/")[-1]])
                extra = {k: v for k, v in node.items() if k != "$ref"}
                return walk({**target, **extra})
            return {k: walk(v) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)


class ScreenplayLLM:
    def __init__(self, settings: Settings, env: dict[str, str] | None = None):
        env = _env() if env is None else env
        key = settings.anthropic_api_key.get_secret_value()
        forced = env.get("SCREENPLAY_LLM", "").strip().lower()
        gemini_key = env.get("GEMINI_API_KEY") or env.get("GOOGLE_API_KEY") or ""
        auto = "anthropic" if key else ("gemini" if gemini_key else "ollama")
        self.provider = forced or auto
        self._effort = settings.llm_effort

        if self.provider == "gemini":
            self._gemini_key = gemini_key
            self._model = env.get("GEMINI_MODEL") or "gemini-3.8-flash"
            self._timeout = float(env.get("GEMINI_TIMEOUT", "180"))
            self.max_batch_chars = 60_000
            self.max_concurrency = 2  # l'offre gratuite limite les requêtes par minute
        elif self.provider == "anthropic":
            from anthropic import AsyncAnthropic

            self._anthropic = AsyncAnthropic(api_key=key) if key else None
            self._model = settings.llm_model
            self.max_batch_chars = 60_000
            self.max_concurrency = 4
        else:
            base = env.get("OLLAMA_BASE_URL") or env.get("OLLAMA_URL") or env.get("OLLAMA_HOST")
            base = (base or "http://localhost:11434").rstrip("/")
            if not base.startswith("http"):
                base = "http://" + base
            self._base = base
            model = env.get("OLLAMA_MODEL", "")
            if not model and not settings.llm_model.startswith("claude"):
                model = settings.llm_model
            self._model = model  # vide : premier modèle installé, cherché au premier appel
            self._num_ctx = int(env.get("OLLAMA_NUM_CTX", "8192"))
            self._timeout = float(env.get("OLLAMA_TIMEOUT", "1800"))
            # Un modèle local a un contexte court et une seule carte graphique : petits lots, un
            # appel à la fois.
            self.max_batch_chars = 6_000
            self.max_concurrency = 1

    @property
    def model(self) -> str:
        return self._model

    async def parse_structured(
        self, *, system: str, user: str, output_format: type[T], max_tokens: int = 16000
    ) -> T:
        """Sortie structurée validée par Pydantic. Le texte du scénario n'est jamais journalisé."""
        if self.provider == "anthropic":
            return await self._anthropic_parse(system, user, output_format, max_tokens)
        if self.provider == "gemini":
            return await self._gemini_parse(system, user, output_format)
        return await self._ollama_parse(system, user, output_format)

    # --- Gemini -------------------------------------------------------------------

    async def _gemini_parse(self, system: str, user: str, output_format: type[T]) -> T:
        if not self._gemini_key:
            raise LLMUnavailable("GEMINI_API_KEY non configurée.")
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent"
        )
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": inline_refs(output_format.model_json_schema()),
            },
        }
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self._timeout, connect=10)
            ) as client:
                for attempt in (1, 2):
                    r = await client.post(
                        url, json=body, headers={"x-goog-api-key": self._gemini_key}
                    )
                    if r.status_code == 429:
                        raise LLMUnavailable("quota Gemini atteint, réessaie dans une minute")
                    if r.status_code in (400, 401, 403):
                        raise LLMUnavailable(
                            f"Gemini refuse la requête ({r.status_code}) : vérifie GEMINI_API_KEY "
                            f"et GEMINI_MODEL (« {self._model} »)"
                        )
                    if r.status_code == 404:
                        raise LLMUnavailable(f"modèle Gemini « {self._model} » introuvable")
                    r.raise_for_status()
                    data = r.json()
                    usage = data.get("usageMetadata", {})
                    log.info(
                        "llm_call",
                        provider="gemini",
                        purpose=output_format.__name__,
                        model=self._model,
                        attempt=attempt,
                        input_tokens=usage.get("promptTokenCount"),
                        output_tokens=usage.get("candidatesTokenCount"),
                    )
                    try:
                        parts = data["candidates"][0]["content"]["parts"]
                        text = "".join(p.get("text", "") for p in parts)
                        return output_format.model_validate_json(text)
                    except (ValidationError, KeyError, IndexError, TypeError):
                        log.warning("gemini_invalid_json", purpose=output_format.__name__)
        except httpx.TimeoutException as exc:
            raise LLMUnavailable("Gemini n'a pas répondu à temps") from exc
        except httpx.HTTPError as exc:
            raise LLMUnavailable(f"Erreur Gemini : {type(exc).__name__}") from exc
        raise LLMUnavailable("Gemini n'a pas produit de réponse exploitable.")

    # --- Ollama -------------------------------------------------------------------

    async def _ollama_model(self, client: httpx.AsyncClient) -> str:
        if self._model:
            return self._model
        r = await client.get(f"{self._base}/api/tags")
        r.raise_for_status()
        models = [m["name"] for m in r.json().get("models", [])]
        if not models:
            raise LLMUnavailable("Aucun modèle Ollama installé (ex. : ollama pull qwen2.5:7b).")
        self._model = models[0]
        log.info("ollama_model_auto", model=self._model)
        return self._model

    async def _ollama_parse(self, system: str, user: str, output_format: type[T]) -> T:
        schema = output_format.model_json_schema()
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(self._timeout, connect=5)) as client:
                model = await self._ollama_model(client)
                for attempt in (1, 2):
                    log.info(
                        "ollama_request",
                        purpose=output_format.__name__,
                        model=model,
                        chars=len(user),
                        attempt=attempt,
                    )
                    r = await client.post(
                        f"{self._base}/api/chat",
                        json={
                            "model": model,
                            "stream": False,
                            "format": schema,
                            "options": {"temperature": 0, "num_ctx": self._num_ctx},
                            "messages": [
                                {
                                    "role": "system",
                                    "content": system
                                    + "\n\nRéponds uniquement avec un objet JSON conforme à ce "
                                    "schéma :\n" + json.dumps(schema, ensure_ascii=False),
                                },
                                {"role": "user", "content": user},
                            ],
                        },
                    )
                    if r.status_code == 404:
                        raise LLMUnavailable(
                            f"Modèle Ollama « {model} » introuvable (ollama pull {model})."
                        )
                    r.raise_for_status()
                    data = r.json()
                    log.info(
                        "llm_call",
                        provider="ollama",
                        purpose=output_format.__name__,
                        model=model,
                        attempt=attempt,
                        input_tokens=data.get("prompt_eval_count"),
                        output_tokens=data.get("eval_count"),
                    )
                    try:
                        return output_format.model_validate_json(data["message"]["content"])
                    except (ValidationError, KeyError, TypeError):
                        log.warning("ollama_invalid_json", purpose=output_format.__name__)
        except httpx.ConnectError as exc:
            raise LLMUnavailable(f"Ollama ne répond pas sur {self._base} (ollama serve).") from exc
        except httpx.TimeoutException as exc:
            raise LLMUnavailable(
                f"le modèle local « {self._model} » n'a pas répondu en {self._timeout:g} s ; "
                "essaie un modèle plus petit ou augmente OLLAMA_TIMEOUT"
            ) from exc
        except httpx.HTTPError as exc:
            raise LLMUnavailable(f"Erreur Ollama : {type(exc).__name__}") from exc
        raise LLMUnavailable("Le modèle local n'a pas produit de réponse exploitable.")

    # --- Anthropic ----------------------------------------------------------------

    async def _anthropic_parse(
        self, system: str, user: str, output_format: type[T], max_tokens: int
    ) -> T:
        if self._anthropic is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY non configurée.")
        response = await self._anthropic.beta.messages.parse(
            model=self._model,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            output_format=output_format,
            output_config={"effort": self._effort},
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        log.info(
            "llm_call",
            provider="anthropic",
            purpose=output_format.__name__,
            model=response.model,
            stop_reason=response.stop_reason,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise LLMUnavailable("Le modèle n'a pas produit de réponse exploitable.")
        return response.parsed_output
