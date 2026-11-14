# Icônes dérivées

Générées une fois à partir de `public/brand/png/encadre-icone.png` (pack de logos encadré) :

- `encadre-icone-maskable-512.png` : icône réduite à 72 % sur le même fond, pour rester dans la zone de sécurité
  des icônes « maskable » (Android découpe l'icône en cercle ou en goutte).
- `apple-touch-icon.png` : 180 × 180 px pour l'écran d'accueil iOS.

Les autres icônes (favicon, 192, 512) sont utilisées telles quelles depuis `public/brand/`.
Si le pack change, régénérer ces deux fichiers à partir du nouveau `encadre-icone.png`.
