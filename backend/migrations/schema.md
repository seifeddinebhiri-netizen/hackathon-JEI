# Schéma de la base de données

Les comptes sont gérés par **Supabase Auth** (`auth.users`). Nous ajoutons nos tables et un bucket.
Les migrations sont à exécuter dans l'ordre dans *Supabase > SQL Editor* : `0001` à `0004`, puis les deux fichiers
de `backend/supabase/migrations/` (`festivals`, `subtitle_drafts`), puis `0005` (Kit Festival), puis `0006`
(durcissement des comptes).

## Tables

### `public.profiles` (une ligne par compte)
| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid, PK, réf. `auth.users` | même identifiant que le compte (`sub` du jeton) |
| `display_name` | text | nom affiché |
| `is_demo` | boolean | compte de démonstration |
| `current_project_id` | uuid, réf. `projects` | projet ouvert par défaut |
| `locale` | text (`fr`) | langue |
| `terms_accepted_at` | timestamptz | consentement explicite |
| `created_at`, `updated_at` | timestamptz | `updated_at` est mis à jour par déclencheur |

Créé automatiquement à l'inscription (déclencheur sur `auth.users`). Supprimer le compte supprime le profil, puis ses projets (`on delete cascade`).

Depuis le navigateur (0006), seules `display_name`, `locale`, `terms_accepted_at` et `current_project_id` sont
modifiables, et `current_project_id` doit être un projet du même compte. `is_demo` est réservé au backend et aux scripts.

### `public.projects`
| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid, PK | |
| `owner_id` | uuid, réf. `profiles` | propriétaire |
| `title` | text | |
| `format` | text, `court` ou `long` | |
| `city` | text | |
| `data` | **jsonb** | tout le reste, voir ci-dessous |
| `version` | integer | +1 à chaque modification (verrou optimiste, pas encore appliqué) |
| `created_at`, `updated_at` | timestamptz | |

### `public.workspaces` (migration 0004 : espaces de travail du Coach, une scène par espace)
| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid, PK | **créé par l'appareil** : un espace peut naître hors ligne |
| `owner_id` | uuid, réf. `profiles` | propriétaire (supprimé avec le compte) |
| `name` | text, 1 à 40 caractères | nom de l'espace |
| `data` | jsonb | `{ request, spec, overrides, notes }` : la scène saisie, le plan de l'IA, les mots modifiés, les étiquettes de mouvement |
| `version` | integer | +1 à chaque enregistrement ; une écriture fondée sur une version dépassée est refusée (409) |
| `created_at`, `updated_at` | timestamptz | |

12 espaces au maximum par utilisateur, 256 Ko au maximum par espace. Seuls les espaces qui ont un plan sont enregistrés.

### Kit Festival (migration 0005)

Le front lit et écrit ces tables **directement** avec la clé publique (`supabase-js`) : la RLS limite chaque compte à
ses lignes, et seulement sur ses propres projets. `owner_id` vaut `auth.uid()` par défaut pour le front ; le backend
et le script de démonstration (`scripts/seed_kit_demo.py`) le remplissent toujours explicitement.

**Une pièce préparée une fois sert à tous les dossiers qui la demandent** : les pièces cochées à la main sont
enregistrées une seule fois par projet (`kit_pieces`), jamais copiées dans chaque dossier. Les autres pièces
(synopsis, sous-titres, déclaration IA, photos, page film) sont calculées par le front à partir des tables ci-dessous.

#### `public.festival_dossiers` (un festival suivi pour un projet)
| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid, PK | |
| `owner_id` | uuid, réf. `profiles` | propriétaire |
| `project_id` | uuid, réf. `projects` | unique avec `festival_id` |
| `festival_id` | text, réf. `festivals` | `on delete restrict` |
| `status` | enum `dossier_status` | « Où j'en suis », voir ci-dessous |
| `ai_choice` | enum `ai_choice` (`aucune`, `outil_technique`, `generation`, `les_deux`), null | réponse validée à la question IA de ce festival (null : pas encore validée) |
| `position` | integer | ordre d'affichage |
| `created_at`, `updated_at` | timestamptz | |

Enum `dossier_status` ↔ libellé affiché (`SHORTLIST_STATUS_LABELS`, `web/src/features/festival/lib/labels.ts`) :

| Valeur | Libellé |
|---|---|
| `a_preparer` | En préparation |
| `pret` | Prêt à soumettre |
| `soumis` | Soumis sur le site officiel |
| `reponse_recue` | Réponse reçue |
| `prochain_appel` | Pour le prochain appel |

#### `public.kit_pieces` (pièces cochées à la main, une ligne par projet et par clé)
| Colonne | Type | Rôle |
|---|---|---|
| `project_id` + `piece_key` | PK | clé de pièce : `affiche`, `bio`, `droits_musique`, `format:<festival_id>` (`pieceKeyOf` côté front) |
| `owner_id` | uuid, réf. `profiles` | propriétaire |
| `state` | enum `piece_state` : `a_faire` (À faire) ou `pret` (Prêt) | « Bloquant » n'est jamais stocké : il est calculé |
| `updated_at` | timestamptz | |

