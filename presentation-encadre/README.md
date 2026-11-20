# Encadré — Prise 02 : Derrière la caméra

Présentation interactive de l'avancement (pitch de **6 minutes**), suite directe du premier pitch.
Un court-métrage en 7 séquences, guidé par **Baba Jamil**, en 16:9. Partie principale : les **quatre modules**,
chacun montré deux fois, la façade (ce que voit le cinéaste) puis l'envers du décor (le back-end).

> Projet isolé : il ne modifie rien dans `web/` ni `backend/`. Il lit seulement leurs ressources
> (mascotte, logos) et fait des captures de l'application en mode démonstration.

---

## 1. Lancer la présentation

```powershell
# Sous Windows : toujours depuis un chemin en C:\ majuscule (sinon Vite charge des modules en double)
Set-Location 'C:\Users\…\hackathon-JEI\presentation-encadre'
npm install          # une seule fois (connexion nécessaire)
npm run build        # crée dist/ : polices, GSAP, images, tout est local
npm run preview      # http://localhost:4174, sans réseau
```

`npm run dev` (http://localhost:4173) pour modifier la présentation. `dist/` peut aussi être copié sur une clé USB
et servi par n'importe quel serveur statique (les chemins sont relatifs).

### Projeter devant le jury

1. Ordinateur relié au projecteur, écran **dupliqué** ou **étendu**.
2. Ouvrir la présentation dans Chrome ou Edge, touche **F** (plein écran).
3. Touche **W** : la **fenêtre présentateur** s'ouvre (notes, étape suivante, chronomètre). La placer sur
   l'écran de l'ordinateur ; elle pilote la fenêtre projetée (même navigateur).
4. **Démo en direct** (séquence 04, option A) : avant de commencer, `cd web && npm run dev` (mode démo par
   défaut, aucune clé nécessaire). « Plein écran » l'agrandit ; **Échap** revient à la présentation.
   Autre adresse : ajouter `?app=https://adresse/projet` à l'URL de la présentation (mémorisé).
5. Plan B : option B (vidéo `public/video/demo.mp4`) ou C (captures, toujours disponible).
6. Touche **M** : animations réduites (simple fondu entre les étapes).

### Clavier

| Touche | Action |
|---|---|
| → · Espace · Page suivante | étape suivante (puis séquence suivante, avec sa transition) |
| ← · Page précédente | étape précédente |
| 0 à 6 | aller à la séquence |
| Début / Fin | première / dernière séquence |
| P | plan de tournage (toutes les séquences) |
| N | notes orales (panneau) · W : fenêtre présentateur |
| F | plein écran · M : animations réduites · A : lecture automatique |
| Échap | fermer le plan, les notes, la démo |

Rien n'avance tout seul (sauf mode A). L'adresse garde la position (`#scène.étape`).

---

## 2. Commandes

| Commande | Rôle |
|---|---|
| `npm run build` · `npm run preview` | build de production et lecture hors connexion |
| `npm run typecheck` · `npm run lint` | contrôles |
| `npm test` | parcours complet au clavier avec les vraies transitions : fin atteinte, retour, façade puis envers du décor sur les 4 modules, démo, plan, mode réduit, aucune trace des séquences supprimées à l’écran, aucune erreur JavaScript (après `build`) |
| `npm run export:pdf` | PDF statique de secours, une page par étape → `export/encadre-prise-02.pdf` |
| `npm run export:video` | vidéo WebM 1920 × 1080 de la présentation qui se déroule seule → `export/video/` |
| `npm run assets:mascotte` · `assets:pdf` · `assets:captures` · `assets:maquettes` | régénérer les ressources |

---

## 3. Déroulé (6 min)

| # | Séquence | Étapes | Entrée | Durée |
|---|---|---|---|---|
| 00 | Précédemment dans Encadré | souvenirs du pitch 1 → « Aujourd'hui, elle prend forme » | coupe | 12 s |
| 00 | Prise 02 — Derrière la caméra | titre → phrase de transition | **clap** | 12 s |
| — | Problématique : cinq entretiens | 5 témoignages réels (Eya Hachicha, Eya Guirat, Nour, Mariem, Tarek) ; chaque photo s’envole vers l’étape dont elle parle → « À chaque étape, ils avancent seuls. » | bandes obliques | 45 s |
| — | Problématique : pourquoi maintenant | filmer → Planifier, Tourner ; règles (Oscars 2027, AI Act art. 50) → Déclarer ; 700 films inscrits aux JCC 2025, 42 en compétition → Diffuser | pellicule | 30 s |
| 01 | Le projet prend forme | « notre réponse » : 4 panneaux s'allument → Baba Jamil prend le scénario | **clap** | 20 s |
| 02 | Du storyboard à l'interface | structure → maquette → écran développé ; Baba Jamil : « Allons voir les quatre modules. » | **page de scénario** | 30 s |
| 03 | Les quatre modules | intro « Quatre modules » puis, pour Planifier, Tourner, Déclarer, Diffuser : **façade** → **l'envers du décor** (9 étapes) | **pellicule** (Baba Jamil marche jusqu'à la bande des 4 modules) | 170 s |
| 04 | Place à la démonstration | A direct · B vidéo · C captures | bandes obliques | 45 s |
| 05 | L'éthique au cœur du projet | créativité · transparence · contrôle humain · limites | pellicule (le projecteur s'éteint) | 30 s |
| 06 | À suivre… | fin de la prise → logo, équipe, GitHub | **iris** | 20 s |

