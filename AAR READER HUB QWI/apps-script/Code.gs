/**
 * AAR Reader Hub QWI - Apps Script backend
 * Purpose:
 * - upsert/delete JSON AAR files in Google Drive
 * - read/write shared mission catalog (hashtags/countries/OACI/operations/exercises)
 * Called by QWI Hub and AAR app.
 *
 * Script Properties expected (optional but recommended):
 * - AAR_ACCESS_KEY: shared secret with web apps (appsScript.accessKey)
 * - AAR_FOLDER_ID: default Drive folder id used when payload.folderId is missing
 * - AAR_CATALOG_JSON: full catalog object
 * - AAR_HASHTAGS_JSON: legacy hashtag array (kept for backward compatibility)
 */

var CATALOG_PROPERTY = "AAR_CATALOG_JSON";
var LEGACY_HASHTAG_PROPERTY = "AAR_HASHTAGS_JSON";

function doGet(e) {
  try {
    var cfg = readScriptConfig_();
    var action = String((e && e.parameter && e.parameter.action) || "").trim().toLowerCase();

    if (action === "status") {
      return jsonOutput_({
        ok: true,
        service: "aar-reader-hub-qwi",
        version: "2026-03-17",
        now: new Date().toISOString()
      });
    }

    if (action === "listaars") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return handleListAars_(e && e.parameter ? e.parameter : {}, cfg);
    }

    if (action === "gethashtags" || action === "hashtags") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return jsonOutput_({
        ok: true,
        action: "getHashtags",
        hashtags: readCatalog_().hashtags
      });
    }

    if (action === "getcatalog" || action === "catalog") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return jsonOutput_({
        ok: true,
        action: "getCatalog",
        catalog: readCatalog_()
      });
    }

    return jsonOutput_({
      ok: true,
      message: "Use POST action=upsert|delete|setHashtags|setCatalog or GET action=status|getHashtags|getCatalog|listAars"
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
    if (action === "sethashtags") return handleSetHashtags_(payload);
    if (action === "setcatalog") return handleSetCatalog_(payload);

    throw new Error("Action unsupported. Expected: upsert, delete, setHashtags or setCatalog.");
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
    file: { id: driveFileId }
  });
}

function handleSetHashtags_(payload) {
  var catalog = readCatalog_();
  catalog.hashtags = normalizeCatalogArray_(payload.hashtags, "hashtag");
  writeCatalog_(catalog);
  return jsonOutput_({
    ok: true,
    action: "setHashtags",
    count: catalog.hashtags.length,
    hashtags: catalog.hashtags
  });
}

function handleSetCatalog_(payload) {
  var incoming = payload && payload.catalog ? payload.catalog : payload;
  var normalized = normalizeCatalogObject_(incoming);
  writeCatalog_(normalized);
  return jsonOutput_({
    ok: true,
    action: "setCatalog",
    catalog: normalized
  });
}

function handleListAars_(params, cfg) {
  var folderId = String((params && params.folderId) || cfg.defaultFolderId || "").trim();
  if (!folderId) {
    throw new Error("Missing folderId (query.folderId or Script Property AAR_FOLDER_ID).");
  }

  var folder = DriveApp.getFolderById(folderId);
  var it = folder.getFiles();
  var files = [];
  var errors = [];
  var limit = 1200;

  while (it.hasNext() && files.length < limit) {
    var file = it.next();
    var name = String(file.getName() || "");
    var mime = String(file.getMimeType() || "").toLowerCase();
    if (!/\.json$/i.test(name) && mime !== "application/json") continue;

    try {
      var text = file.getBlob().getDataAsString();
      var parsed = JSON.parse(text);
      files.push({
        id: file.getId(),
        name: name,
        modifiedTime: file.getLastUpdated().toISOString(),
        aar: parsed
      });
    } catch (error) {
      errors.push({
        id: file.getId(),
        name: name,
        error: String(error && error.message ? error.message : error)
      });
    }
  }

  files.sort(function(a, b) {
    return String(b.modifiedTime || "").localeCompare(String(a.modifiedTime || ""));
  });

  return jsonOutput_({
    ok: true,
    action: "listAars",
    count: files.length,
    files: files,
    errors: errors
  });
}

function normalizeCatalogObject_(input) {
  var src = (input && typeof input === "object") ? input : {};
  return {
    hashtags: normalizeCatalogArray_(src.hashtags, "hashtag"),
    countries: normalizeCatalogArray_(src.countries, "text"),
    oaci: normalizeCatalogArray_(src.oaci, "oaci"),
    operations: normalizeCatalogArray_(src.operations, "text"),
    exercises: normalizeCatalogArray_(src.exercises, "text")
  };
}

function normalizeCatalogArray_(values, kind) {
  var source = Array.isArray(values) ? values : [];
  var out = [];
  var seen = {};

  for (var i = 0; i < source.length; i++) {
    var norm = normalizeCatalogValue_(source[i], kind);
    if (!norm) continue;
    var key = norm.toUpperCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(norm);
  }

  out.sort(function(a, b) { return a.localeCompare(b); });
  return out;
}

function normalizeCatalogValue_(value, kind) {
  var text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";

  if (kind === "hashtag") {
    text = text.replace(/\s+/g, "-");
    if (text.charAt(0) !== "#") text = "#" + text;
    return text;
  }

  if (kind === "oaci") {
    return text.toUpperCase();
  }

  return text;
}

function readCatalog_() {
  var props = PropertiesService.getScriptProperties();
  var raw = String(props.getProperty(CATALOG_PROPERTY) || "").trim();

  if (raw) {
    try {
      return normalizeCatalogObject_(JSON.parse(raw));
    } catch (error) {
      // fallback legacy migration below
    }
  }

  var legacyTags = [];
  var rawLegacy = String(props.getProperty(LEGACY_HASHTAG_PROPERTY) || "").trim();
  if (rawLegacy) {
    try {
      legacyTags = JSON.parse(rawLegacy);
    } catch (error) {
      legacyTags = [];
    }
  }

  return normalizeCatalogObject_({ hashtags: legacyTags });
}

function writeCatalog_(catalog) {
  var normalized = normalizeCatalogObject_(catalog);
  var props = PropertiesService.getScriptProperties();
  props.setProperty(CATALOG_PROPERTY, JSON.stringify(normalized));
  props.setProperty(LEGACY_HASHTAG_PROPERTY, JSON.stringify(normalized.hashtags));
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
