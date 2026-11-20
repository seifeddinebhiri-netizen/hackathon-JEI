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
    # Compte de démonstration (scripts/seed_kit_demo.py) : mêmes valeurs que VITE_DEMO_EMAIL /
    # VITE_DEMO_PASSWORD du front.
    demo_email: str = ""
    demo_password: SecretStr = SecretStr("")

    gemini_api_key: SecretStr = SecretStr("")
    shot_spec_rate_limit: int = 20  # requêtes par fenêtre et par utilisateur
    shot_spec_rate_window_s: int = 3600
    # Modèle Gemini : à vérifier dans Google AI Studio (les modèles gratuits changent souvent).
    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.4
    # `v1beta` : la sortie structurée y est prise en charge ; le SDK utilise `v1` (stable) par défaut.
    llm_api_version: str = "v1beta"
    llm_timeout_s: int = 45
    # DÉVELOPPEMENT SEULEMENT : journalise le prompt complet et la réponse brute (texte des scènes inclus).
    llm_debug_log: bool = False

    # Adresse publique du site (page de vérification imprimée dans le PDF : <adresse>/verifier/<code>)
    public_app_url: str = "http://localhost:5173"

    # Signature C2PA du Passeport IA. En test : certificat fabriqué par scripts/make_test_cert.py.
    # En production : certificat d'une autorité reconnue, clé gardée hors du dépôt (voir docs/C2PA.md).
    c2pa_cert_chain_path: str = (
        ""  # certificat de signature puis intermédiaires/racine, au format PEM
    )
    c2pa_private_key_path: str = ""  # clé privée PEM (jamais dans git)
    c2pa_signing_alg: str = "ES256"  # ES256 | ES384 | ES512 | PS256 | PS384 | PS512 | ED25519
    c2pa_tsa_url: str = ""  # serveur d'horodatage (RFC 3161) ; recommandé en production
    c2pa_test_mode: bool = (
        True  # true : le passeport dit que la signature est une signature de TEST
    )
    c2pa_trust_anchors_path: str = (
        ""  # PEM des autorités de confiance pour NOTRE vérification (facultatif)
    )

    # Catalogue des outils d'IA : recherche automatique quand un outil manque
    tool_resolve_rate_limit: int = 10  # demandes par fenêtre et par utilisateur
    tool_resolve_rate_window_s: int = 3600
    tool_research_daily_limit: int = 30  # recherches automatiques par jour, tous utilisateurs
    tool_research_concurrency: int = 2

    # Vérification publique d'un PDF reçu (sans compte) : limitée par adresse IP, fichiers petits, rien n'est gardé
    verify_pdf_rate_limit: int = 30  # vérifications par fenêtre et par adresse
    verify_pdf_rate_window_s: int = 3600
    verify_pdf_max_mb: int = 8
    verify_pdf_concurrency: int = 2

    # PDF signé du Passeport : fabriquer et signer coûte du temps de calcul
    passport_pdf_rate_limit: int = 20  # PDF par fenêtre et par utilisateur
    passport_pdf_rate_window_s: int = 3600

    # Sous-titres : transcription (ElevenLabs Scribe) puis traduction (Gemini ou Ollama)
    elevenlabs_api_key: SecretStr = SecretStr("")
    llm_provider: str = "gemini"  # gemini | ollama
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
