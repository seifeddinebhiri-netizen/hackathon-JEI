# Schéma de la base de données

Les comptes sont gérés par **Supabase Auth** (`auth.users`). Nous ajoutons deux tables et un bucket.
Les migrations sont à exécuter dans l'ordre dans *Supabase > SQL Editor* : `0001`, `0002`, `0003`.

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
| `festival_shortlist` | festivals retenus et listes de contrôle |
| `film_profile`, `synopsis`, `film_page` | Kit Festival (facultatifs) |

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
