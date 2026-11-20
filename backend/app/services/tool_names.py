import re
import unicodedata


def normalize_name(name: str) -> str:
    """« Chat GPT », « chatgpt » et « ChatGPT » donnent la même clé ; accents et ponctuation ignorés."""
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def make_slug(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:60] or "outil"
