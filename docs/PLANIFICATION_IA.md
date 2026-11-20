# Encadré : l'IA dans la planification

> L'IA propose, le cinéaste décide.

Le dépouillement du scénario, les suggestions de tournage, les lieux et la météo se font
**dans l'assistant de planification** (`/planner/projet`). Il n'y a plus de pages séparées
« Dépouiller mon scénario » ni « Repérage · Lieux & météo ».

## Étape 2 · Scénario

1. **Découper en scènes** : colle le texte du scénario, ou importe un fichier `.txt` ou `.fountain`.
   L'IA (`POST /scenarios/analyze`, Anthropic ou Ollama selon `SCENARIO_PROVIDER`) repère les scènes,
   les décors et les personnages. Rien n'est inventé : les durées valent 1 h par défaut et ce que
   l'IA n'a pas pu lire (intérieur/extérieur, moment, lieu) est signalé. Chaque scène reste à valider.
2. **Suggestions pour le tournage** (`POST /planner/scenes/suggest`) : l'IA relit les scènes et
   propose, sans jamais réécrire l'histoire, les dialogues ni les personnages :
   - préciser intérieur ou extérieur, ou le moment de la journée ;
   - regrouper deux décors qui peuvent se tourner au même endroit ;
   - simplifier une scène coûteuse à tourner ;
   - signaler une information manquante.

   Chaque suggestion cite le texte qui la justifie. L'auteur l'**accepte** (la scène est modifiée
   dans le brouillon) ou la **refuse**. Le serveur écarte toute suggestion inapplicable (scène ou
   décor inconnus, changement qui ne change rien).

## Étape 3 · Lieux

1. **Lieux proposés** (`POST /planner/locations/suggest`) : pour chaque décor, l'IA propose 3 types
   de lieux ; OpenStreetMap Nominatim trouve de vrais lieux dans la ville. L'IA n'invente jamais
   d'adresse. « Choisir ce lieu » remplit l'adresse et les coordonnées ; le nom du décor ne change pas.
2. **Météo pendant le tournage** (`GET /planner/weather`) : dès que le lieu est localisé, la météo
   prévue à cet endroit s'affiche jour par jour sur la période de tournage (Open-Meteo, 14 jours ;
   au-delà, seuls le lever et le coucher du soleil sont calculés, aucun chiffre n'est inventé).
   Si la pluie ou le vent menacent des scènes en extérieur :
   - les **meilleurs jours** de la période sont indiqués ;
   - « **Proposer des lieux abrités** » relance les propositions avec cette contrainte.

## Endpoints

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/scenarios/analyze` | Dépouillement du scénario (scènes, décors, personnages) |
| POST | `/planner/scenes/suggest` | Suggestions de tournage, à accepter ou refuser |
| POST | `/planner/locations/suggest` | Types de lieux + lieux réels (champ `constraints` facultatif) |
| GET | `/planner/weather?lat=&lon=&from=&to=` | Météo jour par jour d'un lieu (120 jours au plus) |

En cas d'indisponibilité du LLM, les routes IA répondent 503 avec un message en français ;
l'auteur peut toujours tout remplir à la main.

## Tests

- Back : `tests/test_scene_suggest.py`, `tests/test_location_suggest.py`, `tests/test_weather.py`
  (LLM, Nominatim et Open-Meteo simulés).
- Front : `src/api/scenarioImport.test.ts`, `wizard/SceneSuggestions.test.tsx`,
  `wizard/LocationSuggestions.test.tsx`.

Sous Windows, lancer `npm test` et `npm run dev` depuis un chemin en `C:\` majuscule
(`Set-Location 'C:\Users\…\web'`) : depuis `c:\` minuscule, Vite charge certains modules deux fois.
