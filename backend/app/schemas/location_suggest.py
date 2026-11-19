"""Contrat des lieux proposés par l'IA pour un décor.

Deux niveaux :
- `LLMLocationSuggestion` : ce que le LLM produit. Des TYPES de lieux et une requête de recherche,
  jamais un nom d'établissement, une adresse ni des coordonnées.
- `LocationSuggestResponse` : ce que renvoie l'API. Chaque proposition reçoit ses `candidates`,
  qui viennent UNIQUEMENT de la recherche géographique (OpenStreetMap Nominatim).
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

# --- Entrée ------------------------------------------------------------------------------


class FilmContext(BaseModel):
    title: str = Field(default="", max_length=200)
    format: str = Field(default="court", max_length=20)
    city: str = Field(min_length=1, max_length=120)
    genre: str | None = Field(default=None, max_length=120)
    synopsis: str | None = Field(default=None, max_length=2000)


class DecorRef(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class SceneInput(BaseModel):
    number: str = Field(max_length=20)
    title: str = Field(default="", max_length=300)
    setting: Literal["INT", "EXT"]
    moment: str = Field(max_length=40)
    summary: str = Field(default="", max_length=2000)
    characters: list[str] = Field(default_factory=list, max_length=40)
    excerpt: str | None = Field(default=None, max_length=1200)


class LocationSuggestRequest(BaseModel):
    film: FilmContext
    decor: DecorRef
    scenes: list[SceneInput] = Field(min_length=1, max_length=40)
    other_decors: list[str] = Field(default_factory=list, max_length=60)
    exclude: list[str] = Field(default_factory=list, max_length=30)
    # Ex. « pluie probable sur la période : préférer des lieux abrités »
    constraints: list[Annotated[str, Field(max_length=200)]] = Field(
        default_factory=list, max_length=5
    )


# --- Sortie du LLM ------------------------------------------------------------------------


class Besoins(BaseModel):
    """Ce que le lieu doit permettre, déduit du texte des scènes."""

    a_voir: list[str] = Field(description="Ce qu'on doit voir à l'image.")
    actions: list[str] = Field(description="Ce que les personnages font dans le lieu.")
    ambiance: str = Field(description="L'ambiance, cohérente avec le genre et le ton du film.")
    pratique: list[str] = Field(
        description="Contraintes pratiques : son, figurants, intérieur ou extérieur, accès."
    )


class Proposition(BaseModel):
    type_de_lieu: str = Field(description="Un TYPE de lieu, jamais un nom d'établissement.")
    pourquoi: str = Field(
        description="Une ou deux phrases simples : pourquoi ce type colle aux scènes."
    )
    requete_recherche: str = Field(
        description=(
            "Ce qu'on taperait dans une carte pour trouver ce type de lieu : 1 ou 2 mots, "
            "le nom courant du lieu (ex. « café », « boulangerie », « plage », « hammam »), "
            "sans adjectif ni nom de ville."
        )
    )
    zone: str = Field(description="Quartier ou type de zone où chercher, sans adresse.")
    facilite: Literal["facile", "moyenne", "difficile"]
    autorisation_probable: Literal["non_necessaire", "a_demander"]
    a_verifier_sur_place: list[str]


class LLMLocationSuggestion(BaseModel):
    besoins: Besoins
    # 3 attendues (du plus fidèle au script au plus facile) ; le serveur en garde 3 au plus.
    propositions: list[Proposition]
    mutualisation: str | None = Field(
        description="Autre décor de la liste qui peut se tourner au même endroit, sinon null."
    )


# --- Réponse de l'API ---------------------------------------------------------------------


class PlaceCandidate(BaseModel):
    """Lieu réel trouvé par la recherche géographique (jamais par le LLM)."""

    name: str
    address: str
    lat: float
    lon: float
    osm_url: str


class PropositionWithCandidates(Proposition):
    candidates: list[PlaceCandidate] = Field(default_factory=list, max_length=3)


class LocationSuggestResponse(BaseModel):
    status: Literal["Brouillon IA : à valider"] = "Brouillon IA : à valider"
    decor: str
    besoins: Besoins
    propositions: list[PropositionWithCandidates]
    mutualisation: str | None = None
    model: str
