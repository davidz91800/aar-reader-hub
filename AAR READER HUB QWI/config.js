/**
 * ============================================================
 * RETEX HUB QWI - CONFIGURATION EDITION + LECTURE
 * ============================================================
 * Ce fichier est la config de la variante QWI (ajout/modif/suppression).
 *
 * Architecture cible (2026-03):
 * - un backend Apps Script UNIQUE pour les 3 PWA.
 * - AUTOMATION 1 (Web App API): doGet/doPost.
 * - AUTOMATION 2 (Email -> Drive): runIngestEmailsToDrive trigger.
 * - ce hub QWI lit/edite via action=listAars/upsert/delete/setCatalog.
 * - le push GitHub des JSON n'est plus requis en nominal.
 *
 * Principe technique:
 * - "local" = valeurs forcees pour le HUB QWI.
 * - "shared" = valeurs detectees si une config globale existe deja.
 * - priorite: local > shared > vide.
 * ============================================================
 */
(function mergeQwiConfig(global) {
  const shared = global.AAR_READER_CONFIG || {};
  const sharedDrive = shared.googleDrive || {};
  const sharedStatic = shared.staticRepo || {};

    // Parametres specifiques QWI (source de verite de ce hub).
  const local = {
    // En QWI, on synchronise aussi au demarrage pour reduire la latence visible.
    autoSyncOnStartup: true,

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
      // Endpoint /exec UNIQUE partage par les 3 PWA.
      webAppUrl: "https://script.google.com/macros/s/AKfycbyR4B_bo7J7mHPE-oEvjVay3xx8-5tmiOex3TfTWr4V3a1xlCmZpQer8dy6dKJn3c9P/exec",
      // Doit matcher la Script Property AAR_ACCESS_KEY.
      accessKey: "AAR-READER-HUB-QWI",
      timeoutMs: 25000
    },

    staticRepo: {
      // Fallback statique desactive en QWI (secours possible si besoin).
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
