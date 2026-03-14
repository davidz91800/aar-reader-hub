/* ═══════════════════════════════════════════════════════════
   AAR Reader Hub — Application Logic (v2 — Refonte)
   ═══════════════════════════════════════════════════════════ */

const DB_NAME = "aar_reader_hub_v1";
const STORE = "reports";
const LAST_SYNC_KEY = "aar_reader_last_sync_v1";

const state = {
  reports: [],
  mode: "list",        // "list" | "analyze"
  openDetailId: null
};

const el = {};

/* ═══ UTILITIES ═══ */
function esc(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(msg) {
  if (!el.toast) return;
  el.toast.textContent = msg;
  el.toast.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.toast.classList.remove("show"), 2800);
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

function formatDateFr(iso) {
  if (!iso) return "—";
  const parts = String(iso).split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/* ═══ AAR DATA MODEL ═══ */
function normalizeAar(input) {
  const a = input && typeof input === "object" ? input : {};
  const meta = a.meta || {};
  return {
    meta: {
      title: meta.title || "",
      date: safeDate(meta.date),
      grade: meta.grade || "",
      gradeAutre: meta.gradeAutre || "",
      nom: meta.nom || "",
      prenom: meta.prenom || "",
      unite: meta.unite || "",
      uniteAutre: meta.uniteAutre || "",
      classification: normalizeClassif(meta.classification || ""),
      // Extended fields from AAR PWA form
      missionType: meta.missionType || "",
      flotte: meta.flotte || "",
      flotteAutre: meta.flotteAutre || "",
      logCountry: meta.logCountry || "",
      logCountryAutre: meta.logCountryAutre || "",
      logAirfield: meta.logAirfield || "",
      logAirfieldAutre: meta.logAirfieldAutre || "",
      tacContext: meta.tacContext || "",
      tacOperation: meta.tacOperation || "",
      tacOperationAutre: meta.tacOperationAutre || "",
      tacExercise: meta.tacExercise || "",
      tacExerciseAutre: meta.tacExerciseAutre || ""
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

/* ═══ DERIVE META (enriched for filters) ═══ */
function deriveMeta(a) {
  const meta = a.meta || {};
  const facts = a.facts || {};
  const recos = a.recos || {};

  const rank = meta.grade === "AUTRE" ? meta.gradeAutre : meta.grade;
  const unit = meta.unite === "AUTRE" ? meta.uniteAutre : meta.unite;
  const name = [meta.nom, meta.prenom].filter(Boolean).join(" ").trim();
  const redacteur = [rank, name].filter(Boolean).join(" ").trim() || "N/A";

  // Extended computed fields
  const fleet = meta.flotte === "AUTRE" ? (meta.flotteAutre || "") : (meta.flotte || "");
  const missionType = meta.missionType || "";
  const country = meta.logCountry === "AUTRE" ? (meta.logCountryAutre || "") : (meta.logCountry || "");
  const airfield = meta.logAirfield === "AUTRE" ? (meta.logAirfieldAutre || "") : (meta.logAirfield || "");
  const tacContext = meta.tacContext || "";
  const tacDetail = tacContext === "OPERATIONS"
    ? (meta.tacOperation === "AUTRE" ? meta.tacOperationAutre : meta.tacOperation) || ""
    : tacContext === "EXERCICE"
    ? (meta.tacExercise === "AUTRE" ? meta.tacExerciseAutre : meta.tacExercise) || ""
    : "";

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
    meta.title, rank, meta.nom, meta.prenom, unit,
    facts.what, facts.why, facts.when, facts.where, facts.who, facts.how, facts.narrative,
    a.analysis?.content,
    recos.doctrine, recos.organisation, recos.rh, recos.equipements, recos.soutien, recos.entrainement,
    a.qwi?.advice, fleet, country, airfield, tacDetail
  ].map(cleanText).join(" ");
  const wordCount = allText ? allText.split(/\s+/).filter(Boolean).length : 0;

  return {
    title: meta.title || "AAR sans titre",
    date: safeDate(meta.date),
    redacteur,
    nom: meta.nom || "",
    prenom: meta.prenom || "",
    unit: unit || "N/A",
    classification: normalizeClassif(meta.classification),
    missionType,
    fleet,
    country,
    airfield,
    tacContext,
    tacDetail,
    factsFilled,
    recosFilled,
    recoCats,
    qwiFilled,
    wordCount,
    missionKey: `${safeDate(meta.date)}|${slug(meta.title || "")}|${slug(name || "anon")}`
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

/* ═══ DRIVE / STATIC SYNC (unchanged logic) ═══ */
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
  return out.split("?")[0].split("#")[0].trim();
}

function isPlaceholderValue(value) {
  const v = String(value || "").trim().toUpperCase();
  if (!v) return false;
  return v.includes("ID_INDEX_JSON_PUBLIC") || v.includes("ID_DU_DOSSIER_DRIVE") || v.includes("TON_API_KEY") || v.includes("API_KEY_OPTIONNEL");
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

function getStaticConfig() {
  const cfg = window.AAR_READER_CONFIG || {};
  const s = cfg.staticRepo || {};
  const indexUrl = String(s.indexUrl || "./AAR Reader Data/index.json").trim() || "./AAR Reader Data/index.json";
  return { enabled: s.enabled !== false, indexUrl };
}

function hasDriveSource(cfg = getDriveConfig()) {
  return !!cfg.indexFileId || (!!cfg.apiKey && !!cfg.folderId);
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

function driveDownloadOrder(cfg) {
  if (!cfg.apiKey) return ["public"];
  return ["api"];
}

function isGoogleAntiBotMessage(msg) {
  const text = String(msg || "").toLowerCase();
  return text.includes("automated queries") || text.includes("we're sorry") || text.includes("google help") || text.includes("protect our users");
}

async function fetchJsonOrThrow(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { cache: "no-store", signal: controller.signal });
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error(`Timeout réseau (${Math.round(timeoutMs / 1000)}s)`);
    throw e;
  } finally { clearTimeout(timer); }

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    const compact = txt.replace(/\s+/g, " ").trim();
    if (isGoogleAntiBotMessage(compact)) throw new Error("Google bloque temporairement les téléchargements. Réessaye dans 2-10 minutes.");
    if (/referer\s+null/i.test(compact) || /referer.*blocked/i.test(compact)) throw new Error("API key bloquée par referer.");
    throw new Error(`HTTP ${response.status} ${response.statusText} ${compact.slice(0, 180)}`);
  }
  const raw = await response.text();
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Réponse vide");
  if (/^\s*<!doctype html/i.test(trimmed) || /^\s*<html/i.test(trimmed)) throw new Error("Fichier non accessible publiquement (réponse HTML).");
  const payload = trimmed.replace(/^\)\]\}'\s*\n?/, "");
  try { return JSON.parse(payload); } catch { throw new Error("JSON invalide."); }
}

async function downloadDriveJson(cfg, file) {
  const order = driveDownloadOrder(cfg);
  const errors = [];
  for (const mode of order) {
    try {
      return mode === "api"
        ? await fetchJsonOrThrow(driveMediaUrl(file.id, cfg.apiKey, file.resourceKey))
        : await fetchJsonOrThrow(drivePublicDownloadUrl(file.id, file.resourceKey));
    } catch (e) {
      errors.push(`${mode}: ${e.message}`);
      if (mode === "api" && /failed to fetch/i.test(String(e?.message || ""))) break;
    }
  }
  throw new Error(errors.join(" | "));
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
      return { id: item.id || "", name: item.name || `aar_${i + 1}.json`, resourceKey: item.resourceKey || "" };
    }).filter((x) => x.id);
  }
  if (Array.isArray(data.files)) {
    return data.files.map((x, i) => ({ id: x.id || "", name: x.name || `aar_${i + 1}.json`, resourceKey: x.resourceKey || "" })).filter((x) => x.id);
  }
  throw new Error("index.json invalide");
}

