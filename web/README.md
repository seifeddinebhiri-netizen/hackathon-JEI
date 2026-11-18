# encadré — front web (`/web`)

> **encadré.** — Tu cadres, on t’encadre.

encadré accompagne les jeunes réalisateurs tunisiens, de l'organisation du tournage jusqu'au festival.
**Planifier** : quand et où tourner chaque scène, selon la lumière, la météo et les lieux.
**Tourner** : le Coach de cadrage sur téléphone (bientôt).
**Déclarer** : le Passeport IA, qui rend visible et vérifiable ce qui est humain et ce qui est IA.
**Diffuser** : le Kit Festival, pour trouver les festivals compatibles et préparer chaque dossier.

Projet du hackathon IA Éthique 360 (JEI INSAT + OIF). Le nom (toujours en minuscules), le slogan et les chemins des
logos sont définis dans un seul fichier : [`src/app/brand.ts`](src/app/brand.ts). Les logos viennent du pack déposé
dans [`public/brand/`](public/brand/) (`svg/` et `png/`).

## Prérequis

- Node.js 20 ou plus récent (testé avec Node 24) et npm 10+

## Démarrer

```bash
cd web
cp .env.example .env    # mocks activés par défaut : aucun backend nécessaire
npm install
npm run dev             # http://localhost:5173
```

Pour la démo, cliquer sur « Continuer en démo » sur la page de connexion : le projet fictif « Dar Hmeti »
(court métrage tourné à Tunis) est prêt. La page **Mes données** permet de le remettre dans son état de départ.

## Scripts

| Script | Rôle |
|---|---|
| `npm run dev` | Serveur de développement (Vite) |
| `npm run build` | Vérifie les types et construit `dist/` |
| `npm run preview` | Sert le build de production en local |
| `npm run typecheck` | Vérification TypeScript (mode strict) |
| `npm run lint` | ESLint (règles React, hooks, interdiction de `fetch` hors de `src/api/client.ts`) |
| `npm run test` | Tests Vitest (planning, règles du soleil, parseur, sous-titres, Passeport, schémas) |
| `npm run format` | Prettier |

La page interne `/_ui` (tous les composants et leurs états) n'existe qu'en développement.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | URL du backend FastAPI |
| `VITE_USE_MOCKS` | `true` | `true` : API simulée dans le navigateur ; `false` : vrai backend |
| `VITE_MOCK_LATENCY_MS` | `600` | Latence simulée des mocks |
| `VITE_MOCK_FAIL_RATE` | `0` | Taux d'échec aléatoire des mocks (0 à 1), pour tester les états d'erreur |
| `VITE_PUBLIC_APP_URL` | `http://localhost:5173` | URL publique de l'app (liens de vérification, QR code du Coach) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | vide | Plus tard : authentification Supabase |

## Identité visuelle

| Usage | Fichier |
|---|---|
| Barre de navigation, pied de page (fonds sombres) | `public/brand/svg/encadre-logo-transparent-pour-fond-sombre.svg` |
| Pages et documents clairs (feuille de service, vérification, page film) | `public/brand/svg/encadre-logo-transparent-pour-fond-clair.svg` |
| Favicon | `public/brand/svg/encadre-favicon.svg` (+ `png/encadre-favicon-64.png`) |
| Application installée (PWA) | `png/encadre-icone-192.png`, `png/encadre-icone.png` (512) ; dérivés « maskable » et Apple dans `public/icons/` |
| Badge du Passeport IA | dessiné en SVG (`src/features/passport/lib/badge.ts`) avec les coins du viseur et le carré rouge du logo |

Pour changer de logo : remplacer les fichiers de `public/brand/` (mêmes noms) ou mettre à jour les chemins dans
`brand.ts`, puis régénérer les deux icônes de `public/icons/` (voir son README).

## Architecture

```
src/
  app/            brand.ts (nom, slogan, logos), router.tsx (routes paresseuses), providers.tsx, layouts/
  routes/         une page par route, fine : elle assemble des features
  features/       auth, project, planner, coach, passport, festival, home, account
                  chacune avec components/ hooks/ lib/
  components/ui/  composants du design system (Button, Field, Tabs, Stepper, PhotoFrame…)
  api/            types.ts (contrat, source de vérité), schemas.ts (zod), client.ts, endpoints.ts,
                  mocks/ (handlers, données, scheduler.ts, météo, parseur), index.ts (bascule)
  lib/            env, format (dates fr), sun (suncalc), photos, print, useMediaQuery
  styles/         index.css : tokens Tailwind, focus, styles d'impression
docs/             API_CONTRACT.md, DESIGN_SYSTEM.md, INTEGRATION.md
```

