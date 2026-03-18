/**
 * ============================================================
 * RETEX HUB QWI - CONFIGURATION EDITION + LECTURE
 * ============================================================
 * Ce fichier est la config de la variante QWI (ajout/modif/suppression).
 *
 * Principe:
 * - "local" = valeurs forcees pour le HUB QWI.
 * - "shared" = valeurs existantes si une config globale a deja ete chargee.
 * - priorite appliquee ici: local > shared > valeur vide.
 *
 * Pourquoi ce merge:
 * - garder une compatibilite si le hub QWI est embarque ailleurs,
 * - tout en imposant ses parametres critiques (Apps Script et dossier Drive).
 * ============================================================
 */
(function mergeQwiConfig(global) {
  const shared = global.AAR_READER_CONFIG || {};
  const sharedDrive = shared.googleDrive || {};
  const sharedStatic = shared.staticRepo || {};

  // Parametres specifiques QWI (source de verite de ce hub).
  const local = {
    // En QWI, on laisse l'utilisateur declencher la sync (moins d'effets de bord).
    autoSyncOnStartup: false,

    googleDrive: {
      // OAuth + API Drive pour compatibilite (lecture/API front si necessaire).
      oauthClientId: "100011978859-sc6aj28as11aqeqmrubrb4rccocvqe9r.apps.googleusercontent.com",
      apiKey: "AIzaSyAIOITquStWBYg6eLA0hPR7etSct16u2ts",
      // Dossier metier des JSON AAR partages.
      folderId: "18RTzOZzYWEIFWS5NXyYA_Ts3Xyf2X5kX",
      // Optionnel: index Drive public (vide = listing dossier).
      indexFileId: ""
    },

    appsScript: {
      // true = backend prioritaire (recommande iPad/PWA).
      enabled: true,
      // Endpoint /exec du backend QWI (listAars/upsert/delete/getCatalog/setCatalog).
      webAppUrl: "https://script.google.com/macros/s/AKfycbzAB36XlBoE5vo1fSfxeMkn05r6FrUlFkEw8iAxiEaTsj1maU82c4d9GgB7W6p72rOPSg/exec",
      // Doit matcher la Script Property AAR_ACCESS_KEY.
      accessKey: "AAR-READER-HUB-QWI",
      timeoutMs: 25000
    },

    staticRepo: {
      // Fallback statique desactive en QWI (on veut privilegier Drive/backend).
      enabled: false,
      indexUrl: "./AAR Reader Data/index.json"
    }
  };

  global.AAR_READER_CONFIG = {
    autoSyncOnStartup: typeof shared.autoSyncOnStartup === "boolean" ? shared.autoSyncOnStartup : local.autoSyncOnStartup,

    googleDrive: {
      oauthClientId: local.googleDrive.oauthClientId || sharedDrive.oauthClientId || "",
      apiKey: local.googleDrive.apiKey || sharedDrive.apiKey || "",
      folderId: local.googleDrive.folderId || sharedDrive.folderId || "",
      indexFileId: local.googleDrive.indexFileId || sharedDrive.indexFileId || ""
    },

    appsScript: {
      enabled: typeof local.appsScript.enabled === "boolean"
        ? local.appsScript.enabled
        : !!(shared.appsScript && shared.appsScript.enabled),
      webAppUrl: String(local.appsScript.webAppUrl || (shared.appsScript && shared.appsScript.webAppUrl) || "").trim(),
      accessKey: String(local.appsScript.accessKey || (shared.appsScript && shared.appsScript.accessKey) || "").trim(),
      timeoutMs: Number(local.appsScript.timeoutMs || (shared.appsScript && shared.appsScript.timeoutMs) || 25000)
    },

    staticRepo: {
      enabled: typeof local.staticRepo.enabled === "boolean" ? local.staticRepo.enabled : (sharedStatic.enabled !== false),
      indexUrl: local.staticRepo.indexUrl || sharedStatic.indexUrl || "./AAR Reader Data/index.json"
    }
  };
})(window);