function toStaticUrl(pathLike) {
  return encodeURI(String(pathLike || "").replace(/\\/g, "/"));
}

async function listStaticFilesFromIndex(indexUrl) {
  const data = await fetchJsonOrThrow(toStaticUrl(indexUrl));
  const rows = Array.isArray(data) ? data : (Array.isArray(data.files) ? data.files : []);
  return rows.map((item, i) => {
    if (typeof item === "string") {
      const raw = item.replace(/\\/g, "/");
      return { path: raw.includes("/") ? raw : `AAR Reader Data/${raw}`, name: raw.split("/").pop() || `aar_${i + 1}.json`, modifiedTime: "" };
    }
    const obj = item || {};
    const pathVal = String(obj.path || "").trim();
    const nameVal = String(obj.name || "").trim();
    const finalPath = pathVal ? pathVal.replace(/\\/g, "/") : (nameVal ? `AAR Reader Data/${nameVal}` : "");
    if (!finalPath) return null;
    return { path: finalPath, name: nameVal || finalPath.split("/").pop() || `aar_${i + 1}.json`, modifiedTime: String(obj.modifiedTime || "").trim() };
  }).filter((x) => x && x.path && /\.json$/i.test(x.path));
}

function setSubtitle(msg) { /* no-op: subtitle removed */ }