Règles :
- les composants n'appellent jamais `fetch` : ils passent par un hook de `features/*/hooks`, qui appelle `src/api` ;
- chaque réponse de l'API est validée par zod (même en mode mock) : jamais d'écran blanc si le backend dévie ;
- chaque écran qui charge des données a 4 états : chargement, erreur (« Réessayer »), vide, succès ;
- les règles de planning sont des fonctions pures (`features/planner/lib/rules.ts`, `schedule.ts`), testées.

Stack : Vite, React 18, TypeScript strict, Tailwind CSS 4, React Router 7, TanStack Query, Radix UI,
react-hook-form + zod, @dnd-kit, date-fns, suncalc, qrcode.react, vite-plugin-pwa, Vitest.

## Passer des mocks au vrai backend

1. Dans `.env` : `VITE_USE_MOCKS=false` et `VITE_API_URL=<url du backend FastAPI>`.
2. Relancer `npm run dev` (les variables Vite sont lues au démarrage).

`src/api/index.ts` choisit alors `endpoints.ts` au lieu de `mocks/handlers.ts`. Les deux respectent le même type
`Api` : aucun écran ne change. Le contrat complet est dans [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md),
la checklist côté backend dans [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

## Éthique dans le front

Ce que l'interface garantit, et où le voir :

- **L'IA propose, l'humain décide.** Toute proposition de l'IA est marquée « Brouillon IA : à valider » et reste
  modifiable : découpage du scénario (étape Scénario), planning (calendrier), sous-titres, classement des festivals.
- **Confidentialité du scénario.** Avant l'envoi, un message dit : « Ton scénario est envoyé pour être découpé en
  scènes. Il n'est pas conservé après le découpage et ne sert pas à entraîner une IA. » (à confirmer côté backend).
- **Météo honnête.** Au-delà de 14 jours, la prévision n'est pas inventée : « Météo à revérifier », valeurs `null`.
- **Pas de jugement dans le Passeport IA.** Le statut d'un outil (Documenté / Partiel / Non divulgué) décrit ce que
  publie son fournisseur, pas le réalisateur ; « Non divulgué » est un statut valide. L'interface ne dit jamais
  « légal » ni « sûr » ; chaque étiquette porte la mention « Ce n'est pas un avis juridique ».
- **Le synopsis n'est jamais réécrit.** Le coach pose des questions, il ne propose pas de texte.
- **Pas de promesse.** « Le classement indique la compatibilité avec les critères du festival. Il ne prédit pas
  la sélection. » Fiches sans source ni date de vérification masquées. Pas de soumission ni de paiement dans l'app.
- **Signature C2PA simulée annoncée comme telle** dans cette version.
- **Mascotte, pas IA.** Baba Jamil (mascotte de marque) n'est pas l'IA : il ne cache jamais une étiquette
  « Brouillon IA », ne se présente pas comme une vraie personne et ne porte pas seul une information utile.
- **Contrôle des données.** `/mes-donnees` : ce qui est stocké, ce qui ne l'est pas, export JSON, suppression.
- **Accessibilité.** Contraste AA, focus or visible, navigation au clavier (y compris pour déplacer une scène),
  cibles de 44 px, statuts en icône + libellé (jamais la couleur seule), `lang="fr"`. Audit axe-core : 0 violation
  sur les 20 écrans (détail dans `docs/REVUE.md`).
- **Données d'exemple.** Festivals et outils IA sont des `[placeholders]` ; sources en `.invalid`, dates factices.
- **Photos** : Unsplash, licence gratuite, créditées sur chaque image et sur `/credits`.

## Documentation

- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) — chaque endpoint, exemples, algorithme de planning
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) — tokens, typographie, composants, contraste, impression
- [`docs/INTEGRATION.md`](docs/INTEGRATION.md) — brancher FastAPI et Supabase, checklist de tests
- [`docs/REVUE.md`](docs/REVUE.md) — revue de design et audit d'accessibilité
- [`docs/captures/`](docs/captures/) — captures de chaque écran en 1440 et 390 px
