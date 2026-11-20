import asyncio
from dataclasses import dataclass
from typing import TypeVar

import structlog
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.core.config import Settings
from app.core.errors import AppError
from app.prompts import moving, static
from app.schemas.shot_spec import LLMMovingPlan, LLMStaticPlan, ShotSpecRequest

log = structlog.get_logger()

# Surcharge passagère de Google (500, 502, 503, 504) : deux nouvelles tentatives, après 2 s puis 5 s.
# Jamais pour un quota (429) ni une requête refusée (400, 401, 403, 404) : réessayer n'y changerait rien.
RETRY_DELAYS: tuple[float, ...] = (2.0, 5.0)
TRANSIENT = (500, 502, 503, 504)

T = TypeVar("T", bound=BaseModel)


class LLMUnavailable(Exception):
    pass


@dataclass(frozen=True)
class GroundedResult:
    """Réponse de l'IA appuyée sur une recherche web : son texte, et les domaines que la recherche a trouvés."""

    text: str
    domains: list[str]


class LLMService:
    """Client Gemini. Un prompt et un schéma de réponse par type de scène (fixe / en mouvement)."""

    def __init__(self, settings: Settings, client: genai.Client | None = None):
        key = settings.gemini_api_key.get_secret_value()
        if client is not None:
            self._client = client
        elif key:
            self._client = genai.Client(
                api_key=key,
                http_options=types.HttpOptions(
                    api_version=settings.llm_api_version, timeout=settings.llm_timeout_s * 1000
                ),
            )
        else:
            self._client = None
        self._model = settings.llm_model
        self._temperature = settings.llm_temperature
        self._debug = settings.llm_debug_log

    @property
    def model(self) -> str:
        return self._model

    async def generate_static(self, rules_text: str, scene: ShotSpecRequest) -> LLMStaticPlan:
        return await self._generate(
            static.build_system(rules_text), static.build_user(scene), LLMStaticPlan
        )

    async def generate_moving(self, rules_text: str, scene: ShotSpecRequest) -> LLMMovingPlan:
        return await self._generate(
            moving.build_system(rules_text), moving.build_user(scene), LLMMovingPlan
        )

    async def generate_structured(
        self, system: str, user: str, schema: type[T], temperature: float | None = None
    ) -> T:
        """Appel générique à sortie structurée (utilisé par la recherche d'outils d'IA)."""
        return await self._generate(system, user, schema, temperature)

    async def _call(self, **kwargs):
        """Appel à Gemini avec nouvelles tentatives sur une surcharge passagère."""
        for wait in (*RETRY_DELAYS, None):
            try:
                return await self._client.aio.models.generate_content(**kwargs)
            except errors.APIError as exc:
                if exc.code not in TRANSIENT or wait is None:
                    raise
                log.info("llm_retry", status=exc.code, wait_s=wait)
                await asyncio.sleep(wait)

    async def grounded_search(self, query: str) -> GroundedResult:
        """Pose une question à l'IA AVEC la recherche Google (réponse appuyée sur de vraies pages).

        Sert à retrouver le site officiel d'un outil au lieu de le deviner. La sortie structurée ne peut
        pas être demandée en même temps que la recherche : on renvoie le texte et les domaines trouvés."""
        if self._client is None:
            raise LLMUnavailable("GEMINI_API_KEY non configurée.")
        try:
            response = await self._call(
                model=self._model,
                contents=query,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())], temperature=0
                ),
            )
        except errors.APIError as exc:
            log.warning("llm_search_error", status=exc.code, detail=str(exc)[:200])
            raise LLMUnavailable("La recherche web de l'IA est indisponible.") from exc
        text = response.text or ""
        meta = response.candidates[0].grounding_metadata if response.candidates else None
        domains: list[str] = []
        for chunk in getattr(meta, "grounding_chunks", None) or []:
            title = getattr(getattr(chunk, "web", None), "title", None)
            if title and title not in domains:
                domains.append(title)
        if self._debug:
            print(
                f"\n===== RECHERCHE WEB =====\n{query}\n--- RÉPONSE ---\n{text}\n--- DOMAINES: {domains}\n",
                flush=True,
            )
        return GroundedResult(text=text, domains=domains)

    async def _generate(
        self, system: str, user: str, schema: type[T], temperature: float | None = None
    ) -> T:
        if self._client is None:
            raise LLMUnavailable("GEMINI_API_KEY non configurée.")
        try:
            # Le texte de la scène n'est journalisé que si LLM_DEBUG_LOG=true (développement).
            if self._debug:
                print(
                    f"\n===== PROMPT ENVOYÉ À L'IA ({schema.__name__}, {self._model}) =====\n"
                    f"--- SYSTEM ---\n{system}\n--- USER ---\n{user}\n",
                    flush=True,
                )
            response = await self._call(
                model=self._model,
                contents=user,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=self._temperature if temperature is None else temperature,
                ),
            )
        except errors.APIError as exc:
            # Le détail renvoyé par Google décrit l'erreur (champ refusé, quota...), pas la scène.
            log.warning("llm_api_error", status=exc.code, model=self._model, detail=str(exc)[:400])
            if exc.code == 429:
                raise AppError(
                    "Le quota gratuit de l'IA est atteint. Réessaie dans un instant.",
                    status_code=429,
                    code="trop_de_requetes",
                ) from exc
            detail = str(exc).lower()
            if exc.code in (401, 403) or "api key" in detail:
                raise LLMUnavailable("La clé GEMINI_API_KEY est refusée par Google.") from exc
            if (
                exc.code == 404
            ):  # seulement un vrai 404 : « model overloaded » n'est pas « modèle inconnu »
                raise LLMUnavailable(
                    "Le modèle d'IA demandé est introuvable (vérifie LLM_MODEL)."
                ) from exc
            if exc.code in (500, 502, 503, 504):
                raise LLMUnavailable(
                    "Le service d'IA est surchargé pour le moment. Réessaie dans un instant."
                ) from exc
            if exc.code == 400:
                raise LLMUnavailable(
                    "L'IA a refusé la requête (erreur 400). Le détail est dans les journaux du serveur."
                ) from exc
            raise LLMUnavailable("Le service d'IA est indisponible pour le moment.") from exc

        usage = response.usage_metadata
        log.info(
            "llm_call",
            model=self._model,
            plan=schema.__name__,
            input_tokens=getattr(usage, "prompt_token_count", None),
            output_tokens=getattr(usage, "candidates_token_count", None),
        )
        if self._debug:
            print(
                f"\n===== RÉPONSE BRUTE DE L'IA =====\n{response.text}\n===== FIN =====\n",
                flush=True,
            )
        parsed = response.parsed
        if not isinstance(parsed, schema):
            try:
                parsed = schema.model_validate_json(response.text or "")
            except ValueError as exc:
                raise LLMUnavailable("L'IA n'a pas produit de plan exploitable.") from exc
        return parsed


def research_service(settings: Settings) -> "LLMService":
    """Service IA de la recherche d'outils : son modèle (TOOL_RESEARCH_MODEL) peut différer de celui du Coach,
    donc avoir son propre quota gratuit."""
    model = settings.tool_research_model or settings.llm_model
    return LLMService(settings.model_copy(update={"llm_model": model}))
