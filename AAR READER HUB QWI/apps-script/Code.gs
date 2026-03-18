/**
 * ============================================================
 * RETEX - BACKEND APPS SCRIPT UNIQUE (3 PWA)
 * ============================================================
 * Ce projet regroupe 2 automations dans UN seul Apps Script:
 *
 * AUTOMATION 1 - WEB APP API (HUB NON QWI + HUB QWI + AAR PWA)
 *   - GET  action=status|listAars|getCatalog|getHashtags|ingestStatus|runIngest|debugLatestMessage|resetIngestState|retryIngest
 *   - POST action=upsert|delete|setCatalog|setHashtags
 *
 * AUTOMATION 2 - INGEST EMAIL -> DRIVE (trigger horaire)
 *   - runIngestEmailsToDrive()
 *   - setupIngestTriggerEvery5Minutes()
 *   - deleteIngestTriggers()
 *
 * Important:
 * - Le push GitHub n'est plus requis pour le fonctionnement nominal.
 * - Les 3 PWA lisent/editent directement via cette API + Drive.
 * - Le referentiel officiel n'est JAMAIS enrichi automatiquement par l'ingest email.
 *   Il est pilote uniquement par le HUB QWI via l'action setCatalog.
 * ============================================================
 */

/* =========================
 * 0) CONSTANTES
 * ========================= */
var SCRIPT_VERSION = "2026-03-18";
var SERVICE_NAME = "retex-aar-backend-unified";

var CATALOG_PROPERTY = "AAR_CATALOG_JSON";
var LEGACY_HASHTAG_PROPERTY = "AAR_HASHTAGS_JSON";
var INGEST_STATE_PROPERTY = "AAR_INGEST_STATE_JSON";
var INGEST_LAST_SUMMARY_PROPERTY = "AAR_INGEST_LAST_SUMMARY_JSON";

var DEFAULTS = Object.freeze({
  ingestEnabled: true,
  ingestMailQuery: "to:david.zemmour3@gmail.com newer_than:30d",
  ingestMaxThreadsPerRun: 20,
  ingestErrorLabel: "AAR_READER_ERROR",
  ingestTriggerMinutes: 1
});

/* =========================
 * 1) WEB APP API
 * ========================= */
function doGet(e) {
  try {
    var cfg = readScriptConfig_();
    var action = String((e && e.parameter && e.parameter.action) || "").trim().toLowerCase();

    if (action === "status") return handleStatus_(cfg);

    if (action === "listaars") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return handleListAars_(e && e.parameter ? e.parameter : {}, cfg);
    }

    if (action === "getcatalog" || action === "catalog") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return jsonOutput_({ ok: true, action: "getCatalog", catalog: readCatalog_() });
    }

    if (action === "gethashtags" || action === "hashtags") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return jsonOutput_({ ok: true, action: "getHashtags", hashtags: readCatalog_().hashtags });
    }

    if (action === "ingeststatus") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return handleIngestStatus_();
    }

    if (action === "runingest") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      var result = runIngestCore_(cfg, { manual: true });
      return jsonOutput_({ ok: true, action: "runIngest", summary: result });
    }

    if (action === "debuglatestmessage") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      return handleDebugLatestMessage_(cfg);
    }

    if (action === "resetingeststate") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      resetIngestState();
      return jsonOutput_({ ok: true, action: "resetIngestState" });
    }

    if (action === "retryingest") {
      assertAccess_(e && e.parameter ? e.parameter.accessKey : "", cfg);
      resetIngestState();
      var retryResult = runIngestCore_(cfg, { manual: true, afterReset: true });
      return jsonOutput_({ ok: true, action: "retryIngest", summary: retryResult });
    }

    return jsonOutput_({
      ok: true,
      message: "Use GET action=status|listAars|getCatalog|getHashtags|ingestStatus|runIngest|debugLatestMessage|resetIngestState|retryIngest"
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
    if (action === "setcatalog") return handleSetCatalog_(payload);
    if (action === "sethashtags") return handleSetHashtags_(payload);

    throw new Error("Unsupported action. Expected upsert, delete, setCatalog or setHashtags.");
  } catch (error) {
    return errorOutput_(error);
  }
}

