"""Prompt du PLAN FIXE : la caméra ne bouge pas, un seul cadrage à viser."""

from app.prompts.common import PRINCIPLES, render_scene, scene_rows
from app.schemas.shot_spec import ShotSpecRequest

SPECIFICS = """
Cette scène est un PLAN FIXE : la caméra ne bouge pas pendant la prise.
- Propose UN SEUL plan : le plan principal de la scène (pas une liste de plans).
- movement vaut « static ».
- label_fr : titre court. why_fr : 1 à 2 phrases, pourquoi ce choix pour CETTE scène, en tenant compte \
de l'ambiance, du style et de l'intention indiqués. advice_fr : conseils non mesurables par le \
téléphone (hauteur de caméra, son...) ; liste vide si rien à ajouter.
"""


def build_system(rules_text: str) -> str:
    return f"{PRINCIPLES}{SPECIFICS}\n# RÈGLES DE CINÉMATOGRAPHIE\n\n{rules_text}"


def build_user(scene: ShotSpecRequest) -> str:
    return render_scene(scene_rows(scene), "Propose le plan.")