#### `public.film_kits` (profil du film, synopsis, page film : une ligne par projet)
`project_id` (PK, réf. `projects`), `owner_id`, `duration_min`, `language`, `genre`, `synopsis_phrase`,
`synopsis_court`, `synopsis_long`, `synopsis_en` (jsonb : version anglaise relue, par version),
`stills` (text[], 12 au plus), `trailer_url`, `updated_at`.

#### `public.ai_passports` (Passeport IA : une ligne par projet)
`project_id` (PK, réf. `projects`), `owner_id`, `film_title`, `director`, `declarations` (jsonb, liste),
`c2pa_signed`, `badge_code` (unique, ex. `EN-DRHM-T1`, créé par le front), `created_at`, `updated_at`.

Page publique `/verifier/<code>` : fonction `public.verify_badge(code text)` (`security definer`, exécutable par
`anon`) qui renvoie **seulement** `film_title`, `director`, `declarations`, `c2pa_signed`.

Page publique `/film/<id du projet>` (migration 0008) : fonction `public.public_film(film_id uuid)` (`security definer`,
exécutable par `anon`) qui renvoie seulement titre, réalisation, synopsis, photos, générique (nom + rôle, sans contact),
bande-annonce et code du Passeport, et seulement pour un projet qui a une ligne dans `film_kits`.

#### `public.subtitle_drafts` (brouillon de sous-titres, un par projet)
Écrit **uniquement par le backend** (transcription). La 0005 ajoute `owner_id` (rempli par le backend) et une
policy de lecture pour le propriétaire. Les anciennes lignes sans propriétaire ne sont plus visibles par personne.

### Bucket `scripts` (Supabase Storage, privé)
Scénario conservé **uniquement si l'utilisateur coche « Garder mon scénario »** (désactivé par défaut). Chemin : `<user_id>/<project_id>/<fichier>`. Les fichiers ne sont pas supprimés automatiquement avec le projet : le backend doit le faire.

## La colonne `data` (jsonb)

Deux parties dans le même objet.

### 1. Clés lues et écrites par le front (contrat `web/src/api/types.ts`)
Le backend les renvoie telles quelles. Une clé facultative absente est **omise** (jamais `null`).

| Clé | Contenu |
|---|---|
| `shooting_window` | `{ "from": "2026-11-19", "to": "2026-12-08" }` |
| `max_hours_per_day` | nombre |
| `scenes` | liste de scènes : `id`, `number`, `title`, `setting` (INT/EXT), `moment`, `location_id`, `characters`, `estimated_hours`, `summary`, `source` (`import_ia` ou `manuel`), `validated` |
| `locations` | liste de lieux (adresse, coordonnées, horaires, jours interdits, autorisation) |
| `people` | liste (acteurs et équipe) |
| `schedule` | planning (facultatif) |
| `festival_shortlist` | *ancien emplacement* des dossiers : remplacé par `festival_dossiers` / `kit_pieces` (0005) |
| `film_profile`, `synopsis`, `film_page` | *ancien emplacement* : remplacé par `film_kits` (0005) |

Un `PATCH /projects/{id}` **remplace en entier** chaque clé envoyée (pas de fusion profonde des listes) et laisse les autres intactes.

### 2. `scene_extras` : géré par le backend, jamais renvoyé au front *(prévu, aucune route ne l'écrit encore)*
Une entrée par identifiant de scène. Le texte reste en **mots** ; les nombres sont recalculés à partir de la calibration.

```jsonc
"scene_extras": {
  "sc-1": {
    "source_excerpt": "…passage du scénario…",   // seulement si « Garder mon scénario » est coché
    "ai_original": { "title": "…", "summary": "…", "estimated_hours": 2 },  // proposition de l'IA
    "edited_fields": ["summary"],                 // champs modifiés par l'utilisateur
    "shot_plan": {
      "ai": {                                     // intentions proposées (vocabulaire fermé)
        "size": "MS", "subject_view": "back", "camera_angle": "eye_level",
        "light_contrast": "medium_low", "exposure": "balanced",
        "why_fr": "…", "advice_fr": ["…"], "rule_ids": ["R-008"]
      },
      "user": { "camera_angle": "low" },          // seulement ce que l'utilisateur a changé
      "calibration": "v0-default"                 // version des tables de conversion en nombres
    }
  }
}
```

- **Plan effectif** = `ai` fusionné avec `user`. Les cibles numériques (angles, plages de luminosité...) sont **recalculées** à partir de ce plan et de la version de calibration, y compris hors ligne sur le téléphone. Si l'utilisateur impose un nombre précis, on le garde dans `user`.
- `edited_fields` peut alimenter le champ « Ce que j'ai décidé moi-même » du Passeport IA.

## Sécurité

- Le backend se connecte directement à Postgres et **ignore la sécurité par ligne (RLS)**. Chaque requête doit donc vérifier `owner_id` = utilisateur du jeton (403 sinon).
- La RLS protège les accès directs avec la clé `anon` depuis le navigateur : chacun ne voit que ses lignes.
- Aucune image de caméra ni donnée de visage n'est stockée.
