# Encadré — repérage intégré des lieux et de la météo

> **Mise à jour :** la page séparée décrite ici a été retirée. Ce module est désormais intégré à l’assistant de planification : voir [PLANIFICATION_IA.md](PLANIFICATION_IA.md).

L'IA propose, le cinéaste décide.

## Lancer exactement le MVP en local (PowerShell)

Prérequis : Python 3.12+, uv, Node/npm, Ollama installé, accès Internet pour les
lieux/météo/tuiles et une clé Geoapify obtenue dans son tableau de bord.

Depuis `C:\Users\fatma\hackathon-JEI`, vérifier la branche :

```powershell
git branch --show-current
# Résultat attendu : feature/scenario-ai
cd backend
uv sync --group dev
```

Si `.env` n'existe pas encore, copier le modèle une seule fois (ne pas écraser un
fichier existant contenant la configuration du projet) :

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Ajouter/adapter dans `backend/.env` :

```dotenv
GEOAPIFY_API_KEY=la_cle_du_tableau_de_bord_geoapify
SCENARIO_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
SCENARIO_TIMEOUT_SECONDS=90
CORS_ORIGINS=http://localhost:5173
SCOUTING_DAILY_PROVIDER_BUDGET=2700
OPEN_METEO_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_API_KEY=
```

Ne pas mettre de clé fournisseur dans une variable `VITE_*`. Le backend appelle
Geoapify et Open-Meteo. Les coordonnées ne proviennent jamais d'Ollama.
Supabase n'est pas requis pour ce module. `/shot-spec` garde son client Anthropic
et nécessite toujours `ANTHROPIC_API_KEY` pour ses propres appels réels.
Pour garder l'analyse de scénario sur Anthropic : `SCENARIO_PROVIDER=anthropic`.

Dans un terminal, lancer Ollama si son application ne le fait pas déjà :

```powershell
ollama serve
```

Dans un autre terminal :

```powershell
ollama pull qwen2.5:7b
cd C:\Users\fatma\hackathon-JEI\backend
uv run uvicorn app.main:app --reload
```

Dans un troisième terminal :

```powershell
cd C:\Users\fatma\hackathon-JEI\web
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm run dev
```

Configuration `web/.env` :

```dotenv
VITE_API_URL=http://localhost:8000
VITE_USE_MOCKS=true
```

Les anciennes API du projet/planner restent simulées dans ce dépôt. Le repérage
et l'analyse de scénario contournent explicitement ces mocks et appellent FastAPI.
Conserver ce réglage permet de tester leur intégration avec le planner existant.

## Parcours de démonstration réel

1. Ouvrir `http://localhost:5173`, puis « Continuer en démo » pour accéder au planner
   existant. Cela ne simule pas les nouveaux fournisseurs du repérage.
2. Sur `/planner/scenario`, charger l'exemple ou coller un scénario, puis demander
   une analyse réelle. Avec `SCENARIO_PROVIDER=ollama`, les scènes sont extraites
   par le modèle Ollama configuré. Corriger et valider les scènes.
3. Ouvrir « Repérer les lieux et la météo des scènes » ou `/planner/reperage`.
4. Sélectionner une scène de l'analyse courante ou du projet courant. Les scènes
   d'un exemple simulé sont signalées comme telles dans le sélecteur.
5. Cliquer sur « Interpréter les besoins avec Ollama » pour proposer une catégorie
   de lieu et des mots-clés, puis vérifier/modifier la catégorie. L'interprétation
   reste facultative : une recherche manuelle fonctionne si Ollama est indisponible.
6. Choisir une région précise (ex. `Tunis, Tunisie`), un rayon de 1 à 30 km, une date
   et lancer la recherche. Le centre géocodé est affiché avec les résultats.
7. Cliquer sur un lieu sur la carte Leaflet ou dans sa carte descriptive : la météo
   est récupérée automatiquement à ses coordonnées GPS fournies par Geoapify.
8. Cocher jusqu'à trois lieux, adapter les seuils de tournage et lancer la comparaison.
   Les meilleures heures sont classées par compatibilité ; toutes les autres heures
   évaluables restent sélectionnables dans « Autre créneau ».
9. Choisir un lieu et une heure, relire les raisons, cocher la revue humaine et confirmer.
   Un nouveau choix pour la même scène remplace le précédent.
10. Aller à l'étape Lieux du planner pour appliquer explicitement le repérage : les
    coordonnées sont associées à la scène, les autorisations sont à demander et
    le créneau est conservé dans les notes comme préférence de tournage.

Le calendrier existant n'est pas réécrit automatiquement. La préférence doit être
reportée/vérifiée dans le calendrier. Une scène provenant de l'analyse doit d'abord
être transférée au projet pour y associer son lieu (numéro et en-tête identiques).
Une scène d'un autre projet n'est pas associée automatiquement par son seul titre.

