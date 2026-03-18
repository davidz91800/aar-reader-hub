/* QWI mode: add / edit / delete AARs and push to Google Drive */
(function () {
  const LOCAL_SOURCE = "qwi_local";
  const REQUEST_PREFIX = "aar_qwi_editor_request:";
  const DELETED_KEY = "aar_qwi_deleted_ids_v1";
  const MISSION_CATALOG_KEY = "aar_mission_catalog_v1";
  const HASHTAG_CATALOG_KEY = "aar_hashtag_catalog_v1";
  const ADMIN_UI_STATE_KEY = "aar_qwi_admin_ui_v2";
  const EDITOR_RELATIVE_URL = "./aar-pwa/AAR.html";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
  const sessions = new Map();
  const CATALOG_DEFS = {
    hashtags: { label: "Hashtags", singular: "hashtag", normalize: (value) => normalizeHashtag(value), selectKey: "hashtag", otherKey: "hashtagAutre", arrayKey: "hashtags" },
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
  let effectiveCatalogCache = null;
  const effectiveCategorySetCache = new Map();
  let adminActiveCategory = CATALOG_KEYS[0];
  let adminOpenHelpKey = "";
  const adminCatalogSearch = {};
  let confirmUi = null;

  function ensureConfirmUi() {
    if (confirmUi) return confirmUi;

    if (!document.getElementById("qwi-confirm-style")) {
      const style = document.createElement("style");
      style.id = "qwi-confirm-style";
      style.textContent = `
        .qwi-confirm-overlay{
          position:fixed; inset:0; z-index:9999; display:none;
          align-items:center; justify-content:center; padding:20px;
          background:rgba(2,6,23,.72); backdrop-filter:blur(4px);
        }
        .qwi-confirm-overlay.open{display:flex;}
        .qwi-confirm-card{
          width:min(560px,96vw);
          border-radius:16px;
          border:1px solid rgba(59,130,246,.35);
          background:linear-gradient(180deg,rgba(30,41,59,.98),rgba(15,23,42,.98));
          box-shadow:0 24px 56px rgba(2,6,23,.62),inset 0 0 0 1px rgba(148,163,184,.06);
          padding:18px 18px 16px;
          color:#e2e8f0;
          transform:translateY(10px);
          opacity:0;
          transition:transform .18s ease,opacity .18s ease;
        }
        .qwi-confirm-overlay.open .qwi-confirm-card{transform:translateY(0); opacity:1;}
        .qwi-confirm-title{
          margin:0 0 10px 0;
          font-weight:800;
          font-size:16px;
          letter-spacing:.2px;
          color:#f8fafc;
        }
        .qwi-confirm-message{
          margin:0;
          white-space:pre-line;
          line-height:1.45;
          font-size:14px;
          color:#cbd5e1;
        }
        .qwi-confirm-input-wrap{margin-top:12px;}
        .qwi-confirm-input{
          width:100%;
          border-radius:10px;
          border:1px solid rgba(100,116,139,.45);
          background:rgba(2,6,23,.75);
          color:#f8fafc;
          padding:10px 12px;
          font-size:14px;
          outline:none;
        }
        .qwi-confirm-input:focus{
          border-color:rgba(59,130,246,.9);
          box-shadow:0 0 0 3px rgba(59,130,246,.2);
        }
        .qwi-confirm-actions{
          margin-top:14px;
          display:flex;
          justify-content:flex-end;
          gap:10px;
        }
        .qwi-confirm-btn{
          border:1px solid rgba(71,85,105,.65);
          background:rgba(30,41,59,.85);
          color:#e2e8f0;
          border-radius:10px;
          padding:8px 13px;
          font-size:13px;
          font-weight:700;
          cursor:pointer;
        }
        .qwi-confirm-btn:hover{border-color:rgba(148,163,184,.9); color:#fff;}
        .qwi-confirm-btn.primary{
          border-color:rgba(59,130,246,.95);
          background:linear-gradient(180deg,#1d4ed8,#1e40af);
          color:#eff6ff;
        }
        .qwi-confirm-btn.danger{
          border-color:rgba(239,68,68,.85);
          background:linear-gradient(180deg,#dc2626,#991b1b);
          color:#fee2e2;
        }
      `;
      document.head.appendChild(style);
    }

    const overlay = document.createElement("div");
    overlay.className = "qwi-confirm-overlay";
    overlay.innerHTML = `
      <div class="qwi-confirm-card" role="dialog" aria-modal="true" aria-labelledby="qwi-confirm-title">
        <h3 id="qwi-confirm-title" class="qwi-confirm-title"></h3>
        <p class="qwi-confirm-message"></p>
        <div class="qwi-confirm-input-wrap" hidden>
          <input class="qwi-confirm-input" type="text" autocomplete="off" />
        </div>
        <div class="qwi-confirm-actions">
          <button type="button" class="qwi-confirm-btn" data-role="cancel">Annuler</button>
          <button type="button" class="qwi-confirm-btn primary" data-role="confirm">Confirmer</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const titleEl = overlay.querySelector(".qwi-confirm-title");
    const messageEl = overlay.querySelector(".qwi-confirm-message");
    const inputWrap = overlay.querySelector(".qwi-confirm-input-wrap");
    const inputEl = overlay.querySelector(".qwi-confirm-input");
    const cancelBtn = overlay.querySelector('[data-role="cancel"]');
    const confirmBtn = overlay.querySelector('[data-role="confirm"]');

    const state = { resolver: null, activeEl: null };

    const close = (payload) => {
      if (!state.resolver) return;
      const done = state.resolver;
      state.resolver = null;
      overlay.classList.remove("open");
      const previous = state.activeEl;
      state.activeEl = null;
      if (previous && typeof previous.focus === "function") {
        setTimeout(() => previous.focus(), 0);
      }
      done(payload);
    };

    cancelBtn.addEventListener("click", () => close({ ok: false }));
    confirmBtn.addEventListener("click", () => {
      close({
        ok: true,
        value: inputWrap.hidden ? "" : String(inputEl.value || "")
      });
    });

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close({ ok: false });
    });

    document.addEventListener("keydown", (event) => {
      if (!overlay.classList.contains("open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close({ ok: false });
        return;
      }
      if (event.key === "Enter" && !inputWrap.hidden && document.activeElement === inputEl) {
        event.preventDefault();
        close({ ok: true, value: String(inputEl.value || "") });
      }
    });

    confirmUi = {
      open: (options = {}) => {
        if (state.resolver) {
          const pending = state.resolver;
          state.resolver = null;
          pending({ ok: false });
        }
        state.activeEl = document.activeElement;
        titleEl.textContent = String(options.title || "Confirmation");
        messageEl.textContent = String(options.message || "");
        const withInput = !!options.withInput;
        inputWrap.hidden = !withInput;
        if (withInput) {
          inputEl.value = String(options.inputValue || "");
          inputEl.placeholder = String(options.inputPlaceholder || "");
        } else {
          inputEl.value = "";
          inputEl.placeholder = "";
        }
        cancelBtn.textContent = String(options.cancelLabel || "Annuler");
        confirmBtn.textContent = String(options.confirmLabel || "Confirmer");
        confirmBtn.classList.toggle("danger", options.kind === "danger");
        confirmBtn.classList.toggle("primary", options.kind !== "danger");
        overlay.classList.add("open");
        setTimeout(() => {
          if (withInput) inputEl.focus();
          else confirmBtn.focus();
        }, 20);
        return new Promise((resolve) => {
          state.resolver = resolve;
        });
      }
    };

    return confirmUi;
  }

  async function askConfirmation(options = {}) {
    const ui = ensureConfirmUi();
    const result = await ui.open(options);
    return !!(result && result.ok);
  }

  async function askTextInput(options = {}) {
    const ui = ensureConfirmUi();
    const result = await ui.open({ ...options, withInput: true });
    if (!result || !result.ok) return null;
    return String(result.value || "");
  }

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

  function readAdminUiState() {
    try {
      const raw = localStorage.getItem(ADMIN_UI_STATE_KEY);
      if (!raw) return { activeCategory: CATALOG_KEYS[0], searches: {} };
      const parsed = JSON.parse(raw);
      return {
        activeCategory: CATALOG_KEYS.includes(parsed?.activeCategory) ? parsed.activeCategory : CATALOG_KEYS[0],
        searches: parsed?.searches && typeof parsed.searches === "object" ? parsed.searches : {}
      };
    } catch {
      return { activeCategory: CATALOG_KEYS[0], searches: {} };
    }
  }

  function saveAdminUiState() {
    try {
      localStorage.setItem(ADMIN_UI_STATE_KEY, JSON.stringify({
        activeCategory: adminActiveCategory,
        searches: adminCatalogSearch
      }));
    } catch {
      // Ignore localStorage failures.
    }
  }

  {
    const savedAdminUi = readAdminUiState();
    adminActiveCategory = savedAdminUi.activeCategory;
    Object.assign(adminCatalogSearch, savedAdminUi.searches || {});
  }

  function cloneCatalog(catalog) {
    const src = catalog && typeof catalog === "object" ? catalog : createEmptyCatalog();
    return {
      hashtags: [...(src.hashtags || [])],
      countries: [...(src.countries || [])],
      oaci: [...(src.oaci || [])],
      operations: [...(src.operations || [])],
      exercises: [...(src.exercises || [])]
    };
  }

  function invalidateCatalogCaches() {
    effectiveCatalogCache = null;
    effectiveCategorySetCache.clear();
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
    const base = baseCatalog || createEmptyCatalog();
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

  function getMetaValuesForCategory(meta, key) {
    const def = CATALOG_DEFS[key];
    if (!def) return [];
    if (def.contextKey && def.contextValue) {
      const ctx = String(meta?.[def.contextKey] || "").trim().toUpperCase();
      if (ctx !== String(def.contextValue || "").trim().toUpperCase()) return [];
    }
    if (def.arrayKey) {
      const values = normalizeCatalogValues(key, meta?.[def.arrayKey]);
      if (values.length) return values;
    }
    const selected = String(meta?.[def.selectKey] || "").trim();
    const other = String(meta?.[def.otherKey] || "").trim();
    const resolved = selected === "AUTRE" ? def.normalize(other) : def.normalize(selected);
    return resolved ? [resolved] : [];
  }

  function getMetaValueForCategory(meta, key) {
    const values = getMetaValuesForCategory(meta, key);
    return values.length ? values[0] : "";
  }

  function syncLegacyHashtagMeta(meta) {
    if (!meta || typeof meta !== "object") return;
    const hashtags = uniqueHashtags(meta.hashtags || []);
    meta.hashtags = hashtags;
    if (!hashtags.length) {
      meta.hashtag = "";
      meta.hashtagAutre = "";
      return;
    }
    const first = hashtags[0];
    if (getEffectiveCategorySet("hashtags").has(String(first).toUpperCase())) {
      meta.hashtag = first;
      meta.hashtagAutre = "";
    } else {
      meta.hashtag = "AUTRE";
      meta.hashtagAutre = first;
    }
  }

  function collectKnownCatalogFromReports() {
    const out = createEmptyCatalog();
    (state.reports || []).forEach((record) => {
      const meta = record?.mission?.meta || {};
      CATALOG_KEYS.forEach((key) => {
        const values = getMetaValuesForCategory(meta, key);
        if (values.length) out[key].push(...values);
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
    return cloneCatalog(currentCatalog || createEmptyCatalog());
  }

  function getBaseCatalog() {
    return baseCatalog || createEmptyCatalog();
  }

  function getEffectiveCatalog() {
    if (!effectiveCatalogCache) {
      effectiveCatalogCache = mergeCatalogs(getBaseCatalog(), getCurrentCatalog());
    }
    return effectiveCatalogCache;
  }

  function setCurrentCatalog(catalog, persist = true) {
    currentCatalog = compactCatalogAgainstBase(catalog);
    invalidateCatalogCaches();
    if (persist) writeCatalogToStorage(currentCatalog);
  }

  function getEffectiveCategorySet(key) {
    if (!effectiveCategorySetCache.has(key)) {
      const effective = getEffectiveCatalog();
      const list = (effective && Array.isArray(effective[key])) ? effective[key] : [];
      effectiveCategorySetCache.set(key, new Set(list.map((value) => String(value || "").toUpperCase())));
    }
    return effectiveCategorySetCache.get(key);
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

  function getRecordWorkflowStatus(record) {
    if (typeof normalizeWorkflowStatus === "function") {
      return normalizeWorkflowStatus(record?.mission?.meta?.workflowStatus || record?.workflowStatus);
    }
    return String(record?.mission?.meta?.workflowStatus || record?.workflowStatus || "").trim().toUpperCase() === "PENDING_QWI_REVIEW"
      ? "PENDING_QWI_REVIEW"
      : "PUBLISHED";
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

  async function publishRecord(recordId) {
    if (!recordId) return;
    const existing = state.reports.find((x) => x.id === recordId);
    if (!existing) return;
    if (getRecordWorkflowStatus(existing) !== "PENDING_QWI_REVIEW") {
      toast("Cet AAR est deja publie.");
      return;
    }
    const canPublish = await askConfirmation({
      title: "Publication Reader",
      message: `Publier cet AAR sur le Reader non QWI ?\n\n${existing.title || "AAR sans titre"}`,
      confirmLabel: "Publier",
      cancelLabel: "Annuler"
    });
    if (!canPublish) return;

    const rec = JSON.parse(JSON.stringify(existing));
    rec.mission = normalizeAar(rec.mission || {});
    rec.mission.meta.workflowStatus = "PUBLISHED";
    rec.mission.meta.qwiReviewedAt = new Date().toISOString();
    rec.mission.meta.publishedAt = rec.mission.meta.qwiReviewedAt;
    rec.workflowStatus = "PUBLISHED";
    rec.updatedAt = new Date().toISOString();

    try {
      const driveMeta = await pushUpsertToDrive(rec, existing);
      rec.driveFileId = driveMeta.id || rec.driveFileId || "";
      rec.driveModifiedTime = driveMeta.modifiedTime || rec.driveModifiedTime || "";
      rec.source = "drive_file";
      rec.sourceName = "google_drive_qwi";
      rec.qwiDirty = false;
      delete rec.qwiError;
      const rows = state.reports.filter((x) => x.id !== rec.id);
      rows.push(rec);
      await persistRecords(rows);
      toast("AAR publie sur le Reader.");
      openDetail(rec.id);
    } catch (error) {
      toast(`Publication impossible: ${error?.message || error}`);
    }
  }

  async function deleteRecord(recordId) {
    if (!recordId) return;
    const rec = state.reports.find((x) => x.id === recordId);
    if (!rec) return;

    const canDelete = await askConfirmation({
      title: "Suppression AAR",
      message: `Supprimer cet AAR ?\n\n${rec.title}`,
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      kind: "danger"
    });
    if (!canDelete) return;

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

  function getAdminCatalogView(category, searchValue) {
    const effectiveCatalog = getEffectiveCatalog();
    const officialCatalog = getCurrentCatalog();
    const values = effectiveCatalog[category] || [];
    const officialValues = officialCatalog[category] || [];
    const query = normalizeTextValue(searchValue);
    const filteredValues = query
      ? values.filter((value) => normalizeTextValue(value).toUpperCase().includes(query.toUpperCase()))
      : values;

    const hidesFullBaseByDefault = category === "oaci" || category === "countries";
    const renderLimit = query ? filteredValues.length : Math.min(filteredValues.length, 120);
    let visibleValues = filteredValues.slice(0, renderLimit);
    let noteSuffix = `${values.length} valeur(s) disponibles au total${query ? `, ${filteredValues.length} correspondance(s)` : ""}`;
    let emptyText = values.length ? "Aucune valeur ne correspond au filtre." : "Aucun element disponible dans ce referentiel.";

    if (hidesFullBaseByDefault && !query) {
      visibleValues = [...officialValues];
      if (category === "oaci") {
        noteSuffix = `${values.length} code(s) disponibles dans la PWA AAR. Le socle OACI complet est masque ici par defaut; tape un code pour le rechercher.`;
        emptyText = officialValues.length
          ? "Aucune valeur ne correspond au filtre."
          : "Aucun code OACI officiel QWI.";
      } else if (category === "countries") {
        noteSuffix = `${values.length} pays disponibles dans la PWA AAR. Le socle pays complet est masque ici par defaut; tape un pays pour le rechercher.`;
        emptyText = officialValues.length
          ? "Aucune valeur ne correspond au filtre."
          : "Aucun pays officiel QWI.";
      }
    } else if (!query && filteredValues.length > renderLimit) {
      noteSuffix += `, affichage des ${renderLimit} premieres.`;
    } else {
      noteSuffix += ".";
    }

    return {
      values,
      filteredValues,
      visibleValues,
      noteText: noteSuffix,
      emptyText,
      query,
      hidesFullBaseByDefault,
      isCollapsedBase: hidesFullBaseByDefault && !query
    };
  }

  function extractOtherCandidates(category) {
    const def = CATALOG_DEFS[category];
    if (!def) return [];
    const known = getEffectiveCategorySet(category);
    const counts = new Map();

    const registerCandidate = (record, candidate, sourceKind) => {
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
    };

    (state.reports || []).forEach((record) => {
      const meta = record?.mission?.meta || {};
      if (def.contextKey && def.contextValue) {
        const ctx = String(meta?.[def.contextKey] || "").trim().toUpperCase();
        if (ctx !== String(def.contextValue).trim().toUpperCase()) return;
      }

      if (def.arrayKey) {
        getMetaValuesForCategory(meta, category).forEach((value) => {
          if (!known.has(String(value).toUpperCase())) registerCandidate(record, value, "unknown");
        });
        return;
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
      registerCandidate(record, candidate, sourceKind);
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
    if (def.arrayKey) {
      const currentValues = getMetaValuesForCategory(meta, category);
      if (!currentValues.length) return false;
      if (!currentValues.some((value) => String(value).toUpperCase() === String(normalizedTarget).toUpperCase())) return false;
      meta[def.arrayKey] = normalizeCatalogValues(category, currentValues);
      syncLegacyHashtagMeta(meta);
      return true;
    }
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
      if (def.arrayKey) {
        const currentValues = getMetaValuesForCategory(meta, category);
        if (!currentValues.length) return false;
        let changed = false;
        const nextValues = currentValues.map((value) => {
          if (String(value).toUpperCase() !== String(source).toUpperCase()) return value;
          changed = true;
          return target;
        });
        if (!changed) return false;
        meta[def.arrayKey] = normalizeCatalogValues(category, nextValues);
        syncLegacyHashtagMeta(meta);
        return true;
      }
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
      if (def.arrayKey) {
        const currentValues = getMetaValuesForCategory(meta, category);
        if (!currentValues.length) return false;
        let changed = false;
        const nextValues = currentValues.map((value) => {
          if (String(value).toUpperCase() !== String(oldNorm).toUpperCase()) return value;
          changed = true;
          return nextNorm;
        });
        if (!changed) return false;
        meta[def.arrayKey] = normalizeCatalogValues(category, nextValues);
        syncLegacyHashtagMeta(meta);
        return true;
      }
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
    const canDelete = await askConfirmation({
      title: `Suppression ${def.singular || "element"}`,
      message: `Supprimer '${normalized}' de ${def.label} ?`,
      confirmLabel: "Supprimer",
      cancelLabel: "Annuler",
      kind: "danger"
    });
    if (!canDelete) return;

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

  function getAdminHelpContent(kind, category, model) {
    const def = CATALOG_DEFS[category] || {};
    const label = String(def.label || "").trim();
    const lowerLabel = label ? label.toLowerCase() : "valeurs";
    const extraBaseNote = model?.view?.isCollapsedBase
      ? "Le socle embarque complet n'est pas affiche d'un bloc ici. Utilise le filtre pour aller chercher une valeur precise."
      : "";

    switch (kind) {
      case "overview":
        return {
          title: "Mode d'emploi",
          body: [
            "Chaque sous-onglet gere un referentiel visible dans la PWA AAR.",
            "Commence par 'A classer'. 'Creer' officialise la valeur telle quelle. 'Rattacher' remplace une variante par une valeur deja existante dans les AAR concernes.",
            "Si une valeur officielle est supprimee alors qu'elle est encore utilisee, elle ne disparait pas des AAR: elle redevient simplement 'a classer'."
          ]
        };
      case "category":
        return {
          title: `Referentiel ${label}`,
          body: [
            `Ce sous-onglet pilote les valeurs ${lowerLabel} proposees aux redacteurs dans la PWA AAR.`,
            extraBaseNote || "Les valeurs officielles QWI s'ajoutent au socle embarque du formulaire."
          ].filter(Boolean)
        };
      case "pending":
        return {
          title: "Valeurs a classer",
          body: [
            "Cette liste montre les valeurs vues dans les AAR mais pas encore presentes dans le referentiel officiel.",
            "Utilise 'Creer' si la valeur doit devenir officielle telle quelle. Utilise 'Rattacher' si c'est juste une variante d'une valeur deja existante."
          ]
        };
      case "add":
        return {
          title: "Ajouter manuellement",
          body: [
            "Ajoute ici une valeur officielle meme si aucun AAR ne l'a encore proposee.",
            "Une fois synchronisee, elle sera disponible pour les redacteurs dans la PWA AAR."
          ]
        };
      case "catalog":
        return {
          title: "Referentiel actuel",
          body: [
            "Cette liste correspond a ce que la PWA AAR sait proposer aux redacteurs.",
            "Socle AAR = valeur deja embarquee dans le formulaire. Officiel QWI = valeur geree dynamiquement depuis cette administration.",
            model?.view?.noteText || "",
            extraBaseNote
          ].filter(Boolean)
        };
      default:
        return null;
    }
  }

  function renderAdminHelp(helpKey, payload, className = "") {
    if (!payload) return "";
    const isOpen = adminOpenHelpKey === helpKey;
    return `
      <div class="admin-help ${className} ${isOpen ? "is-open" : ""}">
        <button class="admin-help-btn" type="button" data-admin-help-toggle="${esc(helpKey)}" aria-label="${esc(payload.title || "Aide")}">?</button>
      </div>
    `;
  }

  function renderAdminHelpModal(payload) {
    if (!payload) return "";
    return `
      <div class="admin-help-modal-backdrop" data-admin-help-close="1"></div>
      <div class="admin-help-modal" role="dialog" aria-modal="true" aria-labelledby="admin-help-modal-title">
        <button class="admin-help-modal-close" type="button" data-admin-help-close="1" aria-label="Fermer l'aide">×</button>
        <div id="admin-help-modal-title" class="admin-help-modal-title">${esc(payload.title || "Aide")}</div>
        <div class="admin-help-modal-body">
          ${(payload.body || []).map((line) => `<p>${esc(line)}</p>`).join("")}
        </div>
      </div>
    `;
  }

  function renderAdminTab(category, model, isActive) {
    const def = model.def;
    return `
      <button
        class="admin-tab ${isActive ? "is-active" : ""}"
        type="button"
        data-admin-tab="${esc(category)}"
        aria-pressed="${isActive ? "true" : "false"}"
      >
        <span class="admin-tab-label">${esc(def.label)}</span>
        <span class="admin-tab-meta">${model.pendingCount ? `${model.pendingCount} a classer` : `${model.officialCount} officiels`}</span>
        <span class="admin-tab-badge ${model.pendingCount ? "is-alert" : "is-ok"}">${model.pendingCount || "OK"}</span>
      </button>
    `;
  }

  function renderAdminCard(category, model) {
    const def = model.def;
    const view = model.view;
    const candidates = model.candidates;
    const visibleValues = view.visibleValues;
    const singular = esc(def.singular || def.label.toLowerCase());
    const searchPlaceholder = category === "hashtags"
      ? "Filtrer les hashtags"
      : category === "countries"
      ? "Rechercher un pays"
      : category === "oaci"
      ? "Rechercher un code OACI"
      : `Filtrer ${singular}`;

    return `
      <article class="admin-stage" data-category="${esc(category)}">
        <div class="admin-stage-head">
          <div class="admin-stage-copy">
            <div class="admin-stage-kicker">Referentiel actif</div>
            <div class="admin-stage-title-row">
              <h3>${esc(def.label)}</h3>
              ${renderAdminHelp(`category:${category}`, getAdminHelpContent("category", category, model))}
            </div>
          </div>
          <div class="admin-stage-stats">
            <div class="admin-stage-stat">
              <span class="admin-stage-stat-value">${model.pendingCount}</span>
              <span class="admin-stage-stat-label">A classer</span>
            </div>
            <div class="admin-stage-stat">
              <span class="admin-stage-stat-value">${model.officialCount}</span>
              <span class="admin-stage-stat-label">Officiels QWI</span>
            </div>
            <div class="admin-stage-stat">
              <span class="admin-stage-stat-value">${model.availableCount}</span>
              <span class="admin-stage-stat-label">Visibles PWA</span>
            </div>
          </div>
        </div>

        <div class="admin-stage-grid">
          <section class="admin-panel admin-panel-priority">
            <div class="admin-panel-head">
              <div class="admin-panel-title-wrap">
                <div class="admin-panel-title">Valeurs a classer</div>
                <div class="admin-panel-submeta">${candidates.length ? `${candidates.length} valeur(s) en attente` : "File vide"}</div>
              </div>
              ${renderAdminHelp(`pending:${category}`, getAdminHelpContent("pending", category, model))}
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
                    <button class="admin-btn admin-btn-primary" data-admin-create-btn="${esc(category)}" data-admin-source="${esc(row.value)}" type="button">Creer</button>
                    <select class="admin-select" data-admin-map-select="${esc(category)}" data-admin-source="${esc(row.value)}" data-admin-idx="${idx}">
                      <option value="">Rattacher a...</option>
                      ${getMappingOptionsForCandidate(category, row.value).map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}
                    </select>
                    <button class="admin-btn" data-admin-map-btn="${esc(category)}" data-admin-source="${esc(row.value)}" data-admin-idx="${idx}" type="button">Rattacher</button>
                  </div>
                </div>
              `).join("") : `<div class="admin-empty">Aucune valeur en attente.</div>`}
            </div>
          </section>

          <div class="admin-stage-side">
            <section class="admin-panel">
              <div class="admin-panel-head">
                <div class="admin-panel-title-wrap">
                  <div class="admin-panel-title">Ajouter</div>
                  <div class="admin-panel-submeta">Creation directe</div>
                </div>
                ${renderAdminHelp(`add:${category}`, getAdminHelpContent("add", category, model))}
              </div>
              <div class="admin-row">
                <input class="admin-input" data-admin-add-input="${esc(category)}" placeholder="Ajouter un ${singular}">
                <button class="admin-btn admin-btn-primary" data-admin-add-btn="${esc(category)}" type="button">Ajouter</button>
              </div>
            </section>

            <section class="admin-panel">
              <div class="admin-panel-head">
                <div class="admin-panel-title-wrap">
                  <div class="admin-panel-title">Referentiel actuel</div>
                  <div class="admin-panel-submeta">
                    ${view.query ? `${view.filteredValues.length} resultat(s)` : `${visibleValues.length} visible(s)`}
                  </div>
                </div>
                ${renderAdminHelp(`catalog:${category}`, getAdminHelpContent("catalog", category, model))}
              </div>
              <div class="admin-row admin-row-search">
                <input class="admin-input" data-admin-search-input="${esc(category)}" value="${esc(model.searchValue)}" placeholder="${esc(searchPlaceholder)}">
              </div>
              <div class="admin-inline-metrics">
                <span class="admin-mini-chip">${model.availableCount} total</span>
                <span class="admin-mini-chip">${model.officialCount} officiel(s)</span>
                ${view.isCollapsedBase ? `<span class="admin-mini-chip is-muted">Socle masque</span>` : ""}
              </div>
              <div class="admin-list">
                ${visibleValues.length ? visibleValues.map((value) => `
                  <div class="admin-item">
                    <div class="admin-item-top">
                      <div>
                        <div class="admin-item-value">${esc(value)}</div>
                        <div class="admin-item-meta">${isOfficialCatalogValue(category, value) ? "Officiel QWI" : "Socle AAR"}</div>
                      </div>
                    </div>
                    ${isOfficialCatalogValue(category, value) ? `
                      <div class="admin-row">
                        <button class="admin-btn" data-admin-rename-btn="${esc(category)}" data-admin-value="${esc(value)}" type="button">Renommer</button>
                        <button class="admin-btn admin-btn-danger" data-admin-delete-btn="${esc(category)}" data-admin-value="${esc(value)}" type="button">Supprimer</button>
                      </div>
                    ` : ""}
                  </div>
                `).join("") : `<div class="admin-empty">${esc(view.emptyText)}</div>`}
              </div>
            </section>
          </div>
        </div>
      </article>
    `;
  }

  function bindAdminEvents(container) {
    if (!container) return;

    container.querySelectorAll("[data-admin-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextCategory = btn.getAttribute("data-admin-tab");
        if (!CATALOG_KEYS.includes(nextCategory)) return;
        adminActiveCategory = nextCategory;
        adminOpenHelpKey = "";
        saveAdminUiState();
        renderAdmin(container);
      });
    });

    container.querySelectorAll("[data-admin-help-toggle]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const helpKey = String(btn.getAttribute("data-admin-help-toggle") || "").trim();
        adminOpenHelpKey = adminOpenHelpKey === helpKey ? "" : helpKey;
        renderAdmin(container);
      });
    });

    container.querySelectorAll("[data-admin-help-close]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        adminOpenHelpKey = "";
        renderAdmin(container);
      });
    });

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
        saveAdminUiState();
        renderAdmin(container, {
          focusCategory: category,
          selectionStart: input.selectionStart,
          selectionEnd: input.selectionEnd
        });
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
        const next = await askTextInput({
          title: "Renommer",
          message: "Saisis le nouveau libelle.",
          inputValue: value,
          inputPlaceholder: "Nouveau libelle",
          confirmLabel: "Valider",
          cancelLabel: "Annuler"
        });
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

  function renderAdmin(targetEl = document.getElementById("view-admin"), options = {}) {
    if (!targetEl) return;
    const officialCatalog = getCurrentCatalog();
    const effectiveCatalog = getEffectiveCatalog();
    const totalOfficialValues = CATALOG_KEYS.reduce((sum, key) => sum + ((officialCatalog[key] || []).length), 0);
    const totalAvailableValues = CATALOG_KEYS.reduce((sum, key) => sum + ((effectiveCatalog[key] || []).length), 0);
    const pendingSummary = getAdminPendingSummary();
    if (!CATALOG_KEYS.includes(adminActiveCategory)) adminActiveCategory = CATALOG_KEYS[0];

    const categoryModels = {};
    CATALOG_KEYS.forEach((key) => {
      const def = CATALOG_DEFS[key];
      const searchValue = String(adminCatalogSearch[key] || "");
      const view = getAdminCatalogView(key, searchValue);
      const candidates = extractOtherCandidates(key);
      categoryModels[key] = {
        key,
        def,
        searchValue,
        view,
        candidates,
        pendingCount: candidates.length,
        officialCount: (officialCatalog[key] || []).length,
        availableCount: (effectiveCatalog[key] || []).length
      };
    });
    const activeModel = categoryModels[adminActiveCategory];
    const helpRegistry = {
      overview: getAdminHelpContent("overview", adminActiveCategory, activeModel),
      [`category:${adminActiveCategory}`]: getAdminHelpContent("category", adminActiveCategory, activeModel),
      [`pending:${adminActiveCategory}`]: getAdminHelpContent("pending", adminActiveCategory, activeModel),
      [`add:${adminActiveCategory}`]: getAdminHelpContent("add", adminActiveCategory, activeModel),
      [`catalog:${adminActiveCategory}`]: getAdminHelpContent("catalog", adminActiveCategory, activeModel)
    };
    const activeHelpPayload = adminOpenHelpKey ? helpRegistry[adminOpenHelpKey] || null : null;

    targetEl.innerHTML = `
      <div class="admin-wrap">
        <div class="admin-header">
          <div class="admin-header-copy">
            <div class="admin-title-row">
              <div class="admin-title">Administration QWI</div>
              ${renderAdminHelp("overview", getAdminHelpContent("overview", adminActiveCategory, activeModel), "admin-help-header")}
            </div>
            <div class="admin-subtitle">Hashtags, pays, OACI, operations et exercices.</div>
          </div>
          <div class="admin-stat-strip">
            <div class="admin-stat-card ${pendingSummary.total ? "is-alert" : "is-ok"}">
              <span class="admin-stat-value">${pendingSummary.total}</span>
              <span class="admin-stat-label">A classer</span>
            </div>
            <div class="admin-stat-card">
              <span class="admin-stat-value">${totalAvailableValues}</span>
              <span class="admin-stat-label">Visibles PWA</span>
            </div>
            <div class="admin-stat-card">
              <span class="admin-stat-value">${totalOfficialValues}</span>
              <span class="admin-stat-label">Officiels QWI</span>
            </div>
          </div>
        </div>
        <div class="admin-tabs" role="tablist" aria-label="Referentiels QWI">
          ${CATALOG_KEYS.map((key) => renderAdminTab(key, categoryModels[key], key === adminActiveCategory)).join("")}
        </div>
        <div class="admin-grid">
          ${renderAdminCard(adminActiveCategory, activeModel)}
        </div>
        ${renderAdminHelpModal(activeHelpPayload)}
      </div>
    `;

    bindAdminEvents(targetEl);

    if (options && options.focusCategory) {
      const searchInput = targetEl.querySelector(`[data-admin-search-input="${options.focusCategory}"]`);
      if (searchInput) {
        searchInput.focus({ preventScroll: true });
        if (typeof options.selectionStart === "number" && typeof options.selectionEnd === "number" && searchInput.setSelectionRange) {
          searchInput.setSelectionRange(options.selectionStart, options.selectionEnd);
        } else {
          const end = String(searchInput.value || "").length;
          if (searchInput.setSelectionRange) searchInput.setSelectionRange(end, end);
        }
      }
    }
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
        <button class="detail-qwi-btn" data-qwi-action="publish" type="button">Publier</button>
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
    const record = state.reports.find((x) => x.id === recordId) || null;
    const workflowStatus = getRecordWorkflowStatus(record);
    const editBtn = actions.querySelector('[data-qwi-action="edit"]');
    const publishBtn = actions.querySelector('[data-qwi-action="publish"]');
    const deleteBtn = actions.querySelector('[data-qwi-action="delete"]');
    const newBtn = actions.querySelector('[data-qwi-action="new"]');

    if (editBtn) editBtn.onclick = () => openEditor(recordId);
    if (publishBtn) {
      publishBtn.style.display = workflowStatus === "PENDING_QWI_REVIEW" ? "" : "none";
      publishBtn.onclick = () => publishRecord(recordId);
    }
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
    invalidateCatalogCaches();
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
