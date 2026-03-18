# Tutoriel complet (debutant) - Backend Apps Script unique pour 3 PWA

Ce tutoriel met en place UNE seule base backend pour:
1. `AAR READER HUB` (non QWI, lecture)
2. `AAR READER HUB QWI` (lecture + edition)
3. `AAR PWA` (formulaire)

Objectif:
- tout centraliser dans Google Apps Script + Google Drive,
- supprimer la dependance fonctionnelle au push GitHub pour les donnees AAR.

---

## 1) Ce que fait chaque automation (noms exacts)

Dans le meme projet Apps Script (`Code.gs`), tu as 2 automations:

1. `AUTOMATION 1 - WEB APP API`
   - Fonctions: `doGet`, `doPost`
   - Sert aux 3 PWA pour:
     - lire les AAR (`action=listAars`)
     - lire/ecrire le catalogue (`getCatalog`, `setCatalog`)
     - creer/modifier/supprimer un AAR (`upsert`, `delete` via HUB QWI)

2. `AUTOMATION 2 - INGEST EMAIL -> DRIVE`
   - Fonction principale: `runIngestEmailsToDrive`
   - Lit les mails AAR, extrait le JSON, cree le fichier `.json` dans Drive
   - Alimente automatiquement le catalogue (hashtags/pays/OACI/operations/exercices)
   - Se lance via trigger horaire

---

## 2) Prerequis

1. Compte Google proprietaire du dossier Drive des AAR.
2. ID du dossier Drive des JSON (ex: `18RTzOZzYWEIFWS5NXyYA_Ts3Xyf2X5kX`).
3. Fichier source a copier:
   - `E - AAR READER HUB/AAR READER HUB QWI/apps-script/Code.gs`

---

## 3) Creation du projet Apps Script

1. Ouvre [script.google.com](https://script.google.com).
2. Clique `Nouveau projet`.
3. Renomme le projet:
   - `RETEX - BACKEND UNIFIE (3 PWA)`
4. Ouvre `Code.gs`, supprime tout, colle le nouveau `Code.gs`.
5. Enregistre.

---

## 4) Proprietes de script a configurer

Ouvre `Parametres du projet` -> `Proprietes du script` -> `Ajouter une propriete`.

### Proprietes obligatoires

1. `AAR_ACCESS_KEY`
   - Exemple: `AAR-READER-HUB-QWI`
   - Cette cle doit etre la meme dans les `config.js` / `mission-config.js`.

2. `AAR_FOLDER_ID`
   - Valeur: ID du dossier Drive qui contient les JSON AAR.

### Proprietes recommandees (ingest email)

3. `AAR_INGEST_ENABLED`
   - `true`

4. `AAR_INGEST_MAIL_QUERY`
   - Exemple:
   - `to:david.zemmour3@gmail.com newer_than:30d`

5. `AAR_INGEST_MAX_THREADS_PER_RUN`
   - Exemple: `20`

6. `AAR_INGEST_ERROR_LABEL`
   - Exemple: `AAR_READER_ERROR`

7. `AAR_INGEST_TRIGGER_MINUTES`
   - Exemple: `5`

### Proprietes catalogue (optionnelles)

8. `AAR_CATALOG_JSON`
   - Exemple minimal:
   - `{"hashtags":["#RETEX"],"countries":[],"oaci":[],"operations":[],"exercises":[]}`

9. `AAR_HASHTAGS_JSON`
   - Legacy (compatibilite), peut rester.

---

## 5) Deploiement Web App (Automation 1)

1. Clique `Deployer` -> `Nouveau deploiement`.
2. Type: `Application web`.
3. Description:
   - `AUTOMATION 1 - WEB APP API - RETEX`
4. `Executer en tant que`: `Moi`
5. `Qui a acces`:
   - `Tout utilisateur possedant un compte Google` (ou `Tout le monde` selon ta politique)
6. Clique `Deployer`.
7. Copie l'URL `/exec`.

Cette URL sera utilisee par les 3 PWA.

---

## 6) Activer le trigger (Automation 2)

Option simple (recommandee):
1. Dans l'editeur Apps Script, selectionne la fonction:
   - `setupIngestTriggerEvery5Minutes`
2. Clique `Executer`.
3. Autorise les permissions.

Ce que fait cette fonction:
- supprime les anciens triggers ingest,
- cree 1 trigger toutes les 5 minutes sur `runIngestEmailsToDrive`.

---

## 7) Tester rapidement

### Test API

1. Ouvre:
   - `https://script.google.com/macros/s/TON_DEPLOYMENT_ID/exec?action=status`
2. Tu dois voir:
   - `"ok": true`
   - `"service": "retex-aar-backend-unified"`

3. Ouvre:
   - `.../exec?action=listAars&accessKey=TA_CLE`
4. Tu dois voir:
   - `count` > 0 (si fichiers presents)

5. Ouvre:
   - `.../exec?action=getCatalog&accessKey=TA_CLE`
6. Tu dois voir:
   - `catalog.hashtags/countries/oaci/operations/exercises`

### Test ingest manuel

1. Ouvre:
   - `.../exec?action=runIngest&accessKey=TA_CLE`
2. Tu dois voir:
   - `summary.messagesProcessed`
   - `summary.driveFilesCreated`

3. Ouvre:
   - `.../exec?action=ingestStatus&accessKey=TA_CLE`
4. Tu dois voir l'etat d'execution memorise.

---

## 8) Liaison avec les 3 PWA (important)

### A) HUB NON QWI - `config.js`

- `appsScript.enabled = true`
- `appsScript.webAppUrl = URL /exec`
- `appsScript.accessKey = AAR_ACCESS_KEY`
- `staticRepo.enabled = false` (si tu veux 100% Drive/API)

### B) HUB QWI - `config.js`

Meme valeurs Apps Script que le non QWI.

### C) AAR PWA - `mission-config.js`

- `appsScript.webAppUrl = URL /exec`
- `appsScript.accessKey = AAR_ACCESS_KEY`

---

## 9) Faut-il encore push GitHub des JSON ?

En architecture unifiee Apps Script + Drive:
- Non, ce n'est plus obligatoire pour alimenter les hubs.
- Les hubs lisent le Drive via `action=listAars`.

Le push GitHub peut rester uniquement:
- pour versionner le code applicatif (HTML/JS/CSS),
- pas pour transporter les donnees metier AAR.

---

## 10) Depannage rapide

1. Erreur `Unauthorized: invalid access key`
   - verifier `AAR_ACCESS_KEY` cote Apps Script
   - verifier `accessKey` dans `config.js` / `mission-config.js`

2. `count = 0` sur `listAars`
   - verifier `AAR_FOLDER_ID`
   - verifier que les fichiers du dossier sont bien des JSON valides

3. Ingest ne cree rien
   - tester `runIngest` manuellement
   - verifier la requete Gmail (`AAR_INGEST_MAIL_QUERY`)
   - verifier que le mail contient bien `---BEGIN-AAR-JSON--- ... ---END-AAR-JSON---`

4. Plusieurs deploiements Apps Script visibles
   - garde un seul deploiement Web App actif (nom explicite)
   - mets son URL dans les 3 apps
   - en cas de doute: redeploie puis remplace l'URL dans les configs

---

## 11) Convention de nommage recommandee

- Projet Apps Script:
  - `RETEX - BACKEND UNIFIE (3 PWA)`
- Deploiement Web App:
  - `AUTOMATION 1 - WEB APP API - RETEX`
- Trigger:
  - `AUTOMATION 2 - INGEST EMAIL -> DRIVE (5min)`

Ces noms permettent de comprendre instantanement qui fait quoi.

