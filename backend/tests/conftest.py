import os

# Les tests ne doivent jamais se connecter à la vraie base Supabase lue dans .env :
# les variables d'environnement sont prioritaires sur .env (pydantic-settings).
# Doit s'exécuter avant tout import de app.main (qui crée l'app au chargement).
os.environ["DATABASE_URL"] = ""
os.environ["SUPABASE_URL"] = ""
# Ni Groq ni Anthropic : un test ne doit jamais appeler un vrai fournisseur d'IA.
os.environ["GROQ_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""
# Jamais de vrai e-mail envoyé par un test (mode essai)
os.environ["RESEND_API_KEY"] = ""
