# AGENTS.md - E - AAR READER HUB QWI

## Role
Ce dossier est la variante editable du Reader Hub.
- Base technique: copie de `E - AAR READER HUB`
- Edition AAR: formulaire source `C - AAR PWA/AAR.html`

## Couplage obligatoire
- Ne pas dupliquer le formulaire AAR ici: l'edition doit passer par `C - AAR PWA/AAR.html`.
- Protocole d'echange a maintenir:
  - Requete: `localStorage["aar_qwi_editor_request:<session>"]`
  - Ouverture: `AAR.html?externalEditor=1&session=<session>`
  - Retour: `window.postMessage({ type: "aar-qwi-save", session, aar })`
- Si ce protocole change, mettre a jour **en meme temps**:
  - `C - AAR PWA/AAR.html`
  - `AAR READER HUB QWI/qwi-mode.js`

## Regle de livraison
Toute evolution de schema/champ AAR ou de rendu detail doit etre synchronisee avec:
1. `C - AAR PWA`
2. `E - AAR READER HUB`
3. `E - AAR READER HUB/AAR READER HUB QWI`

## Contexte d'exploitation (a conserver)
- Flux operationnel actuel:
  - Un e-mail AAR arrive sur `david.zemmour3@gmail.com`.
  - Une automatisation extrait le JSON et l'ecrit dans le dossier Google Drive des JSON.
  - Un push GitHub met a jour les donnees des hubs.
- Ce hub QWI ajoute un flux direct de creation/edition/suppression sur Google Drive et doit rester compatible avec le pipeline ci-dessus.
- Politique credentials:
  - Projet Google Cloud recommande: `RETEX`.
  - Cle API frontend (lecture hub) separee de la cle automatisation.
  - Ecriture QWI: OAuth Client ID Web obligatoire (`googleDrive.oauthClientId`) + consentement utilisateur.
