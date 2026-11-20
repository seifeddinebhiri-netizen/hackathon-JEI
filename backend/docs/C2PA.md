# Signature C2PA du Passeport IA

## Ce que c'est
C2PA (Content Credentials) est une **étiquette signée** attachée à un fichier. Elle dit qui l'a émis et
ce qui lui est arrivé. L'étiquette (le « manifeste ») contient une empreinte du contenu du fichier, et
elle est signée avec la clé privée d'un certificat. Résultat :

- si **un seul octet** change, la vérification échoue (`assertion.dataHash.mismatch`) ;
- si le fichier est intact, un lecteur sait **quel signataire** l'a émis.

**Ce que C2PA ne prouve pas** : que les déclarations du cinéaste sont vraies, ni que le film est « légal »
ou « sans IA ». Il prouve « ce signataire a émis ce fichier, et il n'a pas changé depuis ». Notre PDF le dit.

## Ce que nous signons
Le **PDF du Passeport** (pas le film, trop lourd à envoyer). Le manifeste contient l'action « créé »
(type `digitalCreation` : fait par notre logiciel, **pas** généré par IA) et une assertion
`org.premierplan.ai-passport` : identifiant, badge, titre, empreinte SHA-256 du film, outils déclarés avec leur
statut et s'ils ont été relus, et `signing_mode` (`test` ou `production`). Pour lier le passeport au film,
on y met l'empreinte du film : un festival calcule la sienne et compare.

## Outils
| Rôle | Outil |
|---|---|
| Signature et lecture C2PA | `c2pa-python` (SDK officiel de la C2PA, moteur c2pa-rs) |
| Certificat de test | `scripts/make_test_cert.py` (bibliothèque `cryptography`) |
| PDF | ReportLab (`app/services/passport_pdf_service.py`) |
| Code de signature | `app/services/c2pa_service.py` : `sign_pdf`, `verify_pdf` |

Algorithme : ECDSA P-256 (`ES256`). Le service **relit chaque PDF signé** avant de le livrer.

## Certificat de TEST (maintenant)
`uv run python -m scripts.make_test_cert` crée dans `backend/certs/` (ignoré par git) une autorité de test et
un certificat de signature. Un lecteur public (par exemple contentcredentials.org/verify) affiche alors
« **signataire inconnu / non fiable** » (`signingCredential.untrusted`) tout en confirmant que le fichier est
intact. C'est le comportement attendu pour la démonstration, et le README le dit. Le passeport porte
`signing_mode: test`.

## Passage en production : ce qui change
Le code ne change pas. Trois réglages (`backend/.env`) :
1. `C2PA_CERT_CHAIN_PATH` : le certificat d'une **autorité reconnue par la liste de confiance C2PA**, au lieu du
   certificat de test. C'est payant et demande une vérification de l'organisation. Vérifier sur c2pa.org la
   liste courante des autorités et les offres : nous ne les avons pas testées.
2. `C2PA_PRIVATE_KEY_PATH` : la clé correspondante. Ne jamais la mettre dans git (`certs/` et `*.pem` sont ignorés).
3. `C2PA_TEST_MODE=false` : le passeport cesse de se déclarer « test ».

Recommandé en plus :
- `C2PA_TSA_URL` : un serveur d'horodatage (RFC 3161), pour que la signature reste valable après l'expiration du
  certificat.
- **Clé dans un coffre** (KMS, HSM) qui ne la laisse jamais sortir : remplacer le bloc `load_signer` par
  `c2pa.Signer.from_callback(callback, alg, certs, tsa_url)`, où `callback` envoie les octets à signer au coffre.
  Le reste du code ne bouge pas.
- Rotation : prévoir le renouvellement avant expiration. Les anciens passeports restent vérifiables.

## Vérification
`verify_pdf` renvoie `none` (pas de signature), `invalid` (modifié), `valid` (intact, signataire inconnu de
nous) ou `trusted` (intact et signataire présent dans `C2PA_TRUST_ANCHORS_PATH`).

La route publique `POST /verify/pdf` (un festival dépose le PDF reçu) va plus loin, pour deux raisons :
- **Signé par nous ?** N'importe qui peut signer un PDF avec son propre certificat en copiant nos informations. La
  réponse dit donc `issued_by_us` en comparant le numéro de série du certificat au nôtre (ou `trusted` si une autorité
  de confiance est configurée). Un PDF signé par un autre est « intact » mais jamais « authentique ».
- **À jour ?** Le manifeste contient l'empreinte SHA-256 du Passeport (`passport_sha256`). On la compare à celle du
  Passeport actuel : un seul mot modifié depuis l'émission suffit à dire « le Passeport a changé ».

Rien n'est conservé : le fichier est lu en mémoire puis oublié. Limites : 8 Mo, 30 vérifications par heure et par adresse IP,
2 lectures en parallèle. Le fichier est lu par une bibliothèque native (c2pa-rs) : la taille bornée, le contrôle `%PDF` et la
lecture hors de la boucle d'événements limitent le risque, ils ne le suppriment pas.

**Après un changement de certificat** (renouvellement, passage en production), les anciens PDF ne sont plus reconnus comme
« signés par nous » : leur numéro de série n'est plus celui du certificat courant. Avec `C2PA_TRUST_ANCHORS_PATH` pointant
vers l'autorité (et non le certificat), ils restent `trusted`.

## Limites assumées
- La signature de test ne prouve pas l'identité de l'émetteur.
- L'arabe n'est pas géré dans le PDF (police intégrée à ReportLab) : les caractères non latins deviennent `?`.
- Si l'utilisateur modifie le PDF (même pour l'imprimer), la signature est perdue : il faut réémettre.
