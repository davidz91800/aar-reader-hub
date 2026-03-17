# Tutoriel complet - Backend Google Apps Script pour AAR READER HUB QWI

Objectif: supprimer la friction OAuth dans la PWA QWI (iPad), en passant par un backend Apps Script qui ecrit/supprime les JSON dans Drive.

---

## 0) Prerequis

1. Compte Google proprietaire du dossier Drive JSON.
2. ID du dossier Drive des JSON:
   - ici: `18RTzOZzYWEIFWS5NXyYA_Ts3Xyf2X5kX`
3. Le code Apps Script pret est dans:
   - `apps-script/Code.gs`
4. La PWA QWI est deja preparee pour utiliser ce backend via `config.js`.

---

## 1) Creer le projet Apps Script

1. Ouvre [script.google.com](https://script.google.com).
2. Clique `Nouveau projet`.
3. Renomme le projet: `RETEX - AAR HUB QWI API`.
4. Dans l'editeur, supprime le contenu de `Code.gs`.
5. Copie-colle le contenu du fichier local `apps-script/Code.gs`.
6. Clique `Enregistrer` (icone disquette).

---

## 2) Definir les proprietes de script (secret + folder par defaut)

1. Dans Apps Script, clique `Parametres du projet` (roue dentee, barre gauche).
2. Section `Proprietes du script` -> `Ajouter une propriete`.
3. Ajoute:
   - Cle: `AAR_ACCESS_KEY`
   - Valeur: un secret long (exemple: `QWI-2026-<chaine-longue>`).
4. Ajoute:
   - Cle: `AAR_FOLDER_ID`
   - Valeur: `18RTzOZzYWEIFWS5NXyYA_Ts3Xyf2X5kX`
5. (Optionnel, recommande) ajoute aussi:
   - Cle: `AAR_CATALOG_JSON`
   - Valeur:
     `{"hashtags":["#RETEX"],"countries":[],"oaci":[],"operations":[],"exercises":[]}`
6. (Legacy, optionnel) tu peux garder:
   - Cle: `AAR_HASHTAGS_JSON`
   - Valeur: `["#RETEX"]`
6. Enregistre.

Important:
- `AAR_ACCESS_KEY` doit etre reporte dans `config.js` de la PWA QWI.
- Sans cette cle, n'importe qui connaissant l'URL du Web App peut appeler l'API.

---

## 3) Deployer en application web

1. Clique `Deployer` (en haut droite).
2. Clique `Nouveau deploiement`.
3. Clique l'icone engrenage -> choisis `Application web`.
4. Renseigne:
   - `Description`: `AAR HUB QWI API v1`
   - `Executer en tant que`: `Moi`
   - `Qui a acces`: `Toute personne disposant du lien`
5. Clique `Deployer`.
6. Autorise les permissions:
   - selection du compte,
   - `Parametres avances` si necessaire,
   - `Autoriser`.
7. Copie l'`URL de l'application web` (elle finit par `/exec`).

---

## 4) Configurer la PWA QWI (config.js)

Fichier a modifier:
- `E - AAR READER HUB/AAR READER HUB QWI/config.js`

Dans l'objet `appsScript`, mets:

```js
appsScript: {
  enabled: true,
  webAppUrl: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
  accessKey: "TA_CLE_AAR_ACCESS_KEY",
  timeoutMs: 25000
},
```

Notes:
1. `enabled: true` active le mode backend Apps Script.
2. Le bouton nuage OAuth est masque automatiquement.
3. Les actions `Modifier/Supprimer/Ajouter` passent par Apps Script.

---

## 5) Push GitHub

Depuis le repo `E - AAR READER HUB`:
1. Commit/push vers `aar-reader-hub`.
2. Push du dossier `AAR READER HUB QWI` vers `aar-reader-hub-qwi`.

Si tu utilises deja le process habituel de push, garde ce process.

---

## 6) Test fonctionnel (important)

### Test 1 - API status
1. Ouvre l'URL:
   - `https://script.google.com/macros/s/.../exec?action=status`
2. Tu dois voir du JSON:
   - `"ok": true`
3. Test lecture complete:
   - `https://script.google.com/macros/s/.../exec?action=listAars&accessKey=TA_CLE_AAR_ACCESS_KEY`
   - tu dois voir `action: "listAars"` et `count` > 0.
4. Test catalogue mission:
   - `https://script.google.com/macros/s/.../exec?action=getCatalog&accessKey=TA_CLE_AAR_ACCESS_KEY`
   - tu dois voir `catalog.hashtags/countries/oaci/operations/exercises`.

### Test 2 - PWA QWI
1. Ouvre la PWA QWI sur iPad.
2. Verifie:
   - plus de bouton nuage.
3. Ouvre un AAR -> `Modifier`.
4. Change un champ.
5. Clique `Enregistrer vers HUB QWI`.
6. Recharge la liste:
   - la modif doit etre presente.
7. Verifie dans Drive:
   - le JSON du dossier cible est mis a jour.
8. Test administration referentiels (nouvel onglet HUB QWI):
   - ouvre l'onglet `Administration` dans le HUB QWI,
   - ajoute un element dans `Pays` (ou `OACI`, `Operations`, `Exercices`, `Hashtags`),
   - verifie qu'il apparait dans `getCatalog`,
   - ouvre ensuite l'appli AAR: l'element doit apparaitre comme choix possible.

### Test 3 - Suppression
1. Supprime un AAR depuis le HUB QWI.
2. Verifie dans Drive:
   - le fichier est place en corbeille.

---

## 7) Mise a jour Apps Script (versions)

A chaque changement du code Apps Script:
1. Modifie `Code.gs`.
2. `Deployer` -> `Gerer les deploiements`.
3. Edite le deploiement web existant.
4. Choisis `Nouvelle version`.
5. `Deployer`.

L'URL `/exec` reste la meme.

---

## 8) Depannage

### Erreur "Apps Script HTTP 401/403/500"
1. Ouvre Apps Script -> `Executions` (barre gauche).
2. Regarde le message detaille.
3. Verifie:
   - `AAR_ACCESS_KEY` identique entre Script Properties et `config.js`,
   - `AAR_FOLDER_ID` correct,
   - deploiement web toujours actif.

### Rien ne se passe dans la PWA
1. Force refresh (iPad Safari):
   - vider donnees du site,
   - reouvrir la PWA.
2. Verifie que `index.html` charge bien la derniere version JS.

### Fichier cree au lieu de mis a jour
1. Verifie que `driveFileId` est bien present dans le record edite.
2. Si le fichier d'origine a ete supprime/deplace, l'API recree un nouveau fichier (comportement normal).

---

## 9) Securite recommandee (niveau pratique)

1. Utiliser une cle `AAR_ACCESS_KEY` longue et non evidente.
2. Ne pas diffuser `config.js` en dehors du repo/app cible.
3. Tourner la cle si fuite:
   - changer `AAR_ACCESS_KEY` dans Apps Script,
   - mettre a jour `config.js`,
   - redeployer.

---

## 10) Ce que ce mode change pour le QWI sur iPad

1. Plus de popup OAuth Google Drive.
2. Plus de clic sur le nuage pour connecter.
3. Experience quasi sans friction:
   - ouvrir,
   - modifier,
   - enregistrer.
