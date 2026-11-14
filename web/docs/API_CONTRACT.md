# Contrat d'API Premier Plan

> Document de travail : version complète (corps, réponses, erreurs, exemples JSON) livrée en phase 7.
> Source de vérité des types : `src/api/types.ts`. Schémas de validation : `src/api/schemas.ts`.

## Règles générales

- **Valeurs d'énumération en ASCII** (sans accent ni espace), par ex. `meteo_a_reverifier`, `non_divulgue`.
  Les accents n'apparaissent que dans les libellés affichés par l'interface.
- **Météo hors horizon** : quand `forecast = 'hors_horizon'`, `rain_pct`, `wind_kmh` et `cloud_pct` valent `null`.
  L'interface affiche alors « Météo à revérifier » et n'invente aucune prévision.
- Erreurs : statut HTTP + corps JSON `{ "message": "…en français…" }` (ou `detail`, format FastAPI).

## Endpoints

| Fonction | Méthode et route | Usage | Statut |
|---|---|---|---|
| `createProject` | POST `/projects` | Nouveau projet | confirmé |
| `getProject` | GET `/projects/{id}` | Projet complet | confirmé |
| `updateProject` | PATCH `/projects/{id}` | Scènes, lieux, personnes, sélection | à confirmer |
| `deleteProject` | DELETE `/projects/{id}` | « Supprimer mes données » | confirmé |
| `getProjectPassport` | GET `/projects/{id}/passport` | Passeport du projet (`null` si aucun) | **à confirmer** (ajout du front) |
| `parseScreenplay` | POST `/planner/parse` | Fichier ou texte du scénario → scènes (brouillon) | à confirmer |
| `geocode` | GET `/planner/geocode?q=` | Adresse ou ville → coordonnées | à confirmer |
| `quickSlots` | POST `/planner/quick` | Scène rapide → créneaux classés | à confirmer |
| `generateSchedule` | POST `/planner/schedule` | Projet → planning brouillon | à confirmer |
| `getWeather` | GET `/planner/weather?lat&lon&from&to` | Prévisions par jour | à confirmer |
| `getAiTools` | GET `/ai-tools` | Catalogue des outils IA avec statut | à confirmer |
| `savePassport` | POST `/passport` | Enregistrer la déclaration | confirmé |
| `checkPassport` | GET `/passport/{id}/check` | Contrôle avant PDF | confirmé |
| `getPassportPdfUrl` | GET `/passport/{id}/pdf` | PDF | confirmé |
| `signC2pa` | POST `/c2pa/sign` | Signer le fichier final | confirmé |
| `verifyPassport` | GET `/verify/{id}` | Page publique des festivals | confirmé |
| `searchFestivals` | GET `/festivals` | Recherche + classement | confirmé |
| `getSubtitleDraft` / `saveSubtitles` | GET / PUT `/subtitles/{projectId}` | Sous-titres | à confirmer |
| `getSynopsisFeedback` | POST `/synopsis/feedback` | Questions du coach | confirmé |
| `getPublicFilm` | GET `/films/{id}/public` | Page film publique | à confirmer |
| — | POST `/shot-spec` | Coach (conseils de prise de vue) | **futur**, non utilisé |

## Algorithme de planning

Décrit en tête de `src/api/mocks/scheduler.ts` (référence pour le backend) ; règles partagées dans
`src/features/planner/lib/rules.ts`.
