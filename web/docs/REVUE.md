# Revue de design et d'accessibilité (phase 8)

Méthode : captures pleine page de chaque écran en 1440 et 390 px (`docs/captures/`), critique écran par écran
(première impression, usage, hiérarchie, cohérence, accessibilité), correction des 3 points les plus importants,
puis audit automatique **axe-core** (règles WCAG 2.1 A et AA, bonnes pratiques) et contrôle des cibles tactiles.

## Corrections par écran

| Écran | Corrections |
|---|---|
| Accueil | Hero mobile : l'Étiquette IA ne cache plus la photo · capture « Planifier » lisible sur mobile (3 jours au lieu de 5) · capture du Coach mise en scène (téléphone sur fond nuit) |
| Scène rapide | Les 3 meilleurs créneaux d'abord, les autres sur demande · phrase de synthèse (« 7 recommandés, 1 en plan B ») · détail du créneau plus proche de la liste sur mobile |
| Calendrier | Jours hors période hachurés et nommés · blocs de scène plus compacts (le lieu est déjà en tête de journée) · « Régénérer » et « Valider le planning » remontés à côté des statuts |
| Feuille de service | Rendez-vous mis en avant dans l'en-tête · filet en double supprimé · lignes des acteurs convoqués lisibles sur mobile |
| Passeport IA | Sur mobile : étiquette, puis question, puis sorties (au lieu de tout faire défiler) · dernier département : « Voir le lien, le PDF et le badge » au lieu d'un bouton grisé · adresse du badge ajustée à sa largeur |
| Vérification | Résumé humain / assisté / généré dans l'en-tête · avertissement si la déclaration est incomplète · « Aucun détail fourni » au lieu d'une colonne vide |
| Kit Festival | Échéance toujours au même endroit dans les cartes · filtres repliables sur mobile · onglets sur deux lignes sur mobile (les 5 visibles) |
| Page film | Générique séparé en « Distribution » et « Équipe » |
| Tableau de bord, assistant | Compte à rebours sans retour à la ligne · accords (« 1 généré ») · plus de ligne vide sous les étapes de l'assistant |

## Accessibilité

Résultat final de l'audit axe-core : **0 violation sur les 20 écrans, en 1440 et en 390 px.**

Corrigé pendant l'audit :
- cases à cocher : zone cliquable portée à 44 px (la case visible reste à 24 px, le libellé est aussi cliquable) ;
- filtre des sous-titres : case native de 20 px remplacée par le composant `Checkbox` ;
- repères de navigation en double (« Étapes ») : celui de l'assistant renommé « Étapes de l'assistant » ;
- tableau de `/mes-donnees` défilant sur mobile : rendu focusable et nommé ;
- générique de `/film/:id` : listes de définitions conformes.

Vérifié par ailleurs :
- **contraste** : AA sur tous les textes (ratios dans `DESIGN_SYSTEM.md`), aucun échec axe ;
- **clavier** : tous les contrôles sont atteignables, focus or visible ; déplacer une scène au clavier (Espace,
  flèches, Espace) avec annonces en français, ou via « Déplacer vers… » ; réordonner les scènes du jour au clavier ;
  dialogues Radix avec focus piégé et retour au déclencheur ;
- **cibles** : 44 px minimum pour les boutons, liens de navigation, onglets et contrôles segmentés ;
- **textes alternatifs** : chaque photo a un `alt` en français ; icônes décoratives masquées (`aria-hidden`) ;
  captures illustratives de l'accueil masquées aux lecteurs d'écran ;
- `lang="fr"` sur la page, `lang="en"` et `lang="aeb-Latn"` sur les sous-titres anglais et derja.

Limites connues : les champs de date natifs suivent la langue du navigateur (format mm/jj/aaaa sur un navigateur
anglais) ; l'impression A4 n'a pas été vérifiée sur papier.