function handleStatus_(cfg) {
  var ingestState = loadIngestState_();
  var lastSummary = readLastIngestSummary_();
  return jsonOutput_({
    ok: true,
    service: SERVICE_NAME,
    version: SCRIPT_VERSION,
    now: new Date().toISOString(),
    config: {
      hasAccessKey: !!cfg.accessKey,
      hasDefaultFolderId: !!cfg.defaultFolderId,
      ingestEnabled: cfg.ingestEnabled,
      ingestMailQuery: cfg.ingestMailQuery,
      ingestMaxThreadsPerRun: cfg.ingestMaxThreadsPerRun,
      ingestErrorLabel: cfg.ingestErrorLabel
    },
    ingest: {
      processedIds: ingestState.processedMessageIds.length,
      failedIds: ingestState.failedMessageIds.length,
      lastSummary: lastSummary
    }
  });
}

/* =========================
 * 2) AUTOMATION EMAIL -> DRIVE
 * ========================= */
function runIngestEmailsToDrive() {
  var cfg = readScriptConfig_();
  if (!cfg.ingestEnabled) {
    Logger.log("Ingest disabled (AAR_INGEST_ENABLED != true).");
    return;
  }
  var summary = runIngestCore_(cfg, { manual: false });
  Logger.log("Ingest summary: " + JSON.stringify(summary));
}

function runIngestCore_(cfg, options) {
  validateIngestConfig_(cfg);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("Another ingest run is already in progress.");
  }

  try {
    var summary = {
      mode: options && options.manual ? "manual" : "trigger",
      startedAt: new Date().toISOString(),
      threadsScanned: 0,
      messagesScanned: 0,
      messagesProcessed: 0,
      messagesPermanentError: 0,
      driveFilesCreated: 0,
      driveFilesSkippedExisting: 0
    };

    var folder = DriveApp.getFolderById(cfg.defaultFolderId);
    var errorLabel = getOrCreateLabel_(cfg.ingestErrorLabel);
    var state = loadIngestState_();

    var threads = GmailApp.search(cfg.ingestMailQuery, 0, cfg.ingestMaxThreadsPerRun);
    summary.threadsScanned = threads.length;

    for (var t = 0; t < threads.length; t += 1) {
      var thread = threads[t];
      var messages = thread.getMessages();

      for (var m = 0; m < messages.length; m += 1) {
        var message = messages[m];
        var messageId = String(message.getId() || "").trim();
        if (!messageId) continue;
        summary.messagesScanned += 1;

        if (state.processedMessageIdsSet[messageId] || state.failedMessageIdsSet[messageId]) {
          continue;
        }

        try {
          var payloads = extractAarsFromMessage_(message);
          if (!payloads.length) {
            var perr = new Error("No AAR JSON block found in message.");
            perr.permanent = true;
            throw perr;
          }

          for (var i = 0; i < payloads.length; i += 1) {
            var aar = normalizeAar_(payloads[i]);
            var canonical = JSON.stringify(aar, null, 2) + "\n";
            var hash = sha1Hex_(JSON.stringify(aar)).slice(0, 8);
            var date = safeDate_(aar.meta.date);
            var titleSlug = slug_(aar.meta.title || "aar");
            var fileName = sanitizeFileName_(date + "_" + titleSlug + "_" + hash + ".json");

            var created = createDriveFileIfMissing_(folder, fileName, canonical);
            if (created) summary.driveFilesCreated += 1;
            else summary.driveFilesSkippedExisting += 1;
          }

          state.processedMessageIds.push(messageId);
          state.processedMessageIdsSet[messageId] = true;
          delete state.failedMessageIdsSet[messageId];
          summary.messagesProcessed += 1;

          try { thread.removeLabel(errorLabel); } catch (_) {}
        } catch (error) {
          if (error && error.permanent) {
            state.failedMessageIds.push(messageId);
            state.failedMessageIdsSet[messageId] = true;
            summary.messagesPermanentError += 1;
            try { thread.addLabel(errorLabel); } catch (_) {}
            continue;
          }
          throw error;
        }
      }
    }

    trimIngestState_(state);
    saveIngestState_(state);

    summary.finishedAt = new Date().toISOString();
    saveLastIngestSummary_(summary);
    return summary;
  } finally {
    lock.releaseLock();
  }
}

