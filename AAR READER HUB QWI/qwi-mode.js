/* QWI mode: add / edit / delete AARs and push to Google Drive */
(function () {
  const LOCAL_SOURCE = "qwi_local";
  const REQUEST_PREFIX = "aar_qwi_editor_request:";
  const DELETED_KEY = "aar_qwi_deleted_ids_v1";
  const MISSION_CATALOG_KEY = "aar_mission_catalog_v1";
  const HASHTAG_CATALOG_KEY = "aar_hashtag_catalog_v1";
  const EDITOR_RELATIVE_URL = "./aar-pwa/AAR.html";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
  const sessions = new Map();
  const CATALOG_DEFS = {
    hashtags: { label: "Hashtags", singular: "hashtag", normalize: (value) => normalizeHashtag(value), selectKey: "hashtag", otherKey: "hashtagAutre" },
    countries: { label: "Pays", singular: "pays", normalize: (value) => normalizeTextValue(value), selectKey: "logCountry", otherKey: "logCountryAutre" },
    oaci: { label: "Codes OACI", singular: "code OACI", normalize: (value) => normalizeTextValue(value).toUpperCase(), selectKey: "logAirfield", otherKey: "logAirfieldAutre" },
    operations: { label: "Operations", singular: "operation", normalize: (value) => normalizeTextValue(value), selectKey: "tacOperation", otherKey: "tacOperationAutre", contextKey: "tacContext", contextValue: "OPERATIONS" },
    exercises: { label: "Exercices", singular: "exercice", normalize: (value) => normalizeTextValue(value), selectKey: "tacExercise", otherKey: "tacExerciseAutre", contextKey: "tacContext", contextValue: "EXERCICE" }
  };
  const CATALOG_KEYS = Object.keys(CATALOG_DEFS);

  let tokenClient = null;
  let accessToken = "";
  let tokenExpiryAt = 0;
  let gsiLoader = null;
  let silentReconnectTried = false;
  let adminBusy = false;
  let currentCatalog = createEmptyCatalog();
  let baseCatalog = createEmptyCatalog();
  const adminCatalogSearch = {};

  function hasValidDriveToken() {
    return !!accessToken && Date.now() < tokenExpiryAt - 30000;
  }

  function sortRecords(rows) {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  }

  function normalizeTextValue(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeHashtag(value) {
    let tag = String(value || "").trim();
    if (!tag) return "";
    tag = tag.replace(/\s+/g, "-");
    if (!tag.startsWith("#")) tag = `#${tag}`;
    return tag;
  }

  function uniqueHashtags(values) {
    const out = [];
    const seen = new Set();
    (Array.isArray(values) ? values : []).forEach((value) => {
      const tag = normalizeHashtag(value);
      if (!tag) return;
      const key = tag.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(tag);
    });
    return out.sort((a, b) => a.localeCompare(b, "fr"));
  }

  function createEmptyCatalog() {
    return { hashtags: [], countries: [], oaci: [], operations: [], exercises: [] };
  }

  function getBundledMissionConfig() {
    return (window.AARMissionConfig && typeof window.AARMissionConfig === "object")
      ? window.AARMissionConfig
      : {};
  }

  function normalizeCatalogValues(key, values) {
    const def = CATALOG_DEFS[key];
    if (!def) return [];
    const out = [];
    const seen = new Set();
    (Array.isArray(values) ? values : []).forEach((value) => {
      const normalized = String(def.normalize(value) || "").trim();
      if (!normalized) return;
      const dedupKey = normalized.toUpperCase();
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);
      out.push(normalized);
    });
    return out.sort((a, b) => a.localeCompare(b, "fr"));
  }

  function normalizeCatalogObject(input) {
    const src = input && typeof input === "object" ? input : {};
    const out = createEmptyCatalog();
    CATALOG_KEYS.forEach((key) => {
      out[key] = normalizeCatalogValues(key, src[key]);
    });
    return out;
  }

  function buildBaseCatalogFromEditorConfig() {
    const cfg = getBundledMissionConfig();
    return normalizeCatalogObject({
      hashtags: cfg.hashtags || [],
      countries: cfg.allCountries || [],
      oaci: (Array.isArray(cfg.allAirfields) && cfg.allAirfields.length)
        ? cfg.allAirfields
        : Object.values(cfg.logAirfieldsByCountry || {}).flat(),
      operations: cfg.tacOperations || [],
      exercises: cfg.tacExercises || []
    });
  }

  function compactCatalogAgainstBase(catalog) {
    const normalized = normalizeCatalogObject(catalog);
    const base = normalizeCatalogObject(baseCatalog || {});
    const out = createEmptyCatalog();

    CATALOG_KEYS.forEach((key) => {
      const baseSet = new Set((base[key] || []).map((value) => String(value || "").toUpperCase()));
      out[key] = (normalized[key] || []).filter((value) => !baseSet.has(String(value || "").toUpperCase()));
    });

    return normalizeCatalogObject(out);
  }

  function readCatalogFromStorage() {
    try {
      const raw = localStorage.getItem(MISSION_CATALOG_KEY);
      if (raw) return normalizeCatalogObject(JSON.parse(raw));
    } catch {
      // fallback below
    }

    // Legacy fallback if only hashtags were persisted
    try {
      const rawLegacy = localStorage.getItem(HASHTAG_CATALOG_KEY);
      const parsedLegacy = rawLegacy ? JSON.parse(rawLegacy) : [];
      return normalizeCatalogObject({ hashtags: Array.isArray(parsedLegacy) ? parsedLegacy : [] });
    } catch {
      return createEmptyCatalog();
    }
  }

  function writeCatalogToStorage(catalog) {
    const normalized = compactCatalogAgainstBase(catalog);
    try {
      localStorage.setItem(MISSION_CATALOG_KEY, JSON.stringify(normalized));
      localStorage.setItem(HASHTAG_CATALOG_KEY, JSON.stringify(normalized.hashtags || []));
    } catch (error) {
      console.warn("Catalog storage write failed", error);
    }
  }

  function getMetaValueForCategory(meta, key) {
    const def = CATALOG_DEFS[key];
    if (!def) return "";
    if (def.contextKey && def.contextValue) {
      const ctx = String(meta?.[def.contextKey] || "").trim().toUpperCase();
      if (ctx !== String(def.contextValue || "").trim().toUpperCase()) return "";
    }
    const selected = String(meta?.[def.selectKey] || "").trim();
    const other = String(meta?.[def.otherKey] || "").trim();
    return selected === "AUTRE" ? def.normalize(other) : def.normalize(selected);
  }

  function collectKnownCatalogFromReports() {
    const out = createEmptyCatalog();
    (state.reports || []).forEach((record) => {
      const meta = record?.mission?.meta || {};
      CATALOG_KEYS.forEach((key) => {
        const value = getMetaValueForCategory(meta, key);
        if (value) out[key].push(value);
      });
    });
    CATALOG_KEYS.forEach((key) => { out[key] = normalizeCatalogValues(key, out[key]); });
    return out;
  }

  function mergeCatalogs(...catalogs) {
    const merged = createEmptyCatalog();
    CATALOG_KEYS.forEach((key) => {
      const values = [];
      catalogs.forEach((catalog) => {
        if (catalog && Array.isArray(catalog[key])) values.push(...catalog[key]);
      });
      merged[key] = normalizeCatalogValues(key, values);
    });
    return merged;
  }

  function collectKnownHashtags() {
    const effective = getEffectiveCatalog();
    return (effective && Array.isArray(effective.hashtags))
      ? [...effective.hashtags]
      : [];
  }

  function getCurrentCatalog() {
    return compactCatalogAgainstBase(currentCatalog || {});
  }

  function getBaseCatalog() {
    return normalizeCatalogObject(baseCatalog || {});
  }

  function getEffectiveCatalog() {
    return mergeCatalogs(getBaseCatalog(), getCurrentCatalog());
  }

  function setCurrentCatalog(catalog, persist = true) {
    currentCatalog = compactCatalogAgainstBase(catalog);
    if (persist) writeCatalogToStorage(currentCatalog);
  }

  function getEffectiveCategorySet(key) {
    const list = (getEffectiveCatalog() && Array.isArray(getEffectiveCatalog()[key])) ? getEffectiveCatalog()[key] : [];
    return new Set(list.map((value) => String(value || "").toUpperCase()));
  }

  function isOfficialCatalogValue(category, value) {
    const def = CATALOG_DEFS[category];
    if (!def) return false;
    const normalized = String(def.normalize(value) || "").trim().toUpperCase();
    if (!normalized) return false;
    return (getCurrentCatalog()[category] || []).some((item) => String(item || "").toUpperCase() === normalized);
  }

  function getDeletedIds() {
    try {
      const arr = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]");
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.filter(Boolean));
    } catch {
      return new Set();
    }
  }

  function saveDeletedIds(ids) {
    localStorage.setItem(DELETED_KEY, JSON.stringify([...ids]));
  }

  function markDeleted(id) {
    if (!id) return;
    const ids = getDeletedIds();
    ids.add(id);
    saveDeletedIds(ids);
  }

  function unmarkDeleted(id) {
    if (!id) return;
    const ids = getDeletedIds();
    if (ids.delete(id)) saveDeletedIds(ids);
  }

  async function persistRecords(rows) {
    const sorted = sortRecords(rows);
    try {
      await dbReplaceAll(sorted);
    } catch (error) {
      console.warn("IndexedDB write unavailable in QWI mode", error);
    }
    state.reports = sorted;
    renderAll();
  }

  function requestKey(sessionId) {
    return `${REQUEST_PREFIX}${sessionId}`;
  }

  function buildEditorUrl(sessionId) {
    const url = new URL(EDITOR_RELATIVE_URL, window.location.href);
    url.searchParams.set("externalEditor", "1");
    url.searchParams.set("session", sessionId);
    return url.toString();
  }

  function newSessionId() {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${Date.now()}_${rand}`;
  }

  function getWriteDriveConfig() {
    const base = typeof getDriveConfig === "function" ? getDriveConfig() : {};
    const raw = (window.AAR_READER_CONFIG && window.AAR_READER_CONFIG.googleDrive) || {};
    return {
      folderId: String(base.folderId || raw.folderId || "").trim(),
      indexFileId: String(base.indexFileId || raw.indexFileId || "").trim(),
      oauthClientId: String(raw.oauthClientId || raw.clientId || "").trim()
    };
  }

  function getAppsScriptConfig() {
    const cfg = (window.AAR_READER_CONFIG && window.AAR_READER_CONFIG.appsScript) || {};
    return {
      enabled: cfg.enabled === true,
      webAppUrl: String(cfg.webAppUrl || "").trim(),
      accessKey: String(cfg.accessKey || "").trim(),
      timeoutMs: Math.max(5000, Number(cfg.timeoutMs || 25000) || 25000)
    };
  }

  function usesAppsScriptBackend() {
    const cfg = getAppsScriptConfig();
    return cfg.enabled && !!cfg.webAppUrl;
  }

  function setDriveButtonState({ connected = false, busy = false } = {}) {
    const btn = document.getElementById("qwi-drive-btn");
    if (!btn) return;
    btn.classList.toggle("is-connected", !!connected);
    btn.classList.toggle("is-busy", !!busy);
    btn.disabled = !!busy;
    btn.title = connected ? "Google Drive connecte" : "Connexion Google Drive";
  }

  function authNeedsInteraction(message) {
    const text = String(message || "").toLowerCase();
    if (!text) return false;
    return (
      text.includes("interaction_required") ||
      text.includes("consent_required") ||
      text.includes("login_required") ||
      text.includes("popup_closed") ||
      text.includes("popup_blocked")
    );
  }

  function getIsoToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function toDriveFileName(record) {
    if (record && record.fileName) return record.fileName;
    const title = String(record?.title || "aar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "aar";
    const date = String(record?.date || getIsoToday());
    return `${date}_${title}.json`;
  }

  function ensureGsiLoaded() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
      return Promise.resolve();
    }
    if (gsiLoader) return gsiLoader;

    gsiLoader = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-gsi-client="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Chargement GSI impossible.")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.gsiClient = "1";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Chargement Google Identity Services impossible."));
      document.head.appendChild(script);
    });

    return gsiLoader;
  }

  async function ensureDriveAccess(interactive = true) {
    const cfg = getWriteDriveConfig();
    if (!cfg.oauthClientId) {
      throw new Error("oauthClientId manquant dans config.js (googleDrive.oauthClientId).");
    }

    if (hasValidDriveToken()) {
      setDriveButtonState({ connected: true, busy: false });
      return accessToken;
    }

    await ensureGsiLoaded();

    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: cfg.oauthClientId,
        scope: DRIVE_SCOPE,
        callback: () => {}
      });
    }

    setDriveButtonState({ connected: !!accessToken, busy: true });
    try {
      const tokenResponse = await new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => {
          if (resp && resp.access_token) resolve(resp);
          else reject(new Error("Token Google Drive invalide."));
        };
        tokenClient.error_callback = (err) => {
          const msg = err?.type || err?.message || "Authentification Google annulee.";
          reject(new Error(msg));
        };

        try {
          tokenClient.requestAccessToken({ prompt: interactive ? "consent" : "" });
        } catch (error) {
          reject(error);
        }
      });

      accessToken = tokenResponse.access_token;
      const expiresIn = Number(tokenResponse.expires_in || 3600);
      tokenExpiryAt = Date.now() + (expiresIn * 1000);
      setDriveButtonState({ connected: true, busy: false });
      return accessToken;
    } catch (error) {
      setDriveButtonState({ connected: !!accessToken, busy: false });
      if (!interactive && authNeedsInteraction(error?.message || error)) {
        throw new Error("Session Drive non connectee. Clique sur le nuage puis reenregistre.");
      }
      throw error;
    }
  }

  async function trySilentDriveReconnect() {
    if (usesAppsScriptBackend()) {
      setDriveButtonState({ connected: true, busy: false });
      return;
    }
    if (silentReconnectTried) return;
    silentReconnectTried = true;
    try {
      await ensureDriveAccess(false);
    } catch (error) {
      const msg = String(error?.message || error || "");
      if (!authNeedsInteraction(msg)) {
        console.warn("Silent Drive reconnect failed", error);
      }
      setDriveButtonState({ connected: hasValidDriveToken(), busy: false });
    }
  }

  async function callAppsScript(payload) {
    const cfg = getAppsScriptConfig();
    if (!cfg.enabled || !cfg.webAppUrl) {
      throw new Error("Apps Script non configure (appsScript.webAppUrl).");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const response = await fetch(cfg.webAppUrl, {
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          ...payload,
          accessKey: cfg.accessKey || ""
        }),
        signal: controller.signal
      });

      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}

      if (!response.ok) {
        const detail = data?.error || data?.message || text || response.statusText;
        throw new Error(`Apps Script HTTP ${response.status}: ${detail}`);
      }
      if (!data || data.ok !== true) {
        throw new Error(data?.error || data?.message || "Reponse Apps Script invalide.");
      }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Timeout Apps Script.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function callAppsScriptGet(action, extraParams = {}) {
    const cfg = getAppsScriptConfig();
    if (!cfg.enabled || !cfg.webAppUrl) {
      throw new Error("Apps Script non configure (appsScript.webAppUrl).");
    }
    const url = new URL(cfg.webAppUrl);
    url.searchParams.set("action", action);
    if (cfg.accessKey) url.searchParams.set("accessKey", cfg.accessKey);
    Object.entries(extraParams || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        url.searchParams.set(key, String(value));
      }
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const response = await fetch(url.toString(), { method: "GET", cache: "no-store", signal: controller.signal });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok) {
        const detail = data?.error || data?.message || text || response.statusText;
        throw new Error(`Apps Script HTTP ${response.status}: ${detail}`);
      }
      if (!data || data.ok !== true) {
        throw new Error(data?.error || data?.message || "Reponse Apps Script invalide.");
      }
      return data;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("Timeout Apps Script.");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchRemoteCatalogFromBackend() {
    if (!usesAppsScriptBackend()) return;
    const data = await callAppsScriptGet("getCatalog");
    return normalizeCatalogObject(data?.catalog || {});
  }

  async function syncMissionCatalogToBackend(catalog) {
    if (!usesAppsScriptBackend()) return;
    const normalized = normalizeCatalogObject(catalog);
    await callAppsScript({
      action: "setCatalog",
      catalog: normalized
    });
  }

  async function driveRequest(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Drive ${response.status}: ${text || response.statusText}`);
    }
    return response;
  }

  function multipartBody(metadata, jsonContent, boundary) {
    return [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      jsonContent,
      `--${boundary}--`
    ].join("\r\n");
  }

  function normalizeIndexEntries(payload) {
    if (Array.isArray(payload)) {
      return payload
        .map((item) => {
          if (typeof item === "string") return { id: item, name: "" };
          return { id: String(item?.id || "").trim(), name: String(item?.name || "").trim() };
        })
        .filter((x) => x.id);
    }
    if (payload && Array.isArray(payload.files)) {
      return payload.files
        .map((item) => ({ id: String(item?.id || "").trim(), name: String(item?.name || "").trim() }))
        .filter((x) => x.id);
    }
    return [];
  }

  async function readIndexEntries(token, indexFileId) {
    const res = await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(indexFileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await res.text();
    if (!text.trim()) return [];
    try {
      return normalizeIndexEntries(JSON.parse(text));
    } catch {
      return [];
    }
  }

  async function writeIndexEntries(token, indexFileId, entries) {
    const dedup = [];
    const seen = new Set();
    for (const row of entries) {
      const id = String(row?.id || "").trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      dedup.push({ id, name: String(row?.name || "").trim() });
    }

    const body = JSON.stringify({ files: dedup }, null, 2);
    await driveRequest(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(indexFileId)}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8"
      },
      body
    });
  }

  async function upsertIndexEntry(token, indexFileId, entry) {
    if (!indexFileId) return;
    const entries = await readIndexEntries(token, indexFileId);
    const next = entries.filter((x) => x.id !== entry.id);
    next.push({ id: entry.id, name: entry.name || "" });
    await writeIndexEntries(token, indexFileId, next);
  }

  async function removeIndexEntry(token, indexFileId, fileId) {
    if (!indexFileId || !fileId) return;
    const entries = await readIndexEntries(token, indexFileId);
    const next = entries.filter((x) => x.id !== fileId);
    await writeIndexEntries(token, indexFileId, next);
  }

  async function pushUpsertToDrive(record, existingRecord) {
    const cfg = getWriteDriveConfig();
    const targetFileId = String(existingRecord?.driveFileId || record?.driveFileId || "").trim();
    const backendMode = usesAppsScriptBackend();

    if (!backendMode && !cfg.folderId && !targetFileId) {
      throw new Error("folderId Drive manquant pour creer un nouvel AAR.");
    }

    if (backendMode) {
      const response = await callAppsScript({
        action: "upsert",
        folderId: cfg.folderId,
        driveFileId: targetFileId,
        fileName: toDriveFileName(record),
        mission: record.mission || {}
      });
      const file = response.file || {};
      return {
        id: String(file.id || targetFileId || "").trim(),
        name: String(file.name || toDriveFileName(record)).trim(),
        modifiedTime: String(file.modifiedTime || new Date().toISOString()).trim()
      };
    }

    const token = await ensureDriveAccess(false);
    setDriveButtonState({ connected: true, busy: true });

    try {
      const boundary = `qwi_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const fileName = toDriveFileName(record);
      const metadata = targetFileId
        ? { name: fileName, mimeType: "application/json" }
        : { name: fileName, mimeType: "application/json", parents: [cfg.folderId] };

      const body = multipartBody(metadata, JSON.stringify(record.mission || {}, null, 2), boundary);
      const baseUrl = targetFileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(targetFileId)}?uploadType=multipart&fields=id,name,modifiedTime`
        : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime";

      const res = await driveRequest(baseUrl, {
        method: targetFileId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`
        },
        body
      });

      const meta = await res.json();
      if (!meta?.id) throw new Error("Reponse Drive sans id fichier.");

      if (cfg.indexFileId) {
        await upsertIndexEntry(token, cfg.indexFileId, { id: meta.id, name: meta.name || fileName });
      }

      setDriveButtonState({ connected: true, busy: false });
      return meta;
    } catch (error) {
      setDriveButtonState({ connected: true, busy: false });
      throw error;
    }
  }

  async function pushDeleteToDrive(record) {
    const cfg = getWriteDriveConfig();
    const fileId = String(record?.driveFileId || "").trim();
    if (!fileId) return;

    if (usesAppsScriptBackend()) {
      await callAppsScript({
        action: "delete",
        folderId: cfg.folderId,
        driveFileId: fileId
      });
      return;
    }

    const token = await ensureDriveAccess(false);
    setDriveButtonState({ connected: true, busy: true });

    try {
      await driveRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (cfg.indexFileId) {
        await removeIndexEntry(token, cfg.indexFileId, fileId);
      }

      setDriveButtonState({ connected: true, busy: false });
    } catch (error) {
      setDriveButtonState({ connected: true, busy: false });
      throw error;
    }
  }

  function openEditor(recordId = "") {
    const record = recordId ? state.reports.find((x) => x.id === recordId) : null;
    const sessionId = newSessionId();
    const driveFileId = record ? String(record.driveFileId || "").trim() : "";

    const payload = {
      source: "AAR_READER_HUB_QWI",
      recordId: record ? record.id : "",
      driveFileId,
      hashtagsCatalog: collectKnownHashtags(),
      missionCatalog: getCurrentCatalog(),
      aar: record ? record.mission : null,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(requestKey(sessionId), JSON.stringify(payload));
    sessions.set(sessionId, { recordId: record ? record.id : "", driveFileId });

    const popup = window.open(buildEditorUrl(sessionId), "_blank");
    if (!popup) {
      sessions.delete(sessionId);
      localStorage.removeItem(requestKey(sessionId));
      toast("Popup bloquee: autorise les popups puis reessaie.");
      return;
    }

    if (!usesAppsScriptBackend() && !hasValidDriveToken()) {
      toast("Edition ouverte. Pour pousser sur Drive: clique d'abord sur le nuage.");
    }
  }

  async function upsertFromEditor(sessionId, aarData) {
    const pending = sessions.get(sessionId);
    if (!pending) return;

    const normalized = normalizeAar(aarData || {});
    let rec = buildRecord(normalized, LOCAL_SOURCE, "qwi_editor");
    const pendingRecordId = String(pending.recordId || "").trim();
    const pendingDriveFileId = String(pending.driveFileId || "").trim();
    const existingById = pendingRecordId ? state.reports.find((x) => x.id === pendingRecordId) : null;
    const existingByDriveId = pendingDriveFileId ? state.reports.find((x) => String(x.driveFileId || "").trim() === pendingDriveFileId) : null;
    const existing = existingById || existingByDriveId || null;

    if (existing) {
      rec.id = existing.id;
      rec.createdAt = existing.createdAt || rec.createdAt;
      rec.driveFileId = existing.driveFileId || "";
      rec.driveModifiedTime = existing.driveModifiedTime || "";
    } else if (pendingDriveFileId) {
      // Defensive fallback: if recordId mapping is lost, still update the same Drive file.
      rec.driveFileId = pendingDriveFileId;
    }

    rec.source = LOCAL_SOURCE;
    rec.sourceName = "qwi_editor";
    rec.updatedAt = new Date().toISOString();

    let pushError = "";
    try {
      const driveMeta = await pushUpsertToDrive(rec, existing);
      rec.driveFileId = driveMeta.id || rec.driveFileId || "";
      rec.driveModifiedTime = driveMeta.modifiedTime || rec.driveModifiedTime || "";
      rec.source = "drive_file";
      rec.sourceName = "google_drive_qwi";
      rec.qwiDirty = false;
      delete rec.qwiError;
    } catch (error) {
      pushError = String(error?.message || error || "erreur inconnue");
      rec.qwiDirty = true;
      rec.qwiError = pushError;
    }

    const rows = state.reports.filter((x) => x.id !== rec.id);
    rows.push(rec);

    unmarkDeleted(rec.id);
    await persistRecords(rows);
    if (pushError) toast(`AAR sauvegarde localement (Drive KO): ${pushError}`);
    else toast(existing ? "AAR modifie (Drive + local)." : "AAR ajoute (Drive + local).");
    openDetail(rec.id);
  }

  async function deleteRecord(recordId) {
    if (!recordId) return;
    const rec = state.reports.find((x) => x.id === recordId);
    if (!rec) return;

    if (!window.confirm(`Supprimer cet AAR ?\n\n${rec.title}`)) return;

    if (rec.driveFileId) {
      try {
        await pushDeleteToDrive(rec);
      } catch (error) {
        toast(`Suppression Drive refusee: ${error.message || error}`);
        return;
      }
    }

    markDeleted(recordId);
    const rows = state.reports.filter((x) => x.id !== recordId);
    await persistRecords(rows);
    closeDetail();

    if (rec.driveFileId) toast("AAR supprime (Drive + local).");
    else toast("AAR supprime localement.");
  }

  function ensureCategoryValueInCatalog(category, value) {
    const def = CATALOG_DEFS[category];
    if (!def) return false;
    const normalized = def.normalize(value);
    if (!normalized) return false;
    const current = getCurrentCatalog();
    const nextValues = normalizeCatalogValues(category, [...(current[category] || []), normalized]);
    const changed = JSON.stringify(nextValues) !== JSON.stringify(current[category] || []);
    if (!changed) return false;
    current[category] = nextValues;
    setCurrentCatalog(current, true);
    return true;
  }

  function buildAdminExampleLabel(record) {
    const title = normalizeTextValue(record?.title || record?.mission?.meta?.title || "AAR sans titre");
    const date = normalizeTextValue(record?.date || record?.mission?.meta?.date || "");
    return date ? `${date} - ${title}` : title;
  }

  function getCandidateReasonLabel(row) {
    const parts = [];
    if (row.fromOtherCount) parts.push(`${row.fromOtherCount} via AUTRE`);
    if (row.fromUnknownCount) parts.push(`${row.fromUnknownCount} hors referentiel`);
    return parts.length ? parts.join(" · ") : `${row.count} AAR`;
  }

  function getMappingOptionsForCandidate(category, sourceValue) {
    const def = CATALOG_DEFS[category];
    if (!def) return [];
    const source = String(def.normalize(sourceValue) || "").trim().toUpperCase();
    return (getEffectiveCatalog()[category] || []).filter((value) => {
      return String(def.normalize(value) || "").trim().toUpperCase() !== source;
    });
  }

  function getAdminPendingSummary() {
    const byCategory = {};
    let total = 0;
    CATALOG_KEYS.forEach((key) => {
      const count = extractOtherCandidates(key).length;
      byCategory[key] = count;
      total += count;
    });
    return { total, byCategory };
  }

  function extractOtherCandidates(category) {
    const def = CATALOG_DEFS[category];
    if (!def) return [];
    const known = getEffectiveCategorySet(category);
    const counts = new Map();

    (state.reports || []).forEach((record) => {
      const meta = record?.mission?.meta || {};
      if (def.contextKey && def.contextValue) {
        const ctx = String(meta?.[def.contextKey] || "").trim().toUpperCase();
        if (ctx !== String(def.contextValue).trim().toUpperCase()) return;
      }

      const selectedRaw = String(meta?.[def.selectKey] || "").trim();
      const otherRaw = String(meta?.[def.otherKey] || "").trim();
      const selected = def.normalize(selectedRaw);
      const other = def.normalize(otherRaw);

      let candidate = "";
      let sourceKind = "";
      if (selectedRaw === "AUTRE" && other) {
        candidate = other;
        sourceKind = "other";
      } else if (selected && !known.has(selected.toUpperCase())) {
        candidate = selected;
        sourceKind = "unknown";
      }
      const normalizedCandidate = def.normalize(candidate);
      if (!normalizedCandidate) return;
      if (known.has(normalizedCandidate.toUpperCase())) return;
      const key = normalizedCandidate.toUpperCase();
      let entry = counts.get(key);
      if (!entry) {
        entry = {
          value: normalizedCandidate,
          count: 0,
          fromOtherCount: 0,
          fromUnknownCount: 0,
          examples: [],
          exampleKeys: new Set()
        };
        counts.set(key, entry);
      }
      entry.count += 1;
      if (sourceKind === "other") entry.fromOtherCount += 1;
      if (sourceKind === "unknown") entry.fromUnknownCount += 1;
      const exampleKey = String(record?.id || buildAdminExampleLabel(record));
      if (!entry.exampleKeys.has(exampleKey) && entry.examples.length < 3) {
        entry.exampleKeys.add(exampleKey);
        entry.examples.push({
          id: String(record?.id || ""),
          label: buildAdminExampleLabel(record)
        });
      }
    });

    return [...counts.values()]
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, "fr"));
  }

  async function applyRecordsMutation(mutator, successLabel) {
    if (adminBusy) return;
    adminBusy = true;
    try {
      const changed = [];
      const now = new Date().toISOString();
      const rows = state.reports.map((record) => {
        const clone = JSON.parse(JSON.stringify(record));
        const hasChanged = mutator(clone);
        if (!hasChanged) return record;
        clone.updatedAt = now;
        changed.push(clone);
        return clone;
      });

      if (!changed.length) {
        toast("Aucune donnee a modifier.");
        return;
      }

      let ok = 0;
      let ko = 0;
      for (const rec of changed) {
        try {
          const driveMeta = await pushUpsertToDrive(rec, rec);
          rec.driveFileId = driveMeta.id || rec.driveFileId || "";
          rec.driveModifiedTime = driveMeta.modifiedTime || rec.driveModifiedTime || "";
          rec.source = "drive_file";
          rec.sourceName = "google_drive_qwi";
          rec.qwiDirty = false;
          delete rec.qwiError;
          ok += 1;
        } catch (error) {
          rec.qwiDirty = true;
          rec.qwiError = String(error?.message || error || "erreur inconnue");
          ko += 1;
        }
      }

      await persistRecords(rows);
      renderAdmin();
      if (ko) toast(`${successLabel}: ${ok} MAJ, ${ko} en echec.`);
      else toast(`${successLabel}: ${ok} AAR mis a jour.`);
    } finally {
      adminBusy = false;
    }
  }

  function applyCategoryValue(meta, category, targetValue) {
    const def = CATALOG_DEFS[category];
    if (!def) return false;
    if (def.contextKey && def.contextValue) {
      const ctx = String(meta?.[def.contextKey] || "").trim().toUpperCase();
      if (ctx !== String(def.contextValue).trim().toUpperCase()) return false;
    }
    const normalizedTarget = def.normalize(targetValue);
    if (!normalizedTarget) return false;
    const current = getMetaValueForCategory(meta, category);
    if (!current) return false;
    if (String(current).toUpperCase() !== String(normalizedTarget).toUpperCase()) return false;
    meta[def.selectKey] = normalizedTarget;
    meta[def.otherKey] = "";
    return true;
  }

  async function mapOtherCandidate(category, sourceValue, targetValue) {
    const def = CATALOG_DEFS[category];
    if (!def) return;
    const source = def.normalize(sourceValue);
    const target = def.normalize(targetValue);
    if (!source || !target) {
      toast("Valeur source/cible invalide.");
      return;
    }
    if (!getEffectiveCategorySet(category).has(String(target).toUpperCase())) {
      ensureCategoryValueInCatalog(category, target);
    }
    await applyRecordsMutation((record) => {
      const meta = record?.mission?.meta || {};
      const current = getMetaValueForCategory(meta, category);
      if (!current) return false;
      if (String(current).toUpperCase() !== String(source).toUpperCase()) return false;
      meta[def.selectKey] = target;
      meta[def.otherKey] = "";
      return true;
    }, `${def.label}: normalisation`);
    try {
      await syncMissionCatalogToBackend(getCurrentCatalog());
    } catch (error) {
      console.warn("Catalog sync failed after mapping", error);
    }
  }

  async function addCatalogItem(category, value) {
    const def = CATALOG_DEFS[category];
    if (!def) return;
    const normalized = def.normalize(value);
    if (!normalized) {
      toast(`${def.label}: valeur invalide.`);
      return;
    }
    const changed = ensureCategoryValueInCatalog(category, normalized);
    renderAdmin();
    if (!changed) {
      toast(`${def.label}: deja present.`);
      return;
    }
    try {
      await syncMissionCatalogToBackend(getCurrentCatalog());
      toast(`${def.label}: element ajoute.`);
    } catch (error) {
      toast(`Ajout local OK, sync backend KO: ${error.message || error}`);
    }
  }

  async function renameCatalogItem(category, oldValue, nextValue) {
    const def = CATALOG_DEFS[category];
    if (!def) return;
    const oldNorm = def.normalize(oldValue);
    const nextNorm = def.normalize(nextValue);
    if (!oldNorm || !nextNorm) {
      toast(`${def.label}: renommage invalide.`);
      return;
    }

    const catalog = getCurrentCatalog();
    const nextList = normalizeCatalogValues(category, (catalog[category] || []).map((value) => {
      return String(value).toUpperCase() === String(oldNorm).toUpperCase() ? nextNorm : value;
    }));
    catalog[category] = nextList;
    setCurrentCatalog(catalog, true);

    await applyRecordsMutation((record) => {
      const meta = record?.mission?.meta || {};
      const current = getMetaValueForCategory(meta, category);
      if (!current) return false;
      if (String(current).toUpperCase() !== String(oldNorm).toUpperCase()) return false;
      meta[def.selectKey] = nextNorm;
      meta[def.otherKey] = "";
      return true;
    }, `${def.label}: renommage`);

    try {
      await syncMissionCatalogToBackend(getCurrentCatalog());
    } catch (error) {
      toast(`Renommage local OK, sync backend KO: ${error.message || error}`);
      return;
    }
    renderAdmin();
  }

  async function deleteCatalogItem(category, value) {
    const def = CATALOG_DEFS[category];
    if (!def) return;
    const normalized = def.normalize(value);
    if (!normalized) return;
    if (!window.confirm(`Supprimer '${normalized}' de ${def.label} ?`)) return;

    const catalog = getCurrentCatalog();
    const nextList = (catalog[category] || []).filter((item) => {
      return String(item).toUpperCase() !== String(normalized).toUpperCase();
    });
    catalog[category] = normalizeCatalogValues(category, nextList);
    setCurrentCatalog(catalog, true);
    renderAdmin();

    try {
      await syncMissionCatalogToBackend(getCurrentCatalog());
      toast(`${def.label}: element supprime.`);
    } catch (error) {
      toast(`Suppression locale OK, sync backend KO: ${error.message || error}`);
    }
  }

  function renderAdminCard(category, candidates = []) {
    const def = CATALOG_DEFS[category];
    const officialCatalog = getCurrentCatalog();
    const effectiveCatalog = getEffectiveCatalog();
    const values = effectiveCatalog[category] || [];
    const searchValue = String(adminCatalogSearch[category] || "");
    const query = normalizeTextValue(searchValue);
    const filteredValues = query
      ? values.filter((value) => normalizeTextValue(value).toUpperCase().includes(query.toUpperCase()))
      : values;
    const renderLimit = query ? filteredValues.length : Math.min(filteredValues.length, 120);
    const visibleValues = filteredValues.slice(0, renderLimit);
    const singular = esc(def.singular || def.label.toLowerCase());

    return `
      <article class="admin-card" data-category="${esc(category)}">
        <div class="admin-card-head">
          <div>
            <h3>${esc(def.label)}</h3>
            <div class="admin-note">Classe ici les valeurs proposees par les AAR pour obtenir un referentiel propre et reutilisable.</div>
          </div>
          <div class="admin-chip ${candidates.length ? "admin-chip-alert" : "admin-chip-ok"}">
            ${candidates.length ? `${candidates.length} a classer` : `Rien a classer`}
          </div>
        </div>

        <div class="admin-section">
          <div class="admin-section-title">1. Valeurs a classer</div>
          <div class="admin-section-help">Si la valeur doit devenir officielle, clique sur "Creer". Si c'est une variante d'une valeur existante, choisis la cible puis clique sur "Rattacher".</div>
        </div>
        <div class="admin-list admin-list-pending">
          ${candidates.length ? candidates.map((row, idx) => `
            <div class="admin-item admin-item-pending">
              <div class="admin-item-top">
                <div>
                  <div class="admin-item-value">${esc(row.value)}</div>
                  <div class="admin-item-meta">${esc(getCandidateReasonLabel(row))}</div>
                </div>
                <div class="admin-item-count">${row.count} AAR</div>
              </div>
              ${row.examples.length ? `<div class="admin-item-examples">${row.examples.map((example) => `<button class="admin-example-chip" data-admin-open-record="${esc(example.id || "")}" type="button">${esc(example.label || "")}</button>`).join("")}</div>` : ""}
              <div class="admin-action-grid">
                <button class="admin-btn admin-btn-primary" data-admin-create-btn="${esc(category)}" data-admin-source="${esc(row.value)}" type="button">Creer ce ${singular}</button>
                <select class="admin-select" data-admin-map-select="${esc(category)}" data-admin-source="${esc(row.value)}" data-admin-idx="${idx}">
                  <option value="">Rattacher a une valeur existante...</option>
                  ${getMappingOptionsForCandidate(category, row.value).map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}
                </select>
                <button class="admin-btn" data-admin-map-btn="${esc(category)}" data-admin-source="${esc(row.value)}" data-admin-idx="${idx}" type="button">Rattacher</button>
              </div>
            </div>
          `).join("") : `<div class="admin-empty">Aucune valeur en attente. Tout ce qui a ete propose par les AAR existe deja dans ce referentiel.</div>`}
        </div>

        <div class="admin-section">
          <div class="admin-section-title">2. Ajouter manuellement</div>
          <div class="admin-section-help">Utilise cette zone pour creer une valeur officielle, meme si aucun AAR ne l'a encore proposee.</div>
          <div class="admin-row">
            <input class="admin-input" data-admin-add-input="${esc(category)}" placeholder="Ajouter un ${singular}">
            <button class="admin-btn admin-btn-primary" data-admin-add-btn="${esc(category)}" type="button">Ajouter</button>
          </div>
        </div>

        <div class="admin-section">
          <div class="admin-section-title">3. Referentiel actuel</div>
          <div class="admin-section-help">Cette liste correspond aux valeurs effectivement proposees dans la PWA AAR. Les valeurs marquees "Socle AAR" viennent du formulaire embarque; les valeurs "Officiel QWI" viennent du referentiel dynamique.</div>
          <div class="admin-row">
            <input class="admin-input" data-admin-search-input="${esc(category)}" value="${esc(searchValue)}" placeholder="Filtrer le referentiel ${singular}">
          </div>
          <div class="admin-note">${values.length} valeur(s) disponibles au total${query ? `, ${filteredValues.length} correspondance(s)` : ""}${(!query && filteredValues.length > renderLimit) ? `, affichage des ${renderLimit} premieres` : ""}.</div>
        </div>
        <div class="admin-list">
          ${visibleValues.length ? visibleValues.map((value) => `
            <div class="admin-item">
              <div class="admin-item-top">
                <div class="admin-item-value">${esc(value)}</div>
                <div class="admin-item-meta">${isOfficialCatalogValue(category, value) ? "Officiel QWI" : "Socle AAR"}</div>
              </div>
              ${isOfficialCatalogValue(category, value) ? `
              <div class="admin-row">
                <button class="admin-btn" data-admin-rename-btn="${esc(category)}" data-admin-value="${esc(value)}" type="button">Renommer</button>
                <button class="admin-btn admin-btn-danger" data-admin-delete-btn="${esc(category)}" data-admin-value="${esc(value)}" type="button">Supprimer</button>
              </div>` : ""}
            </div>
          `).join("") : `<div class="admin-empty">${values.length ? "Aucune valeur ne correspond au filtre." : "Aucun element disponible dans ce referentiel."}</div>`}
        </div>
      </article>
    `;
  }

  function bindAdminEvents(container) {
    if (!container) return;

    container.querySelectorAll("[data-admin-add-input]").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const category = input.getAttribute("data-admin-add-input");
        addCatalogItem(category, input.value).then(() => {
          input.value = "";
        });
      });
    });

    container.querySelectorAll("[data-admin-add-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const category = btn.getAttribute("data-admin-add-btn");
        const input = container.querySelector(`[data-admin-add-input="${category}"]`);
        const value = input ? input.value : "";
        addCatalogItem(category, value).then(() => {
          if (input) input.value = "";
        });
      });
    });

    container.querySelectorAll("[data-admin-search-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const category = input.getAttribute("data-admin-search-input");
        adminCatalogSearch[category] = input.value || "";
        renderAdmin(container);
      });
    });

    container.querySelectorAll("[data-admin-create-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const category = btn.getAttribute("data-admin-create-btn");
        const source = btn.getAttribute("data-admin-source") || "";
        await mapOtherCandidate(category, source, source);
      });
    });

    container.querySelectorAll("[data-admin-rename-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const category = btn.getAttribute("data-admin-rename-btn");
        const value = btn.getAttribute("data-admin-value") || "";
        const next = window.prompt("Nouveau libelle :", value);
        if (next === null) return;
        await renameCatalogItem(category, value, next);
      });
    });

    container.querySelectorAll("[data-admin-delete-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const category = btn.getAttribute("data-admin-delete-btn");
        const value = btn.getAttribute("data-admin-value") || "";
        await deleteCatalogItem(category, value);
      });
    });

    container.querySelectorAll("[data-admin-map-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const category = btn.getAttribute("data-admin-map-btn");
        const source = btn.getAttribute("data-admin-source") || "";
        const idx = btn.getAttribute("data-admin-idx") || "";
        const select = container.querySelector(`[data-admin-map-select="${category}"][data-admin-idx="${idx}"]`);
        const selected = select ? String(select.value || "") : "";
        if (!selected) {
          toast("Selectionne une cible.");
          return;
        }
        const target = selected === "__NEW__" ? source : selected;
        await mapOtherCandidate(category, source, target);
      });
    });

    container.querySelectorAll("[data-admin-open-record]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const recordId = String(btn.getAttribute("data-admin-open-record") || "").trim();
        if (!recordId) {
          toast("AAR introuvable.");
          return;
        }
        if (typeof setView === "function") setView("list");
        openDetail(recordId);
      });
    });
  }

  function renderAdmin(targetEl = document.getElementById("view-admin")) {
    if (!targetEl) return;
    const officialCatalog = getCurrentCatalog();
    const effectiveCatalog = getEffectiveCatalog();
    const totalOfficialValues = CATALOG_KEYS.reduce((sum, key) => sum + ((officialCatalog[key] || []).length), 0);
    const totalAvailableValues = CATALOG_KEYS.reduce((sum, key) => sum + ((effectiveCatalog[key] || []).length), 0);
    const pendingSummary = getAdminPendingSummary();

    targetEl.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-header">
          <div>
            <div class="admin-title">Administration des referentiels QWI</div>
            <div class="admin-subtitle">But: transformer les valeurs proposees par les AAR en valeurs officielles simples a reutiliser dans toute l'application.</div>
          </div>
          <div class="admin-kpis">
            <div class="admin-chip ${pendingSummary.total ? "admin-chip-alert" : "admin-chip-ok"}">${pendingSummary.total} valeur(s) a classer</div>
            <div class="admin-chip">${totalAvailableValues} valeur(s) visibles dans la PWA AAR</div>
            <div class="admin-chip">${totalOfficialValues} valeur(s) officielles QWI</div>
          </div>
        </div>
        <div class="admin-guide">
          <div class="admin-step"><span>1</span> Va d'abord dans "Valeurs a classer".</div>
          <div class="admin-step"><span>2</span> Clique sur "Creer" si la valeur doit devenir officielle.</div>
          <div class="admin-step"><span>3</span> Utilise "Rattacher" si c'est juste une variante d'une valeur existante.</div>
          <div class="admin-step"><span>4</span> Si tu supprimes une valeur officielle encore utilisee dans un AAR, elle redevient simplement "a classer".</div>
        </div>
        <div class="admin-grid">
          ${CATALOG_KEYS.map((key) => renderAdminCard(key, extractOtherCandidates(key))).join("")}
        </div>
      </div>
    `;

    bindAdminEvents(targetEl);
  }

  function injectDetailActions() {
    if (!state.openDetailId) return;

    const header = document.querySelector("#detail-sheet .detail-header");
    if (!header) return;

    let actions = document.getElementById("detail-qwi-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.id = "detail-qwi-actions";
      actions.className = "detail-qwi-actions";
      actions.innerHTML = `
        <button class="detail-qwi-btn" data-qwi-action="edit" type="button">Modifier</button>
        <button class="detail-qwi-btn" data-qwi-action="delete" type="button">Supprimer</button>
        <button class="detail-qwi-btn" data-qwi-action="new" type="button">Nouveau</button>
      `;

      if (el.detailMetaLine && el.detailMetaLine.parentNode === header) {
        el.detailMetaLine.insertAdjacentElement("afterend", actions);
      } else {
        header.appendChild(actions);
      }
    }

    const recordId = state.openDetailId;
    const editBtn = actions.querySelector('[data-qwi-action="edit"]');
    const deleteBtn = actions.querySelector('[data-qwi-action="delete"]');
    const newBtn = actions.querySelector('[data-qwi-action="new"]');

    if (editBtn) editBtn.onclick = () => openEditor(recordId);
    if (deleteBtn) deleteBtn.onclick = () => deleteRecord(recordId);
    if (newBtn) newBtn.onclick = () => openEditor();
  }

  async function connectDrive() {
    try {
      await ensureDriveAccess(true);
      toast("Connexion Google Drive OK.");
    } catch (error) {
      toast(`Connexion Drive impossible: ${error.message || error}`);
    }
  }

  async function initMissionCatalog() {
    baseCatalog = buildBaseCatalogFromEditorConfig();
    const localCatalog = readCatalogFromStorage();
    let merged = localCatalog;

    if (usesAppsScriptBackend()) {
      try {
        const remoteCatalog = await fetchRemoteCatalogFromBackend();
        merged = mergeCatalogs(remoteCatalog, merged);
      } catch (error) {
        console.warn("Remote mission catalog unavailable", error);
      }
    }

    setCurrentCatalog(merged, true);
    if (state.mode === "admin") renderAdmin();
  }

  function installTopActions() {
    const newBtn = document.getElementById("qwi-new-btn");
    if (newBtn) newBtn.addEventListener("click", () => openEditor());

    const driveBtn = document.getElementById("qwi-drive-btn");
    if (driveBtn) {
      if (usesAppsScriptBackend()) {
        driveBtn.style.display = "none";
        driveBtn.setAttribute("aria-hidden", "true");
      } else {
        driveBtn.addEventListener("click", connectDrive);
      }
    }

    if (el.syncBtn) {
      el.syncBtn.title = "Synchroniser (conserve les modifications QWI locales)";
    }

    if (usesAppsScriptBackend()) {
      setDriveButtonState({ connected: true, busy: false });
    } else {
      setDriveButtonState({ connected: false, busy: false });
      trySilentDriveReconnect();
    }
  }

  const baseOpenDetail = openDetail;
  openDetail = function patchedOpenDetail(id) {
    baseOpenDetail(id);
    injectDetailActions();
  };

  const baseCloseDetail = closeDetail;
  closeDetail = function patchedCloseDetail() {
    baseCloseDetail();
    const actions = document.getElementById("detail-qwi-actions");
    if (actions) actions.remove();
  };

  const baseSyncPreferred = syncPreferred;
  syncPreferred = async function patchedSyncPreferred(opts = {}) {
    const localRecords = state.reports.filter((x) => x.source === LOCAL_SOURCE || x.qwiDirty);
    let deletedIds = getDeletedIds();

    await baseSyncPreferred(opts);

    // If Drive sync is unavailable and we are on static source, do not keep stale local deletions.
    const hasDriveRecords = state.reports.some((x) => x.source === "drive_file");
    if (!hasDriveRecords && deletedIds.size) {
      saveDeletedIds(new Set());
      deletedIds = new Set();
    }

    let merged = state.reports.filter((x) => !deletedIds.has(x.id));
    for (const localRec of localRecords) {
      merged = merged.filter((x) => x.id !== localRec.id);
      merged.push(localRec);
    }

    if (merged.length !== state.reports.length || localRecords.length || deletedIds.size) {
      await persistRecords(merged);
    }

    if (state.mode === "admin") renderAdmin();
  };

  window.addEventListener("message", async (evt) => {
    const msg = evt.data;
    if (!msg || msg.type !== "aar-qwi-save") return;

    const sessionId = String(msg.session || "");
    if (!sessions.has(sessionId)) return;

    let incomingCatalog = null;
    try {
      if (msg.missionCatalog && typeof msg.missionCatalog === "object") {
        incomingCatalog = normalizeCatalogObject(msg.missionCatalog);
      } else if (Array.isArray(msg.hashtagsCatalog)) {
        incomingCatalog = normalizeCatalogObject({ hashtags: msg.hashtagsCatalog });
      }

      await upsertFromEditor(sessionId, msg.aar || msg.data || {});

      if (incomingCatalog) {
        const mergedCatalog = mergeCatalogs(getCurrentCatalog(), incomingCatalog);
        setCurrentCatalog(mergedCatalog, true);
        if (state.mode === "admin") renderAdmin();
        try {
          await syncMissionCatalogToBackend(mergedCatalog);
        } catch (error) {
          console.warn("Mission catalog sync failed", error);
        }
      }
    } catch (error) {
      console.error("QWI editor save failed", error);
      toast(`Echec enregistrement: ${error.message || error}`);
    } finally {
      sessions.delete(sessionId);
      localStorage.removeItem(requestKey(sessionId));
    }
  });

  const deletedIds = getDeletedIds();
  if (deletedIds.size) {
    const hasDriveRecords = state.reports.some((x) => x.source === "drive_file");
    if (!hasDriveRecords) {
      saveDeletedIds(new Set());
    } else {
      const next = state.reports.filter((x) => !deletedIds.has(x.id));
      if (next.length !== state.reports.length) {
        persistRecords(next).catch((e) => console.warn("Failed to apply deleted IDs", e));
      }
    }
  }

  window.QwiMode = Object.assign({}, window.QwiMode || {}, {
    renderAdmin
  });

  installTopActions();
  initMissionCatalog().catch((error) => {
    console.warn("Mission catalog init failed", error);
  });
})();
