# Design system « Noir pellicule »

Les tokens sont définis **une seule fois**, dans [`src/styles/index.css`](../src/styles/index.css) (bloc `@theme` de
Tailwind CSS 4), et utilisés par les classes Tailwind (`bg-ink`, `text-muted-on-light`, `shadow-hard`…).
Ne jamais écrire une couleur en dur dans un composant. Tous les composants sont visibles avec leurs états sur la page
interne `/_ui` (développement uniquement).

L'identité (nom, slogan, lettre du logo, couleurs du logo) est dans [`src/app/brand.ts`](../src/app/brand.ts).

## Principes

- Cinéma, pas « startup IA » : noir profond, aplats or et rouge, perforations de pellicule, captures légèrement inclinées.
- **Angles droits** (rayon 0) partout, sauf éléments vraiment ronds (soleil du schéma).
- **Pas d'ombre floue** : ombres décalées franches pour ce qui est mis en avant.
- Pas de violet, pas de dégradés « IA », pas de glassmorphism, pas d'emoji.
- **Un statut = une icône + un libellé**, jamais la couleur seule (conflits, raisons, vigilance, confiance).

## Couleurs

| Token | Valeur | Usage |
|---|---|---|
| `ink` | `#121110` | Fond sombre, texte principal sur clair |
| `paper` | `#F2F2EF` | Fond clair de l'application |
| `white` | `#FFFFFF` | Cartes, champs |
| `surface-dark` | `#1F1D1B` | Surfaces sur fond sombre, cadre photo vide |
| `line-dark` / `line-light` | `#3A3733` / `#D9D7D1` | Filets sur sombre / sur clair |
| `muted-on-dark` / `muted-on-light` | `#B8B4AC` / `#55524C` | Texte secondaire |
| `brand-red` | `#E4202E` | Logo, grands aplats, mot en couleur dans les titres |
| `action` / `action-hover` | `#C8102E` / `#A50D26` | Fond des boutons principaux (texte blanc) |
| `gold` / `gold-soft` | `#FFC82E` / `#FFE7A3` | Lumière, accents, focus, « Brouillon IA » |
| `ok-bg` / `ok-fg` | `#DDEFE3` / `#14532D` | Documenté, OK, validé |
| `warn-bg` / `warn-fg` | `#FFF0C2` / `#5C4400` | Partiel, attention, à préparer |
| `bad-bg` / `bad-fg` | `#FBD9DC` / `#7F1020` | Non divulgué, conflit, erreur |
| `ext` / `int` | `#FFE7A3` / `#E2E0D9` | Blocs du calendrier, toujours avec « EXT » / « INT » écrit |

### Contraste (WCAG AA)

| Paire | Ratio | Usage autorisé |
|---|---|---|
| blanc sur `action` | 5,9:1 | Boutons principaux |
| blanc sur `brand-red` | 4,6:1 | Appel final : titres et texte de 18 px ou plus |
| `ink` sur `paper` / `gold` | > 15:1 / > 12:1 | Texte courant |
| `muted-on-light` sur `paper` | ≈ 7:1 | Texte secondaire |
| `muted-on-dark` sur `ink` | ≈ 9:1 | Texte secondaire sur sombre |
| `ok-fg`, `warn-fg`, `bad-fg` sur leur fond | > 7:1 | Pastilles de statut |

Règles : les boutons principaux sont sur `action` (`#C8102E`), jamais sur `brand-red`. Sur un aplat or, le contour de
focus passe en encre (classe `on-gold`).

## Typographie (Google Fonts)

| Rôle | Police | Graisse | Token |
|---|---|---|---|
| Titres | Space Grotesk, serrée (`-0.02em`) | 500 / 700 | `font-display` |
| Texte | Inter | 400 / 500 / 600 | `font-sans` |
| Étiquettes en capitales | JetBrains Mono | 500 | `font-mono`, classe `.eyebrow` |

| Token | Taille | Usage |
|---|---|---|
| `text-hero` | 112 px | Titre de l'accueil (54 px sur mobile) |
| `text-page` | 56 px | Titre de page (40 px sur mobile) |
| `text-h2` / `text-h3` | 32 / 22 px | Sections / cartes |
| `text-lead` | 18 px | Introductions |
| `text-body` | 16 px | Texte courant |
| `text-meta` | 13 px | Texte secondaire — **minimum pour du texte** |
| `text-label` | 12 px | Étiquettes en capitales — **minimum absolu** |

## Espacement et grille

