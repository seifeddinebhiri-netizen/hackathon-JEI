# Encadré — analyse de scénario

> **Mise à jour :** la page séparée décrite ici a été retirée. Ce module est désormais intégré à l’assistant de planification : voir [PLANIFICATION_IA.md](PLANIFICATION_IA.md).

L'analyse peut désormais utiliser Ollama avec `SCENARIO_PROVIDER=ollama`.
Voir [le guide repérage et Ollama](LOCATION_WEATHER_SCOUTING.md) pour la configuration.

> L'IA propose, le cinéaste décide.

## Lancement local

Dans PowerShell, depuis la racine du dépôt :

```powershell
cd backend
Copy-Item .env.example .env
# Renseigner ANTHROPIC_API_KEY dans .env, uniquement côté serveur.
uv sync --group dev
uv run uvicorn app.main:app --reload
```

Dans un second terminal :

```powershell
cd web
Copy-Item .env.example .env
npm ci
npm run dev
```

Variables backend : `ANTHROPIC_API_KEY`, `LLM_MODEL` (modèle compatible avec les
sorties structurées Anthropic), `SCENARIO_TIMEOUT_SECONDS` (90 par défaut),
`CORS_ORIGINS` (`http://localhost:5173` par défaut). Les identifiants Supabase
ne sont pas nécessaires pour analyser. L'analyse réutilise le client Anthropic
de `LLMService`, avec une seule nouvelle tentative SDK et un délai global.
Le chemin `/shot-spec` reste inchangé.

Variable frontend : `VITE_API_URL=http://localhost:8000`.
Garder `VITE_USE_MOCKS=true` pour démontrer les fonctions historiques du planner :
leurs API serveur ne sont pas implémentées dans ce dépôt. L'analyse de scénario
appelle toujours FastAPI, indépendamment de ce réglage. Aucune clé IA ne doit
être placée dans une variable `VITE_*`.

## Parcours

1. Ouvrir l'application, cliquer sur « Continuer en démo » pour accéder au planner.
2. Ouvrir `/planner/scenario` via « Analyser mon scénario · Encadré ».
3. Entrer un titre et un scénario de 30 à 100 000 caractères, ou importer un TXT
   UTF-8 de 400 Ko maximum. L'import ne déclenche aucun appel IA.
4. Cliquer sur « Analyser mon scénario » pour tester l'intégration réelle.
5. Corriger les scènes et les descriptions/observations des personnages.
   Les personnages et leurs apparitions suivent les listes modifiables des scènes.
6. Confirmer l'analyse. Toute correction ultérieure annule cette confirmation.
7. Continuer vers la planification, renseigner les durées de tournage, puis
   ajouter explicitement les scènes au projet. Les scènes existantes sont conservées.
   Les lieux narratifs n'ont pas de coordonnées inventées : compléter adresses
   et autorisations à l'étape Lieux. Le crépuscule devient « heure dorée » dans
   le vocabulaire limité du planner, à revoir par le cinéaste.

Le bouton « Mode démo · données simulées » charge uniquement l'exemple fixe
« Le premier jour » et son analyse prédéfinie dans `scenario/demo.ts`.
Il remplace le brouillon courant par cet exemple et affiche une bannière explicite.
Aucun appel réseau ni clé n'est nécessaire. Le bouton « Charger l’exemple »
charge seulement le texte, que l'utilisateur peut ensuite analyser réellement.
Une erreur du fournisseur ne déclenche jamais le mode démo.

## Contrat API et erreurs

`POST /scenarios/analyze`, JSON `{ "title": "…", "content": "…" }`.
Réponse : titre, statut de brouillon, `simulated: false`, scènes ordonnées et
personnages avec références aux scènes. Voir `backend/app/schemas/scenario.py`
et les schémas Zod dans `web/src/features/planner/scenario/api.ts`.
Les champs de faits, interprétations et suggestions restent séparés.
La validation rejette les numéros désordonnés, références incohérentes et
doublons de casse/espacement des personnages. Le rapprochement des variantes
orthographiques mineures relève de l'IA puis de la revue humaine.

Erreurs : 422 entrée invalide ; 503 clé absente/fournisseur indisponible ;
504 délai dépassé ; 502 sortie invalide, refus ou réponse tronquée.
Le client affiche les messages français du format commun
`{ "error": { "code": "…", "message": "…" } }`.

## Confidentialité

Le texte original est conservé séparément de l'analyse modifiable, dans
`sessionStorage`, clé `encadre-scenario-v1`. Le transfert validé utilise
`encadre-scenario-handoff-v1`. La session survit aux rafraîchissements ; elle
expire à la fermeture de l'onglet, selon les fonctions de restauration du navigateur.
« Effacer ma session » vide ces deux brouillons. Cela ne supprime pas les scènes
déjà transférées dans un projet ; utiliser les contrôles du projet pour celles-ci.
Si le stockage est indisponible, le travail reste en mémoire et un avertissement
indique que la persistance n'est pas garantie.

Le backend ne stocke ni scénario ni analyse. Le contenu n'est pas journalisé,
les exceptions du fournisseur sont remplacées par des erreurs sûres. Ne pas
activer la journalisation HTTP détaillée du SDK en production. Le texte est
transmis à Anthropic sur demande explicite ; aucune promesse sur la rétention
ou l'entraînement du fournisseur n'est faite par ce module.

## Vérification

```powershell
cd backend
uv run pytest -q
uv run ruff check app tests
cd ../web
npm test
npm run typecheck
npm run lint
npm run build
```

Les tests utilisent des fournisseurs simulés, jamais un appel Anthropic payant.
La validation de schéma ne prouve pas la fidélité sémantique : toute analyse
reste un brouillon soumis à la revue du cinéaste. Les scénarios longs peuvent
dépasser la limite de sortie du modèle ; le découpage en lots est une évolution
future. L'API reprend les conventions d'accès existantes du dépôt : prévoir
authentification serveur, quotas et limites de débit avant exposition publique.
Les prochains travaux sont l'implémentation des API historiques du planner,
la revue de la fidélité des extractions réelles et la recherche de lieux vérifiés.

## Fichiers livrés

Créations :

- `backend/app/schemas/scenario.py`
- `backend/app/services/scenario_analysis_service.py`
- `backend/app/controllers/scenario_controller.py`
- `backend/app/routes/scenario.py`
- `backend/tests/test_scenario.py`
- `web/src/routes/ScenarioAnalysis.tsx` et `ScenarioAnalysis.test.tsx`
- `web/src/features/planner/scenario/api.ts` et `api.test.ts`
- `web/src/features/planner/scenario/demo.ts`
- `web/src/features/planner/scenario/storage.ts`
- `web/src/features/planner/scenario/PlannerHandoff.tsx` et `PlannerHandoff.test.tsx`
- `docs/SCENARIO_ANALYSIS.md`

Intégration et mises à jour :

- `backend/app/services/llm_service.py` : méthode d'analyse sur le client partagé.
- `backend/app/routes/__init__.py` : enregistrement du routeur.
- `backend/app/core/config.py`, `backend/.env.example` : délai configurable.
- `backend/app/main.py` : titre Encadré dans la documentation API.
- `web/src/api/client.ts` : erreurs du backend et confidentialité des validations.
- `web/src/app/router.tsx`, `web/src/routes/PlannerHome.tsx` : accès à l'analyse.
- `web/src/features/planner/components/wizard/StepScreenplay.tsx` : transfert explicite.
- `web/src/app/brand.ts` : nom officiel et slogan.
- `web/src/routes/MyData.tsx` : conservation et transmission des scénarios.
- `README.md`, `web/README.md` : identité et documentation.