function setupIngestTriggerEvery1Minute() {
  setupIngestTriggerByMinutes_(1);
}

function setupIngestTriggerEvery5Minutes() {
  setupIngestTriggerByMinutes_(5);
}

function setupIngestTriggerEvery10Minutes() {
  setupIngestTriggerByMinutes_(10);
}

function setupIngestTriggerEvery15Minutes() {
  setupIngestTriggerByMinutes_(15);
}

function setupIngestTriggerByMinutes_(minutes) {
  var n = Number(minutes);
  if ([1, 5, 10, 15, 30].indexOf(n) < 0) {
    throw new Error("Unsupported trigger minutes. Use 1, 5, 10, 15 or 30.");
  }
  deleteIngestTriggers();
  ScriptApp.newTrigger("runIngestEmailsToDrive").timeBased().everyMinutes(n).create();
  PropertiesService.getScriptProperties().setProperty("AAR_INGEST_TRIGGER_MINUTES", String(n));
}

function deleteIngestTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i += 1) {
    if (triggers[i].getHandlerFunction() === "runIngestEmailsToDrive") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function resetIngestState() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(INGEST_STATE_PROPERTY);
  props.deleteProperty(INGEST_LAST_SUMMARY_PROPERTY);
}

function testLatestMessageExtraction() {
  var cfg = readScriptConfig_();
  validateIngestConfig_(cfg);

  var threads = GmailApp.search(cfg.ingestMailQuery, 0, 1);
  if (!threads.length) {
    Logger.log("No matching thread.");
    return;
  }

  var messages = threads[0].getMessages();
  if (!messages.length) {
    Logger.log("No message in thread.");
    return;
  }

  var latest = messages[messages.length - 1];
  var payloads = extractAarsFromMessage_(latest);
  Logger.log("Extracted payload count: " + payloads.length);
  if (payloads.length) {
    Logger.log(JSON.stringify(normalizeAar_(payloads[0]), null, 2));
  }
}

function handleDebugLatestMessage_(cfg) {
  validateIngestConfig_(cfg);

  var threads = GmailApp.search(cfg.ingestMailQuery, 0, 1);
  if (!threads.length) {
    return jsonOutput_({
      ok: true,
      action: "debugLatestMessage",
      found: false,
      reason: "No matching Gmail thread for current query.",
      query: cfg.ingestMailQuery
    });
  }

  var messages = threads[0].getMessages();
  if (!messages.length) {
    return jsonOutput_({
      ok: true,
      action: "debugLatestMessage",
      found: false,
      reason: "Matching thread exists but contains no message.",
      query: cfg.ingestMailQuery
    });
  }

  var latest = messages[messages.length - 1];
  var plainBody = String(latest.getPlainBody() || "");
  var rawContent = String(latest.getRawContent() || "");
  var payloads = extractAarsFromMessage_(latest);

  return jsonOutput_({
    ok: true,
    action: "debugLatestMessage",
    found: true,
    query: cfg.ingestMailQuery,
    message: {
      id: latest.getId(),
      subject: latest.getSubject(),
      from: latest.getFrom(),
      date: latest.getDate() ? latest.getDate().toISOString() : null
    },
    markers: {
      plainBegin: plainBody.indexOf("---BEGIN-AAR-JSON---") >= 0,
      plainEnd: plainBody.indexOf("---END-AAR-JSON---") >= 0,
      rawBegin: rawContent.indexOf("---BEGIN-AAR-JSON---") >= 0,
      rawEnd: rawContent.indexOf("---END-AAR-JSON---") >= 0
    },
    payloadCount: payloads.length,
    firstPayload: payloads.length ? normalizeAar_(payloads[0]) : null
  });
}

function handleIngestStatus_() {
  var state = loadIngestState_();
  var last = readLastIngestSummary_();
  return jsonOutput_({
    ok: true,
    action: "ingestStatus",
    processedIds: state.processedMessageIds.length,
    failedIds: state.failedMessageIds.length,
    lastSummary: last
  });
}

function readLastIngestSummary_() {
  var raw = String(PropertiesService.getScriptProperties().getProperty(INGEST_LAST_SUMMARY_PROPERTY) || "").trim();
  if (!raw) return null;
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    return null;
  }
}