async function syncFromStaticRepo({ silent = false } = {}) {
  const staticCfg = getStaticConfig();
  if (!staticCfg.enabled) throw new Error("Source statique désactivée.");
  setSubtitle("Synchronisation en cours…");
  setSyncing(true);
  try {
    const files = await listStaticFilesFromIndex(staticCfg.indexUrl);
    if (!files.length) {
      if (state.reports.length) {
        setSubtitle(`${state.reports.length} AAR · source statique vide`);
        if (!silent) toast("Aucun fichier dans l'index statique, cache conservé.");
        return;
      }
      await dbReplaceAll([]);
      state.reports = [];
      renderAll();
      setSubtitle("0 AAR · source statique");
      saveLastSync();
      if (!silent) toast("Aucun AAR trouvé.");
      return;
    }
    const existingByPath = new Map(
      state.reports.filter((r) => r.source === "static_file" && r.staticPath).map((r) => [r.staticPath, r])
    );
    const records = [];
    const errors = [];
    for (const f of files) {
      const existing = existingByPath.get(f.path);
      const sameVersion = existing && existing.staticModifiedTime && f.modifiedTime && existing.staticModifiedTime === f.modifiedTime;
      if (sameVersion) { records.push(existing); continue; }
      try {
        const payload = await fetchJsonOrThrow(toStaticUrl(f.path));
        const rec = buildRecord(parseAarObject(payload), "static_file", f.name || f.path);
        rec.updatedAt = f.modifiedTime || new Date().toISOString();
        rec.staticPath = f.path;
        rec.staticModifiedTime = f.modifiedTime || "";
        if (existing) { rec.id = existing.id; rec.createdAt = existing.createdAt || rec.createdAt; }
        records.push(rec);
      } catch (e) {
        errors.push(`${f.name || f.path}: ${e.message}`);
        if (existing) records.push(existing);
      }
    }
    if (!records.length && state.reports.length) {
      setSubtitle(`${state.reports.length} AAR · echec sync`);
      if (!silent) toast("Sync en échec : cache conservé.");
      return;
    }
    await dbReplaceAll(records);
    state.reports = records.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    renderAll();
    saveLastSync();
    setSubtitle(`${records.length} AAR · source statique`);
    if (!silent) {
      if (errors.length) toast(`Sync OK : ${records.length} AAR, ${errors.length} erreur(s).`);
      else toast(`Sync OK : ${records.length} AAR.`);
    }
  } finally { setSyncing(false); }
}

