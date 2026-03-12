# E - AAR READER HUB

PWA lecture seule pour consulter et analyser les AAR centralises.

## Mode Google Drive (gratuit)

Cette app lit des fichiers JSON AAR publics depuis Google Drive via Google Drive API.

### Setup minimal (admin)

1. Creer un dossier Google Drive pour les AAR JSON.
2. Partager les fichiers/dossier en lecture (visibilite publique selon ta politique).
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

Recommande (sans OAuth): utiliser `indexFileId` et laisser `folderId` vide.
Exemple `index.json`:

```json
{
  "files": [
    { "id": "FILE_ID_1", "name": "2026-03-12_aar_01.json", "resourceKey": "" },
    { "id": "FILE_ID_2", "name": "2026-03-12_aar_02.json", "resourceKey": "" }
  ]
}
```

## Fonctionnement

- Au demarrage:
  - avec reseau: synchro Drive auto (si config ok)
  - sans reseau: lecture du cache local (IndexedDB)
- Bouton `Synchroniser Drive` pour forcer la synchro.
- Application en lecture seule (pas d'edition des AAR).

## Lancement

Ouvrir `index.html` depuis un serveur HTTP local ou un hebergement statique (GitHub Pages, SharePoint static, etc.).
