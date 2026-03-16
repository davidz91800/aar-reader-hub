# E - AAR READER HUB QWI

PWA QWI pour consulter, modifier, supprimer et ajouter des AAR.

## Demarrage utilisateur (simple)

Ne pas ouvrir `index.html` en double-clic.

1. Ouvrir ce dossier.
2. Double-cliquer `0 - OUVRIR AAR READER HUB.bat`.
3. L'application s'ouvre sur `http://localhost:18081/.../AAR READER HUB QWI/index.html`.

Si `index.html` est ouvert en `file://`, l'app affiche maintenant une aide a l'ecran.

## Structure du dossier

- `0 - OUVRIR AAR READER HUB.bat` : point d'entree utilisateur.
- `AAR Reader Data/` : donnees JSON lues par l'application.
- `index.html`, `app.js`, `styles.css`, `config.js` : coeur de la PWA.
- `qwi-mode.js` : mode edition + bridge vers `C - AAR PWA/AAR.html`.

## Edition QWI

- `Nouveau` / `Modifier` ouvrent le formulaire embarque: `aar-pwa/AAR.html` (compatible web/iPad).
- Le dossier `aar-pwa/` est une copie de deploiement du formulaire source `C - AAR PWA`.
- `Supprimer` retire l'AAR localement et sur Drive (si configure).
- Le retour d'edition se fait automatiquement vers le hub QWI.

## Mode Google Drive (lecture + ecriture)

### Setup minimal (admin)

1. Creer un dossier Google Drive pour les AAR JSON.
2. Partager le dossier avec les utilisateurs editeurs.
3. Activer Google Drive API dans Google Cloud Console.
4. Creer une API key.
5. Creer un OAuth Client ID (application web) autorise sur ton domaine/localhost.
6. Renseigner `config.js`:

```js
window.AAR_READER_CONFIG = {
  autoSyncOnStartup: false,
  googleDrive: {
    oauthClientId: "TON_OAUTH_CLIENT_ID",
    apiKey: "TON_API_KEY",
    folderId: "ID_DU_DOSSIER_DRIVE",
    indexFileId: ""
  }
};
```

Option: `indexFileId` peut pointer vers un `index.json` public contenant la liste des fichiers.

## Fonctionnement

- Au demarrage:
  - avec reseau: synchro Drive (si config ok) ou source statique
  - sans reseau: lecture du cache local (IndexedDB)
- Bouton `Synchroniser Drive` pour forcer la synchro.
- Bouton nuage: connexion Google Drive (OAuth) pour autoriser les ecritures.
- Important: la premiere ecriture de la session exige de cliquer sur le nuage avant de sauver une edition.
- Modif/ajout/suppression poussent vers Drive si OAuth + folderId sont configures.
- Si push Drive echoue, la modif reste locale (message explicite).

## Architecture recommandee avec le hub non QWI

Pour que les utilisateurs non QWI voient les nouveaux AAR sans push GitHub:

1. Ce hub QWI ecrit dans Drive (OAuth + folderId).
2. Le hub non QWI lit Drive directement.
3. La source statique locale reste seulement en fallback.

Conseil iPad/PWA:
- Verifier les referers autorises de la cle API du hub non QWI (domaine reel, pas uniquement localhost).

## Lancement alternatif

Hebergement statique possible (GitHub Pages, SharePoint static, etc.).
Dans tous les cas, utiliser HTTP/HTTPS et pas `file://`.