async function syncFromGoogleDrive({ silent = false } = {}) {
  const cfg = getDriveConfig();
  const hasIndexMode = !!cfg.indexFileId;
  const hasFolderMode = !!cfg.apiKey && !!cfg.folderId;
  if (!hasIndexMode && !hasFolderMode) {
    setSubtitle("Config invalide");
    if (!silent) toast("Config invalide : indexFileId, ou apiKey+folderId.");
    return;
  }
  setSubtitle("Synchronisation Drive…");
  setSyncing(true);
  try {
    const files = hasIndexMode ? await listDriveFilesFromIndex(cfg.indexFileId) : await listDriveFiles(cfg.apiKey, cfg.folderId);
    if (!files.length) {
      await dbReplaceAll([]);
      state.reports = [];
      renderAll();
      setSubtitle("0 AAR · Google Drive");
      saveLastSync();
      if (!silent) toast("Aucun AAR trouvé sur Drive.");
      return;
    }
    const existingDriveById = new Map(
      state.reports.filter((r) => r.source === "drive_file" && r.driveFileId).map((r) => [r.driveFileId, r])
    );
    const records = [];
    const errors = [];
    let blockedByGoogle = false;
    for (const f of files) {
      const existing = existingDriveById.get(f.id);
      const sameVersion = existing && existing.driveModifiedTime && f.modifiedTime && existing.driveModifiedTime === f.modifiedTime;
      if (sameVersion) { records.push(existing); continue; }
      if (blockedByGoogle) {
        if (existing) records.push(existing);
        else errors.push(`${f.name || f.id}: sauté (blocage Google).`);
        continue;
      }
      try {
        const payload = await downloadDriveJson(cfg, f);
        const rec = buildRecord(parseAarObject(payload), "drive_file", f.name || f.id);
        rec.updatedAt = f.modifiedTime || new Date().toISOString();
        rec.driveFileId = f.id;
        rec.driveModifiedTime = f.modifiedTime || "";
        if (existing) { rec.id = existing.id; rec.createdAt = existing.createdAt || rec.createdAt; }
        records.push(rec);
      } catch (e) {
        errors.push(`${f.name || f.id}: ${e.message}`);
        if (existing) records.push(existing);
        if (isGoogleAntiBotMessage(e.message)) blockedByGoogle = true;
      }
    }
    if (!records.length && state.reports.length) {
      setSubtitle(`${state.reports.length} AAR · échec sync Drive`);
      if (!silent) toast("Sync Drive en échec : cache conservé.");
      return;
    }
    await dbReplaceAll(records);
    state.reports = records.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    renderAll();
    saveLastSync();
    setSubtitle(blockedByGoogle ? `${records.length} AAR · Drive (blocage détecté)` : `${records.length} AAR · Google Drive`);
    if (!silent) {
      if (errors.length) toast(`Sync OK : ${records.length} AAR, ${errors.length} erreur(s).`);
      else toast(`Sync OK : ${records.length} AAR.`);
    }
  } catch (e) {
    const staticCfg = getStaticConfig();
    if (staticCfg.enabled) {
      try { await syncFromStaticRepo({ silent }); if (!silent) toast("Drive indisponible : basculé sur source statique."); return; } catch {}
    }
    setSubtitle(`Erreur : ${e.message}`);
    if (!silent) toast(`Erreur sync Drive : ${e.message}`);
  } finally { setSyncing(false); }
}

async function syncPreferred({ silent = false } = {}) {
  const driveCfg = getDriveConfig();
  if (hasDriveSource(driveCfg)) { await syncFromGoogleDrive({ silent }); return; }
  await syncFromStaticRepo({ silent });
}

function saveLastSync() {
  const now = new Date().toISOString();
  localStorage.setItem(LAST_SYNC_KEY, now);
}

function setSyncing(on) {
  if (el.syncBtn) {
    el.syncBtn.disabled = on;
    el.syncBtn.classList.toggle("syncing", on);
  }
}

/* ═══ IndexedDB ═══ */
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