Base 8 px. Marges de page : 16 px sur mobile, 48 px dès 768 px, 64 px dès 1280 px (classe `.container-pp`,
largeur max 1440 px). Grille de 12 colonnes (`lg:grid-cols-12`). Grilles toujours avec `grid-cols-1` explicite
sur mobile (évite le défilement horizontal).

## Formes, ombres, focus

- `shadow-hard` (`6px 6px 0 ink`), `shadow-hard-sm` (3 px), `shadow-hard-gold`, `shadow-hard-red`.
- Bordures de 2 px (`border-2 border-ink`) ; pointillés pour ce qui reste à valider.
- Focus : contour **or de 3 px, décalé de 2 px**, sur tous les éléments (`:focus-visible`).
- Cibles tactiles d'au moins **44 px** (`min-h-11`), y compris les petits boutons.

## Composants (`src/components/ui`)

| Composant | Quand l'utiliser | États / variantes |
|---|---|---|
| `Button`, `ButtonLink` | Toute action ; un seul `primary` par zone | `primary`, `secondary`, `ghost`, `on-dark` ; `sm` / `md` / `lg` ; survol, focus, désactivé, chargement |
| `StatusChip` | Statut court, toujours icône + libellé | `ok`, `warn`, `bad`, `neutral`, `gold`, `dark`, `red` |
| `AiDraftBadge` | Toute proposition de l'IA | « Brouillon IA : à valider » / « Validé par toi » |
| `Stepper` | Assistant du Planner | en cours, terminé, à venir ; cliquable |
| `SegmentedControl` | Choix exclusif court (INT/EXT, moment, Oui/Non, statut) | vrais boutons radio, flèches au clavier |
| `Field` + `Input`, `TextArea`, `Select` | Formulaires (react-hook-form + zod) | aide, erreur (icône + texte), facultatif, requis, désactivé |
| `CharCount` | Synopsis, limites de festival | sous / au-dessus de la limite |
| `Checkbox` | Listes à cocher (dossier, scène relue) | coché, désactivé, aide |
| `FileDrop` | Import du scénario | vide, fichier choisi, erreur de format ou de taille ; utilisable au clavier |
| `ScoreSquares` | Score 1-5 d'un festival | toujours avec le libellé texte |
| `Countdown` | Dates limites | normal, ≤ 14 jours (urgent), passée |
| `Tabs` | Kit Festival (`?onglet=`) | Radix Tabs |
| `Card`, `PageHeader`, `Eyebrow` | Structure | `light`, `paper`, `dark`, `gold`, `raised` |
| `EmptyState`, `ErrorState`, `Skeleton` / `LoadingBlock`, `QueryState` | Les 4 états de chaque écran | vide + action ; erreur + « Réessayer » ; chargement annoncé |
| `Dialog`, `Tooltip`, `Toaster` / `useToast` | Confirmation, aide, retour d'action | toast avec action (« Annuler » pendant 8 s) |
| `Perforations` | Motif décoratif | sombre, clair, or |
| `PhotoFrame` | Toute photo | 16:10, 2,39:1, 4:5, 3:2 ; crédit sur la photo ; cadre « [photo] » sans image |
| `Icon` | Icônes maison (trait 2 px, angles droits) | décoratives (`aria-hidden`) ou avec `label` |

Composants métier notables : `AiLabel` (Étiquette IA, format étiquette nutritionnelle), `SunDiagram` (course du soleil
en SVG), `CaptureFrame` (style unique des captures de l'accueil).

## Photos

`PhotoFrame` lit le registre [`src/lib/photos.ts`](../src/lib/photos.ts) : `<picture>` WebP + JPEG de secours, en 1000
et 2000 px, point de cadrage, crédit « Photo : Nom / Unsplash » en haut à droite de l'image, page `/credits`.
Traitement de couleur en CSS uniquement (`.photo-grade` : contraste +8 %, saturation −18 %). Toute nouvelle photo :
une entrée dans le registre et une ligne dans `public/photos/CREDITS.md`.

## Impression

Feuille de service, page de vérification et aperçu PDF du Passeport : feuille A4 (marges 14 mm), noir sur blanc,
sans navigation ni ombres. Classes utilitaires : `no-print` (masqué), `print-only` (visible seulement à l'impression),
`print-avoid` (pas de coupure), `print-break` (nouvelle page). Composant `PrintLayout` pour les pages imprimables.

## Mouvement

Transitions courtes (100 ms) sur les boutons ; `prefers-reduced-motion` désactive animations et transitions.
