# AGENTS.md - E - AAR READER HUB QWI

## Role
Ce dossier est la variante editable du Reader Hub.
- Base technique: copie de `E - AAR READER HUB`
- Edition AAR: formulaire source `C - AAR PWA/AAR.html`

## Couplage obligatoire
- Le formulaire source reste `C - AAR PWA/AAR.html`.
- Le sous-dossier `aar-pwa/` de ce hub est une copie de deploiement (web/iPad) et doit etre synchronise a chaque evolution du formulaire source.
- Protocole d'echange a maintenir:
  - Requete: `localStorage["aar_qwi_editor_request:<session>"]`
  - Ouverture: `aar-pwa/AAR.html?externalEditor=1&session=<session>`
  - Retour: `window.postMessage({ type: "aar-qwi-save", session, aar })`
- Si ce protocole change, mettre a jour **en meme temps**:
  - `C - AAR PWA/AAR.html`
  - `AAR READER HUB QWI/aar-pwa/AAR.html`
  - `AAR READER HUB QWI/qwi-mode.js`

## Regle de livraison
Toute evolution de schema/champ AAR ou de rendu detail doit etre synchronisee avec:
1. `C - AAR PWA`
2. `E - AAR READER HUB`
3. `E - AAR READER HUB/AAR READER HUB QWI`

## Regles d'encodage (obligatoires)
- Encodage requis: `UTF-8` pour tous les fichiers texte.
- En ecriture via scripts/PowerShell, toujours utiliser `-Encoding UTF8`.
- Controle anti-mojibake avant commit:
  - pattern: `Ã|Â|â€¦|â€”|ðŸ`
  - toute occurrence visible en UI doit etre corrigee avant push.
- Les textes UI de `app.js` doivent rester alignes avec ceux du hub non QWI.

## Contexte d'exploitation (a conserver)
- Flux operationnel actuel:
  - Un e-mail AAR arrive sur `david.zemmour3@gmail.com`.
  - Une automatisation extrait le JSON et l'ecrit dans le dossier Google Drive des JSON.
  - Un push GitHub met a jour les donnees des hubs.
- Ce hub QWI ajoute un flux direct de creation/edition/suppression sur Google Drive et doit rester compatible avec le pipeline ci-dessus.
- Mode backend sans OAuth (prioritaire pour iPad):
  - Le hub peut passer par `appsScript` dans `config.js` (`enabled=true`) pour ecriture/suppression.
  - Dans ce mode, `qwi-mode.js` appelle un Web App Apps Script et le bouton nuage OAuth est masque.
  - Sources backend livrees dans `apps-script/Code.gs` et `apps-script/TUTORIEL_APPS_SCRIPT_FR.md`.
- Politique credentials:
  - Projet Google Cloud recommande: `RETEX`.
  - Cle API frontend (lecture hub) separee de la cle automatisation.
  - Ecriture QWI: OAuth Client ID Web obligatoire (`googleDrive.oauthClientId`) + consentement utilisateur.
