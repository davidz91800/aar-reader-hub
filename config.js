/**
 * ============================================================
 * RETEX HUB NON QWI - CONFIGURATION CENTRALE
 * ============================================================
 * Ce fichier configure uniquement le HUB LECTEUR (non QWI).
 *
 * Sources possibles de donnees, dans l'ordre de priorite:
 * 1) appsScript (recommande): lecture listAars/getCatalog via Web App.
 * 2) googleDrive (API front): lecture directe Drive depuis le navigateur.
 * 3) staticRepo: fallback local GitHub (AAR Reader Data/index.json).
 *
 * Note architecture:
 * - L'automation email -> Drive -> GitHub est un script distinct.
 * - Le backend QWI (upsert/delete/catalog) est un autre script distinct.
 * ============================================================
 */
window.AAR_READER_CONFIG = {
  // true = tente une synchro automatique au chargement de la PWA.
  autoSyncOnStartup: true,

  googleDrive: {
    // OAuth client pour appels Drive interactifs (utile en mode API front).
    oauthClientId: "100011978859-sc6aj28as11aqeqmrubrb4rccocvqe9r.apps.googleusercontent.com",
    // Cle API Drive (lecture front) - soumise aux restrictions referrer.
    apiKey: "AIzaSyAIOITquStWBYg6eLA0hPR7etSct16u2ts",
    // Dossier Drive contenant les JSON AAR (source metier).
    folderId: "18RTzOZzYWEIFWS5NXyYA_Ts3Xyf2X5kX",
    // Optionnel: fichier index public Drive. Laisser vide = listing dossier.
    indexFileId: ""
  },

  appsScript: {
    // true = priorite a la lecture via Web App Apps Script (plus fiable en PWA).
    enabled: true,
    // Endpoint /exec du backend Apps Script actif.
    webAppUrl: "https://script.google.com/macros/s/AKfycbzAB36XlBoE5vo1fSfxeMkn05r6FrUlFkEw8iAxiEaTsj1maU82c4d9GgB7W6p72rOPSg/exec",
    // Cle partagee validee cote Apps Script (AAR_ACCESS_KEY).
    accessKey: "AAR-READER-HUB-QWI",
    // Timeout reseau des appels backend (ms).
    timeoutMs: 25000
  },

  staticRepo: {
    // true = autorise le fallback sur donnees statiques du repo.
    enabled: false,
    // Index local GitHub Pages (fallback uniquement).
    indexUrl: "./AAR Reader Data/index.json"
  }
};