Total : **360 s**. Notes complètes : [NOTES_ORALES.md](NOTES_ORALES.md).

### Transition façade → envers du décor : « le négatif »

La même pour les 4 modules : les captures de la façade passent en **négatif de pellicule** (couleurs inversées,
léger grain) et s'effacent, puis les lignes du diagramme se dessinent et les blocs apparaissent un par un.
Environ 1,3 s, sans rotation ni clignotement. Animations réduites : simple fondu.

---

## 4. Back-end par module (`src/data/backend.ts`)

Extrait du dépôt `seifeddinebhiri-netizen/hackathon-JEI` le 20 nov. 2026 : `origin/main` (dont la fusion
« ai-passport » : PDF et signature C2PA du Passeport) et `feature/scenario-ai` (planner, convocations, pas
encore fusionné). Chaque bloc cite le fichier ou la route qui le prouve (affiché au survol du bloc).
Statuts : **Intégré** (route branchée et testée), **Partiel** (branché mais simulé, non validé avec une vraie
clé, en revue, ou certificat de test), **Prévu** (pas encore codé).

| Module | Flux |
|---|---|
| Planifier | Import (React) → `POST /planner/parse` → IA (Gemini, Anthropic, Groq, Ollama) → décision du cinéaste → Supabase `projects` ; branche lieux (Nominatim) et météo (Open-Meteo, SunCalc) ; calendrier et convocations **partiel** |
| Tourner | Scène (React) → `POST /shot-spec` → Gemini + 71 règles (**partiel**) → calibration → mesure sur le téléphone (MediaPipe, capteurs, Canvas, MediaRecorder) ; espaces dans Supabase `workspaces` ; corps entier **prévu** |
| Déclarer | Déclaration (React) → Supabase `ai_passports` → PDF ReportLab signé `c2pa-python` (**partiel** : certificat de test) → `POST /verify/pdf` ; outil inconnu → `POST /ai-tools/resolve` → recherche Gemini dans la documentation publique → catalogue `ai_tools` |
| Diffuser | Kit Festival (React) → `GET /festivals` (festivals.json, 20 fiches) ; `POST /subtitles/{id}/draft` → ElevenLabs Scribe → traduction Gemini ou Ollama + glossaire derja → validation ligne par ligne → Supabase |

---

## 5. Design system et code

Mêmes tokens que l'application (`web/src/styles/index.css`, « Noir pellicule ») et que le premier pitch :
noir `#121110`, or `#FFC82E`, rouge `#E4202E`, blanc cassé `#F2F2EF` ; Space Grotesk (titres), Inter (texte),
JetBrains Mono (surtitres). Angles droits, ombres décalées franches, perforations, badges RÉALISÉ / EN COURS /
PROCHAINEMENT (icône + libellé). La mascotte est toujours l'un des 7 SVG originaux de `web/public/mascotte`.

```
src/
  App.tsx                    orchestration : étapes, clavier, transitions, présentateur, URL
  data/deck.ts               séquences : étapes, transition d'entrée, marques de Baba Jamil, notes, durées
  data/backend.ts            diagrammes back-end des 4 modules, avec preuves et statuts
  components/BackendDiagram  rendu d'un diagramme (blocs, liens, pastilles de statut)
  hooks/useBeatTimeline.ts   une timeline GSAP par scène, labels b0, b1… = étapes
  transitions/               clap, pellicule, page de scénario, bandes obliques, iris
  scenes/                    une scène par séquence
scripts/                     extraction PDF, captures, exports PDF/vidéo, test de bout en bout
```

---

## 6. Limites et ressources manquantes

- **Vidéo `Dar_Hmeti_Demo.mp4` introuvable** : la déposer dans `public/video/demo.mp4` puis `npm run build`.
- Les captures viennent de la branche `feature/scenario-ai` : les écrans du Passeport ajoutés par la fusion
  « ai-passport » de main (PDF signé, vérification de PDF) n'y figurent pas encore ; le diagramme Déclarer, lui,
  les décrit. Refaire les captures après la fusion : `npm run assets:captures`.
- Les tests de `origin/main` (ai-passport) n'ont pas été relancés ici ; ceux de `feature/scenario-ai` passent.
- La fenêtre présentateur se synchronise par `BroadcastChannel` : même navigateur, même ordinateur.
