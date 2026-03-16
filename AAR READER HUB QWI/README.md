# E - AAR READER HUB

PWA lecture seule pour consulter les AAR.

## Demarrage utilisateur (simple)

Ne pas ouvrir `index.html` en double-clic.

1. Ouvrir ce dossier.
2. Double-cliquer `0 - OUVRIR AAR READER HUB.bat`.
3. L'application s'ouvre sur `http://localhost:8080/index.html`.

Si `index.html` est ouvert en `file://`, l'app affiche maintenant une aide a l'ecran.

## Structure du dossier

- `0 - OUVRIR AAR READER HUB.bat` : point d'entree utilisateur.
- `AAR Reader Data/` : donnees JSON lues par l'application.
- `index.html`, `app.js`, `styles.css`, `config.js` : coeur de la PWA.

## Mode Google Drive (gratuit)

Cette app lit des fichiers JSON AAR publics depuis Google Drive.

### Setup minimal (admin)

1. Creer un dossier Google Drive pour les AAR JSON.
2. Partager les fichiers/dossier en lecture.
3. Activer Google Drive API dans Google Cloud Console.
4. Creer une API key.
5. Renseigner `config.js`:

```js
window.AAR_READER_CONFIG = {
  autoSyncOnStartup: true,
  googleDrive: {
    apiKey: "TON_API_KEY",
    folderId: "ID_DU_DOSSIER_DRIVE",
    indexFileId: ""
  }
};
```

Option: `indexFileId` peut pointer vers un `index.json` public contenant la liste des fichiers.

Mode recommande iPad:
- `indexFileId` renseigne
- `folderId` vide
- `apiKey` possible vide si `index.json` et les AAR sont publics
- tous les fichiers AAR partages en lecture ("Toute personne ayant le lien")

Le Reader telecharge les JSON via `drive.usercontent.google.com`.
En mode hybride, l'app peut basculer automatiquement sur `AAR Reader Data/index.json` si Drive est indisponible.

## Fonctionnement

- Au demarrage:
  - avec reseau: synchro Drive (si config ok) ou source statique
  - sans reseau: lecture du cache local (IndexedDB)
- Bouton `Synchroniser Drive` pour forcer la synchro.
- Application en lecture seule (pas d'edition des AAR).

## Lancement alternatif

Hebergement statique possible (GitHub Pages, SharePoint static, etc.).
Dans tous les cas, utiliser HTTP/HTTPS et pas `file://`.
