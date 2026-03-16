/* QWI mode: add / edit / delete AARs with external editor bridge */
(function () {
  const LOCAL_SOURCE = "qwi_local";
  const REQUEST_PREFIX = "aar_qwi_editor_request:";
  const DELETED_KEY = "aar_qwi_deleted_ids_v1";
  const EDITOR_RELATIVE_URL = "../../C - AAR PWA/AAR.html";
  const sessions = new Map();

  function sortRecords(rows) {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
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
    await dbReplaceAll(sorted);
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

  function openEditor(recordId = "") {
    const record = recordId ? state.reports.find((x) => x.id === recordId) : null;
    const sessionId = newSessionId();

    const payload = {
      source: "AAR_READER_HUB_QWI",
      recordId: record ? record.id : "",
      aar: record ? record.mission : null,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(requestKey(sessionId), JSON.stringify(payload));
    sessions.set(sessionId, { recordId: record ? record.id : "" });

    const popup = window.open(buildEditorUrl(sessionId), "_blank");
    if (!popup) {
      sessions.delete(sessionId);
      localStorage.removeItem(requestKey(sessionId));
      toast("Popup bloquee: autorise les popups puis reessaie.");
      return;
    }
  }

  async function upsertFromEditor(sessionId, aarData) {
    const pending = sessions.get(sessionId);
    if (!pending) return;

    const normalized = normalizeAar(aarData || {});
    let rec = buildRecord(normalized, LOCAL_SOURCE, "qwi_editor");
    const existing = pending.recordId ? state.reports.find((x) => x.id === pending.recordId) : null;

    if (existing) {
      rec.id = existing.id;
      rec.createdAt = existing.createdAt || rec.createdAt;
    }

    rec.source = LOCAL_SOURCE;
    rec.sourceName = "qwi_editor";
    rec.updatedAt = new Date().toISOString();

    const rows = state.reports.filter((x) => x.id !== rec.id);
    rows.push(rec);

    unmarkDeleted(rec.id);
    await persistRecords(rows);
    toast(existing ? "AAR modifie." : "AAR ajoute.");
    openDetail(rec.id);
  }

  async function deleteRecord(recordId) {
    if (!recordId) return;
    const rec = state.reports.find((x) => x.id === recordId);
    if (!rec) return;

    if (!window.confirm(`Supprimer cet AAR ?\n\n${rec.title}`)) return;

    markDeleted(recordId);
    const rows = state.reports.filter((x) => x.id !== recordId);
    await persistRecords(rows);
    closeDetail();
    toast("AAR supprime.");
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

  function installTopActions() {
    const newBtn = document.getElementById("qwi-new-btn");
    if (newBtn) newBtn.addEventListener("click", () => openEditor());

    if (el.syncBtn) {
      el.syncBtn.title = "Synchroniser (conserve les modifications QWI locales)";
    }
  }

  const baseRenderList = renderList;
  renderList = function patchedRenderList() {
    baseRenderList();
  };

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
    const localRecords = state.reports.filter((x) => x.source === LOCAL_SOURCE);
    const deletedIds = getDeletedIds();

    await baseSyncPreferred(opts);

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
      await upsertFromEditor(sessionId, msg.aar || msg.data || {});
    } catch (error) {
      console.error("QWI editor save failed", error);
      toast(`Echec enregistrement: ${error.message || error}`);
    } finally {
      sessions.delete(sessionId);
      localStorage.removeItem(requestKey(sessionId));
    }
  });

  // Apply deletion filters at startup if needed.
  const deletedIds = getDeletedIds();
  if (deletedIds.size) {
    const next = state.reports.filter((x) => !deletedIds.has(x.id));
    if (next.length !== state.reports.length) {
      persistRecords(next).catch((e) => console.warn("Failed to apply deleted IDs", e));
    }
  }

  installTopActions();
})();
