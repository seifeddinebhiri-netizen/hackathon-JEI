# Intégration avec le backend

Checklist pour brancher le front sur le backend FastAPI et sur Supabase Auth. Le contrat est dans
[`API_CONTRACT.md`](API_CONTRACT.md) ; le front ne demande aucune modification d'écran pour passer des mocks au réel.

## 1. Passer au vrai backend

- [ ] `.env` : `VITE_USE_MOCKS=false`, `VITE_API_URL=https://<api>` (sans `/` final), `VITE_PUBLIC_APP_URL=https://<front>`.
- [ ] Redémarrer `npm run dev` ou reconstruire (`npm run build`) : les variables `VITE_*` sont figées au build.
- [ ] Vérifier que le badge « Données de démonstration » a disparu de la barre de navigation.

### Mode mixte : brancher le backend fonction par fonction

Avec `VITE_USE_MOCKS=true`, `VITE_REAL_ENDPOINTS` liste les fonctions de `src/api/endpoints.ts` qui passent quand
même par le vrai backend (noms séparés par des virgules) ; toutes les autres restent simulées. Exemple, Kit Festival :

```
VITE_USE_MOCKS=true
VITE_REAL_ENDPOINTS=searchFestivals,getFestival
```

- Aiguillage : `src/api/mixed.ts` (testé dans `src/api/mixed.test.ts`). Un nom inconnu est ignoré et signalé dans la
  console en développement.
- Avec `VITE_USE_MOCKS=false`, la liste est ignorée : tout passe par le backend.
- Les mocks gardent la même forme que le backend (même type `Api`, mêmes schémas zod) : basculer une fonction ne
  change aucun écran. Les festivals simulés sont une copie de `backend/data/festivals.json` avec la même logique de
  classement (`src/api/mocks/festivals.ts`) : à recopier quand le fichier du backend change.
