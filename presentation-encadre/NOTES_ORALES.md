# Notes orales — Encadré, prise 02 (6 minutes)

Une ligne = une pression sur → (étape). Les mêmes notes s'affichent dans la fenêtre présentateur (**W**)
et le panneau de notes (**N**).

## 00 · Précédemment dans Encadré (20 s)

1. *(Laisser défiler la pellicule 2 à 3 secondes, sans parler.)*
2. Il y a quelques jours, nous vous avons présenté un constat : les jeunes réalisateurs tunisiens avancent seuls. Trois artistes nous l'ont dit devant El Teatro.
3. Aujourd'hui, cette vision prend forme. Baba Jamil lève le clap : on passe derrière la caméra.

## 00 · Prise 02 — Derrière la caméra (15 s)

1. Encadré, prise 02 : derrière la caméra. Une idée, un premier prototype, et maintenant les coulisses.
2. La première fois, nous vous avons montré pourquoi Encadré devait exister. Aujourd'hui, comment nous lui avons donné vie. Toujours avec la même règle : l'IA propose, le cinéaste décide.

## Problématique · Cinq entretiens (45 s)

1. Avant de construire, nous avons écouté. Cinq entretiens : étudiants en cinéma, réalisateurs, metteur en scène.
2. Eya Hachicha, étudiante en cinéma : le choix des plans, la planification. Premier axe : planifier.
3. Eya Guirat : le cadrage, et déclarer l'usage de l'IA. Deux axes : tourner et déclarer.
4. Nour Elomr Ouni : on n'a pas d'encadrants pour mettre en valeur le projet artistique.
5. Mariem Ben Jeddi : l'État ne s'intéresse pas aux jeunes artistes.
6. Tarek Ben Abdelfatteh : ceux qui connaissent le chemin ne t'aident pas à avancer. Trois voix pour le même axe : être vu, diffuser.
7. Quatre étapes, et à chacune, ils avancent seuls.

## Problématique · Pourquoi maintenant (30 s)

1. Pourquoi maintenant ? Parce que personne ne leur a appris comment, et que trois choses ont changé.
2. Tout le monde peut filmer : un téléphone suffit. Mais organiser un tournage et cadrer, ça ne s'apprend nulle part. Planifier, tourner.
3. Les règles changent : les Oscars 2027 exigent des scénarios écrits par des humains, et l'AI Act européen impose depuis août 2026 de signaler les contenus truqués par IA. Déclarer devient obligatoire.
4. Et tout le monde veut être vu : 700 films inscrits aux JCC 2025, 42 en compétition officielle. Il faut arriver prêt. Diffuser.

*Sources à citer si le jury demande : La Presse de Tunisie (5 déc. 2025) pour les 700 films ; listes du CNCI pour les 42 en compétition ; règles de la 99e cérémonie des Oscars (1er mai 2026) ; Règlement (UE) 2024/1689, art. 50.*

## 01 · Le projet prend forme (20 s)

1. Ces quatre blocages sont exactement nos quatre étapes : planifier, tourner, déclarer, diffuser. C'est notre réponse.
2. Chacune est devenue un module de l'application, de la préparation du tournage jusqu'à la diffusion du film.
3. Et tout commence par une feuille : le scénario.

## 02 · Du storyboard à l'interface (30 s)

1. Avant d'écrire du code, nous avons conçu chaque écran. Exemple : la relecture des sous-titres. D'abord la structure de la page.
2. Puis une maquette sur un canevas de design : brouillon IA à valider, lignes à risque en premier.
3. Et l'écran réellement développé. Passons aux quatre modules.

## 03 · Les quatre modules, façade et envers du décor (170 s)

1. Quatre modules. Pour chacun : ce que voit le cinéaste, puis l'envers du décor. Tout est capturé dans le prototype et extrait de notre dépôt.
2. **Planifier.** On importe un scénario, même en PDF ou Word. L'IA le découpe en scènes, propose des améliorations que l'on accepte ou refuse, suggère des lieux réels et vérifie la météo. Le calendrier est en cours. Le créateur garde le dernier mot.
3. *L'envers du décor.* Le fichier part vers FastAPI, le modèle (Gemini, Anthropic, Groq ou Ollama en local) renvoie un brouillon contraint par un schéma, le cinéaste valide, le projet est enregistré dans Supabase. En parallèle : vrais lieux par OpenStreetMap, météo par Open-Meteo. Le calendrier est calculé dans le navigateur pour l'instant : partiel.
4. **Tourner.** Au premier pitch, le Coach était une illustration. Aujourd'hui, un prototype qui ouvre la caméra et mesure visage, horizon, angle et lumière sur le téléphone, sans rien envoyer. Le plan par l'IA reste à valider avec une vraie clé.
5. *L'envers du décor.* La scène va à /shot-spec ; Gemini choisit dans un vocabulaire fermé, appuyé sur 71 règles sourcées ; le serveur convertit les mots en chiffres ; le téléphone mesure en direct avec MediaPipe et les capteurs. Les espaces de travail sont dans Supabase. Prochaine brique : le corps entier.
6. **Déclarer.** Le Passeport IA : département par département, ce qui est humain et ce qui vient de l'IA. Chaque outil est cherché dans sa documentation publique. Le PDF est signé en C2PA, avec un certificat de test pour l'instant.
7. *L'envers du décor.* Le Passeport est dans Supabase, le badge est généré par la base. Un outil inconnu déclenche une recherche : pages officielles en https, Gemini extrait des faits avec citation, le catalogue garde le statut. Le PDF est fabriqué par ReportLab et signé avec c2pa-python ; les festivals le vérifient sans que rien ne soit stocké.
8. **Diffuser.** Vingt festivals sourcés, classés par compatibilité, sans prédire la sélection. Les sous-titres : transcription du derja, traduction, relecture ligne par ligne, export verrouillé tant que tout n'est pas validé.
9. *L'envers du décor.* Les festivals viennent d'un fichier vérifié à la main ; l'audio va chez ElevenLabs puis est supprimé ; Gemini, ou Ollama en local, traduit avec un glossaire derja ; le cinéaste valide chaque ligne ; dossiers et brouillons sont dans Supabase.

*Survoler un bloc du diagramme affiche le fichier qui le prouve (utile pour les questions du jury).*

## 04 · Place à la démonstration (45 s)

Démo courte : importer le scénario → découpage → accepter une suggestion → calendrier.
A : en direct (`cd web && npm run dev` avant). B : vidéo de secours. C : captures, toujours disponible (→ et ←). Échap pour revenir.

## 05 · L'éthique au cœur du projet (30 s)

1. Trois principes, devant l'objectif.
2. Créativité : l'IA ne réécrit ni l'histoire, ni les dialogues, ni le synopsis.
3. Transparence : « non divulgué » est accepté, chaque festival a sa source, la météo n'est jamais inventée.
4. Contrôle humain : sous-titres validés ligne par ligne, alerte avant de générer le planning, images du Coach traitées sur le téléphone.
5. Et ce que nous ne promettons pas encore, nous le disons.

## 06 · À suivre… (20 s)

1. Fin de la prise 02.
2. Nous n'avons pas seulement imaginé un outil. Nous avons commencé à construire un nouvel accompagnement pour les créateurs. L'IA propose, le cinéaste décide.
3. Encadré : tourne, déclare, fais-toi voir. Merci. *(Le dépôt GitHub est à l'écran.)*
