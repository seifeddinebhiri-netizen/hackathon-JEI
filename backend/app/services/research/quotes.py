import re
import unicodedata

_QUOTES = str.maketrans(
    {"‘": "'", "’": "'", "“": '"', "”": '"', "«": '"', "»": '"', "–": "-", "—": "-"}
)


def _canon(text: str) -> str:
    """Compare sans être trompé par la mise en forme : espaces, guillemets typographiques, ** de Markdown."""
    text = unicodedata.normalize("NFKC", text).translate(_QUOTES).replace(" ", " ")
    text = re.sub(r"[*_`]+", "", text)
    return re.sub(r"\s+", " ", text).strip().casefold()


MIN_QUOTE_CHARS = 12


def quote_in_page(quote: str, page_text: str) -> bool:
    """La phrase donnée par le modèle figure-t-elle VRAIMENT dans la page ? Garde-fou principal
    contre les faits inventés : une phrase absente de la page est rejetée."""
    q = _canon(quote).rstrip(".… ")
    if len(q) < MIN_QUOTE_CHARS:
        return False
    return q in _canon(page_text)
