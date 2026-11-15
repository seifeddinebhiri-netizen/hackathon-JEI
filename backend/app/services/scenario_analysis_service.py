import asyncio

from anthropic import APIError, APITimeoutError
from pydantic import ValidationError

from app.core.errors import AppError
from app.schemas.scenario import ScenarioAnalysis, ScenarioRequest, ScenarioResponse
from app.services.llm_service import LLMService, LLMUnavailable


async def analyze(llm: LLMService, body: ScenarioRequest) -> ScenarioResponse:
    try:
        # Includes SDK retries; hard limit for the complete operation.
        async with asyncio.timeout(llm.scenario_timeout_seconds):
            result = await llm.analyze_scenario(body.content)
        parsed = ScenarioAnalysis.model_validate(result)
    except AppError:
        raise
    except (TimeoutError, APITimeoutError):
        raise AppError(
            "Analyse trop longue. Réessayez avec un scénario plus court.", 504, "analysis_timeout"
        ) from None
    except LLMUnavailable:
        raise AppError(
            "Analyse IA indisponible. Vérifiez ANTHROPIC_API_KEY côté serveur, "
            "ou utilisez le mode démo explicite.",
            503,
            "llm_unavailable",
        ) from None
    except (ValidationError, ValueError, TypeError):
        raise AppError(
            "Réponse IA inexploitable. Réessayez ou utilisez la démo.", 502, "invalid_model_output"
        ) from None
    except APIError:
        raise AppError(
            "Le fournisseur IA est indisponible. Réessayez plus tard.", 503, "provider_unavailable"
        ) from None
    except Exception:  # noqa: BLE001 — privacy boundary: never log provider payloads
        # Do not propagate provider exceptions containing private request/response data.
        raise AppError(
            "Analyse indisponible. Réessayez plus tard.", 502, "analysis_failed"
        ) from None
    return ScenarioResponse(title=body.title, **parsed.model_dump())
