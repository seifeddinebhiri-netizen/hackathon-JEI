from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
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
    # Connexion de démo du front (jeton « demo.… ») : tous ses projets appartiennent à un même
    # utilisateur Supabase de démo, créé au premier usage. Jamais accepté en production.
    allow_demo_login: bool = True
    demo_user_email: str = "demo@encadre.invalid"

    # Convocations par e-mail (Resend). Sans clé : mode essai, rien n'est envoyé.
    resend_api_key: SecretStr = SecretStr("")
    # Sans domaine vérifié chez Resend, seul onboarding@resend.dev est accepté, et il n'envoie
    # qu'à l'adresse du compte Resend.
    email_from: str = "Encadré <onboarding@resend.dev>"
    # Adresse de réponse par défaut si le réalisateur n'en donne pas
    email_reply_to: str = ""

    anthropic_api_key: SecretStr = SecretStr("")
    llm_model: str = "claude-opus-5-5"
    llm_effort: str = "medium"  # low | medium | high | xhigh | max
    scenario_timeout_seconds: float = Field(default=90, gt=0, le=180)
    scenario_provider: Literal["anthropic", "groq", "ollama"] = "anthropic"
    groq_api_key: SecretStr = SecretStr("")
    groq_model: str = "openai/gpt-oss-20b"
    # Analyse de scénario (/scenario) : schéma trop exigeant pour gpt-oss-20b, d'où le 120b
    groq_scenario_model: str = "openai/gpt-oss-120b"
    # Suggestions de scènes et de lieux (Planner), utilisées si ANTHROPIC_API_KEY est vide
    groq_suggest_model: str = "openai/gpt-oss-120b"
    groq_timeout_seconds: float = Field(default=180, gt=0, le=600)
    # Plafond de la réponse (raisonnement compris). Offre gratuite : 8 000 jetons/min au total.
    groq_max_completion_tokens: int = Field(default=4000, ge=256, le=65536)
    # Taille d'un lot de scènes envoyé au découpage. Monter (ex. 60000) avec l'offre payante.
    groq_max_batch_chars: int = Field(default=6000, ge=1000, le=200_000)
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b"
    geoapify_api_key: SecretStr = SecretStr("")
    scouting_daily_provider_budget: int = Field(default=2700, ge=1, le=100000)
    open_meteo_url: str = "https://api.open-meteo.com/v1/forecast"
    open_meteo_api_key: SecretStr = SecretStr("")

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
