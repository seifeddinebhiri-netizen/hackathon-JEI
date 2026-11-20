# Recherche automatique d'un outil d'IA

Quand un cinéaste déclare un outil absent du catalogue, le serveur lance une recherche guidée (10 à 60 s). Rien
n'est enregistré si elle ne trouve rien de vérifiable. Le résultat est toujours « à vérifier » jusqu'à relecture.

## Les étapes

1. **Registre des sources connues** (`data/ai_tool_sources.json`). Pour un outil courant, on part d'adresses
   déjà vérifiées par `scripts/verify_tool_sources.py` : ni recherche, ni devinette. ~30 outils.
2. **Recherche web** (outil inconnu). Gemini avec la recherche Google trouve le site ; le modèle choisit ensuite
   le site officiel **parmi les résultats**. En dernier recours seulement, la mémoire du modèle.
3. **Contrôle d'identité.** Le site doit mentionner l'outil (ou son fournisseur) : écarte un faux site.
4. **Liens de la page d'accueil.** On lit le pied de page et on garde les liens « conditions », « confidentialité »,
   « licence », sur le même domaine. Ce n'est qu'à défaut qu'on teste des chemins courants (`/terms`, `/privacy`…).
5. **Lecture.** HTTP honnête d'abord. Une page « coquille » (texte chargé par JavaScript) est relue par un
   navigateur sans écran **local**, si `RESEARCH_BROWSER=true`.
6. **Pages écartées** : coquilles vides, fausses pages (le site répond son accueil à toute adresse), doublons.
7. **Extraction en UN appel** pour toutes les pages (le quota gratuit est limité), puis **vérification en code** :
   chaque citation doit se trouver mot pour mot dans une page lue. Le statut est calculé par des règles.

## Ce que nous ne faisons pas, volontairement

- **Aucun contournement d'un refus.** Un 401, 403 ou 429, ou un `robots.txt` qui nous interdit la page, arrête la
  lecture : l'outil reste « hors catalogue ». Le navigateur n'est **jamais** essayé après un refus : il ne sert
  qu'aux pages qui s'ouvrent normalement mais n'affichent rien sans JavaScript. Nous ne passons pas par un service
  tiers de lecture pour franchir un blocage.
- Le navigateur se présente avec le même nom de robot honnête, ne garde rien (contexte neuf, pas de cookies) et
  chaque requête de la page doit être en https vers un site public.
- Aucune adresse proposée par le modèle n'est lue hors du site officiel.

## Réglages (`backend/.env`)

| Variable | Rôle |
|---|---|
| `TOOL_RESEARCH_MODEL` | Modèle de la recherche. Vide = `LLM_MODEL`. **Le quota gratuit est compté par modèle** : en mettre un autre (ex. `gemini-3.1-flash-lite`) évite que les recherches consomment les requêtes du Coach. |
| `RESEARCH_BROWSER` | `true` pour lire les sites en JavaScript. Installation : `uv sync --extra browser`, puis `uv run playwright install chromium`. |
| `TOOL_RESEARCH_DAILY_LIMIT`, `TOOL_RESEARCH_CONCURRENCY` | Plafond de recherches par jour, parallélisme. |

## Coût en requêtes Gemini

Outil du registre : **1** requête. Outil inconnu : **3** (recherche web, choix du site, extraction). Le palier
gratuit de `gemini-2.5-flash` est de **20 requêtes par jour** : prévois un modèle dédié (`TOOL_RESEARCH_MODEL`)
ou un compte avec facturation avant de laisser les utilisateurs lancer des recherches.

## Scripts

```
uv run python -m scripts.research_tool "Kimi K2"                  # essai sans rien écrire
uv run --extra browser python -m scripts.research_tool "Kimi K2" --browser --save
uv run python -m scripts.research_tool "Kimi K2" --no-registry    # mesurer la découverte seule
uv run --extra browser python -m scripts.verify_tool_sources --browser          # état du registre
uv run --extra browser python -m scripts.verify_tool_sources --browser --write  # ne garder que le vérifié
```

Pour ajouter un outil au registre : ajoute son entrée (site + adresses des conditions) dans
`data/ai_tool_sources.json`, puis lance `verify_tool_sources --write` : seules les pages lisibles et juridiques sont gardées.