/* ═══ DYNAMIC FILTER OPTIONS ═══ */
function getUniqueValues(key) {
  const vals = new Set();
  for (const r of state.reports) {
    const v = String(r[key] || "").trim();
    if (v && v !== "N/A") vals.add(v);
  }
  return [...vals].sort();
}

function populateDynamicFilters() {
  fillSelectOptions(el.filterFleet, "Flotte: Toutes", getUniqueValues("fleet"));
  fillSelectOptions(el.filterUnit, "Unité: Toutes", getUniqueValues("unit"));
  fillSelectOptions(el.filterCountry, "Pays: Tous", getUniqueValues("country"));
}

function fillSelectOptions(selectEl, allLabel, values) {
  if (!selectEl) return;
  const current = selectEl.value;
  selectEl.innerHTML = `<option value="ALL">${esc(allLabel)}</option>` +
    values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
  if (values.includes(current)) selectEl.value = current;
  else selectEl.value = "ALL";
  updateChipState(selectEl);
}

function updateChipState(sel) {
  if (!sel) return;
  sel.classList.toggle("has-value", sel.value !== "ALL");
}

/* ═══ FILTER & SORT ═══ */
function filtered() {
  const q = (el.searchInput?.value || "").trim().toLowerCase();
  const classif = el.filterClassif?.value || "ALL";
  const mType = el.filterMissionType?.value || "ALL";
  const fleet = el.filterFleet?.value || "ALL";
  const unit = el.filterUnit?.value || "ALL";
  const country = el.filterCountry?.value || "ALL";
  const sort = el.filterSort?.value || "DATE_DESC";

  let rows = state.reports;

  if (classif !== "ALL") rows = rows.filter((r) => r.classification === classif);
  if (mType !== "ALL") rows = rows.filter((r) => r.missionType === mType);
  if (fleet !== "ALL") rows = rows.filter((r) => r.fleet === fleet);
  if (unit !== "ALL") rows = rows.filter((r) => r.unit === unit);
  if (country !== "ALL") rows = rows.filter((r) => r.country === country);

  if (q) {
    rows = rows.filter((r) => [
      r.title, r.redacteur, r.nom, r.prenom, r.unit,
      r.classification, r.fleet, r.country, r.airfield,
      r.missionType, r.tacDetail,
      r.mission?.analysis?.content,
      r.mission?.facts?.narrative,
      r.recoCats?.join(" "),
      r.mission?.qwi?.advice
    ].map(cleanText).join(" ").toLowerCase().includes(q));
  }

  if (sort === "DATE_DESC") rows = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  else if (sort === "DATE_ASC") rows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  else if (sort === "TITLE_ASC") rows = [...rows].sort((a, b) => a.title.localeCompare(b.title));
  else if (sort === "UPDATED_DESC") rows = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return rows;
}

/* ═══ RENDERING — LIST VIEW ═══ */
function classifTag(c) {
  const norm = normalizeClassif(c);
  if (norm === "NON PROTEGE") return `<span class="tag tag-np">NP</span>`;
  if (norm === "DIFFUSION RESTREINTE") return `<span class="tag tag-dr">DR</span>`;
  if (norm === "SECRET SPECIAL FRANCE") return `<span class="tag tag-ssf">SSF</span>`;
  return `<span class="tag tag-dorese">${esc(norm)}</span>`;
}

