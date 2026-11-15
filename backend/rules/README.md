# Base de règles de cinématographie

Workflow :

1. `rules/raw/candidates.json` : règles candidates brutes (générées/collectées).
2. Validation : `uv run python -m scripts.validate_rules [chemin]`
   (défaut `rules/raw/candidates.json`; code de sortie non nul si invalide).
3. Relecture humaine : chaque règle, chaque source et chaque valeur chiffrée est vérifiée.
4. Les règles relues et validées sont placées dans `rules/rules.json` (fichier chargé par
   l'API au démarrage; s'il est absent, l'API démarre avec un avertissement et 0 règle).

Schéma : `rules/schema/rule.schema.json`, régénéré avec
`uv run python -m scripts.export_rule_schema`.

## Règles d'or

- **Aucun chiffre ni source inventé.** Une valeur (`numeric_hint`) doit venir de la source
  citée; sinon `numeric_hint: null` et on baisse la `confidence`.
- **Pas de source, pas d'affichage** : une règle sans source est refusée par la validation.
- Les URLs doivent être réellement consultables et correspondre à ce qu'elles citent.
