/**
 * A .skill file: one skill zipped for upload to claude.ai or the Skills API.
 *
 * Those take the Agent Skills standard's frontmatter fields only, so the copy
 * of SKILL.md inside the file keeps those and drops the rest (fields such as
 * disable-model-invocation, which plugins use for Claude Code and Cursor), and
 * the result says which were dropped. The tests (evals/) stay out: they are
 * for building the skill, not running it. Written with Node's own zlib, so it
 * needs nothing installed.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { deflateRawSync } from "node:zlib";

const STANDARD = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
const SKIP_DIRS = new Set(["__pycache__", "node_modules", ".git"]);
const SKIP_FILES = new Set([".DS_Store"]);

/** SKILL.md with only the standard's top-level frontmatter keys, and the keys removed. */
export function portableSkillMd(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return { text, removed: [] };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { text, removed: [] };
  const keep = [];
  const removed = [];
  let dropping = false;
  for (const line of lines.slice(1, end)) {
    const key = /^([A-Za-z0-9_-]+):/.exec(line)?.[1];
    if (key) {
      dropping = !STANDARD.has(key);
      if (dropping) removed.push(key);
    }
    if (!dropping) keep.push(line);
  }
  return { text: ["---", ...keep, ...lines.slice(end)].join("\n"), removed };
}

let table;
function crc32(buf) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip archive of [name, bytes] entries, deflated, names in UTF-8. */
export function zip(entries, when = new Date()) {
  const dosTime = (when.getHours() << 11) | (when.getMinutes() << 5) | Math.floor(when.getSeconds() / 2);
  const dosDate = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const packed = deflateRawSync(data);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // names are UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/**
 * Writes <name>.skill for the skill folder `dir` into `outDir`.
 * @returns {{ file: string, entries: string[], removed: string[] }}
 */
export function skillFile(dir, outDir = ".") {
  const root = resolve(dir);
  const name = basename(root);
  if (!existsSync(join(root, "SKILL.md"))) throw new Error(`${root} has no SKILL.md`);
  const entries = [];
  let removed = [];
  const walk = (d) => {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      const rel = relative(root, p).split(sep).join("/");
      if (statSync(p).isDirectory()) {
        if (SKIP_DIRS.has(e) || rel === "evals") continue;
        walk(p);
        continue;
      }
      if (SKIP_FILES.has(e) || e.endsWith(".pyc")) continue;
      let data = readFileSync(p);
      if (rel === "SKILL.md") {
        const portable = portableSkillMd(data.toString("utf8"));
        removed = portable.removed;
        data = Buffer.from(portable.text, "utf8");
      }
      entries.push([`${name}/${rel}`, data]);
    }
  };
  walk(root);
  mkdirSync(outDir, { recursive: true });
  const file = join(resolve(outDir), `${name}.skill`);
  writeFileSync(file, zip(entries));
  return { file, entries: entries.map(([n]) => n), removed };
}
