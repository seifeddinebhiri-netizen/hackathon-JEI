# Contrat d'API

Source de vérité des types : [`src/api/types.ts`](../src/api/types.ts). Schémas de validation (zod, vérifiés par le
compilateur contre les types) : [`src/api/schemas.ts`](../src/api/schemas.ts). Implémentation simulée de référence :
[`src/api/mocks/handlers.ts`](../src/api/mocks/handlers.ts). Les exemples ci-dessous viennent des mocks et sont abrégés (`…`).

Statuts : **confirmé** (validé avec l'équipe backend), **à confirmer** (proposé par le front), **futur** (pas utilisé).

## Règles générales

- JSON en UTF-8. Dates en ISO 8601 : `"2026-11-21"` pour un jour, `"2026-11-21T08:00:00+01:00"` pour un instant.
  Heures locales `"HH:mm"` (`"07:00"`).
- **Valeurs d'énumération en ASCII** (sans accent ni espace) : `meteo_a_reverifier`, `non_divulgue`… Les accents
  n'apparaissent que dans les libellés affichés.
- **Météo hors horizon** : si `forecast = "hors_horizon"`, `rain_pct`, `wind_kmh` et `cloud_pct` valent `null`.
  Le front affiche « Météo à revérifier » ; aucune valeur ne doit être inventée.
- Authentification : en-tête `Authorization: Bearer <jeton>` (jeton Supabase, voir INTEGRATION.md).
- Champs facultatifs : absents ou `undefined` ; ne pas envoyer `null` sauf là où le type l'indique.
- Toute réponse est validée par zod côté front : une réponse non conforme s'affiche comme une erreur
  (« La réponse du serveur n'a pas le format attendu »), jamais comme un écran blanc.

### Erreurs

Corps du backend encadré : `{ "error": { "code": "festival_not_found", "message": "…en français…" } }`. Le front lit
`error.message`, puis `message`, puis `detail` (format FastAPI par défaut).
Le message est affiché tel quel à l'utilisateur ; sans message, le front en affiche un par défaut.

| Statut | Code front | Message par défaut |
|---|---|---|
| 400, 422 | `invalide` | Certaines informations envoyées ne sont pas valides. |
| 401 | `non_autorise` | Ta session a expiré. Reconnecte-toi. |
| 403 | `interdit` | Tu n'as pas accès à cette ressource. |
| 404 | `introuvable` | Élément introuvable. |
| 409 | `conflit` | Ces données ont été modifiées ailleurs. Recharge la page. |
| 413 | `trop_volumineux` | Fichier trop volumineux. |
| 5xx | `serveur` | Le serveur a rencontré un problème. |
| — | `delai_depasse` | Délai : 15 s, 60 s pour l'import de scénario. |
| — | `reseau` | Impossible de joindre le serveur. |

## Vue d'ensemble

| Fonction | Méthode et route | Usage | Statut |
|---|---|---|---|
| `createProject` | POST `/projects` | Nouveau projet | confirmé |
| `getProject` | GET `/projects/{id}` | Projet complet | confirmé |
| `updateProject` | PATCH `/projects/{id}` | Scènes, lieux, personnes, planning, sélection, Kit Festival | à confirmer |
| `deleteProject` | DELETE `/projects/{id}` | « Supprimer mon projet » | confirmé |
| `getProjectPassport` | GET `/projects/{id}/passport` | Passeport du projet (`null` si aucun) | **à confirmer** (ajout du front) |
| `parseScreenplay` | POST `/planner/parse` | Scénario → scènes (brouillon) | à confirmer |
| `geocode` | GET `/planner/geocode?q=` | Adresse ou ville → coordonnées | à confirmer |
| `quickSlots` | POST `/planner/quick` | Scène rapide → créneaux classés | à confirmer |
| `generateSchedule` | POST `/planner/schedule` | Projet → planning brouillon | à confirmer |
| `getWeather` | GET `/planner/weather` | Prévisions par jour | à confirmer |
| `getAiTools` | GET `/ai-tools` | Catalogue des outils IA | à confirmer |
| `savePassport` | POST `/passport` | Créer ou mettre à jour la déclaration | confirmé |
| `checkPassport` | GET `/passport/{id}/check` | Contrôle avant PDF | confirmé |
| `getPassportPdfUrl` | GET `/passport/{id}/pdf` | URL du PDF | confirmé |
| `signC2pa` | POST `/c2pa/sign` | Signer le fichier final | confirmé |
| `verifyPassport` | GET `/verify/{id}` | Page publique des festivals | confirmé |
| `searchFestivals` | GET `/festivals` | Recherche, filtres, classement | confirmé |
| `getFestival` | GET `/festivals/{id}` | Fiche d'un festival | backend prêt |
| `createSubtitleDraft` | POST `/subtitles/{projectId}/draft` | Audio/vidéo → brouillon FR + EN | backend prêt |
| `getSubtitleDraft` | GET `/subtitles/{projectId}` | Brouillon de sous-titres | backend prêt |
| `saveSubtitles` | PUT `/subtitles/{projectId}` | Enregistrer les lignes | backend prêt |
| `getSynopsisFeedback` | POST `/synopsis/feedback` | Questions du coach | confirmé |
| `translateSynopsis` | POST `/synopsis/translate` | Version anglaise du synopsis (brouillon IA) | confirmé |
| `getPublicFilm` | GET `/films/{id}/public` | Page film publique | à confirmer |
| — | POST `/shot-spec` | Coach : conseils de prise de vue | **futur** |
| — | GET `/projects/{id}/days/{date}/public` | Feuille de service partageable sans compte | **futur** |
| — | POST `/films/{id}/stills` | Envoi des photos de la page film | **futur** |

---

## Projet

### `createProject` — POST `/projects` · confirmé

Corps (`CreateProjectInput`) :
```json
{ "title": "Dar Hmeti", "format": "court", "city": "Tunis",
  "shooting_window": { "from": "2026-11-19", "to": "2026-12-08" }, "max_hours_per_day": 8 }
```
Réponse 201 : `Project` (listes vides). Erreurs : 400/422.

### `getProject` — GET `/projects/{id}` · confirmé

Réponse 200 : `Project`. Erreurs : 401, 403, 404.
```json
{
  "id": "demo-maree-basse", "title": "Dar Hmeti", "format": "court", "city": "Tunis",
  "shooting_window": { "from": "2026-11-19", "to": "2026-12-08" }, "max_hours_per_day": 8,
  "locations": [{
    "id": "loc-medina", "name": "Médina : ruelle et café", "address": "Médina de Tunis, [adresse exacte à compléter]",
    "lat": 36.7986, "lon": 10.1706, "access_hours": { "from": "07:00", "to": "23:00" },
    "forbidden_days": ["vendredi"], "permit": "a_demander", "notes": "…"
  }],
  "scenes": [{
    "id": "sc-1", "number": "1", "title": "Amira ouvre le café", "setting": "INT", "moment": "jour",
    "location_id": "loc-medina", "characters": ["Amira", "Mounir"], "estimated_hours": 2,
    "summary": "Amira lève le rideau du café de son oncle…", "source": "import_ia", "validated": true
  }],
  "people": [
    { "id": "p-1", "kind": "acteur", "name": "[Actrice 1]", "role": "Actrice", "character": "Amira" },
    { "id": "p-5", "kind": "equipe", "name": "Yassine", "role": "Réalisation" }
  ],
  "schedule": { "…": "voir generateSchedule" },
  "festival_shortlist": [{
    "festival_id": "fest-a", "status": "a_preparer",
    "checklist": [{ "requirement": { "kind": "synopsis", "detail": "Synopsis de 300 caractères maximum", "limit_chars": 300 }, "done": false }]
  }],
  "film_profile": { "duration_min": 15, "language": "Derja (arabe tunisien)", "genre": "Fiction" },
  "synopsis": { "phrase": "…", "court": "…", "long": "…" },
  "film_page": { "stills": ["/photos/ruelle.jpg"], "trailer_url": "https://…" }
}
```
`festival_shortlist[].status` (« Où j'en suis ») · **confirmé côté front** : `a_preparer` (en préparation) | `pret` (prêt à
soumettre) | `soumis` (soumis sur le site officiel) | `reponse_recue` | `prochain_appel` (appel clos, pour la prochaine
édition). Ces cinq valeurs sont validées par le schéma zod du front. Le backend ne gère pas encore les projets :
la mise à jour du statut passe par `PATCH /projects/{id}`, qui reste servi par le mock. `checklist[].done` sert aux pièces cochées à la main (affiche,
biographie, format…) et à la déclaration IA validée.

`forbidden_days` accepte des dates ISO (`"2026-11-21"`) ou des jours de semaine en français, en minuscules (`"vendredi"`).
`film_profile`, `synopsis` et `film_page` sont facultatifs (absents tant que le Kit Festival n'a rien enregistré).

### `updateProject` — PATCH `/projects/{id}` · à confirmer

Corps : sous-ensemble de `Project` (`UpdateProjectInput`) : `title`, `format`, `city`, `shooting_window`,
`max_hours_per_day`, `scenes`, `locations`, `people`, `schedule`, `festival_shortlist`, `film_profile`, `synopsis`,
`film_page`. Chaque champ envoyé **remplace** la valeur entière (pas de fusion profonde des listes).
Réponse 200 : `Project` complet. Erreurs : 400/422, 404, 409.

Usages : enregistrement automatique de l'assistant (scènes, lieux, personnes), déplacements dans le calendrier
(`schedule` recalculé par le front), validation du planning (`schedule.status = "valide"`), sélection de festivals,
Kit Festival (`film_profile`, `synopsis`, `film_page`).

Le navigateur garde une copie de `film_profile`, `synopsis` et `film_page` (clés `pp-cache-<champ>-<projectId>`,
même forme) qui sert seulement de cache d'affichage et de filet si l'enregistrement échoue.

### `deleteProject` — DELETE `/projects/{id}` · confirmé

Supprime le projet, son Passeport (la page de vérification renvoie alors 404) et ses sous-titres.
Réponse 200 `{ "ok": true }` ou 204. Erreurs : 403, 404.

### `getProjectPassport` — GET `/projects/{id}/passport` · à confirmer (ajout du front)

Réponse 200 : `Passport` ou `null` si aucune déclaration n'existe encore. Erreurs : 404 (projet).

---

## Planner

### `parseScreenplay` — POST `/planner/parse` · à confirmer

`multipart/form-data` : `file` (PDF, DOCX, TXT ou Fountain, 10 Mo maximum côté front) **ou** `text`.
Délai côté front : 60 s. Le scénario ne doit pas être conservé après le découpage (message affiché à l'utilisateur).

Réponse 200 (`ParseScreenplayResult`) :
```json
{
  "scenes": [{ "id": "sc-…", "number": "1", "title": "Amira attend le premier train", "setting": "INT",
               "moment": "aube", "location_id": "loc-x", "characters": ["Nour"], "estimated_hours": 0.5,
               "summary": "Amira attend le premier train, sa valise à la main.", "source": "import_ia", "validated": false }],
  "locations": [{ "id": "loc-x", "name": "Gare de Tunis", "address": "", "forbidden_days": [], "permit": "non_necessaire" }],
  "characters": ["Nour"],
  "warnings": ["Les durées de tournage sont estimées à partir de la longueur du texte : ajuste-les."]
}
```
Les scènes renvoyées ont `source = "import_ia"` et `validated = false` (affichées « Brouillon IA : à valider »).
`location_id` renvoie vers un lieu de `locations` ; le front fusionne les lieux par nom avec ceux du projet.
Erreurs : 400 (aucun contenu), 413, 415/422 (format non pris en charge).

### `geocode` — GET `/planner/geocode?q=La Marsa` · à confirmer

Réponse 200 : `GeocodeResult[]` (le premier est utilisé), éventuellement vide.
```json
[{ "label": "La Marsa", "lat": 36.8782, "lon": 10.3247 }]
```

### `quickSlots` — POST `/planner/quick` · à confirmer

Corps (`QuickSlotRequest`) :
```json
{ "description": "Amira marche seule sur la plage…", "place": "Tunis", "setting": "EXT",
  "moment": "heure_doree", "from": "2026-11-15", "to": "2026-11-28" }
```
Réponse 200 (`QuickSlotsResponse`), créneaux triés : `recommande`, puis `plan_b`, puis `a_eviter` (8 au plus) :
```json
{
  "place": { "label": "Tunis", "lat": 36.8065, "lon": 10.1815 },
  "slots": [{
    "start": "2026-11-15T16:00:00+01:00", "end": "2026-11-15T17:30:00+01:00", "verdict": "recommande",
    "reason": "Ciel plutôt dégagé (nuages 31 %, pluie 16 %). Soleil au sud-ouest, à 12° au-dessus de l'horizon.",
    "weather": { "…": "WeatherDay" }
  }]
}
```
Le Planner ne donne pas de conseils de cadrage (type de plan, hauteur, inclinaison) : c'est le rôle du Coach.

### `generateSchedule` — POST `/planner/schedule` · à confirmer

Corps : `{ "project_id": "demo-maree-basse" }`. Le serveur lit le projet enregistré.
Réponse 200 (`Schedule`, `status = "brouillon_ia"`). Le front l'enregistre ensuite avec `PATCH /projects/{id}`
(si le serveur l'enregistre déjà, ce PATCH reste sans effet). Erreurs : 404, 422 (projet incomplet).
```json
{
  "generated_at": "2026-11-14T15:02:11+01:00", "status": "brouillon_ia",
  "days": [{
    "date": "2026-11-19", "location_ids": ["loc-medina"], "call_time": "07:00",
    "scenes": [{
      "scene_id": "sc-1", "start": "2026-11-19T08:00:00+01:00", "end": "2026-11-19T10:00:00+01:00",
      "conflicts": [{ "kind": "autorisation_manquante", "message": "Autorisation de tournage encore à demander pour Médina : ruelle et café." }]
    }],
    "weather": { "date": "2026-11-19", "rain_pct": 17, "wind_kmh": 21, "cloud_pct": 33,
                 "sunrise": "2026-11-19T07:01:00+01:00", "sunset": "2026-11-19T17:07:00+01:00",
                 "golden_hour": { "from": "2026-11-19T16:27:00+01:00", "to": "2026-11-19T17:07:00+01:00" },
                 "forecast": "prevision" },
    "backup_note": "Risque d'averse (27 %) : repli possible sur scène 1."
  }],
  "unplaced": [{ "scene_id": "sc-9", "reason": "Plus de place dans la période : allonge la période ou les heures par jour." }]
}
```
Types de conflits : `pluie`, `vent`, `lieu_ferme`, `jour_trop_long`, `autorisation_manquante`, `meteo_a_reverifier`.

### `getWeather` — GET `/planner/weather?lat=36.8&lon=10.18&from=2026-11-19&to=2026-12-08` · à confirmer

Réponse 200 : `WeatherDay[]`, un par jour de la période. Au-delà de l'horizon (environ 14 jours) :
```json
{ "date": "2026-12-05", "rain_pct": null, "wind_kmh": null, "cloud_pct": null,
  "sunrise": "2026-12-05T07:15:00+01:00", "sunset": "2026-12-05T17:02:00+01:00",
  "golden_hour": { "from": "…", "to": "…" }, "forecast": "hors_horizon" }
```
Le front l'utilise pour recalculer les conflits même sur les jours vides du calendrier.

---

## Passeport IA

### `getAiTools` — GET `/ai-tools` · à confirmer

Réponse 200 : `AiTool[]`. Le statut décrit ce que **le fournisseur publie** (données d'entraînement, droits),
pas le travail du réalisateur. `non_divulgue` est un statut valide.
```json
[{ "id": "tool-montage-a", "name": "[Logiciel de montage avec IA]", "provider": "[Fournisseur E]",
   "status": "partiel", "note": "Fonctions IA documentées, origine des données partiellement décrite.",
   "source_url": "https://fournisseur-e.exemple.invalid/ia", "checked_at": "2026-10-01" }]
```

### `savePassport` — POST `/passport` · confirmé

Création (sans `id`) ou mise à jour (avec `id`). Corps (`SavePassportInput`) :
```json
{ "id": "pass-4ff7045785", "project_id": "demo-maree-basse", "film_title": "Dar Hmeti", "director": "Yassine",
  "declarations": [
    { "department": "scenario", "used_ai": false, "what": "", "human_decisions": "Écrit par le réalisateur." },
    { "department": "montage", "used_ai": true, "tool_id": "tool-montage-a",
      "what": "Détection automatique des plans et synchronisation du son.", "level": "assistance",
      "human_decisions": "Choix des prises et du rythme." }
  ] }
```
Réponse 200 : `Passport` (le serveur fixe `badge_code`, `verify_url`, `c2pa_signed`, `updated_at`).
Le front enregistre automatiquement à chaque modification. Départements : `scenario`, `image`, `montage`, `son_voix`,
`musique`, `vfx`, `sous_titres`, `affiche_promo`. Niveaux : `assistance`, `generation_partielle`, `generation_complete`.
Un outil hors catalogue passe par `custom_tool` (affiché « Non divulgué »).

### `checkPassport` — GET `/passport/{id}/check` · confirmé

Réponse 200 (`PassportCheck`). Le bouton PDF est actif seulement si `ok = true`.
```json
{ "ok": false,
  "missing": [{ "department": "musique", "message": "Musique : réponds à « As-tu utilisé une IA ? »." }],
  "warnings": ["Affiche et promotion : [Générateur d'images A] est « Non divulgué » (…). Ce statut est valide et sera affiché tel quel."] }
```

### `getPassportPdfUrl` — GET `/passport/{id}/pdf` · confirmé

Réponse 200 : `{ "url": "https://…/passeport.pdf" }`, ouverte dans un nouvel onglet. En mode mock, l'URL pointe vers
`/verifier/{id}?imprimer=1` (aperçu imprimable). Erreurs : 404, 409 (déclaration incomplète).

### `signC2pa` — POST `/c2pa/sign` · confirmé

Corps : `{ "passport_id": "pass-4ff7045785", "file_name": "dar-hmeti-v-finale.mp4" }`.
Réponse 200 :
```json
{ "signed": true, "manifest_id": "c2pa-…", "signed_at": "2026-11-14T16:10:00+01:00", "simulated": true }
```
`simulated = true` : le front l'annonce (« aucune signature réelle n'a été posée »). Erreurs : 404, 409.

### `verifyPassport` — GET `/verify/{id}` · confirmé · **public, sans authentification**

Réponse 200 (`VerifyResult`) : la déclaration, les outils utilisés (catalogue), l'état de la signature.
```json
{ "passport": { "id": "exemple", "film_title": "[Film d'exemple]", "badge_code": "EN-EXEM-PL", "c2pa_signed": true, "…": "…" },
  "tools": [{ "id": "tool-son-a", "status": "documente", "…": "…" }],
  "signature": { "signed": true, "signed_at": "2026-10-01T10:00:00+01:00", "manifest_id": "c2pa-exemple" },
  "checked_at": "2026-11-14T16:12:00+01:00" }
```
Erreur 404 : le front affiche « Passeport introuvable ».

---

## Festival

### `searchFestivals` — GET `/festivals` · confirmé

Paramètres (tous facultatifs) : `q` (nom, pays ou ville, sans tenir compte des accents), `country`, `max_duration_min`,
`fee` (`gratuit` | `payant`), `deadline_before` (date ISO), `subtitle_lang` (`fr`, `en`, `ar`), `ai_policy`,
`open_only` (`true` : seulement `deadline_status = ouverte`). Pour classer pour un film : `film_duration_min`,
`film_language`, `film_genre`, `film_ai_departments`. Même résultat en `POST /festivals/match` (film et filtres dans le corps).

Réponse 200 : `FestivalMatch[]`. Avec un film : score décroissant, puis appels ouverts (date la plus proche), à
confirmer, clos (les plus récents d'abord) ; sans film, le même ordre sans le score.
```json
[{ "festival": {
     "id": "vienna-shorts", "name": "Vienna Shorts · Fiction & Documentary", "country": "Autriche", "city": "Vienne",
     "edition": "24e édition, 25-30 mai 2027", "deadline": "2027-01-31", "deadline_status": "ouverte",
     "deadline_note": "Tarif normal 19 € jusqu'au 5 janvier 2027, tarif tardif 29 € du 6 au 31 janvier 2027.",
     "fee": "19 € puis 29 €", "max_duration_min": 30, "subtitle_langs": ["en"], "ai_policy": "a_declarer",
     "ai_policy_detail": "Déclaration obligatoire parmi 4 options : pas d'IA ; IA comme outil technique…",
     "eligibility": "Films terminés le 1er janvier 2026 ou après ; films d'écoles acceptés",
     "requirements": [{ "kind": "synopsis", "detail": "Synopsis court dans le formulaire", "limit_chars": null }],
     "source_url": "https://viennashorts.filmchief.com/submit-film/fiction-documentary-2027", "checked_at": "2026-11-18" },
   "score": 4,
   "reasons": ["Durée compatible (15 min pour 30 min maximum).", "Le festival demande une déclaration IA : ton Passeport IA la prépare."],
   "warnings": ["Sous-titres demandés en : en."] }]
```
- `deadline` : date ISO ou `null` (prochaine édition pas encore annoncée). `deadline_status` (`ouverte` | `passee` |
  `a_confirmer`) est calculé à la lecture, jamais stocké.
- `ai_policy` : `acceptee` | `a_declarer` | `interdite` | `section_dediee` (films faits par IA dans une section à part)
  | `non_precisee` (le règlement ne dit rien : ce n'est pas une autorisation).
- Champs facultatifs, `null` si inconnus : `city`, `edition`, `deadline_note`, `ai_policy_detail`, `eligibility`,
  `max_duration_min`, `requirements[].limit_chars`.

Règles : une fiche sans `source_url` ou sans `checked_at` n'est pas affichée. Le score indique la compatibilité
avec les critères du festival ; il ne prédit pas la sélection (score 1 : un critère bloque, ex. durée, IA refusée,
appel clos). Pas de soumission ni de paiement via l'API. Le front ne recalcule pas la compatibilité : la fiche
reprend le score et les raisons de `searchFestivals` pour ce festival.

### `getFestival` — GET `/festivals/{id}` · backend prêt

Réponse 200 : `Festival` (même forme que ci-dessus, sans score). Erreur 404 :
`{ "error": { "code": "festival_not_found", "message": "Festival introuvable." } }`.

### `createSubtitleDraft` — POST `/subtitles/{projectId}/draft` · backend prêt

`multipart/form-data` :
- `file` (obligatoire) : audio ou vidéo du film, `SUBTITLE_MAX_UPLOAD_MB` maximum (200 Mo par défaut) ;
- `language_code` (facultatif) : code ISO-639-1 ou ISO-639-3 accepté par ElevenLabs Scribe. Pour la derja, `ara`
  (Scribe n'a pas de code de dialecte ; `aeb` est converti en `ara` par le serveur). `source_lang` vaut alors `derja`.
  Absent = langue détectée automatiquement ;
- `keyterms` (facultatif) : noms des personnages et des lieux séparés par des virgules (`"Nour, Amira, Kerkennah"`),
  50 au maximum, 5 mots et 50 caractères au plus chacun ; aide la transcription à les reconnaître ;
- `characters` (facultatif) : personnages séparés par des virgules, donnés au traducteur comme contexte.

Flux : transcription (ElevenLabs Scribe v2) → découpage en sous-titres → traduction FR + EN (Gemini ou Ollama,
avec le glossaire derja) → règles de sous-titrage. Le fichier est supprimé du serveur dès la transcription finie,
même en cas d'erreur ; l'audio n'est jamais stocké. Remplace le brouillon existant du projet. Réponse 200 : `SubtitleDraft`.
Cette requête peut durer une à plusieurs minutes (3 minutes au plus côté serveur, `SUBTITLE_DRAFT_TIMEOUT_S`).
`processing.translator` indique le modèle qui a réellement traduit (le principal, ou le modèle de secours si le
principal était indisponible).

Erreurs : `413` fichier trop volumineux · `422` fichier vide ou aucune parole détectée · `502` le service de
transcription a échoué · `503` transcription ou traduction non configurée sur le serveur · `504` délai dépassé.
En mode mixte, si l'appel réel échoue, l'écran propose de continuer avec le brouillon d'exemple (mock).

Une ligne que le traducteur n'a pas pu traduire reste dans le brouillon avec `fr` et `en` vides, `confidence: "faible"`
et une `note` : la requête n'échoue pas pour une ligne.

### `getSubtitleDraft` — GET `/subtitles/{projectId}` · backend prêt

Réponse 200 (`SubtitleDraft`) ; `lines` vide (et `processing` absent) s'il n'y a pas encore de brouillon.
```json
{ "project_id": "demo-maree-basse", "source_lang": "derja",
  "lines": [{ "id": "l8", "start": "00:02:44,000", "end": "00:02:46,800", "source": "Ya3tik essa7a, Nour.",
              "fr": "Merci, Nour.", "en": "Thank you, Nour.", "confidence": "elevee",
              "note": "« Ya3tik essa7a » : littéralement « que Dieu te donne la santé ». Remerciement courant…",
              "validated": false,
              "speaker": "S1", "glossary_used": ["ya3tik-essa7a"],
              "warnings": [{ "rule": "lecture_rapide", "detail": "FR : 19 car./s pour 2,8 s (limite 17)" }] }],
  "processing": { "transcriber": "elevenlabs/scribe_v2", "translator": "gemini/gemini-3.8-flash",
                  "created_at": "2026-11-18T15:02:11.204Z" } }
```
- Horodatage au format SRT (`HH:MM:SS,mmm`). Le front exporte le `.srt` lui-même, seulement si toutes les lignes sont validées.
- `confidence` : `elevee` | `moyenne` | `faible`. Calculée par le serveur à partir de celle du traducteur, abaissée
  d'un cran si la transcription est incertaine, et d'un cran si une tournure est signalée (`note`) sans entrée du
  glossaire. Jamais au-dessus de ce qu'indique le traducteur.
- Champs facultatifs (absents si vides, jamais `null`) : `en`, `note`, `speaker` (`S1`, `S2`… dans l'ordre
  d'apparition), `processing`. Toujours présents dans les réponses du serveur : `warnings` (liste, éventuellement vide)
  et `glossary_used` (ids du glossaire derja utilisés).
- `warnings[].rule` : `lecture_rapide` (plus de 17 car./s), `trop_de_lignes` (plus de 2 lignes de 42 car.),
  `ligne_trop_longue` (un mot dépasse 42 car.), `duree_courte` (moins de 1 s), `duree_longue` (plus de 7 s),
  `chevauchement` (moins de 80 ms après la ligne précédente). `detail` est un texte en français à afficher tel quel.
- `processing` : outils utilisés, repris par le Passeport IA.

### `saveSubtitles` — PUT `/subtitles/{projectId}` · backend prêt

Corps : `{ "lines": SubtitleLine[] }` (liste complète, ids uniques). Réponse 200 : `SubtitleDraft`.
Le serveur garde `source_lang` et `processing` du brouillon, ne modifie pas les horodatages et recalcule `warnings`
(les avertissements envoyés par le front sont ignorés pour ces règles). `422` si deux lignes ont le même `id` ou si un
horodatage n'est pas au format SRT.

### `translateSynopsis` — POST `/synopsis/translate` · confirmé

Corps : `{ "kind": "court", "text": "Dans la médina de Tunis…", "target_lang": "en" }`. Réponse 200 : `{ "text": "In the Tunis medina…" }`.
`kind` : `phrase` | `court` | `long` ; `target_lang` : `en` uniquement ; `text` : 10 000 caractères au plus.
`limit_chars` (facultatif, entier de 1 à 10 000) : limite de caractères que la traduction doit respecter ; le front
ne l'envoie pas pour l'instant.
Traduction du texte de l'auteur par le même LLM que les sous-titres (Gemini ou Ollama) : anglais naturel, noms propres
gardés, rien d'ajouté ni réécrit ; affichée « Brouillon IA : à valider ». Le texte n'est jamais loggé.
Erreurs : `422` texte vide ou corps invalide · `502` le service de traduction a échoué · `503` traduction non
configurée sur le serveur. Le mock ne traduit que les textes de démonstration.

### `getSynopsisFeedback` — POST `/synopsis/feedback` · confirmé

Corps : `{ "kind": "court", "text": "Amira, 24 ans, apprend…", "limit_chars": 300 }`
(`kind` : `phrase` | `court` | `long`). Réponse 200 :
```json
{ "questions": ["Quel est le moment où tout bascule pour ton personnage ?",
                "Un programmateur qui ne connaît pas la Tunisie comprendrait-il le contexte ?"] }
```
**Uniquement des questions** : la réponse ne contient jamais de texte réécrit.

### `getPublicFilm` — GET `/films/{id}/public` · à confirmer · **public**

`{id}` = identifiant du projet. Construit à partir du projet (`synopsis`, `film_page`, `people`) et du Passeport.
```json
{ "id": "demo-maree-basse", "title": "Dar Hmeti", "director": "Yassine",
  "synopsis_short": "…", "synopsis_long": "…",
  "stills": ["/photos/ruelle.jpg", "/photos/porte.jpg"],
  "credits": [{ "role": "Amira", "name": "[Actrice 1]" }, { "role": "Réalisation", "name": "Yassine" }],
  "trailer_url": "https://…", "passport_badge_code": "EN-WWVQ-M2",
  "verify_url": "https://…/verifier/pass-4ff7045785" }
```
Erreur 404 : « Film introuvable ». L'envoi de vraies photos (`POST /films/{id}/stills`) est **futur** : pour
l'instant, `film_page.stills` contient des chemins d'images déjà publiées.

---

## Algorithme de planning (référence : `src/api/mocks/scheduler.ts`)

Entrée : le projet (scènes, lieux, période, heures max par jour) et la météo de chaque jour.
Sortie : un `Schedule` au statut `brouillon_ia`.

1. Grouper les scènes par lieu ; les groupes avec le plus de scènes EXT passent en premier.
2. Pour chaque scène (EXT avant INT), noter chaque jour de la période :
   - éliminé si le lieu est interdit ce jour-là (date ISO ou jour de semaine en français) ;
   - éliminé si la somme des durées dépasse `max_hours_per_day` ;
   - éliminé si l'horaire imposé par le soleil (aube, heure dorée, nuit) sort des horaires d'accès du lieu,
     ou si une autre scène occupe déjà ce moment ;
   - 1er passage : éliminé si EXT et pluie ≥ 40 % ou vent ≥ 40 km/h, ou si la journée devient trop longue ;
   - bonus si le jour accueille déjà ce lieu (regroupement), malus s'il accueille un autre lieu ;
   - EXT : bonus si la prévision est connue et sèche ; INT : bonus si le jour est pluvieux ;
   - léger bonus aux jours les plus tôt.
3. Sans jour possible : 2e passage sans les filtres météo et amplitude (conflit signalé) ;
   sinon la scène va dans `unplaced` avec la raison.
4. Mise en page d'une journée (`layoutDay`, `src/features/planner/lib/rules.ts`) :
   aube / heure dorée / nuit calées sur le soleil (suncalc), scènes « jour » à la suite dès 08:00
   (ou l'ouverture du lieu) avec 30 min de battement, rendez-vous 1 h avant la 1re scène.
5. Conflits par scène : `pluie`, `vent`, `lieu_ferme`, `jour_trop_long`, `autorisation_manquante`,
   `meteo_a_reverifier` (EXT au-delà de 14 jours : la météo n'est pas inventée).
6. Note de repli (`backup_note`) quand un jour avec des scènes EXT a une météo incertaine.

Après la génération, les modifications manuelles **conservent les horaires déjà posés** : une scène déplacée sur une
date prend le premier créneau libre (ou son horaire solaire) ; déposée sur la frise, elle prend l'heure choisie
(pas de 15 min, refusée si elle chevauche une autre scène). Le front recalcule les conflits de la journée
(`finalizeDay`, `src/features/planner/lib/rules.ts`) et enregistre le planning avec `PATCH /projects/{id}` (`schedule`).
Les actions sur les conflits (« Marquer comme obtenue », « Déplacer au … ? ») passent aussi par ce `PATCH`. Si le backend applique d'autres règles, il doit
renvoyer un `Schedule` de même forme. La disponibilité des acteurs n'est pas prise en compte dans cette version.