Sans clé Geoapify : erreur explicite de configuration, aucun lieu fictif. Sans
prévision disponible : statut `unavailable`, aucune météo fabriquée. Sans Ollama :
erreur d'interprétation explicite ; les évaluations déterministes restent utilisables,
avec `ai_status=unavailable` si une explication avait été demandée.

## Fournisseurs et limites

- **Geoapify** : géocodage `/v1/geocode/search` puis lieux `/v2/places`, 12 résultats
  maximum. Recherche par catégorie et rayon, pas par similarité visuelle garantie.
  Les mots-clés Ollama expliquent la proposition ; seul le type de décor validé
  filtre la recherche. La zone correspond au rayon autour du centre géocodé, pas
  à toute la frontière administrative de la région. La couverture dépend des données.
  Aucun renseignement sur une réservation ou une autorisation de tournage n'est déduit.
  Les attributions Geoapify et OpenStreetMap sont affichées à côté des résultats.
  Respecter les quotas et conditions du compte :
  [documentation Places](https://apidocs.geoapify.com/docs/places/),
  [tarifs et quotas](https://www.geoapify.com/pricing/),
  [conditions](https://www.geoapify.com/terms-and-conditions/).
- **Open-Meteo** : prévision horaire, fuseau du lieu, lever/coucher et jusqu'à 16 jours.
  L'horizon est vérifié avec le fuseau du lieu puis avec les horodatages réellement
  reçus ; cela ne garantit pas 16 jours de données pour chaque variable. Une date
  passée ou trop éloignée est explicitement indisponible. Les champs manquants
  restent `null`. La grille météo peut représenter une zone autour du point GPS,
  pas un capteur placé sur le décor. La précision décroît avec l'échéance.
  L'API gratuite est destinée à l'usage **non commercial**. Pour un usage commercial,
  configurer l'URL et la clé du plan adapté côté serveur. Attribution CC BY 4.0 :
  [documentation](https://open-meteo.com/en/docs), [conditions](https://open-meteo.com/en/terms).
- **SunCalc** : calcul local des événements astronomiques à partir de la date,
  des coordonnées et du fuseau. Les heures sont affichées dans le fuseau du lieu,
  indépendamment du fuseau du navigateur. Aux pôles, un événement inexistant
  reste indisponible. Aucune heure de lever/coucher de remplacement n'est inventée.
  [Code et documentation](https://github.com/mourner/suncalc).
- **Leaflet / tuiles OpenStreetMap** : carte interactive, marqueurs sélectionnables,
  liste alternative accessible et attributions visibles. Les tuiles publiques sont
  chargées à la demande par le navigateur, sans préchargement de zones ni cache
  hors ligne ajouté. Garder un Referer HTTP valide et un usage modéré. Pour un
  déploiement à fort trafic, choisir un service de tuiles adapté :
  [politique des tuiles](https://operations.osmfoundation.org/policies/tiles/).
- **Ollama** : adaptateur commun aux scénarios et au repérage, sorties JSON validées
  par Pydantic. Il peut proposer une catégorie ou une explication éditoriale, jamais
  changer les scores, les coordonnées ou les mesures reçues des fournisseurs.
  L'explication est affichée comme brouillon indépendant des faits.
  [API Chat et sorties structurées](https://docs.ollama.com/api/chat).

## Règles d'évaluation déterministes

Chaque créneau représente une heure `[début, début + 1 h]`. Les précipitations
Open-Meteo sont un cumul sur l'heure précédente : le service utilise donc le point
suivant pour obtenir le cumul du créneau proposé. Si ce point n'existe pas, le
créneau est indisponible ; une absence n'est jamais interprétée comme zéro pluie.
Vent, température, nuages et jour/nuit sont les échantillons horaires du fournisseur.
La lumière à l'aube/au crépuscule est une fenêtre approximative ±1 h autour de
l'événement solaire Open-Meteo, pas une garantie de lumière constante pendant l'heure.

Base : 100 points. Déductions en extérieur (ou INT/EXT inconnu) :

| Condition | Déduction |
| --- | --- |
| Vent au-dessus du seuil | 30 |
| Précipitations au-dessus du seuil | 35 |
| Couverture nuageuse hors plage | 15 |
| Température hors plage | 20 |
| Moment naturel incompatible | 40 |
| INT/EXT ou moment non renseigné | 15 |

Le score est borné à 0. Verdict : ≥85 compatible, 60–84 à vérifier, <60 défavorable.
Ce n'est ni une probabilité ni un avis de sécurité. Chaque raison indique les
valeurs et les seuils concernés. En intérieur, les contraintes de météo extérieure
ne pénalisent pas le score, mais la lumière naturelle et les inconnues restent
signalées. Pour un décor à éclairage artificiel, adapter le moment demandé.
Créneau passé, mesure manquante ou événement solaire nécessaire inexistant :
score `null`, verdict `unavailable`, sans recommandation.

## API, résilience et confidentialité

| Méthode | Route | Fonction |
| --- | --- | --- |
| GET | `/locations/search?region=…&category=cafe&radius_km=10` | Lieux réels |
| GET | `/locations/{location_id}/weather?date=YYYY-MM-DD` | Météo aux GPS du lieu mémorisé |
| POST | `/locations/interpret-scene` | `{ "text": "…" }` → proposition Ollama |
| POST | `/planning/evaluate-location` | Comparaison de 1 à 3 lieux |

Exemple d'évaluation (les IDs proviennent exclusivement de la recherche) :

```json
{
  "location_ids": ["identifiant_retourne_par_la_recherche"],
  "date": "2026-11-16",
  "requirements": {
    "setting": "EXT",
    "moment": "DAY",
    "max_wind_kmh": 25,
    "max_precipitation_mm": 0.2,
    "min_cloud_pct": 0,
    "max_cloud_pct": 70,
    "min_temperature_c": 5,
    "max_temperature_c": 35
  },
  "scene_text": "Description de scène fournie par le cinéaste",
  "explain_with_ollama": false
}
```

Validation des coordonnées, des catégories, des plages numériques, des dates et
des réponses externes. Erreurs françaises : 422 entrée invalide ; 404 région/lieu
absent ou expiré ; 429 fréquence/quota dépassé ; 502 sortie invalide ; 503 fournisseur
ou configuration indisponible ; 504 délai dépassé.

Limites du MVP **par processus** : 20 requêtes de repérage/minute/adresse cliente,
au moins 350 ms entre appels externes de données, budget journalier configurable
(2700 par défaut, partagé lieux/météo). Aucun nouvel essai automatique qui pourrait
multiplier les crédits. Délais HTTP 15 s (connexion 5 s), Ollama 75 s ; limite globale
45 s recherche/météo, 80 s interprétation et 110 s comparaison. Réessayer explicitement
en cas d'échec. Les identifiants retournés par la recherche sont conservés 24 h
dans un registre mémoire borné ; après redémarrage/expiration, relancer la recherche.

Cache mémoire borné : centres géocodés 24 h, recherches 1 h, météo 10 min.
Les caches et compteurs ne sont pas distribués. **Utiliser un seul worker** pour ce
MVP ; prévoir cache/limiteur partagés et authentification serveur avant un déploiement
public multi-instance. Le budget local ne remplace pas le suivi du quota du compte.

Les journaux HTTP détaillés sont désactivés pour éviter d'y écrire les clés présentes
dans les URL fournisseurs. Ne pas activer les logs HTTP DEBUG en production.
Les services cartographiques reçoivent la région, la catégorie et le rayon ; le
service météo reçoit les coordonnées. Aucun scénario n'est envoyé à ces fournisseurs.
Ollama reçoit la description de scène seulement après une action explicite.

Les choix confirmés sont conservés dans `sessionStorage`, clé `encadre-scouting-v1`.
« Retirer ce choix » les efface individuellement ; la fermeture de l'onglet termine
normalement la session (selon les fonctions de restauration du navigateur).
Cela ne supprime pas un lieu déjà transféré dans un projet. Aucun nouveau schéma
de base de données ni stockage serveur des scénarios/choix n'a été ajouté.

## Fichiers principaux et vérification

- Backend : `schemas/scouting.py`, `services/scouting_service.py`,
  `services/ollama_service.py`, `controllers/scouting_controller.py`, `routes/scouting.py`.
- Frontend : `routes/PlannerScouting.tsx`, `features/planner/scouting/` (API validée,
  carte, météo, calculs solaires, confirmation et transfert).
- Intégration : routeur, accueil planner, analyse de scénario, étape Lieux,
  configuration et fichiers de dépendances. `/shot-spec` reste sur Anthropic.
- Tests : `backend/tests/test_scouting.py`, `backend/tests/test_ollama.py`,
  `web/src/routes/PlannerScouting.test.tsx`, `web/src/features/planner/scouting/scouting.test.ts`.

```powershell
cd C:\Users\fatma\hackathon-JEI\backend
uv run pytest -q
uv run ruff check app tests
cd ../web
npm test
npm run typecheck
npm run lint
npm run build
```

Les tests automatisés simulent Geoapify, Open-Meteo et Ollama : aucune clé ni
requête payante nécessaire. Ils vérifient le protocole HTTP, les caches/quotas,
les erreurs, les règles, les références GPS, les données nulles, le parcours humain,
le transfert au planner et l'absence d'événements solaires inventés.

Prochaines étapes : contrôle visuel sur mobile et desktop, essais de terrain,
intégration du créneau confirmé dans le véritable calendrier serveur et vérification
des accès/disponibilités avec les gestionnaires des lieux.

Vérification de cette livraison : 62 tests backend et 42 tests frontend réussis ;
Ruff, ESLint, TypeScript et build de production réussis. Un appel réel Open-Meteo
sur un point public de Tunis a répondu HTTP 200 avec le fuseau `Africa/Tunis`,
384 points horaires et 16 points journaliers. Le test réel Geoapify nécessite une
clé, absente de cette configuration. L'exécution d'un modèle Ollama réel et le
contrôle visuel dans un navigateur n'ont pas été vérifiés pendant cette livraison.
