/**
 * ============================================================
 * RETEX HUB NON QWI - CONFIGURATION CENTRALE
 * ============================================================
 * Ce fichier configure uniquement le HUB LECTEUR (non QWI).
 *
 * Architecture cible (2026-03):
 * - 1 backend Apps Script UNIQUE pour les 3 PWA.
 * - AUTOMATION 1 (Web App API): doGet/doPost.
 * - AUTOMATION 2 (Email -> Drive): runIngestEmailsToDrive trigger.
 * - Le hub NON QWI lit les AAR via action=listAars.
 * - Le push GitHub des JSON n'est plus requis en nominal.
 *
 * Ordre de lecture:
 * 1) appsScript (recommande)
 * 2) googleDrive API front (secours)
 * 3) staticRepo (secours ultime, desactive par defaut)
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
    // true = source prioritaire pour lecture (Web App Apps Script unique).
    enabled: true,
    // Endpoint /exec partage par HUB NON QWI, HUB QWI et AAR PWA.
    webAppUrl: "https://script.google.com/macros/s/AKfycbyR4B_bo7J7mHPE-oEvjVay3xx8-5tmiOex3TfTWr4V3a1xlCmZpQer8dy6dKJn3c9P/exec",
    // Cle partagee (Script Property AAR_ACCESS_KEY).
    accessKey: "AAR-READER-HUB-QWI",
    // Timeout reseau des appels backend (ms).
    timeoutMs: 25000
  },

  staticRepo: {
    // true = autorise le fallback sur donnees statiques du repo (secours uniquement).
    enabled: false,
    // Index local GitHub Pages (fallback uniquement).
    indexUrl: "./AAR Reader Data/index.json"
  }
};
