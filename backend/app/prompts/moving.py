"""Prompt du PLAN EN MOUVEMENT : une seule prise décrite par des passages, en secondes."""

from app.prompts.common import PRINCIPLES, render_scene, scene_rows
from app.schemas.shot_spec import ShotSpecRequest

SPECIFICS = """
Cette scène est filmée en UNE SEULE PRISE EN MOUVEMENT. Sa durée est donnée dans <scene>.
Tu décris la prise par des PASSAGES consécutifs qui couvrent toute la durée :
- le premier passage commence à 0 s, chaque passage commence quand le précédent finit, le dernier finit \
à la durée indiquée (start_s et end_s sont en secondes, comptées depuis le début de la prise) ;
- prévois 2 à 6 passages (8 au maximum) : un nouveau passage quand quelque chose change nettement \
(un personnage entre ou sort de l'image, la caméra change de mouvement, la lumière change).
Pour chaque passage :
- description_fr : ce qui se passe à l'image et comment la caméra bouge (1 à 2 phrases) ;
- at_start : le cadrage au début du passage ; s'il n'y a ni personne ni visage à l'image pendant ce \
passage, subject_kind vaut « none » (ou « object ») et subject_view « not_applicable » ;
- at_end : seulement si le cadrage évolue en douceur pendant le passage (par exemple la caméra passe de \
la contre-plongée à la plongée, ou le sujet passe du tiers droit au tiers gauche) : le cadrage à la fin. \
Sinon null ;
- movement : « static » si la caméra est immobile pendant le passage, sinon « pan » (pivoter), \
« tilt » (haut/bas) ou « tracking » (se déplacer).
how_fr : explique à l'utilisateur, en français et en le tutoyant, comment la scène sera filmée, avec \
les secondes (par exemple « Pendant 10 secondes, tu pars de la gauche... »). Les secondes de ce texte \
doivent correspondre exactement à tes passages.
label_fr : titre court du plan. why_fr : pourquoi ce plan pour CETTE scène. advice_fr : conseils non \
mesurables par le téléphone (vitesse du mouvement, départ, arrivée, son).
Les secondes sont les seuls nombres que tu écris : tout le reste vient du vocabulaire du schéma.
"""


def build_system(rules_text: str) -> str:
    return f"{PRINCIPLES}{SPECIFICS}\n# RÈGLES DE CINÉMATOGRAPHIE\n\n{rules_text}"


def build_user(scene: ShotSpecRequest) -> str:
    rows = scene_rows(scene)
    if scene.duration_s is not None:
        rows.append(("Durée estimée de la prise", f"{scene.duration_s:g} secondes"))
    return render_scene(rows, "Décris la prise, passage par passage.")
