"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "AAR Reader Data");
const DROP_DIR = path.join(DATA_DIR, "_EMAIL_DROP");
const DONE_DIR = path.join(DATA_DIR, "_EMAIL_DONE");
const ERROR_DIR = path.join(DATA_DIR, "_EMAIL_ERROR");
const INDEX_FILE = path.join(DATA_DIR, "index.json");
const LOCK_FILE = path.join(ROOT_DIR, ".email-drop-watcher.lock");
const POLL_MS = 3000;
const AUTO_PUSH_DELAY_MS = 8000;
const AUTO_PUSH_ENABLED = process.argv.includes("--auto-push");
const ONCE_MODE = process.argv.includes("--once");

const processing = new Set();
let autoPushTimer = null;
let autoPushRequested = false;
let autoPushRunning = false;
let lastDataSnapshot = "";

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${nowIso()}] ${msg}`);
}

function runGit(args) {
  return spawnSync("git", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    windowsHide: true
  });
}

function hasStagedChangesOutsideData() {
  const out = runGit(["diff", "--cached", "--name-only"]);
  if (out.status !== 0) return false;
  const lines = String(out.stdout || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return lines.some((name) => !name.startsWith("AAR Reader Data/"));
}

function hasPendingDataChanges() {
  const out = runGit(["status", "--porcelain", "--", "AAR Reader Data"]);
  if (out.status !== 0) return false;
  return String(out.stdout || "").trim().length > 0;
}

function scheduleAutoPush(reason) {
  if (!AUTO_PUSH_ENABLED) return;
  autoPushRequested = true;
  if (autoPushTimer) return;
  autoPushTimer = setTimeout(() => {
    autoPushTimer = null;
    runAutoPush().catch((e) => log(`Auto-push error: ${e.message}`));
  }, AUTO_PUSH_DELAY_MS);
  log(`Auto-push planifie (${reason})`);
}

async function runAutoPush() {
  if (!AUTO_PUSH_ENABLED || autoPushRunning || !autoPushRequested) return;
  autoPushRunning = true;
  autoPushRequested = false;

  try {
    if (hasStagedChangesOutsideData()) {
      log("Auto-push annule: changements indexes hors 'AAR Reader Data'.");
      return;
    }

    let res = runGit(["add", "--all", "--", "AAR Reader Data"]);
    if (res.status !== 0) {
      log(`Auto-push git add echec: ${String(res.stderr || res.stdout || "").trim()}`);
      return;
    }

    res = runGit(["diff", "--cached", "--quiet", "--", "AAR Reader Data"]);
    if (res.status === 0) {
      log("Auto-push: aucun changement data a publier.");
      return;
    }

    const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
    res = runGit(["commit", "-m", `Auto publish Reader data ${ts}`, "--", "AAR Reader Data"]);
    if (res.status !== 0) {
      log(`Auto-push commit echec: ${String(res.stderr || res.stdout || "").trim()}`);
      return;
    }

    res = runGit(["push"]);
    if (res.status !== 0) {
      log(`Auto-push push echec: ${String(res.stderr || res.stdout || "").trim()}`);
      return;
    }

    log("Auto-push: publication GitHub terminee.");
  } finally {
    autoPushRunning = false;
    if (autoPushRequested && !autoPushTimer) {
      autoPushTimer = setTimeout(() => {
        autoPushTimer = null;
        runAutoPush().catch((e) => log(`Auto-push error: ${e.message}`));
      }, AUTO_PUSH_DELAY_MS);
    }
  }
}

function isPidAlive(pid) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return false;
  try {
    process.kill(n, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock() {
  if (ONCE_MODE) return;
  if (fs.existsSync(LOCK_FILE)) {
    const raw = fs.readFileSync(LOCK_FILE, "utf8").trim();
    if (isPidAlive(raw)) {
      throw new Error(`Watcher deja lance (pid ${raw}).`);
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid), "utf8");
}

function releaseLock() {
  if (ONCE_MODE) return;
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const raw = fs.readFileSync(LOCK_FILE, "utf8").trim();
      if (String(process.pid) === raw) fs.unlinkSync(LOCK_FILE);
    }
  } catch {}
}

function safeDate(v) {
  const raw = String(v || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

function stripDiacritics(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function slug(v) {
  return String(v || "aar")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "aar";
}

function decodeQuotedPrintable(text) {
  const src = String(text || "");
  if (!src.includes("=")) return src;
  const unfolded = src.replace(/=(\r\n|\n|\r)/g, "");
  return unfolded.replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function decodeBasicEntities(text) {
  return String(text || "")
    .replace(/&quot;/gi, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(v) {
  return htmlToText(String(v || "")).replace(/\s+/g, " ").trim();
}

function normalizeClassif(v) {
  const raw = stripDiacritics(String(v || "")).toUpperCase().replace(/\s+/g, " ").trim();
  if (!raw) return "UNKNOWN";
  if (raw.includes("NON PROTEGE")) return "NON PROTEGE";
  if (raw.includes("DIFFUSION RESTREINTE")) return "DIFFUSION RESTREINTE";
  if (raw.includes("SECRET SPECIAL FRANCE")) return "SECRET SPECIAL FRANCE";
  return raw;
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
  try {
    return parseAarObject(JSON.parse(raw));
  } catch {}
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return parseAarObject(JSON.parse(raw.slice(start, end + 1)));
    } catch {}
  }
  return null;
}

function hashString(text) {
  return crypto.createHash("sha1").update(String(text || ""), "utf8").digest("hex");
}

function pushUniqueAar(out, seen, aar) {
  if (!aar) return;
  const key = hashString(JSON.stringify(aar));
  if (seen.has(key)) return;
  seen.add(key);
  out.push(aar);
}

function parseTextForAars(text) {
  const out = [];
  const seen = new Set();

  const payloads = [
    String(text || ""),
    decodeBasicEntities(String(text || "")),
    decodeQuotedPrintable(String(text || "")),
    decodeBasicEntities(decodeQuotedPrintable(String(text || ""))),
    htmlToText(String(text || ""))
  ].filter((x) => String(x || "").trim());

  for (const payload of payloads) {
    const blocks = [
      /---BEGIN-AAR-JSON---([\s\S]*?)---END-AAR-JSON---/gi,
      /---BEGIN-DEBRIEF-JSON---([\s\S]*?)---END-DEBRIEF-JSON---/gi
    ];
    blocks.forEach((rgx) => {
      let match;
      while ((match = rgx.exec(payload)) !== null) {
        pushUniqueAar(out, seen, parseAarCandidate(match[1]));
      }
    });
  }

  if (out.length) return out;

  for (const payload of payloads) {
    pushUniqueAar(out, seen, parseAarCandidate(payload));
  }
  return out;
}

function extractBase64MimeParts(rawText) {
  const out = [];
  const regex = /Content-Transfer-Encoding:\s*base64[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--[^\r\n]+|\r?\n$)/gi;
  let match;
  while ((match = regex.exec(rawText)) !== null) {
    const chunk = String(match[1] || "");
    const cleaned = chunk.replace(/[^A-Za-z0-9+/=\r\n]/g, "").replace(/\r?\n/g, "");
    if (!cleaned || cleaned.length < 16) continue;
    try {
      const decodedUtf8 = Buffer.from(cleaned, "base64").toString("utf8");
      if (decodedUtf8.trim()) out.push(decodedUtf8);
    } catch {}
  }
  return out;
}

function parseBufferForAars(buffer) {
  const out = [];
  const seen = new Set();

  const utf8 = buffer.toString("utf8");
  const latin1 = buffer.toString("latin1");
  const utf16 = buffer.toString("utf16le");
  const candidates = [utf8, latin1, utf16];
  const mimeDecoded = extractBase64MimeParts(latin1);
  candidates.push(...mimeDecoded);

  for (const candidate of candidates) {
    const aars = parseTextForAars(candidate);
    for (const aar of aars) pushUniqueAar(out, seen, aar);
  }
  return out;
}

function fileTimestamp() {
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

function uniqueTargetPath(baseDir, fileName) {
  const parsed = path.parse(fileName);
  let n = 0;
  while (true) {
    const name = n === 0 ? `${parsed.name}${parsed.ext}` : `${parsed.name}_${n}${parsed.ext}`;
    const target = path.join(baseDir, name);
    if (!fs.existsSync(target)) return target;
    n += 1;
  }
}

function writeAarFiles(aars) {
  const created = [];
  for (const aar of aars) {
    const normalized = normalizeAar(aar);
    const date = safeDate(normalized.meta.date);
    const titleSlug = slug(normalized.meta.title || "aar");
    const hash = hashString(JSON.stringify(normalized)).slice(0, 8);
    const fileName = `${date}_${titleSlug}_${hash}.json`;
    const target = uniqueTargetPath(DATA_DIR, fileName);
    fs.writeFileSync(target, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    created.push(path.basename(target));
  }
  return created;
}

async function wait(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitStable(filePath) {
  try {
    const a = fs.statSync(filePath);
    await wait(900);
    const b = fs.statSync(filePath);
    return a.size === b.size && a.mtimeMs === b.mtimeMs;
  } catch {
    return false;
  }
}

function moveTo(dirPath, sourceFilePath) {
  const sourceName = path.basename(sourceFilePath);
  const stamped = `${fileTimestamp()}_${sourceName}`;
  const target = uniqueTargetPath(dirPath, stamped);
  fs.renameSync(sourceFilePath, target);
  return target;
}

function rebuildStaticIndex() {
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.json$/i.test(name) && name.toLowerCase() !== "index.json")
    .sort((a, b) => a.localeCompare(b));

  const payload = {
    files: files.map((name) => {
      const full = path.join(DATA_DIR, name);
      const stat = fs.statSync(full);
      return {
        path: `AAR Reader Data/${name}`,
        name,
        modifiedTime: new Date(stat.mtimeMs).toISOString(),
        size: stat.size
      };
    })
  };

  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function computeDataSnapshot() {
  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const lines = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.json$/i.test(name) && name.toLowerCase() !== "index.json")
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const full = path.join(DATA_DIR, name);
      const stat = fs.statSync(full);
      return `${name}|${stat.size}|${Math.floor(stat.mtimeMs)}`;
    });
  return lines.join("\n");
}

function readAarsFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === ".json") {
    const text = buffer.toString("utf8");
    try {
      return [parseAarObject(JSON.parse(text))];
    } catch {
      const fromText = parseTextForAars(text);
      if (fromText.length) return fromText;
      throw new Error("JSON invalide ou format AAR non reconnu");
    }
  }

  const parsed = parseBufferForAars(buffer);
  if (parsed.length) return parsed;
  throw new Error("Aucun bloc AAR JSON detecte dans le fichier");
}

function isCandidateFile(name) {
  const low = String(name || "").toLowerCase();
  return low.endsWith(".eml") || low.endsWith(".msg") || low.endsWith(".txt") || low.endsWith(".json");
}

async function processFile(fileName) {
  const source = path.join(DROP_DIR, fileName);
  if (!fs.existsSync(source)) return;
  if (processing.has(source)) return;
  processing.add(source);

  try {
    const stable = await waitStable(source);
    if (!stable) return;

    const aars = readAarsFromFile(source);
    const created = writeAarFiles(aars);
    const moved = moveTo(DONE_DIR, source);
    log(`OK ${fileName} -> ${created.length} JSON (${created.join(", ")}) | archive: ${path.basename(moved)}`);
  } catch (error) {
    let movedName = "n/a";
    try {
      const moved = moveTo(ERROR_DIR, source);
      movedName = path.basename(moved);
    } catch {}
    log(`ERR ${fileName} -> ${error.message} | archive erreur: ${movedName}`);
  } finally {
    processing.delete(source);
  }
}

async function scanOnce() {
  ensureDir(DATA_DIR);
  ensureDir(DROP_DIR);
  ensureDir(DONE_DIR);
  ensureDir(ERROR_DIR);

  if (!lastDataSnapshot) {
    lastDataSnapshot = computeDataSnapshot();
  }

  const entries = fs.readdirSync(DROP_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name).filter(isCandidateFile);
  for (const fileName of files) {
    await processFile(fileName);
  }

  const newSnapshot = computeDataSnapshot();
  const indexMissing = !fs.existsSync(INDEX_FILE);
  if (indexMissing || newSnapshot !== lastDataSnapshot) {
    rebuildStaticIndex();
    lastDataSnapshot = newSnapshot;
    scheduleAutoPush(indexMissing ? "index manquant" : "AAR Reader Data modifie");
  }
}

async function startWatcher() {
  ensureDir(DATA_DIR);
  ensureDir(DROP_DIR);
  ensureDir(DONE_DIR);
  ensureDir(ERROR_DIR);

  log("Watcher actif.");
  log(`Drop dossier: ${DROP_DIR}`);
  log(`Data dossier: ${DATA_DIR}`);
  log("Extensions supportees: .eml, .msg, .txt, .json");
  if (AUTO_PUSH_ENABLED) log("Auto-push GitHub: ACTIVE");
  if (AUTO_PUSH_ENABLED && hasPendingDataChanges()) {
    scheduleAutoPush("changements data deja presents au demarrage");
  }
  await scanOnce();

  setInterval(() => {
    scanOnce().catch((e) => log(`Scan error: ${e.message}`));
  }, POLL_MS);
}

async function main() {
  if (ONCE_MODE) {
    await scanOnce();
    return;
  }
  acquireLock();
  process.on("exit", releaseLock);
  process.on("SIGINT", () => { releaseLock(); process.exit(0); });
  process.on("SIGTERM", () => { releaseLock(); process.exit(0); });
  await startWatcher();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
