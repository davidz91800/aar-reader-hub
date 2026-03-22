# D - AAR READER HUB

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

## Mode recommande (Apps Script + Drive)

Cette app lit les JSON AAR via un backend Apps Script unique (partage avec HUB QWI et AAR PWA).

### Setup minimal (admin)

1. Deployer le backend Apps Script (`apps-script/Code.gs` cote QWI).
2. Recuperer l'URL `/exec` et la cle `AAR_ACCESS_KEY`.
3. Renseigner `config.js`:

```js
window.AAR_READER_CONFIG = {
  autoSyncOnStartup: true,
  appsScript: {
    enabled: true,
    webAppUrl: "https://script.google.com/macros/s/.../exec",
    accessKey: "AAR-READER-HUB-QWI"
  }
};
```

## Architecture recommandee (QWI + non QWI)

Objectif: ne plus dependre d'un push GitHub de donnees pour voir les nouveaux AAR.

1. Email AAR -> automation Apps Script ingest -> Drive.
2. HUB QWI edite via Apps Script (`upsert/delete`).
3. HUB NON QWI lit via Apps Script (`listAars`).
4. Le push GitHub reste utile pour le code front, pas pour les JSON metier.

Pour iPad/PWA:
- Si tu utilises une API key, ajoute le domaine reel de publication dans les referers autorises (pas seulement `localhost`).
- Si tu veux eviter les contraintes de referer, utilise `indexFileId` public et laisse `apiKey` vide (lecture publique).

## Fonctionnement

- Au demarrage:
  - avec reseau: synchro Drive (si config ok) ou source statique
  - sans reseau: lecture du cache local (IndexedDB)
- Bouton `Synchroniser Drive` pour forcer la synchro.
- Application en lecture seule (pas d'edition des AAR).

## Lancement alternatif

Hebergement statique possible (GitHub Pages, SharePoint static, etc.).
Dans tous les cas, utiliser HTTP/HTTPS et pas `file://`.
