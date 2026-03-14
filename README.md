# E - AAR READER HUB

PWA lecture seule pour consulter et analyser les AAR centralises.

## Mode Google Drive (gratuit)

Cette app lit des fichiers JSON AAR publics depuis Google Drive.

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

Mode recommande iPad:
- `indexFileId` renseigne
- `folderId` vide
- `apiKey` peut etre vide si `index.json` et les AAR sont publics
- tous les fichiers AAR doivent etre partages en lecture ("Toute personne ayant le lien")

Le Reader telecharge les JSON via `drive.usercontent.google.com` (compatible CORS navigateur, y compris iPad PWA).
En mode hybride, l'app peut basculer automatiquement sur un index statique GitHub (`AAR Reader Data/index.json`) si Drive est temporairement bloque.

## Fonctionnement

- Au demarrage:
  - avec reseau: synchro Drive auto (si config ok)
  - sans reseau: lecture du cache local (IndexedDB)
- Bouton `Synchroniser Drive` pour forcer la synchro.
- Application en lecture seule (pas d'edition des AAR).

## Mode "ultra ergonomique" (drag/drop email)

Objectif: glisser un email dans un dossier et avoir automatiquement un JSON AAR exploitable par tous les iPads.

1. Lancer `start-email-drop-watcher.bat` sur ton poste admin.
2. Glisser/deposer tes emails dans:
   - `AAR Reader Data/_EMAIL_DROP`
3. Le watcher extrait le bloc JSON (`---BEGIN-AAR-JSON--- ... ---END-AAR-JSON---`) et cree un fichier `.json` dans:
   - `AAR Reader Data`
4. Les emails traites sont archives dans:
   - `AAR Reader Data/_EMAIL_DONE`
5. Si echec d'extraction:
   - `AAR Reader Data/_EMAIL_ERROR`
6. Sur les iPads: ouvrir la PWA et cliquer `Synchroniser Drive` (ou relancer l'app si auto-sync active).

Extensions supportees en entree: `.eml`, `.msg`, `.txt`, `.json`.

Le watcher fait maintenant l'auto-push GitHub apres extraction (commit + push automatiques des fichiers `AAR Reader Data`).
Important: ne lancer qu'une seule instance du watcher (un lock est applique pour eviter les doublons).
Il surveille aussi les ajouts/suppressions/modifications manuels de `.json` dans `AAR Reader Data` et publie automatiquement.

Note: le watcher met aussi a jour `AAR Reader Data/index.json` automatiquement pour la source statique.

## Mode Cloud 100% (sans PC allume)

Un pipeline Google Apps Script est disponible dans:

- `cloud-automation/README.md`
- `cloud-automation/apps-script/Code.gs`

Ce mode traite les emails directement dans le cloud, ecrit les JSON dans Drive, puis pousse automatiquement les donnees vers GitHub.

## Publication en 1 clic (apres ajout manuel de JSON)

Si tu ajoutes un `.json` directement dans `AAR Reader Data`, lance:
- `publish-reader-data.bat`

Ce script:
1. reconstruit `AAR Reader Data/index.json`
2. commit les JSON + index
3. push sur GitHub

Sans ce push, les iPads ne verront pas les nouveaux AAR.

## Lancement

Ouvrir `index.html` depuis un serveur HTTP local ou un hebergement statique (GitHub Pages, SharePoint static, etc.).
