const DB_NAME = "aar_reader_hub_v1";
const STORE = "reports";
const LAST_SYNC_KEY = "aar_reader_last_sync_v1";

const state = {
  reports: [],
  expandModes: {},
  mode: "consult"
};

const el = {};

function esc(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(msg) {
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.toast.classList.remove("show"), 2300);
}

function setSourceStatus(msg) {
  if (el.sourceStatus) el.sourceStatus.textContent = msg;
}

function updateLastSyncLabel(iso) {
  if (!el.lastSync) return;
  if (!iso) {
    el.lastSync.textContent = "Derniere synchro: jamais";
    return;
  }
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) {
      el.lastSync.textContent = "Derniere synchro: inconnue";
      return;
    }
    el.lastSync.textContent = `Derniere synchro: ${dt.toLocaleString()}`;
  } catch {
    el.lastSync.textContent = "Derniere synchro: inconnue";
  }
}

function safeDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? v : new Date().toISOString().slice(0, 10);
}

function slug(v) {
  return String(v || "item")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "item";
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function stripDiacritics(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeClassif(v) {
  const raw = stripDiacritics(String(v || "")).toUpperCase().replace(/\s+/g, " ").trim();
  if (!raw) return "UNKNOWN";
  if (raw.includes("NON PROTEGE")) return "NON PROTEGE";
  if (raw.includes("DIFFUSION RESTREINTE")) return "DIFFUSION RESTREINTE";
  if (raw.includes("SECRET SPECIAL FRANCE")) return "SECRET SPECIAL FRANCE";
  return raw;
}

function htmlToText(html) {
  const src = String(html || "");
  if (!src) return "";
  try {
    const doc = new DOMParser().parseFromString(src, "text/html");
    return doc.body?.innerText || doc.body?.textContent || src;
  } catch {
    return src.replace(/<[^>]+>/g, " ");
  }
}

function cleanText(v) {
  return htmlToText(String(v || "")).replace(/\s+/g, " ").trim();
}

function nonEmpty(v) {
  return cleanText(v).length > 0;
}

function decodeQuotedPrintable(text) {
  const src = String(text || "");
  if (!src.includes("=")) return src;
  const unfolded = src.replace(/=(\r\n|\n|\r)/g, "");
  return unfolded.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeEntities(text) {
  const src = String(text || "");
  if (!src || typeof document === "undefined") return src;
  const ta = document.createElement("textarea");
  ta.innerHTML = src;
  return ta.value;
}

function normalizeTextPayload(text, typeHint = "") {
  let out = String(text || "");
  if (!out) return "";
  const hint = String(typeHint || "").toLowerCase();
  if (hint.includes("html") || /<[^>]+>/.test(out)) out = htmlToText(out);
  out = decodeQuotedPrintable(out);
  out = decodeEntities(out);
  return out;
}

function normalizeAar(input) {
  const a = input && typeof input === "object" ? input : {};
  return {
    meta: {
      title: a.meta?.title || "",
      date: safeDate(a.meta?.date),
      grade: a.meta?.grade || "",
      gradeAutre: a.meta?.gradeAutre || "",
      nom: a.meta?.nom || "",
      prenom: a.meta?.prenom || "",
      unite: a.meta?.unite || "",
      uniteAutre: a.meta?.uniteAutre || "",
      classification: normalizeClassif(a.meta?.classification || "")
    },
    facts: {
      what: a.facts?.what || "",
      why: a.facts?.why || "",
      when: a.facts?.when || "",
      where: a.facts?.where || "",
      who: a.facts?.who || "",
      how: a.facts?.how || "",
      narrative: a.facts?.narrative || ""
    },
    analysis: {
      content: a.analysis?.content || ""
    },
    recos: {
      doctrine: a.recos?.doctrine || "",
      organisation: a.recos?.organisation || "",
      rh: a.recos?.rh || "",
      equipements: a.recos?.equipements || "",
      soutien: a.recos?.soutien || "",
      entrainement: a.recos?.entrainement || ""
    },
    qwi: {
      advice: a.qwi?.advice || ""
    }
  };
}

function isAarLike(o) {
  return !!o && typeof o === "object" && (o.meta || o.facts || o.analysis || o.recos || o.qwi);
}

function parseAarObject(o) {
  if (isAarLike(o)) return normalizeAar(o);
  if (o && isAarLike(o.aar)) return normalizeAar(o.aar);
  if (o && isAarLike(o.mission)) return normalizeAar(o.mission);
  throw new Error("Objet non reconnu comme AAR");
}

function parseAarCandidate(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try { return parseAarObject(JSON.parse(raw)); } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return parseAarObject(JSON.parse(raw.slice(start, end + 1))); } catch {}
  }
  return null;
}

function parseTextForAars(text) {
  const out = [];
  const seen = new Set();
  const pushUnique = (aar) => {
    if (!aar) return;
    const key = hash(JSON.stringify(aar));
    if (seen.has(key)) return;
    seen.add(key);
    out.push(aar);
  };

  const payloads = [
    String(text || ""),
    normalizeTextPayload(text, ""),
    decodeQuotedPrintable(text)
  ].filter((x) => String(x || "").trim());

  for (const payload of payloads) {
    const blocks = [
      /---BEGIN-AAR-JSON---([\s\S]*?)---END-AAR-JSON---/gi,
      /---BEGIN-DEBRIEF-JSON---([\s\S]*?)---END-DEBRIEF-JSON---/gi
    ];
    blocks.forEach((rgx) => {
      let m;
      while ((m = rgx.exec(payload)) !== null) pushUnique(parseAarCandidate(m[1]));
    });
  }

  if (out.length) return out;
  for (const payload of payloads) pushUnique(parseAarCandidate(payload));
  return out;
}

function deriveMeta(a) {
  const meta = a.meta || {};
  const facts = a.facts || {};
  const recos = a.recos || {};

  const rank = meta.grade === "AUTRE" ? meta.gradeAutre : meta.grade;
  const unit = meta.unite === "AUTRE" ? meta.uniteAutre : meta.unite;
  const name = [meta.nom, meta.prenom].filter(Boolean).join(" ").trim();
  const redacteur = [rank, name].filter(Boolean).join(" ").trim() || "N/A";

  const factKeys = ["what", "why", "when", "where", "who", "how", "narrative"];
  const recoKeys = ["doctrine", "organisation", "rh", "equipements", "soutien", "entrainement"];

  const factsFilled = factKeys.reduce((n, k) => n + (nonEmpty(facts[k]) ? 1 : 0), 0);
  const recosFilled = recoKeys.reduce((n, k) => n + (nonEmpty(recos[k]) ? 1 : 0), 0);

  const recoLabels = {
    doctrine: "DOCTRINE",
    organisation: "ORGANISATION",
    rh: "RH",
    equipements: "EQUIPEMENTS",
    soutien: "SOUTIEN",
    entrainement: "ENTRAINEMENT"
  };
  const recoCats = recoKeys.filter((k) => nonEmpty(recos[k])).map((k) => recoLabels[k]);
  const qwiFilled = nonEmpty(a.qwi?.advice);

  const allText = [
    meta.title,
    rank,
    meta.nom,
    meta.prenom,
    unit,
    facts.what,
    facts.why,
    facts.when,
    facts.where,
    facts.who,
    facts.how,
    facts.narrative,
    a.analysis?.content,
    recos.doctrine,
    recos.organisation,
    recos.rh,
    recos.equipements,
    recos.soutien,
    recos.entrainement,
    a.qwi?.advice
  ].map(cleanText).join(" ");

  const wordCount = allText ? allText.split(/\s+/).filter(Boolean).length : 0;
  const title = meta.title || "AAR sans titre";
  const date = safeDate(meta.date);

  return {
    title,
    date,
    redacteur,
    nom: meta.nom || "",
    prenom: meta.prenom || "",
    unit: unit || "N/A",
    classification: normalizeClassif(meta.classification),
    factsFilled,
    recosFilled,
    recoCats,
    qwiFilled,
    wordCount,
    missionKey: `${date}|${slug(title)}|${slug(name || "anon")}`
  };
}

function buildRecord(aar, source, sourceName = "") {
  const normalized = normalizeAar(aar);
  const meta = deriveMeta(normalized);
  const idHash = hash(JSON.stringify(normalized));
  const now = new Date().toISOString();
  return {
    id: `${meta.date}_${idHash}`,
    source,
    sourceName,
    mission: normalized,
    fileName: `${meta.date}_${slug(meta.title)}_${idHash}.json`,
    createdAt: now,
    updatedAt: now,
    ...meta
  };
}

function normalizeDriveId(raw) {
  const src = String(raw || "").trim();
  if (!src) return "";
  let out = src;
  if (out.includes("drive.google.com")) {
    const mFolder = out.match(/\/folders\/([^/?#]+)/i);
    if (mFolder && mFolder[1]) return mFolder[1];
    const mFile = out.match(/\/d\/([^/?#]+)/i);
    if (mFile && mFile[1]) return mFile[1];
  }
  out = out.split("?")[0].split("#")[0].trim();
  return out;
}

function isPlaceholderValue(value) {
  const v = String(value || "").trim().toUpperCase();
  if (!v) return false;
  return v.includes("ID_INDEX_JSON_PUBLIC")
    || v.includes("ID_DU_DOSSIER_DRIVE")
    || v.includes("TON_API_KEY")
    || v.includes("API_KEY_OPTIONNEL");
}

function getDriveConfig() {
  const cfg = window.AAR_READER_CONFIG || {};
  const g = cfg.googleDrive || {};
  const apiKeyRaw = String(g.apiKey || "").trim();
  const folderIdRaw = normalizeDriveId(g.folderId);
  const indexFileIdRaw = normalizeDriveId(g.indexFileId);
  return {
    autoSyncOnStartup: cfg.autoSyncOnStartup !== false,
    apiKey: isPlaceholderValue(apiKeyRaw) ? "" : apiKeyRaw,
    folderId: isPlaceholderValue(folderIdRaw) ? "" : folderIdRaw,
    indexFileId: isPlaceholderValue(indexFileIdRaw) ? "" : indexFileIdRaw
  };
}

function drivePublicDownloadUrl(fileId, resourceKey = "") {
  const rk = String(resourceKey || "").trim();
  const extra = rk ? `&resourcekey=${encodeURIComponent(rk)}` : "";
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&authuser=0&confirm=t${extra}`;
}

function driveMediaUrl(fileId, apiKey, resourceKey = "") {
  const rk = String(resourceKey || "").trim();
  const extra = rk ? `&resourceKey=${encodeURIComponent(rk)}` : "";
  return `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${encodeURIComponent(apiKey)}${extra}`;
}

async function fetchJsonOrThrow(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { cache: "no-store", signal: controller.signal });
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error(`Timeout reseau (${Math.round(timeoutMs / 1000)}s)`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    const compact = txt.replace(/\s+/g, " ").trim();
    if (/referer\s+null/i.test(compact) || /referer.*blocked/i.test(compact)) {
      throw new Error("API key bloquee par referer (mode iPad PWA). Dans Google Cloud: Application restrictions = Aucun.");
    }
    throw new Error(`HTTP ${response.status} ${response.statusText} ${compact.slice(0, 180)}`);
  }
  const raw = await response.text();
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Reponse vide");
  if (/^\s*<!doctype html/i.test(trimmed) || /^\s*<html/i.test(trimmed)) {
    throw new Error("Le fichier n'est pas accessible publiquement (reponse HTML).");
  }
  const payload = trimmed.replace(/^\)\]\}'\s*\n?/, "");
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error("JSON invalide ou non lisible.");
  }
}

async function listDriveFiles(apiKey, folderId) {
  const query = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&pageSize=1000&fields=files(id,name,modifiedTime,size,resourceKey)&orderBy=modifiedTime desc&key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJsonOrThrow(url);
  return Array.isArray(data.files) ? data.files : [];
}

async function listDriveFilesFromIndex(indexFileId) {
  const data = await fetchJsonOrThrow(drivePublicDownloadUrl(indexFileId));
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      if (typeof item === "string") return { id: item, name: `aar_${i + 1}.json`, resourceKey: "" };
      return {
        id: item.id || "",
        name: item.name || `aar_${i + 1}.json`,
        resourceKey: item.resourceKey || ""
      };
    }).filter((x) => x.id);
  }
  if (Array.isArray(data.files)) {
    return data.files.map((x, i) => ({
      id: x.id || "",
      name: x.name || `aar_${i + 1}.json`,
      resourceKey: x.resourceKey || ""
    })).filter((x) => x.id);
  }
  throw new Error("index.json invalide (attendu: array ou {files:[...]})");
}

async function syncFromGoogleDrive({ silent = false } = {}) {
  const cfg = getDriveConfig();
  const hasIndexMode = !!cfg.indexFileId;
  const hasFolderMode = !!cfg.apiKey && !!cfg.folderId;
  if (!hasIndexMode && !hasFolderMode) {
    setSourceStatus("Source: config invalide (mettre indexFileId, ou apiKey+folderId)");
    if (!silent) toast("Config invalide: indexFileId, ou apiKey+folderId.");
    return;
  }

  setSourceStatus("Source: synchronisation en cours...");
  if (el.syncDriveBtn) el.syncDriveBtn.disabled = true;

  try {
    const files = hasIndexMode
      ? await listDriveFilesFromIndex(cfg.indexFileId)
      : await listDriveFiles(cfg.apiKey, cfg.folderId);

    if (!files.length) {
      await dbReplaceAll([]);
      state.reports = [];
      renderAll();
      setSourceStatus("Source: Google Drive (0 JSON)");
      const now = new Date().toISOString();
      localStorage.setItem(LAST_SYNC_KEY, now);
      updateLastSyncLabel(now);
      if (!silent) toast("Aucun AAR JSON trouve sur Drive.");
      return;
    }

    const records = [];
    const errors = [];

    for (const f of files) {
      try {
        let payload;
        if (cfg.apiKey) {
          try {
            payload = await fetchJsonOrThrow(driveMediaUrl(f.id, cfg.apiKey, f.resourceKey));
          } catch (apiErr) {
            try {
              payload = await fetchJsonOrThrow(drivePublicDownloadUrl(f.id, f.resourceKey));
            } catch (publicErr) {
              throw new Error(`API: ${apiErr.message} | Public: ${publicErr.message}`);
            }
          }
        } else {
          payload = await fetchJsonOrThrow(drivePublicDownloadUrl(f.id, f.resourceKey));
        }
        const rec = buildRecord(parseAarObject(payload), "drive_file", f.name || f.id);
        rec.updatedAt = f.modifiedTime || new Date().toISOString();
        records.push(rec);
      } catch (e) {
        errors.push(`${f.name || f.id}: ${e.message}`);
      }
    }

    await dbReplaceAll(records);
    state.reports = records.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    state.expandModes = {};
    renderAll();

    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);
    updateLastSyncLabel(now);
    setSourceStatus(`Source: Google Drive (${records.length} AAR)`);

    if (!silent) {
      if (errors.length) toast(`Synchro OK: ${records.length} AAR, ${errors.length} erreur(s).`);
      else toast(`Synchro OK: ${records.length} AAR.`);
    }
  } catch (e) {
    setSourceStatus(`Source: erreur Drive (${e.message})`);
    if (!silent) toast(`Erreur sync Drive: ${e.message}`);
  } finally {
    if (el.syncDriveBtn) el.syncDriveBtn.disabled = false;
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(rec) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(rec);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbClearAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbReplaceAll(records) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    for (const rec of records) store.put(rec);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function upsert(rec) {
  const ex = state.reports.find((r) => r.missionKey === rec.missionKey);
  if (ex) {
    rec.id = ex.id;
    rec.createdAt = ex.createdAt;
  }
  rec.updatedAt = new Date().toISOString();
  await dbPut(rec);
  const i = state.reports.findIndex((r) => r.id === rec.id);
  if (i >= 0) state.reports[i] = rec;
  else state.reports.push(rec);
  state.reports.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
}

async function resetApplicationData() {
  const ok = confirm("Supprimer tous les AAR du cache local ?");
  if (!ok) return;
  try {
    await dbClearAll();
    state.reports = [];
    state.expandModes = {};
    localStorage.removeItem(LAST_SYNC_KEY);
    updateLastSyncLabel("");
    setSourceStatus("Source: cache local vide");
    renderAll();
    toast("Cache local reinitialise.");
  } catch (e) {
    toast(`Reinitialisation impossible: ${e.message}`);
  }
}

async function importFromText(text, source, sourceName) {
  const aars = parseTextForAars(text || "");
  if (!aars.length) return 0;
  for (const a of aars) await upsert(buildRecord(a, source, sourceName));
  return aars.length;
}

async function importFile(file) {
  const text = await file.text();
  const low = (file.name || "").toLowerCase();
  if (low.endsWith(".json")) {
    try {
      await upsert(buildRecord(parseAarObject(JSON.parse(text)), "json_file", file.name));
      return 1;
    } catch {}
  }
  return importFromText(text, "email_file", file.name || "file");
}

function fileKey(file) {
  return `${file?.name || "file"}|${file?.size || 0}|${file?.lastModified || 0}`;
}

async function importFiles(files) {
  let count = 0;
  const seen = new Set();
  for (const f of (files || [])) {
    if (!f || typeof f.text !== "function") continue;
    const key = fileKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    try { count += await importFile(f); } catch {}
  }
  return count;
}

function filtered() {
  const q = el.searchInput.value.trim().toLowerCase();
  const c = el.classifFilter.value;
  const s = el.sortFilter.value;

  let rows = state.reports.filter((r) => (c === "ALL" ? true : r.classification === c));
  if (q) {
    rows = rows.filter((r) => [
      r.title,
      r.redacteur,
      r.nom,
      r.prenom,
      r.unit,
      r.classification,
      r.mission?.analysis?.content,
      r.mission?.facts?.narrative,
      r.recoCats?.join(" "),
      r.mission?.qwi?.advice
    ].map(cleanText).join(" ").toLowerCase().includes(q));
  }

  if (s === "DATE_DESC") rows.sort((a, b) => b.date.localeCompare(a.date));
  if (s === "DATE_ASC") rows.sort((a, b) => a.date.localeCompare(b.date));
  if (s === "TITLE_ASC") rows.sort((a, b) => a.title.localeCompare(b.title));
  if (s === "UPDATED_DESC") rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return rows;
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
  const panel = document.getElementById(`panel-${mode}`);
  if (panel) panel.classList.add("active");
  renderPanels();
}

function listItems(arr) {
  return arr.length ? `<ul class="clean">${arr.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>Aucun element.</p>";
}

function renderAarLight(r) {
  const narrative = cleanText(r.mission.facts.narrative) || cleanText(r.mission.analysis.content) || "N/A";
  const summaryLine = `5W1H: ${r.factsFilled}/7 - Recos: ${r.recosFilled}/6 - Mots: ${r.wordCount}`;
  return `
    <section class="fold-section">
      <h4>Contexte</h4>
      <p>${esc(narrative.slice(0, 420) || "N/A")}</p>
    </section>
    <section class="fold-section">
      <h4>Synthese</h4>
      <p>${esc(summaryLine)}</p>
    </section>
    <section class="fold-section">
      <h4>Categories DORESE</h4>
      ${listItems(r.recoCats.slice(0, 6))}
    </section>
    <section class="fold-section">
      <h4>Avis QWI / Weapons School</h4>
      <p>${esc(cleanText(r.mission.qwi?.advice) || "N/A")}</p>
    </section>`;
}

function renderAarHeavy(r) {
  const m = r.mission;
  const factLabels = {
    what: "Quoi",
    why: "Pourquoi",
    when: "Quand",
    where: "Ou",
    who: "Qui",
    how: "Comment",
    narrative: "Narratif"
  };

  const factsHtml = Object.keys(factLabels).map((k) => {
    const txt = cleanText(m.facts[k]);
    return `<div><strong>${esc(factLabels[k])}</strong>${txt ? `<p>${esc(txt)}</p>` : "<p>N/A</p>"}</div>`;
  }).join("");

  const recoLabels = {
    doctrine: "DOCTRINE",
    organisation: "ORGANISATION",
    rh: "RH",
    equipements: "EQUIPEMENTS",
    soutien: "SOUTIEN",
    entrainement: "ENTRAINEMENT"
  };
  const recos = Object.keys(recoLabels)
    .filter((k) => nonEmpty(m.recos[k]))
    .map((k) => `<article class="dfp"><div class="t">${esc(recoLabels[k])}</div><p>${esc(cleanText(m.recos[k]))}</p></article>`)
    .join("") || "<p>Aucune recommandation.</p>";

  return `
    <article class="paper paper-inline">
      <header class="paper-head"><h3>${esc(r.title)}</h3><p>${esc(r.date)} - Redacteur: ${esc(r.redacteur)} - Classif: ${esc(r.classification)}</p></header>
      <div class="paper-body">
        <section class="section"><h4>5W1H</h4><div class="cols-2">${factsHtml}</div></section>
        <section class="section"><h4>Analyse</h4><p>${esc(cleanText(m.analysis.content) || "N/A")}</p></section>
        <section class="section"><h4>Recommendations (DORESE)</h4>${recos}</section>
        <section class="section"><h4>Avis QWI / Weapons School</h4><p>${esc(cleanText(m.qwi?.advice) || "N/A")}</p></section>
      </div>
    </article>`;
}

function renderConsult() {
  const rows = filtered();
  if (!rows.length) {
    el.panelConsult.innerHTML = `<div class="empty">Aucun AAR. Lance une synchro Drive ou importe un dossier.</div>`;
    return;
  }

  el.panelConsult.innerHTML = rows.map((r) => {
    const mode = state.expandModes[r.id] || "";
    const body = mode === "heavy" ? renderAarHeavy(r) : mode === "light" ? renderAarLight(r) : "";
    return `
      <article class="mission-fold ${mode ? `open mode-${mode}` : "closed"}" data-id="${r.id}">
        <header class="mission-fold-head">
          <div class="mission-fold-title">${esc(r.title)}</div>
          <div class="mission-fold-controls">
            <button class="fold-pill icon ${mode === "light" ? "active" : ""}" data-act="expand-light" data-id="${r.id}" title="Developpement leger" aria-label="Developpement leger"><span class="chev-stack one" aria-hidden="true"><span class="chev"></span></span></button>
            <button class="fold-pill icon ${mode === "heavy" ? "active" : ""}" data-act="expand-heavy" data-id="${r.id}" title="Developpement lourd" aria-label="Developpement lourd"><span class="chev-stack two" aria-hidden="true"><span class="chev"></span><span class="chev"></span></span></button>
          </div>
        </header>
        ${mode ? `<div class="mission-fold-body">${body}</div>` : ""}
      </article>`;
  }).join("");

  el.panelConsult.querySelectorAll("[data-act]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const id = btn.dataset.id;
      const action = btn.dataset.act;
      if (action === "expand-light") {
        state.expandModes[id] = state.expandModes[id] === "light" ? null : "light";
        renderAll();
      } else if (action === "expand-heavy") {
        state.expandModes[id] = state.expandModes[id] === "heavy" ? null : "heavy";
        renderAll();
      }
    });
  });
}

function topMap(reports, mapper, n) {
  const map = new Map();
  reports.forEach((r) => mapper(r).forEach((k) => {
    if (!k) return;
    map.set(k, (map.get(k) || 0) + 1);
  }));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function bars(rows) {
  if (!rows.length) return "<p>Aucune donnee.</p>";
  const max = Math.max(...rows.map((x) => x[1]));
  return rows.map(([k, v]) => `<div class="bar"><div title="${esc(k)}">${esc(k)}</div><div class="track"><div class="fill" style="width:${Math.max(6, Math.round((v / max) * 100))}%"></div></div><div>${v}</div></div>`).join("");
}

function renderAnalyze() {
  if (!state.reports.length) {
    el.panelAnalyze.innerHTML = `<div class="empty">Aucun AAR pour analyse.</div>`;
    return;
  }

  const totals = state.reports.reduce((a, r) => {
    a.facts += r.factsFilled;
    a.recos += r.recosFilled;
    a.words += r.wordCount;
    a.qwi += r.qwiFilled ? 1 : 0;
    return a;
  }, { facts: 0, recos: 0, words: 0, qwi: 0 });

  const classifTop = topMap(state.reports, (r) => [r.classification], 5);
  const unitTop = topMap(state.reports, (r) => [r.unit || "N/A"], 6);
  const recoTop = topMap(state.reports, (r) => r.recoCats || [], 6);

  el.panelAnalyze.innerHTML = `
    <div class="stats">
      <article class="stat"><div class="k">AAR</div><div class="v">${state.reports.length}</div></article>
      <article class="stat"><div class="k">5W1H remplis</div><div class="v">${totals.facts}</div></article>
      <article class="stat"><div class="k">Recos total</div><div class="v">${totals.recos}</div></article>
      <article class="stat"><div class="k">Avis QWI</div><div class="v">${totals.qwi}</div></article>
    </div>
    <div class="grid-2">
      <section class="box"><h4>Top classifications</h4>${bars(classifTop)}</section>
      <section class="box"><h4>Top unites</h4>${bars(unitTop)}</section>
      <section class="box"><h4>Top categories DORESE</h4>${bars(recoTop)}</section>
      <section class="box"><h4>Volume global</h4>${bars([["5W1H", totals.facts], ["Recos", totals.recos], ["Avis QWI", totals.qwi], ["Mots", totals.words]])}</section>
    </div>`;
}

function renderPanels() {
  if (state.mode === "consult") renderConsult();
  if (state.mode === "analyze") renderAnalyze();
}

function renderAll() {
  renderPanels();
}

async function readFileFromEntry(entry) {
  return new Promise((resolve) => {
    try {
      entry.file((file) => resolve(file), () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

async function readEntries(reader) {
  return new Promise((resolve) => {
    try {
      reader.readEntries((entries) => resolve(entries || []), () => resolve([]));
    } catch {
      resolve([]);
    }
  });
}

async function walkDroppedEntry(entry, outFiles) {
  if (!entry) return;
  if (entry.isFile) {
    const file = await readFileFromEntry(entry);
    if (file) outFiles.push(file);
    return;
  }
  if (!entry.isDirectory) return;
  const reader = entry.createReader();
  while (true) {
    const entries = await readEntries(reader);
    if (!entries.length) break;
    for (const child of entries) await walkDroppedEntry(child, outFiles);
  }
}

async function readDroppedDirectoryFiles(dt) {
  const out = [];
  const items = [...(dt?.items || [])];
  const entries = items
    .map((it) => (typeof it.webkitGetAsEntry === "function" ? it.webkitGetAsEntry() : null))
    .filter(Boolean);
  if (!entries.length) return out;
  for (const entry of entries) await walkDroppedEntry(entry, out);
  return out;
}

async function readDroppedTextPayloads(dt) {
  const chunks = [];
  const seen = new Set();
  const addChunk = (source, text) => {
    const raw = String(text || "");
    if (!raw.trim()) return;
    const key = `${source}|${hash(raw)}`;
    if (seen.has(key)) return;
    seen.add(key);
    chunks.push({ source, text: raw });
  };
  if (!dt) return chunks;

  addChunk("text/plain", dt.getData("text/plain"));
  addChunk("text/html", dt.getData("text/html"));
  addChunk("text/uri-list", dt.getData("text/uri-list"));

  const items = [...(dt.items || [])];
  const stringItems = items.filter((it) => it.kind === "string");
  await Promise.all(stringItems.map((it, idx) => new Promise((resolve) => {
    try {
      it.getAsString((value) => {
        addChunk(it.type || `item-${idx}`, value);
        resolve();
      });
    } catch {
      resolve();
    }
  })));

  return chunks;
}

async function handleDrop(ev) {
  ev.preventDefault();
  ev.stopPropagation();
  el.dropzone.classList.remove("drag-over");

  let c = 0;
  const directFiles = [...(ev.dataTransfer?.files || [])];
  const folderFiles = await readDroppedDirectoryFiles(ev.dataTransfer);
  c += await importFiles([...directFiles, ...folderFiles]);

  const chunks = await readDroppedTextPayloads(ev.dataTransfer);
  for (const chunk of chunks) {
    c += await importFromText(normalizeTextPayload(chunk.text, chunk.source), "text_drop", chunk.source);
  }

  if (c) {
    toast(`${c} AAR importe(s) localement.`);
    setMode("consult");
    renderAll();
  } else {
    toast("Aucun JSON AAR detecte.");
  }
}

async function importRawTextPayload(rawText) {
  const raw = String(rawText || "").trim();
  if (!raw) {
    toast("Aucun texte a importer.");
    return;
  }
  const normalized = normalizeTextPayload(raw, "text/plain");
  let count = 0;
  count += await importFromText(raw, "raw_text", "manual_paste");
  if (!count) {
    count += await importFromText(normalized, "raw_text", "manual_paste");
  }
  if (count) {
    toast(`${count} AAR importe(s) depuis texte.`);
    setMode("consult");
    renderAll();
  } else {
    toast("Aucun JSON AAR detecte dans le texte.");
  }
}

async function init() {
  Object.assign(el, {
    syncDriveBtn: document.getElementById("sync-drive-btn"),
    sourceStatus: document.getElementById("source-status"),
    lastSync: document.getElementById("last-sync"),
    importFilesBtn: document.getElementById("import-files-btn"),
    importFilesInput: document.getElementById("import-files-input"),
    importFolderBtn: document.getElementById("import-folder-btn"),
    importFolderInput: document.getElementById("import-folder-input"),
    resetAppBtn: document.getElementById("reset-app-btn"),
    rawEmailInput: document.getElementById("raw-email-input"),
    importRawBtn: document.getElementById("import-raw-btn"),
    pasteClipboardBtn: document.getElementById("paste-clipboard-btn"),
    dropzone: document.getElementById("dropzone"),
    searchInput: document.getElementById("search-input"),
    classifFilter: document.getElementById("classif-filter"),
    sortFilter: document.getElementById("sort-filter"),
    panelConsult: document.getElementById("panel-consult"),
    panelAnalyze: document.getElementById("panel-analyze"),
    toast: document.getElementById("toast")
  });

  const lastSync = localStorage.getItem(LAST_SYNC_KEY) || "";
  updateLastSyncLabel(lastSync);

  const cfg = getDriveConfig();
  if (cfg.indexFileId || (cfg.apiKey && cfg.folderId)) {
    setSourceStatus("Source: Google Drive configure");
  } else {
    setSourceStatus("Source: config invalide (mettre indexFileId, ou apiKey+folderId)");
  }

  if (el.syncDriveBtn) {
    el.syncDriveBtn.onclick = () => syncFromGoogleDrive();
  }

  el.dropzone.addEventListener("dragover", (ev) => { ev.preventDefault(); el.dropzone.classList.add("drag-over"); });
  el.dropzone.addEventListener("dragleave", () => el.dropzone.classList.remove("drag-over"));
  el.dropzone.addEventListener("drop", handleDrop);

  document.addEventListener("dragover", (ev) => ev.preventDefault());
  document.addEventListener("drop", (ev) => { if (!el.dropzone.contains(ev.target)) handleDrop(ev); });

  if (el.importFilesBtn && el.importFilesInput) {
    el.importFilesBtn.onclick = () => el.importFilesInput.click();
    el.importFilesInput.onchange = async () => {
      const files = [...(el.importFilesInput.files || [])];
      if (!files.length) return;
      const c = await importFiles(files);
      if (c) {
        toast(`${c} AAR importe(s) localement.`);
        setMode("consult");
        renderAll();
      } else {
        toast("Aucun AAR detecte dans les fichiers selectionnes.");
      }
      el.importFilesInput.value = "";
    };
  }

  if (el.importFolderBtn && el.importFolderInput) {
    el.importFolderBtn.onclick = () => el.importFolderInput.click();
    el.importFolderInput.onchange = async () => {
      const files = [...(el.importFolderInput.files || [])];
      if (!files.length) return;
      const c = await importFiles(files);
      if (c) {
        toast(`${c} AAR importe(s) localement.`);
        setMode("consult");
        renderAll();
      } else {
        toast("Aucun JSON AAR detecte dans le dossier selectionne.");
      }
      el.importFolderInput.value = "";
    };
  }

  if (el.resetAppBtn) el.resetAppBtn.onclick = resetApplicationData;

  if (el.importRawBtn && el.rawEmailInput) {
    el.importRawBtn.onclick = async () => {
      await importRawTextPayload(el.rawEmailInput.value);
    };
  }

  if (el.pasteClipboardBtn && el.rawEmailInput) {
    el.pasteClipboardBtn.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        el.rawEmailInput.value = text || "";
        if (!text) {
          toast("Presse-papiers vide.");
          return;
        }
        toast("Texte colle depuis le presse-papiers.");
      } catch (e) {
        toast(`Lecture presse-papiers impossible: ${e.message}`);
      }
    };
  }

  [el.searchInput, el.classifFilter, el.sortFilter].forEach((n) => {
    n.addEventListener("input", renderAll);
    n.addEventListener("change", renderAll);
  });
  document.querySelectorAll(".tab").forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });

  try {
    state.reports = await dbGetAll();
    state.reports.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  } catch (e) {
    toast(`Erreur IndexedDB: ${e.message}`);
  }

  renderAll();

  if (cfg.autoSyncOnStartup) {
    if (navigator.onLine) {
      await syncFromGoogleDrive({ silent: true });
    } else {
      setSourceStatus("Source: hors ligne, lecture cache local");
    }
  }
}

init();
