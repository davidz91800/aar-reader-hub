/**
 * AAR Reader Hub QWI - Apps Script backend
 * Purpose:
 * - upsert JSON AAR files in Google Drive
 * - delete JSON AAR files in Google Drive
 * Called by the QWI web app (GitHub Pages / iPad PWA).
 *
 * Script Properties expected (optional but recommended):
 * - AAR_ACCESS_KEY: shared secret with the web app config (appsScript.accessKey)
 * - AAR_FOLDER_ID: default Drive folder id used when payload.folderId is missing
 */

function doGet(e) {
  try {
    var action = String((e && e.parameter && e.parameter.action) || "").trim().toLowerCase();
    if (action === "status") {
      return jsonOutput_({
        ok: true,
        service: "aar-reader-hub-qwi",
        version: "2026-03-17",
        now: new Date().toISOString()
      });
    }
    return jsonOutput_({
      ok: true,
      message: "Use POST with JSON body: action=upsert|delete"
    });
  } catch (error) {
    return errorOutput_(error);
  }
}

function doPost(e) {
  try {
    var payload = parsePayload_(e);
    var cfg = readScriptConfig_();
    assertAccess_(payload.accessKey, cfg);

    var action = String(payload.action || "").trim().toLowerCase();
    if (action === "upsert") return handleUpsert_(payload, cfg);
    if (action === "delete") return handleDelete_(payload);

    throw new Error("Action unsupported. Expected: upsert or delete.");
  } catch (error) {
    return errorOutput_(error);
  }
}

function readScriptConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    accessKey: String(props.getProperty("AAR_ACCESS_KEY") || "").trim(),
    defaultFolderId: String(props.getProperty("AAR_FOLDER_ID") || "").trim()
  };
}

function parsePayload_(e) {
  var raw = String((e && e.postData && e.postData.contents) || "").trim();
  if (!raw) throw new Error("Empty request body.");
  var parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON payload.");
  return parsed;
}

function assertAccess_(incomingKey, cfg) {
  if (!cfg.accessKey) return;
  if (String(incomingKey || "").trim() !== cfg.accessKey) {
    throw new Error("Unauthorized: invalid access key.");
  }
}

function handleUpsert_(payload, cfg) {
  var driveFileId = String(payload.driveFileId || "").trim();
  var folderId = String(payload.folderId || cfg.defaultFolderId || "").trim();
  var mission = (payload.mission && typeof payload.mission === "object") ? payload.mission : {};
  var fileName = sanitizeFileName_(String(payload.fileName || "").trim() || buildFallbackName_(mission));

  if (!driveFileId && !folderId) {
    throw new Error("Missing folderId (payload.folderId or Script Property AAR_FOLDER_ID).");
  }

  var jsonText = JSON.stringify(mission, null, 2);
  var file = null;

  if (driveFileId) {
    try {
      file = DriveApp.getFileById(driveFileId);
      file.setContent(jsonText);
      if (fileName) file.setName(fileName);
    } catch (error) {
      // If an id was provided but cannot be updated, fallback to create a new file.
      file = null;
    }
  }

  if (!file) {
    var folder = DriveApp.getFolderById(folderId);
    var blob = Utilities.newBlob(jsonText, "application/json", fileName);
    file = folder.createFile(blob);
  }

  return jsonOutput_({
    ok: true,
    action: "upsert",
    file: {
      id: file.getId(),
      name: file.getName(),
      modifiedTime: file.getLastUpdated().toISOString()
    }
  });
}

function handleDelete_(payload) {
  var driveFileId = String(payload.driveFileId || "").trim();
  if (!driveFileId) throw new Error("Missing driveFileId for delete action.");

  var file = DriveApp.getFileById(driveFileId);
  file.setTrashed(true);

  return jsonOutput_({
    ok: true,
    action: "delete",
    file: {
      id: driveFileId
    }
  });
}

function sanitizeFileName_(name) {
  var base = String(name || "aar.json")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
  if (!base) base = "aar.json";
  if (!/\.json$/i.test(base)) base += ".json";
  return base;
}

function buildFallbackName_(mission) {
  var meta = mission && mission.meta ? mission.meta : {};
  var date = String(meta.date || "").trim() || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var title = slug_(String(meta.title || "").trim() || "aar");
  return date + "_" + title + ".json";
}

function slug_(value) {
  var out = String(value || "").toLowerCase();
  out = out.replace(/[^\w\- ]+/g, "");
  out = out.replace(/\s+/g, "-").replace(/\-+/g, "-").replace(/^\-+|\-+$/g, "");
  return out || "aar";
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorOutput_(error) {
  return jsonOutput_({
    ok: false,
    error: String(error && error.message ? error.message : error)
  });
}
