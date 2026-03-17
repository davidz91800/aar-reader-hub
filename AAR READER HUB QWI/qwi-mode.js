/* QWI mode: add / edit / delete AARs and push to Google Drive */
(function () {
  const LOCAL_SOURCE = "qwi_local";
  const REQUEST_PREFIX = "aar_qwi_editor_request:";
  const DELETED_KEY = "aar_qwi_deleted_ids_v1";
  const HASHTAG_CATALOG_KEY = "aar_hashtag_catalog_v1";
  const EDITOR_RELATIVE_URL = "./aar-pwa/AAR.html";
  const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
  const sessions = new Map();

  let tokenClient = null;
  let accessToken = "";
  let tokenExpiryAt = 0;
  let gsiLoader = null;
  let silentReconnectTried = false;

  function hasValidDriveToken() {
    return !!accessToken && Date.now() < tokenExpiryAt - 30000;
  }

  function sortRecords(rows) {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
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

  function collectKnownHashtags() {
    const fromReports = state.reports.flatMap((r) => {
      const meta = r?.mission?.meta || {};
      const selected = String(meta.hashtag || "").trim();
      const other = String(meta.hashtagAutre || "").trim();
      if (selected === "AUTRE") return other ? [other] : [];
      return selected ? [selected] : [];
    });

    let fromStorage = [];
    try {
      const raw = localStorage.getItem(HASHTAG_CATALOG_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      fromStorage = Array.isArray(parsed) ? parsed : [];
    } catch {}

    return uniqueHashtags([...fromStorage, ...fromReports]);
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
    if (!cfg.folderId && !targetFileId) {
      throw new Error("folderId Drive manquant pour creer un nouvel AAR.");
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

    if (!hasValidDriveToken()) {
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

  function installTopActions() {
    const newBtn = document.getElementById("qwi-new-btn");
    if (newBtn) newBtn.addEventListener("click", () => openEditor());

    const driveBtn = document.getElementById("qwi-drive-btn");
    if (driveBtn) driveBtn.addEventListener("click", connectDrive);

    if (el.syncBtn) {
      el.syncBtn.title = "Synchroniser (conserve les modifications QWI locales)";
    }

    setDriveButtonState({ connected: false, busy: false });
    trySilentDriveReconnect();
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
  };

  window.addEventListener("message", async (evt) => {
    const msg = evt.data;
    if (!msg || msg.type !== "aar-qwi-save") return;

    const sessionId = String(msg.session || "");
    if (!sessions.has(sessionId)) return;

    try {
      if (Array.isArray(msg.hashtagsCatalog)) {
        const catalog = uniqueHashtags(msg.hashtagsCatalog);
        try { localStorage.setItem(HASHTAG_CATALOG_KEY, JSON.stringify(catalog)); } catch {}
      }
      await upsertFromEditor(sessionId, msg.aar || msg.data || {});
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

  installTopActions();
})();
