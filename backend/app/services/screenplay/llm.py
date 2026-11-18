"""Client LLM du découpage de scénario.

Indépendant de `LLMService` (Coach de cadrage) pour ne pas modifier ce fichier : même clé,
même modèle et même effort, lus dans la configuration.
"""

from typing import TypeVar

import structlog
from anthropic import AsyncAnthropic

from app.core.config import Settings
from app.services.llm_service import LLMUnavailable

log = structlog.get_logger()

T = TypeVar("T")


class ScreenplayLLM:
    def __init__(self, settings: Settings):
        key = settings.anthropic_api_key.get_secret_value()
        self._client = AsyncAnthropic(api_key=key) if key else None
        self._model = settings.llm_model
        self._effort = settings.llm_effort

    @property
    def available(self) -> bool:
        return self._client is not None

    async def parse_structured(
        self, *, system: str, user: str, output_format: type[T], max_tokens: int = 16000
    ) -> T:
        """Sortie structurée validée par Pydantic. Le texte du scénario n'est jamais journalisé."""
        if self._client is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY non configurée.")
        response = await self._client.beta.messages.parse(
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
            purpose=output_format.__name__,
            model=response.model,
            stop_reason=response.stop_reason,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            raise LLMUnavailable("Le modèle n'a pas produit de réponse exploitable.")
        return response.parsed_output