function renderList() {
  const rows = filtered();

  // Count badge
  if (el.aarCount) {
    el.aarCount.textContent = rows.length === state.reports.length
      ? `${rows.length} AAR`
      : `${rows.length} / ${state.reports.length} AAR`;
  }

  if (!rows.length) {
    el.aarGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3>${state.reports.length ? "Aucun AAR ne correspond aux filtres" : "Aucun AAR chargé"}</h3>
        <p>${state.reports.length ? "Essaie de modifier tes critères de recherche." : "Clique sur le bouton ↻ pour synchroniser les données."}</p>
      </div>`;
    return;
  }

  el.aarGrid.innerHTML = rows.map((r) => {
    const excerpt = cleanText(r.mission?.facts?.narrative || r.mission?.analysis?.content || r.mission?.facts?.what || "");
    const tags = [classifTag(r.classification)];
    if (r.missionType) tags.push(`<span class="tag tag-${r.missionType.toLowerCase()}">${esc(r.missionType)}</span>`);
    if (r.fleet) tags.push(`<span class="tag tag-fleet">${esc(r.fleet)}</span>`);
    if (r.recoCats?.length) tags.push(...r.recoCats.slice(0, 3).map((c) => `<span class="tag tag-dorese">${esc(c)}</span>`));

    return `
      <article class="aar-card" data-id="${r.id}" role="button" tabindex="0">
        <div class="card-top">
          <div class="card-title">${esc(r.title)}</div>
          <div class="card-date">${formatDateFr(r.date)}</div>
        </div>
        <div class="card-meta">${esc(r.redacteur)} · ${esc(r.unit)}${r.country ? " · " + esc(r.country) : ""}${r.airfield ? " · " + esc(r.airfield) : ""}</div>
        ${excerpt ? `<div class="card-excerpt">${esc(excerpt.slice(0, 200))}</div>` : ""}
        <div class="card-tags">${tags.join("")}</div>
      </article>`;
  }).join("");

  // Attach click events
  el.aarGrid.querySelectorAll(".aar-card").forEach((card) => {
    card.addEventListener("click", () => openDetail(card.dataset.id));
    card.addEventListener("keydown", (e) => { if (e.key === "Enter") openDetail(card.dataset.id); });
  });
}

/* ═══ RENDERING — DETAIL MODAL ═══ */
function openDetail(id) {
  const r = state.reports.find((x) => x.id === id);
  if (!r) return;
  state.openDetailId = id;
  const m = r.mission;

  el.detailTitle.textContent = r.title;
  el.detailMetaLine.textContent = `${formatDateFr(r.date)} · ${r.redacteur} · ${r.unit} · ${r.classification}${r.fleet ? " · " + r.fleet : ""}${r.country ? " · " + r.country : ""}`;

  const factLabels = { what: "WHAT / QUOI", why: "WHY / POURQUOI", when: "WHEN / QUAND", where: "WHERE / OÙ", who: "WHO / QUI", how: "HOW / COMMENT", narrative: "NARRATIF" };
  const factsHtml = Object.entries(factLabels).map(([k, label]) => {
    const txt = cleanText(m.facts[k]);
    return `<div class="w6-item"><div class="w6-label">${esc(label)}</div><div class="w6-content">${txt ? esc(txt) : '<span class="w6-na">N/A</span>'}</div></div>`;
  }).join("");

  const recoLabels = { doctrine: "DOCTRINE", organisation: "ORGANISATION", rh: "RH", equipements: "ÉQUIPEMENTS", soutien: "SOUTIEN", entrainement: "ENTRAÎNEMENT" };
  const recosHtml = Object.entries(recoLabels)
    .filter(([k]) => nonEmpty(m.recos[k]))
    .map(([k, label]) => `<div class="dorese-block"><div class="dorese-tag">${esc(label)}</div><div class="dorese-text">${esc(cleanText(m.recos[k]))}</div></div>`)
    .join("") || '<p style="color:var(--text-muted)">Aucune recommandation.</p>';

  const analysisText = cleanText(m.analysis?.content);
  const qwiText = cleanText(m.qwi?.advice);

  let missionCtxHtml = "";
  if (r.missionType || r.country || r.airfield || r.tacDetail) {
    const parts = [];
    if (r.missionType) parts.push(`<strong>Type :</strong> ${esc(r.missionType)}`);
    if (r.country) parts.push(`<strong>Pays :</strong> ${esc(r.country)}`);
    if (r.airfield) parts.push(`<strong>Terrain OACI :</strong> ${esc(r.airfield)}`);
    if (r.tacContext) parts.push(`<strong>Contexte TAC :</strong> ${esc(r.tacContext)}`);
    if (r.tacDetail) parts.push(`<strong>Détail :</strong> ${esc(r.tacDetail)}`);
    missionCtxHtml = `
      <div class="detail-section">
        <div class="detail-section-head">Contexte Mission</div>
        <div class="detail-section-body"><p>${parts.join(" &nbsp;·&nbsp; ")}</p></div>
      </div>`;
  }

  el.detailBody.innerHTML = `
    ${missionCtxHtml}
    <div class="detail-section">
      <div class="detail-section-head">5W1H — Faits</div>
      <div class="detail-section-body"><div class="w6-grid">${factsHtml}</div></div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head">Analyse</div>
      <div class="detail-section-body"><p>${analysisText ? esc(analysisText) : '<span class="w6-na">N/A</span>'}</p></div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head">Recommandations DORESE</div>
      <div class="detail-section-body">${recosHtml}</div>
    </div>
    <div class="detail-section">
      <div class="detail-section-head">Avis QWI / Weapons School</div>
      <div class="detail-section-body"><p>${qwiText ? esc(qwiText) : '<span class="w6-na">N/A</span>'}</p></div>
    </div>`;

  el.detailOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeDetail() {
  el.detailOverlay.classList.remove("open");
  document.body.style.overflow = "";
  state.openDetailId = null;
}

/* ═══ RENDERING — ANALYZE VIEW ═══ */
function topMap(reports, mapper, n) {
  const map = new Map();
  reports.forEach((r) => mapper(r).forEach((k) => { if (!k) return; map.set(k, (map.get(k) || 0) + 1); }));
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function barsHtml(rows) {
  if (!rows.length) return '<p style="color:var(--text-muted)">Aucune donnée.</p>';
  const max = Math.max(...rows.map((x) => x[1]));
  return rows.map(([k, v]) => `
    <div class="bar-row">
      <div class="bar-label" title="${esc(k)}">${esc(k)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, Math.round((v / max) * 100))}%"></div></div>
      <div class="bar-value">${v}</div>
    </div>`).join("");
}

function renderAnalyze() {
  if (!state.reports.length) {
    el.viewAnalyze.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <h3>Aucun AAR pour analyse</h3>
        <p>Synchronise les données pour voir les statistiques.</p>
      </div>`;
    return;
  }

  const totals = state.reports.reduce((a, r) => {
    a.qwi += r.qwiFilled ? 1 : 0;
    return a;
  }, { qwi: 0 });

  const classifTop = topMap(state.reports, (r) => [r.classification], 5);
  const unitTop = topMap(state.reports, (r) => [r.unit || "N/A"], 10);
  const recoTop = topMap(state.reports, (r) => r.recoCats || [], 6);
  const mTypeTop = topMap(state.reports, (r) => [r.missionType].filter(Boolean), 10);
  const countryTop = topMap(state.reports, (r) => [r.country].filter(Boolean), 30);
  const opsExTop = topMap(state.reports, (r) => [r.tacDetail].filter(Boolean), 30);

  // Rename LOG / TAC for display
  const mTypeDisplay = mTypeTop.map(([k, v]) => {
    if (k === "LOG") return ["Logistique (LOG)", v];
    if (k === "TAC") return ["Tactique (TAC)", v];
    return [k, v];
  });

  el.viewAnalyze.innerHTML = `
    <div class="stats-grid">
      <article class="stat-card"><div class="stat-label">AAR total</div><div class="stat-value">${state.reports.length}</div></article>
      <article class="stat-card"><div class="stat-label">Avis QWI</div><div class="stat-value">${totals.qwi}</div></article>
    </div>
    <div class="analyze-grid">
      ${mTypeDisplay.length ? `<section class="analyze-box"><h4>Logistique / Tactique</h4>${barsHtml(mTypeDisplay)}</section>` : ""}
      ${countryTop.length ? `<section class="analyze-box"><h4>Par pays</h4>${barsHtml(countryTop)}</section>` : ""}
      ${opsExTop.length ? `<section class="analyze-box"><h4>Par opération / exercice</h4>${barsHtml(opsExTop)}</section>` : ""}
      <section class="analyze-box"><h4>Par classification</h4>${barsHtml(classifTop)}</section>
      <section class="analyze-box"><h4>Par unité</h4>${barsHtml(unitTop)}</section>
      <section class="analyze-box"><h4>Par catégorie DORESE</h4>${barsHtml(recoTop)}</section>
    </div>`;
}

