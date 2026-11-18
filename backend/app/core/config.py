from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"

    supabase_url: str = ""
    supabase_anon_key: SecretStr = SecretStr("")
    supabase_service_role_key: SecretStr = SecretStr("")
    supabase_jwt_secret: SecretStr = SecretStr("")
    database_url: SecretStr = SecretStr("")

    anthropic_api_key: SecretStr = SecretStr("")
    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "medium"  # low | medium | high | xhigh | max

    # Sous-titres : transcription (ElevenLabs Scribe) puis traduction (Gemini ou Ollama)
    elevenlabs_api_key: SecretStr = SecretStr("")
    llm_provider: str = "gemini"  # gemini | ollama
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = ""
    gemini_fallback_model: str = "gemini-3.5-flash"  # essayé une fois si le principal échoue
    gemini_timeout_s: float = 45  # délai maximal par appel Gemini
    gemini_thinking: str = "minimal"  # thinking_level : minimal | low | medium | high
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = ""
    subtitle_max_upload_mb: int = 200
    subtitle_draft_timeout_s: float = 180  # délai maximal de POST /subtitles/{id}/draft

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
