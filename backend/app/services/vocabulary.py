"""Libellés français du vocabulaire fermé : ce que l'utilisateur lit et modifie dans le plan.

Chaque champ de `ShotIntent` à choix fermé a un libellé et des options. Le front construit ses
listes déroulantes à partir de `GET /calibration`, donc une seule source de vérité.
"""

from app.schemas.shot_spec import (
    Backlight,
    CameraAngle,
    Contrast,
    Exposure,
    Movement,
    ShotSize,
    Stability,
    SubjectKind,
    SubjectPosition,
    SubjectView,
    SunRelative,
    Tilt,
)

# (clé du champ, libellé du champ, {valeur: libellé}) dans l'ordre d'affichage.
FIELDS: list[tuple[str, str, dict[str, str]]] = [
    (
        "size",
        "Taille de plan",
        {
            ShotSize.ECU: "Très gros plan (détail)",
            ShotSize.CU: "Gros plan (visage)",
            ShotSize.MCU: "Plan rapproché (poitrine)",
            ShotSize.MS: "Plan moyen (taille)",
            ShotSize.MWS: "Plan américain (cuisses)",
            ShotSize.WS: "Plan large (lieu)",
        },
    ),
    (
        "subject_kind",
        "Ce qu'on filme",
        {
            SubjectKind.person: "Une personne",
            SubjectKind.face: "Un visage",
            SubjectKind.hands: "Des mains",
            SubjectKind.object: "Un objet",
            SubjectKind.none: "Pas de sujet précis (décor)",
        },
    ),
    (
        "subject_view",
        "Vue du sujet",
        {
            SubjectView.front: "De face",
            SubjectView.side: "De profil",
            SubjectView.back: "De dos",
            SubjectView.not_applicable: "Sans objet",
        },
    ),
    (
        "subject_position",
        "Place dans l'image",
        {
            SubjectPosition.left_third: "Tiers gauche",
            SubjectPosition.center: "Au centre",
            SubjectPosition.right_third: "Tiers droit",
        },
    ),
    (
        "camera_angle",
        "Hauteur de la caméra",
        {
            CameraAngle.eye_level: "À hauteur des yeux",
            CameraAngle.low: "En contre-plongée (vers le haut)",
            CameraAngle.high: "En plongée (vers le bas)",
        },
    ),
    ("tilt", "Horizon", {Tilt.level: "Droit", Tilt.dutch: "Penché (volontairement)"}),
    (
        "light_contrast",
        "Contraste de la lumière",
        {
            Contrast.low: "Très doux",
            Contrast.medium_low: "Doux",
            Contrast.medium: "Moyen",
            Contrast.high: "Fort",
        },
    ),
    (
        "exposure",
        "Luminosité de l'image",
        {Exposure.dark: "Sombre", Exposure.balanced: "Équilibrée", Exposure.bright: "Claire"},
    ),
    (
        "backlight",
        "Contre-jour",
        {
            Backlight.avoid: "À éviter",
            Backlight.accept: "Toléré",
            Backlight.intentional: "Voulu (silhouette)",
        },
    ),
    (
        "sun_relative",
        "Soleil par rapport au sujet",
        {
            SunRelative.front: "Dans mon dos (sujet éclairé)",
            SunRelative.side: "De côté",
            SunRelative.behind: "Derrière le sujet",
            SunRelative.not_applicable: "Sans objet (intérieur)",
        },
    ),
    ("stability", "Appui", {Stability.tripod: "Sur trépied", Stability.handheld: "À main levée"}),
    (
        "movement",
        "Mouvement",
        {
            Movement.static: "Caméra fixe",
            Movement.pan: "Panoramique (pivoter)",
            Movement.tilt: "Tilt (haut/bas)",
            Movement.tracking: "Travelling (suivre)",
        },
    ),
]
