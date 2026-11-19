"""Fiche de tournage d'une scène, écrite par l'IA à partir du texte de la scène (jamais inventée).

Ce qui n'est pas dans le texte reste vide : le front affiche alors « non précisé ».
"""

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.location_suggest import FilmContext

Moment = Literal["jour", "nuit", "aube", "heure_doree"]


class SceneForDetail(BaseModel):
    number: str = Field(max_length=20)
    title: str = Field(default="", max_length=300)
    setting: Literal["INT", "EXT"]
    moment: Moment
    decor: str = Field(default="", max_length=200)
    summary: str = Field(default="", max_length=2000)
    characters: list[str] = Field(default_factory=list, max_length=40)
    excerpt: str | None = Field(default=None, max_length=1200)


class SceneDetailRequest(BaseModel):
    film: FilmContext
    scene: SceneForDetail


class LLMSceneDetail(BaseModel):
    what_happens: str = Field(
        description="Ce qui se passe, dans l'ordre, en 3 à 5 phrases simples. Faits du texte."
    )
    on_screen: str = Field(
        description="Ce qu'on voit à l'image : décor, ambiance, lumière décrite. Vide si absent."
    )
    props: list[str] = Field(description="Accessoires cités ou indispensables à l'action.")
    costumes: list[str] = Field(
        description="Costumes, maquillage, coiffure cités dans le texte. Vide si rien."
    )
    extras: str = Field(description="Figurants, foule, passants mentionnés. Vide si aucun.")
    sound: list[str] = Field(description="Sons, musique, bruits utiles cités ou évidents.")
    special: list[str] = Field(
        description="Véhicules, animaux, effets, cascades, eau, feu. Vide si rien."
    )
    watch_out: list[str] = Field(
        description="Points d'attention pour le tournage, déduits du texte (2 à 4 au plus)."
    )


class SceneDetail(LLMSceneDetail):
    model: str
