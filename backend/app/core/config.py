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

    gemini_api_key: SecretStr = SecretStr("")
    shot_spec_rate_limit: int = 20  # requêtes par fenêtre et par utilisateur
    shot_spec_rate_window_s: int = 3600
    # Modèle Gemini : à vérifier dans Google AI Studio (les modèles gratuits changent souvent).
    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.4
    # `v1beta` : la sortie structurée y est prise en charge ; le SDK utilise `v1` (stable) par défaut.
    llm_api_version: str = "v1beta"
    llm_timeout_s: int = 45

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
