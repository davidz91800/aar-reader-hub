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

## Mode recommande (Apps Script + Drive)

### Setup minimal (admin)

1. Deployer le backend Apps Script unique (`apps-script/Code.gs`).
2. Recuperer l'URL `/exec` + `AAR_ACCESS_KEY`.
3. Garder le dossier Drive des JSON comme source metier.
4. Renseigner `config.js`:

```js
window.AAR_READER_CONFIG = {
  autoSyncOnStartup: false,
  appsScript: {
    enabled: true,
    webAppUrl: "https://script.google.com/macros/s/.../exec",
    accessKey: "AAR-READER-HUB-QWI"
  }
};
```

## Fonctionnement

- Au demarrage:
  - avec reseau: synchro Drive (si config ok) ou source statique
  - sans reseau: lecture du cache local (IndexedDB)
- Bouton `Synchroniser Drive` pour forcer la synchro.
- Modif/ajout/suppression passent par Apps Script vers Drive.
- Si Drive est indisponible, le cache local est conserve.

## Architecture recommandee avec le hub non QWI

Pour que les utilisateurs non QWI voient les nouveaux AAR sans push GitHub de donnees:

1. L'automation ingest Apps Script ecrit les nouveaux JSON en Drive.
2. Ce hub QWI edite les JSON via Apps Script.
3. Le hub non QWI lit via Apps Script (`listAars`).

Conseil iPad/PWA:
- Verifier les referers autorises de la cle API du hub non QWI (domaine reel, pas uniquement localhost).

## Lancement alternatif

Hebergement statique possible (GitHub Pages, SharePoint static, etc.).
Dans tous les cas, utiliser HTTP/HTTPS et pas `file://`.
