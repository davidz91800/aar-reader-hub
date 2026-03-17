# AGENTS.md - E - AAR READER HUB

## Role
Ce dossier (`E - AAR READER HUB`) est le hub de lecture principal des AAR.

## Couplage obligatoire
- Le schema AAR doit rester aligne avec `C - AAR PWA/AAR.html`.
- Toute evolution de parsing/champs dans `app.js` doit etre repercutee dans:
  - `AAR READER HUB QWI/app.js`
  - `AAR READER HUB QWI/qwi-mode.js` (si le flux d'edition est impacte)
- Toute evolution de rendu detail/PDF ici doit etre refletee dans la variante QWI, sauf decision explicite contraire.

## Regle de livraison
Quand tu modifies ce hub, verifie toujours l'impact sur:
1. `C - AAR PWA` (formulaire et schema)
2. `AAR READER HUB QWI` (ajout/edition/suppression + rendu)

## Regles d'encodage (obligatoires)
- Tous les fichiers texte (`.js`, `.html`, `.css`, `.md`, `.json`) doivent etre en `UTF-8`.
- Ne jamais sauvegarder avec un encodage implicite. Si usage PowerShell: toujours forcer `-Encoding UTF8`.
- Avant commit, verifier qu'il n'y a pas de mojibake dans les fichiers modifies:
  - Pattern de controle: `Ã|Â|â€¦|â€”|ðŸ`
  - Si un match apparait dans du texte UI, corriger avant push.
- Si un texte UI est modifie ici, reproduire la meme correction dans `AAR READER HUB QWI/app.js`.

## Contexte d'exploitation (a conserver)
- Flux operationnel actuel:
  - Un e-mail AAR arrive sur `david.zemmour3@gmail.com`.
  - Une automatisation extrait le JSON et l'ecrit dans le dossier Google Drive des JSON.
  - Un push GitHub met a jour les donnees statiques consommees par le hub.
- Toute modification de sync/stockage doit garder ce pipeline e-mail -> Drive -> GitHub fonctionnel.
- Variante QWI:
  - Peut utiliser un backend Apps Script (config `appsScript` dans `AAR READER HUB QWI/config.js`) pour ecriture/suppression sans popup OAuth.
  - Le hub non QWI peut aussi lire via Apps Script (`action=listAars`) pour eviter les blocages de cle API Drive cote navigateur.
  - Si ce mode est active, garder la compatibilite schema/rendu avec le hub principal.
- Politique credentials:
  - Projet Google Cloud recommande: `RETEX`.
  - Cle API du hub frontend separee de la cle API d'automatisation.
  - Si la cle frontend est exposee dans `config.js`, la restreindre (HTTP referrers + Drive API uniquement).
