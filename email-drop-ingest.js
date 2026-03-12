"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "AAR Reader Data");
const DROP_DIR = path.join(DATA_DIR, "_EMAIL_DROP");
const DONE_DIR = path.join(DATA_DIR, "_EMAIL_DONE");
const ERROR_DIR = path.join(DATA_DIR, "_EMAIL_ERROR");
const POLL_MS = 3000;

const processing = new Set();

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function log(msg) {
  console.log(`[${nowIso()}] ${msg}`);
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

  const entries = fs.readdirSync(DROP_DIR, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile()).map((e) => e.name).filter(isCandidateFile);
  for (const fileName of files) {
    await processFile(fileName);
  }
}

async function startWatcher() {
  ensureDir(DATA_DIR);
  ensureDir(DROP_DIR);
  ensureDir(DONE_DIR);
  ensureDir(ERROR_DIR);

  log("Watcher actif.");
  log(`Drop dossier: ${DROP_DIR}`);
  log(`Output JSON: ${DATA_DIR}`);
  log("Extensions supportees: .eml, .msg, .txt, .json");
  await scanOnce();

  setInterval(() => {
    scanOnce().catch((e) => log(`Scan error: ${e.message}`));
  }, POLL_MS);
}

async function main() {
  const once = process.argv.includes("--once");
  if (once) {
    await scanOnce();
    return;
  }
  await startWatcher();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