function saveLastIngestSummary_(summary) {
  PropertiesService.getScriptProperties().setProperty(INGEST_LAST_SUMMARY_PROPERTY, JSON.stringify(summary || {}));
}

/* =========================
 * 3) ENDPOINTS METIER HUB
 * ========================= */
function handleUpsert_(payload, cfg) {
  var driveFileId = String(payload.driveFileId || "").trim();
  var folderId = String(payload.folderId || cfg.defaultFolderId || "").trim();
  var mission = (payload.mission && typeof payload.mission === "object") ? payload.mission : {};
  var fileName = sanitizeFileName_(String(payload.fileName || "").trim() || buildFallbackName_(mission));

  if (!driveFileId && !folderId) {
    throw new Error("Missing folderId (payload.folderId or Script Property AAR_FOLDER_ID).");
  }

  var jsonText = JSON.stringify(normalizeAar_(mission), null, 2);
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

  return jsonOutput_({ ok: true, action: "delete", file: { id: driveFileId } });
}

function handleSetCatalog_(payload) {
  var incoming = payload && payload.catalog ? payload.catalog : payload;
  var normalized = normalizeCatalogObject_(incoming);
  writeCatalog_(normalized);
  return jsonOutput_({ ok: true, action: "setCatalog", catalog: normalized });
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

function handleListAars_(params, cfg) {
  var folderId = String((params && params.folderId) || cfg.defaultFolderId || "").trim();
  if (!folderId) throw new Error("Missing folderId.");

  var folder = DriveApp.getFolderById(folderId);
  var it = folder.getFiles();
  var files = [];
  var errors = [];
  var limit = 1500;

  while (it.hasNext() && files.length < limit) {
    var file = it.next();
    var name = String(file.getName() || "");
    var mime = String(file.getMimeType() || "").toLowerCase();
    if (!/\.json$/i.test(name) && mime !== "application/json" && mime !== "text/plain") continue;
    if (/^index\.json$/i.test(name)) continue;

    try {
      var text = file.getBlob().getDataAsString();
      var parsed = JSON.parse(text);
      files.push({
        id: file.getId(),
        name: name,
        modifiedTime: file.getLastUpdated().toISOString(),
        aar: normalizeAar_(parsed)
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

/* =========================
 * 4) CONFIG / SECURITE
 * ========================= */
function readScriptConfig_() {
  var props = PropertiesService.getScriptProperties();
  var triggerMinutesRaw = Number(props.getProperty("AAR_INGEST_TRIGGER_MINUTES") || DEFAULTS.ingestTriggerMinutes);
  var triggerMinutes = [1, 5, 10, 15, 30].indexOf(triggerMinutesRaw) >= 0
    ? triggerMinutesRaw
    : DEFAULTS.ingestTriggerMinutes;

  return {
    accessKey: String(props.getProperty("AAR_ACCESS_KEY") || "").trim(),
    defaultFolderId: String(props.getProperty("AAR_FOLDER_ID") || "").trim(),
    ingestEnabled: parseBoolean_(props.getProperty("AAR_INGEST_ENABLED"), DEFAULTS.ingestEnabled),
    ingestMailQuery: String(props.getProperty("AAR_INGEST_MAIL_QUERY") || DEFAULTS.ingestMailQuery).trim(),
    ingestMaxThreadsPerRun: Number(props.getProperty("AAR_INGEST_MAX_THREADS_PER_RUN") || DEFAULTS.ingestMaxThreadsPerRun),
    ingestErrorLabel: String(props.getProperty("AAR_INGEST_ERROR_LABEL") || DEFAULTS.ingestErrorLabel).trim(),
    ingestTriggerMinutes: triggerMinutes
  };
}

function validateIngestConfig_(cfg) {
  if (!cfg.defaultFolderId) throw new Error("Missing AAR_FOLDER_ID.");
  if (!cfg.ingestMailQuery) throw new Error("Missing AAR_INGEST_MAIL_QUERY.");
  if (!Number.isFinite(cfg.ingestMaxThreadsPerRun) || cfg.ingestMaxThreadsPerRun <= 0) {
    throw new Error("AAR_INGEST_MAX_THREADS_PER_RUN must be > 0.");
  }
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

function parseBoolean_(value, defaultValue) {
  var src = String(value == null ? "" : value).trim().toLowerCase();
  if (!src) return !!defaultValue;
  if (src === "1" || src === "true" || src === "yes" || src === "y") return true;
  if (src === "0" || src === "false" || src === "no" || src === "n") return false;
  return !!defaultValue;
}

/* =========================
 * 5) ETAT INGEST
 * ========================= */
function loadIngestState_() {
  var raw = String(PropertiesService.getScriptProperties().getProperty(INGEST_STATE_PROPERTY) || "").trim();
  var out = {
    processedMessageIds: [],
    failedMessageIds: [],
    processedMessageIdsSet: {},
    failedMessageIdsSet: {}
  };

  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed.processedMessageIds)) out.processedMessageIds = parsed.processedMessageIds.filter(Boolean);
      if (Array.isArray(parsed.failedMessageIds)) out.failedMessageIds = parsed.failedMessageIds.filter(Boolean);
    } catch (_) {}
  }

  for (var i = 0; i < out.processedMessageIds.length; i += 1) out.processedMessageIdsSet[out.processedMessageIds[i]] = true;
  for (var j = 0; j < out.failedMessageIds.length; j += 1) out.failedMessageIdsSet[out.failedMessageIds[j]] = true;
  return out;
}

function saveIngestState_(state) {
  var payload = {
    processedMessageIds: state.processedMessageIds || [],
    failedMessageIds: state.failedMessageIds || []
  };
  PropertiesService.getScriptProperties().setProperty(INGEST_STATE_PROPERTY, JSON.stringify(payload));
}

function trimIngestState_(state) {
  var MAX_IDS = 10000;
  if (state.processedMessageIds.length > MAX_IDS) {
    state.processedMessageIds = state.processedMessageIds.slice(state.processedMessageIds.length - MAX_IDS);
  }
  if (state.failedMessageIds.length > MAX_IDS) {
    state.failedMessageIds = state.failedMessageIds.slice(state.failedMessageIds.length - MAX_IDS);
  }
}

/* =========================
 * 6) EXTRACTION EMAIL
 * ========================= */
function getOrCreateLabel_(labelName) {
  var existing = GmailApp.getUserLabelByName(labelName);
  return existing || GmailApp.createLabel(labelName);
}

function extractAarsFromMessage_(message) {
  var texts = [];
  pushIfNotBlank_(texts, message.getRawContent());
  pushIfNotBlank_(texts, message.getPlainBody());
  pushIfNotBlank_(texts, htmlToText_(message.getBody()));

  var attachments = message.getAttachments();
  for (var i = 0; i < attachments.length; i += 1) {
    var a = attachments[i];
    var name = String(a.getName() || "").toLowerCase();
    if (name.endsWith(".json") || name.endsWith(".txt") || name.endsWith(".eml") || name.endsWith(".msg")) {
      pushIfNotBlank_(texts, a.getDataAsString());
    }
  }

  var out = [];
  var seen = {};
  for (var t = 0; t < texts.length; t += 1) {
    var parsed = parseTextForAars_(texts[t]);
    for (var x = 0; x < parsed.length; x += 1) {
      var key = sha1Hex_(JSON.stringify(parsed[x]));
      if (seen[key]) continue;
      seen[key] = true;
      out.push(parsed[x]);
    }
  }
  return out;
}

function parseTextForAars_(text) {
  var src = String(text || "");
  var payloads = [
    src,
    decodeBasicEntities_(src),
    decodeQuotedPrintable_(src),
    decodeBasicEntities_(decodeQuotedPrintable_(src)),
    htmlToText_(src)
  ];

  var cleanedPayloads = [];
  for (var i = 0; i < payloads.length; i += 1) {
    var s = String(payloads[i] || "").trim();
    if (s) cleanedPayloads.push(s);
  }

  var out = [];
  var seen = {};
  var rgxList = [
    /---BEGIN-AAR-JSON---([\s\S]*?)---END-AAR-JSON---/gi,
    /---BEGIN-DEBRIEF-JSON---([\s\S]*?)---END-DEBRIEF-JSON---/gi
  ];

  for (var p = 0; p < cleanedPayloads.length; p += 1) {
    var payload = cleanedPayloads[p];
    for (var r = 0; r < rgxList.length; r += 1) {
      var rgx = new RegExp(rgxList[r].source, rgxList[r].flags);
      var m;
      while ((m = rgx.exec(payload)) !== null) {
        var aar = parseAarCandidate_(m[1]);
        if (!aar) continue;
        var hashKey = sha1Hex_(JSON.stringify(aar));
        if (seen[hashKey]) continue;
        seen[hashKey] = true;
        out.push(aar);
      }
    }
  }

  if (out.length) return out;

  for (var q = 0; q < cleanedPayloads.length; q += 1) {
    var fallbackAar = parseAarCandidate_(cleanedPayloads[q]);
    if (!fallbackAar) continue;
    var fallbackKey = sha1Hex_(JSON.stringify(fallbackAar));
    if (seen[fallbackKey]) continue;
    seen[fallbackKey] = true;
    out.push(fallbackAar);
  }

  return out;
}

function parseAarCandidate_(text) {
  var raw = String(text || "").trim();
  if (!raw) return null;

  var direct = parseJsonSafely_(raw);
  if (direct) {
    try { return parseAarObject_(direct); } catch (_) {}
  }

  var candidates = extractBalancedJsonObjects_(raw, 4);
  for (var i = 0; i < candidates.length; i += 1) {
    var parsed = parseJsonSafely_(candidates[i]);
    if (!parsed) continue;
    try { return parseAarObject_(parsed); } catch (_) {}
  }
  return null;
}

function parseAarObject_(obj) {
  if (isAarLike_(obj)) return obj;
  if (obj && isAarLike_(obj.aar)) return obj.aar;
  if (obj && isAarLike_(obj.mission)) return obj.mission;
  throw new Error("Object is not recognized as AAR.");
}

function isAarLike_(obj) {
  return !!obj && typeof obj === "object" && (obj.meta || obj.facts || obj.analysis || obj.recos || obj.qwi);
}

function parseJsonSafely_(text) {
  try { return JSON.parse(text); } catch (_) { return null; }
}

function extractBalancedJsonObjects_(text, maxCount) {
  var out = [];
  var s = String(text || "");
  var n = s.length;
  var i = 0;

  while (i < n && out.length < maxCount) {
    var start = s.indexOf("{", i);
    if (start < 0) break;

    var depth = 0;
    var inString = false;
    var escaped = false;

    for (var j = start; j < n; j += 1) {
      var ch = s.charAt(j);

      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === "\"") inString = false;
        continue;
      }

      if (ch === "\"") { inString = true; continue; }
      if (ch === "{") depth += 1;
      if (ch === "}") depth -= 1;

      if (depth === 0) {
        out.push(s.slice(start, j + 1));
        i = j + 1;
        break;
      }
    }

    if (depth !== 0) break;
  }

  return out;
}

/* =========================
 * 7) NORMALISATION AAR
 * ========================= */
function normalizeAar_(input) {
  var a = input && typeof input === "object" ? input : {};
  return {
    meta: {
      title: str_(a.meta && a.meta.title),
      date: safeDate_(a.meta && a.meta.date),
      grade: str_(a.meta && a.meta.grade),
      gradeAutre: str_(a.meta && a.meta.gradeAutre),
      nom: str_(a.meta && a.meta.nom),
      prenom: str_(a.meta && a.meta.prenom),
      unite: str_(a.meta && a.meta.unite),
      uniteAutre: str_(a.meta && a.meta.uniteAutre),
      flotte: str_(a.meta && a.meta.flotte),
      flotteAutre: str_(a.meta && a.meta.flotteAutre),
      reportKind: normalizeReportKind_(a.meta && a.meta.reportKind),
      classification: normalizeClassification_(a.meta && a.meta.classification),
      missionType: str_(a.meta && a.meta.missionType),
      logCountry: str_(a.meta && a.meta.logCountry),
      logCountryAutre: str_(a.meta && a.meta.logCountryAutre),
      logAirfield: str_(a.meta && a.meta.logAirfield),
      logAirfieldAutre: str_(a.meta && a.meta.logAirfieldAutre),
      hashtags: extractHashtagsFromMeta_(a.meta),
      hashtag: str_(a.meta && a.meta.hashtag),
      hashtagAutre: str_(a.meta && a.meta.hashtagAutre),
      tacContext: str_(a.meta && a.meta.tacContext),
      tacOperation: str_(a.meta && a.meta.tacOperation),
      tacOperationAutre: str_(a.meta && a.meta.tacOperationAutre),
      tacExercise: str_(a.meta && a.meta.tacExercise),
      tacExerciseAutre: str_(a.meta && a.meta.tacExerciseAutre)
    },
    facts: {
      what: str_(a.facts && a.facts.what),
      why: str_(a.facts && a.facts.why),
      when: str_(a.facts && a.facts.when),
      where: str_(a.facts && a.facts.where),
      who: str_(a.facts && a.facts.who),
      how: str_(a.facts && a.facts.how),
      narrative: str_(a.facts && a.facts.narrative)
    },
    analysis: { content: str_(a.analysis && a.analysis.content) },
    recos: {
      doctrine: str_(a.recos && a.recos.doctrine),
      organisation: str_(a.recos && a.recos.organisation),
      rh: str_(a.recos && a.recos.rh),
      equipements: str_(a.recos && a.recos.equipements),
      soutien: str_(a.recos && a.recos.soutien),
      entrainement: str_(a.recos && a.recos.entrainement)
    },
    qwi: { advice: str_(a.qwi && a.qwi.advice) }
  };
}

function str_(v) { return v == null ? "" : String(v); }

function safeDate_(v) {
  var raw = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

function normalizeClassification_(v) {
  var raw = stripDiacritics_(String(v || "")).toUpperCase().replace(/\s+/g, " ").trim();
  if (!raw) return "UNKNOWN";
  if (raw.indexOf("NON PROTEGE") >= 0) return "NON PROTEGE";
  if (raw.indexOf("DIFFUSION RESTREINTE") >= 0) return "DIFFUSION RESTREINTE";
  if (raw.indexOf("SECRET SPECIAL FRANCE") >= 0) return "SECRET SPECIAL FRANCE";
  return raw;
}

function normalizeReportKind_(v) {
  return String(v || "").trim().toUpperCase() === "FLASH" ? "FLASH" : "CONSOLIDE";
}

function normalizeHashtag_(value) {
  var text = String(value || "").trim();
  if (!text) return "";
  text = text.replace(/\s+/g, "-");
  if (text.charAt(0) !== "#") text = "#" + text;
  return text;
}

function normalizeHashtagArray_(values) {
  var source = Array.isArray(values) ? values : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < source.length; i += 1) {
    var tag = normalizeHashtag_(source[i]);
    if (!tag) continue;
    var key = tag.toUpperCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(tag);
  }
  out.sort(function(a, b) { return a.localeCompare(b); });
  return out;
}

function extractHashtagsFromMeta_(meta) {
  var src = meta && typeof meta === "object" ? meta : {};
  var out = [];
  if (Array.isArray(src.hashtags)) out = out.concat(src.hashtags);

  var selectedRaw = String(src.hashtag || "").trim();
  var selected = normalizeHashtag_(selectedRaw);
  var other = normalizeHashtag_(src.hashtagAutre);
  if (selectedRaw.toUpperCase() === "AUTRE") {
    if (other) out.push(other);
  } else {
    if (selected) out.push(selected);
    if (other && other.toUpperCase() !== selected.toUpperCase()) out.push(other);
  }
  return normalizeHashtagArray_(out);
}

/* =========================
 * 8) CATALOGUE DYNAMIQUE
 * ========================= */
function readCatalog_() {
  var props = PropertiesService.getScriptProperties();
  var raw = String(props.getProperty(CATALOG_PROPERTY) || "").trim();
  if (raw) {
    try {
      return normalizeCatalogObject_(JSON.parse(raw));
    } catch (error) {
      // fallback legacy
    }
  }

  var legacyTags = [];
  var rawLegacy = String(props.getProperty(LEGACY_HASHTAG_PROPERTY) || "").trim();
  if (rawLegacy) {
    try { legacyTags = JSON.parse(rawLegacy); } catch (_) { legacyTags = []; }
  }
  return normalizeCatalogObject_({ hashtags: legacyTags });
}

function writeCatalog_(catalog) {
  var normalized = normalizeCatalogObject_(catalog);
  var props = PropertiesService.getScriptProperties();
  props.setProperty(CATALOG_PROPERTY, JSON.stringify(normalized));
  props.setProperty(LEGACY_HASHTAG_PROPERTY, JSON.stringify(normalized.hashtags));
}

function normalizeCatalogObject_(input) {
  var src = input && typeof input === "object" ? input : {};
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

  for (var i = 0; i < source.length; i += 1) {
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

function mergeCatalogFromAar_(catalog, aar) {
  var added = 0;
  var meta = aar && aar.meta ? aar.meta : {};

  var hashtags = extractHashtagsFromMeta_(meta);
  for (var i = 0; i < hashtags.length; i += 1) {
    if (addCatalogValue_(catalog.hashtags, hashtags[i], "hashtag")) added += 1;
  }

  var country = resolveOtherChoice_(meta.logCountry, meta.logCountryAutre);
  if (addCatalogValue_(catalog.countries, country, "text")) added += 1;

  var oaci = resolveOtherChoice_(meta.logAirfield, meta.logAirfieldAutre);
  if (addCatalogValue_(catalog.oaci, oaci, "oaci")) added += 1;

  var operation = resolveOtherChoice_(meta.tacOperation, meta.tacOperationAutre);
  if (addCatalogValue_(catalog.operations, operation, "text")) added += 1;

  var exercise = resolveOtherChoice_(meta.tacExercise, meta.tacExerciseAutre);
  if (addCatalogValue_(catalog.exercises, exercise, "text")) added += 1;

  if (added > 0) {
    catalog.hashtags = normalizeCatalogArray_(catalog.hashtags, "hashtag");
    catalog.countries = normalizeCatalogArray_(catalog.countries, "text");
    catalog.oaci = normalizeCatalogArray_(catalog.oaci, "oaci");
    catalog.operations = normalizeCatalogArray_(catalog.operations, "text");
    catalog.exercises = normalizeCatalogArray_(catalog.exercises, "text");
  }

  return added;
}

function resolveOtherChoice_(value, otherValue) {
  var main = String(value || "").trim();
  var other = String(otherValue || "").trim();
  var key = stripDiacritics_(main).toUpperCase();
  if (!main) return other;
  if (key === "AUTRE" || key === "OTHER") return other || main;
  return main;
}

function addCatalogValue_(arr, value, kind) {
  if (!Array.isArray(arr)) return false;
  var normalized = normalizeCatalogValue_(value, kind);
  if (!normalized) return false;
  var key = normalized.toUpperCase();
  for (var i = 0; i < arr.length; i += 1) {
    if (String(arr[i] || "").toUpperCase() === key) return false;
  }
  arr.push(normalized);
  return true;
}

/* =========================
 * 9) OUTILS / UTILITAIRES
 * ========================= */
function createDriveFileIfMissing_(folder, fileName, content) {
  var existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) return false;
  folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
  return true;
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

function slug_(v) {
  var cleaned = stripDiacritics_(String(v || "aar"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (cleaned || "aar").slice(0, 60);
}

function stripDiacritics_(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sha1Hex_(text) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, text, Utilities.Charset.UTF_8);
  var out = [];
  for (var i = 0; i < digest.length; i += 1) {
    var b = digest[i];
    var n = b < 0 ? b + 256 : b;
    out.push(("0" + n.toString(16)).slice(-2));
  }
  return out.join("");
}

function pushIfNotBlank_(arr, value) {
  var s = String(value || "").trim();
  if (s) arr.push(s);
}

function decodeQuotedPrintable_(text) {
  var src = String(text || "");
  if (src.indexOf("=") < 0) return src;
  var unfolded = src.replace(/=(\r\n|\n|\r)/g, "");
  return unfolded.replace(/=([A-Fa-f0-9]{2})/g, function(_, hex) {
    return String.fromCharCode(parseInt(hex, 16));
  });
}

function decodeBasicEntities_(text) {
  return String(text || "")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText_(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorOutput_(error) {
  return jsonOutput_({
    ok: false,
    error: String(error && error.message ? error.message : error)
  });
}
