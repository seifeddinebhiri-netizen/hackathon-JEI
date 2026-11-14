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
| — | GET `/projects/{id}/days/{date}/public` | Feuille de service partageable sans compte (lien à jeton) | **futur** : pour l'instant « Copier le lien » ne fonctionne que pour les membres connectés |

## Algorithme de planning (référence : `src/api/mocks/scheduler.ts`)

Entrée : le projet (scènes, lieux, période, heures max par jour) et la météo de chaque jour.
Sortie : un `Schedule` au statut `brouillon_ia`.

1. Grouper les scènes par lieu ; les groupes avec le plus de scènes EXT passent en premier.
2. Pour chaque scène (EXT avant INT), noter chaque jour de la période :
   - éliminé si le lieu est interdit ce jour-là (`forbidden_days` : date ISO ou jour de semaine en français) ;
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

Le front réutilise `layoutDay` pour recalculer horaires et conflits après chaque déplacement manuel,
puis enregistre le planning avec `PATCH /projects/{id}` (`schedule`). Si le backend applique d'autres
règles, il doit renvoyer un `Schedule` de même forme. La disponibilité des acteurs n'est pas prise en compte.