/* ═══ VIEW SWITCHING ═══ */
function setView(view) {
  state.mode = view;
  document.querySelectorAll(".toggle-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const target = document.getElementById(`view-${view}`);
  if (target) target.classList.add("active");
  renderCurrentView();
}

function renderCurrentView() {
  if (state.mode === "list") renderList();
  else if (state.mode === "analyze") renderAnalyze();
}

function renderAll() {
  populateDynamicFilters();
  renderCurrentView();
}

/* ═══ INIT ═══ */
async function init() {
  Object.assign(el, {
    syncBtn: document.getElementById("sync-btn"),

    searchInput: document.getElementById("search-input"),
    filterMissionType: document.getElementById("filter-mission-type"),
    filterClassif: document.getElementById("filter-classif"),
    filterFleet: document.getElementById("filter-fleet"),
    filterUnit: document.getElementById("filter-unit"),
    filterCountry: document.getElementById("filter-country"),
    filterSort: document.getElementById("filter-sort"),
    aarGrid: document.getElementById("aar-grid"),
    aarCount: document.getElementById("aar-count"),
    viewList: document.getElementById("view-list"),
    viewAnalyze: document.getElementById("view-analyze"),
    detailOverlay: document.getElementById("detail-overlay"),
    detailTitle: document.getElementById("detail-title"),
    detailMetaLine: document.getElementById("detail-meta-line"),
    detailBody: document.getElementById("detail-body"),
    detailClose: document.getElementById("detail-close"),
    toast: document.getElementById("toast")
  });

  // Sync button
  if (el.syncBtn) el.syncBtn.onclick = () => syncPreferred();

  // View toggle
  document.querySelectorAll(".toggle-btn").forEach((b) => {
    b.onclick = () => setView(b.dataset.view);
  });

  // Close detail
  if (el.detailClose) el.detailClose.onclick = closeDetail;
  if (el.detailOverlay) {
    el.detailOverlay.addEventListener("click", (e) => {
      if (e.target === el.detailOverlay) closeDetail();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.openDetailId) closeDetail();
  });

  // Filter events
  const allFilters = [el.searchInput, el.filterMissionType, el.filterClassif, el.filterFleet, el.filterUnit, el.filterCountry, el.filterSort];
  allFilters.forEach((n) => {
    if (!n) return;
    n.addEventListener("input", () => { updateChipState(n); renderCurrentView(); });
    n.addEventListener("change", () => { updateChipState(n); renderCurrentView(); });
  });

  // Source status
  const cfg = getDriveConfig();
  const staticCfg = getStaticConfig();
  if (hasDriveSource(cfg)) setSubtitle("Source : Google Drive");
  else if (staticCfg.enabled) setSubtitle("Source : données statiques");
  else setSubtitle("Source non configurée");

  // Load from IndexedDB
  let dbOk = false;
  try {
    state.reports = await dbGetAll();
    state.reports.sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
    dbOk = true;
  } catch (e) {
    // IndexedDB may fail on file:// too — that's OK
    console.warn("IndexedDB unavailable:", e.message);
  }

  renderAll();

  // Detect file:// protocol — fetch won't work
  if (location.protocol === "file:") {
    toast("Ouverture locale détectée. Utilise un serveur HTTP (ex: localhost:8888) pour charger les données.");
    return;
  }

  // Auto-sync
  if (cfg.autoSyncOnStartup || staticCfg.enabled) {
    if (navigator.onLine) {
      await syncPreferred({ silent: true });
    }
  }
}

init();