- Lancer le backend : `cd backend && uv run uvicorn app.main:app --port 8000` (CORS : `CORS_ORIGINS` doit contenir
  l'origine du front, `http://localhost:5173` par défaut).

Où regarder en cas de problème : `src/api/client.ts` (URL, en-têtes, délais, erreurs), `src/api/endpoints.ts`
(une fonction par route), `src/api/schemas.ts` (validation des réponses ; en développement, la console affiche le
détail de chaque réponse non conforme : `[api] Réponse invalide pour …`).

## 2. CORS côté FastAPI

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://<front-de-production>"],
    allow_credentials=False,          # le jeton passe par l'en-tête Authorization, pas par cookie
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)
```

- [ ] Les routes publiques (`GET /verify/{id}`, `GET /films/{id}/public`) répondent **sans** jeton.
- [ ] `DELETE` renvoie 200 `{ "ok": true }` ou 204.

## 3. Import du scénario (`POST /planner/parse`)

- [ ] `multipart/form-data`, champ `file` **ou** champ `text`.
- [ ] Formats acceptés : `.pdf`, `.docx`, `.txt`, `.fountain`. Taille max : **10 Mo** (le front bloque au-delà ;
      le serveur doit renvoyer 413 sinon).
- [ ] Délai : le front attend 60 s au maximum.
- [ ] Le fichier n'est pas conservé après le découpage et ne sert pas à entraîner une IA : c'est le message affiché
      avant l'envoi (`src/features/planner/components/wizard/StepScreenplay.tsx`). **Si ce n'est pas vrai côté
      serveur, adapter ce texte.**
- [ ] Les scènes renvoyées ont `source = "import_ia"` et `validated = false`.

## 4. Remplacer le faux login par Supabase Auth

Le faux fournisseur (`src/features/auth/AuthProvider.tsx`) a déjà l'interface attendue
(`src/features/auth/context.ts`) : `user`, `session`, `loading`, `signIn(email, password)`, `signInDemo()`,
`signOut()`, `setCurrentProject(id)`. Seul ce fichier change.

1. `npm install @supabase/supabase-js` (nouvelle dépendance : à valider avec l'équipe).
2. Remplir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (lus dans `src/lib/env.ts`).
3. Dans `AuthProvider.tsx` :
   ```ts
   const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);

   // au montage
   supabase.auth.getSession().then(({ data }) => save(toSession(data.session)));
   const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => save(toSession(s)));
   // au démontage : sub.subscription.unsubscribe()

   signIn = async (email, password) => {
     const { error } = await supabase.auth.signInWithPassword({ email, password });
     if (error) throw new Error('Email ou mot de passe incorrect.');
   };
   signOut = async () => { await supabase.auth.signOut(); };
   signInDemo = async () => { /* compte de démo dédié, ou retirer le bouton */ };
   ```
   `toSession` convertit la session Supabase vers le type `Session` de `src/api/types.ts`
   (`access_token`, `expires_at`, `user`). `setAuthTokenGetter` transmet déjà `access_token` à chaque requête
   (`Authorization: Bearer …`).
4. Projet courant : `user.project_id` vient aujourd'hui de la session de démo. Avec Supabase, le lire dans le profil
   (table `profiles` ou `user_metadata`) et l'écrire dans `setCurrentProject`.
5. FastAPI vérifie le JWT Supabase (clé JWT du projet) et contrôle que le projet appartient à l'utilisateur
   (sinon 403).

## 5. Points du contrat à trancher

| Sujet | Proposition du front |
|---|---|
| `GET /projects/{id}/passport` | Ajouté : renvoie `Passport` ou `null` |
| `film_profile`, `synopsis`, `film_page` dans `Project` | Validé : enregistrés via `PATCH /projects/{id}` |
| `PATCH` : remplacement ou fusion | Chaque champ envoyé remplace la valeur entière |
| `POST /planner/schedule` | Le front enregistre ensuite le planning par `PATCH` ; le serveur peut aussi l'enregistrer |
| Feuille de service publique | Futur : lien à jeton (`GET /projects/{id}/days/{date}/public`) |
| Photos de la page film | Futur : `POST /films/{id}/stills` |
| `GET /passport/{id}/pdf` | Renvoie une URL (fichier signé ou temporaire) |
| `ShortlistItem.status` | **À confirmer** : `a_preparer` \| `pret` \| `soumis` \| `reponse_recue` \| `prochain_appel` (« Où j'en suis ») |
| `POST /synopsis/translate` | **À confirmer** : traduction anglaise du synopsis de l'auteur (mock seulement pour l'instant) |
| Version anglaise du synopsis, réponse « Déclaration IA » par festival | Gardées dans le navigateur pour l'instant (pas dans `Project`) |

## 6. Tester chaque écran

Pour chaque écran : succès, chargement (ralentir le réseau dans les outils du navigateur), erreur (couper le backend :
le message et « Réessayer » doivent apparaître), vide.

- [ ] `/connexion` : connexion, erreur d'identifiants, redirection vers la page demandée.
- [ ] `/projet` : sans planning, avec planning, sans Passeport, sans sélection.
- [ ] `/planner/rapide` : créneaux, « Météo à revérifier » au-delà de 14 jours, « Ajouter à mon film ».
- [ ] `/planner/projet` : création (`?nouveau=1`), import PDF / TXT / texte collé, « Ajouter à la suite » ou
      « Remplacer », lieux et personnes, enregistrement automatique (couper le réseau → « Échec de l'enregistrement »).
- [ ] Générer, puis régénérer (confirmation, puis « Annuler » pendant 8 s qui restaure le planning précédent).
- [ ] `/planner/calendrier` : poser une scène à une heure précise sur la frise, la déposer sur une date ou un jour
      libre, au clavier (Espace, flèches, Espace) et par « Déplacer vers… » ; chevauchement refusé ; conflits
      regroupés avec « Marquer comme obtenue » et « Déplacer au … ? » ; vue « Période » ; cartes par jour à 390 px.
- [ ] `/planner/jour/:date` : ordre des scènes, heure de rendez-vous, impression A4.
- [ ] `/coach` : QR code (avec `VITE_PUBLIC_APP_URL` accessible depuis un téléphone), version mobile.
- [ ] `/passeport` : 8 départements, outil hors catalogue, contrôle avant PDF, PDF, badge PNG/SVG, signature C2PA.
- [ ] `/verifier/:id` : sans être connecté ; identifiant inconnu → « Passeport introuvable ».
- [ ] `/festival` (Catalogue) : avec `VITE_REAL_ENDPOINTS=searchFestivals,getFestival`, les 20 festivals du backend ;
      appels ouverts, compatibles, sous-titres FR, région, recherche (ville, pays, sans accents), « Classer selon mon
      film », « Préparer mon dossier » / « Préparer pour 2027 ». Anciennes URL `?onglet=…` redirigées.
- [ ] `/festival/:id` (Fiche) : compatibilité renvoyée par le serveur, panneau « Ton dossier » ; id inconnu → 404.
- [ ] `/festival/dossiers` : pièces triées bloquant → à faire → prêt, « Où j'en suis », colonne « Mes pièces ».
- [ ] `/festival/sous-titres` : import (le son est extrait dans le navigateur, seul le WAV part), relecture,
      « À vérifier d'abord », export `.srt` bloqué tant que tout n'est pas validé (`DarHmeti_EN.srt`, UTF-8).
- [ ] `/festival/sous-titres/regarder` : vidéo locale, arrêt sur les lignes à risque, raccourcis, frise.
- [ ] `/festival/synopsis` : compteur, limites (exemples marqués), questions du coach, version anglaise.
- [ ] `/festival/dossiers/:id/declaration-ia` : Passeport fait / pas encore / importer ; « Déclarer maintenant »
      renvoie au dossier à la fin du Passeport (`?retour=`).
- [ ] `/festival/page-film` : photos, bande-annonce, lien public.
- [ ] `/film/:id` : sans être connecté.
- [ ] `/mes-donnees` : export JSON, suppression (le lien de vérification renvoie ensuite 404).

## 7. Gestion des erreurs

- Toutes les erreurs passent par `ApiError` (`status`, `code`, `message`). Le message du serveur
  (`{ "error": { "code", "message" } }`, ou `message`, ou `detail`) est affiché tel quel : l'écrire en français,
  sans jargon.
- Les requêtes ne sont pas réessayées sur les erreurs 4xx ni sur les réponses non conformes ; les autres le sont une fois.
- Les modifications sont optimistes (planning, sélection, sous-titres) : en cas d'échec, l'écran revient à l'état
  précédent et un message s'affiche.
- 401 : la session est expirée ; avec Supabase, rafraîchir le jeton (`autoRefreshToken`) ou renvoyer vers `/connexion`.


## 7. État du branchement (Coach et connexion)

- **Connexion réelle** : `SupabaseAuthProvider` (création de compte + connexion). Active dès que `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY` sont renseignés ; sinon la connexion simulée reste en place. Désactiver « Confirm email » dans Supabase
  (Authentication > Sign In / Providers > Email) pour les essais.
- **Coach réel, reste simulé** : avec `VITE_USE_MOCKS=true` et `VITE_REAL_COACH=true`, seuls `generateShotSpec` et `getCalibration`
  appellent le backend (`src/api/index.ts`). Projet, Planner, Passeport et Festival restent des mocks.
- **Tester sur téléphone** : la page est en https (`npm run dev:phone`), le backend en http : le navigateur bloque cet appel (contenu mixte).
  Mets `VITE_API_URL=/api` : le serveur de dev relaie `/api/*` vers `http://localhost:8000` (voir `vite.config.ts`).
- Le jeton Supabase part dans `Authorization: Bearer …` ; le backend le vérifie (`SUPABASE_JWT_SECRET`, ou les clés publiques si le projet
  utilise les nouvelles clés asymétriques).
- **Espaces de travail du Coach** : exécuter la migration `backend/migrations/0004_workspaces.sql` dans Supabase. Sans elle,
  `GET /workspaces` échoue et le Coach affiche « Enregistrement sur ton compte impossible » (les espaces restent dans le téléphone).
