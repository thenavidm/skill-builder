#!/usr/bin/env node
/**
 * The README in other languages.
 *
 * Each translation lives in docs/i18n/README.<code>.md and starts with a line
 * recording which English README it was translated from (a SHA-256 of
 * README.md without its language bar). A translation whose hash matches the
 * English is current and must have the same structure: the same headings, the
 * same code blocks, the same links. One whose hash differs is behind, and
 * `status` lists it for the next release.
 *
 *   node scripts/i18n/readme.mjs status                  which translations are current, behind or missing
 *   node scripts/i18n/readme.mjs bar                     write the language bar into README.md and every translation
 *   node scripts/i18n/readme.mjs check <code> <file>     check a raw translation against README.md before finalizing it
 *   node scripts/i18n/readme.mjs finalize <code> <file>  turn a raw translation (links as in README.md) into docs/i18n/README.<code>.md
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const LANGUAGES = JSON.parse(readFileSync(join(ROOT, "scripts", "i18n", "languages.json"), "utf8"));
export const ENGLISH = LANGUAGES[0];

const BAR_START = "<!-- languages -->";
const BAR_END = "<!-- /languages -->";
const SOURCE = /^<!-- i18n: translated from README\.md sha256:([0-9a-f]{64}) lang:([A-Za-z-]+) -->\n/;

const read = (file) => readFileSync(join(ROOT, file), "utf8");

/** The text without its language bar, so editing the bar never makes a translation look behind. */
export function withoutBar(text) {
  const start = text.indexOf(BAR_START);
  const end = text.indexOf(BAR_END);
  if (start < 0 || end < start) return text;
  return text.slice(0, start) + text.slice(end + BAR_END.length);
}

export function englishHash(text = read(ENGLISH.file)) {
  return createHash("sha256").update(withoutBar(text)).digest("hex");
}


/**
 * The language bar: one button per language, each a link to its README, the
 * current one in bold and not linked. Buttons are <kbd> text, not images, so
 * every script renders correctly and a screen reader reads the name.
 */
export function bar(current) {
  const self = LANGUAGES.find((l) => l.code === current);
  const buttons = LANGUAGES.map((l) => {
    if (l.code === current) return `<kbd><b>${l.flag} ${l.name}</b></kbd>`;
    const href = self.file.startsWith("docs/i18n/") ? (l.code === "en" ? "../../README.md" : l.file.replace("docs/i18n/", "")) : l.file;
    return `<a href="${href}"><kbd>${l.flag} ${l.name}</kbd></a>`;
  });
  return `${BAR_START}\n<p align="center">\n${buttons.join("\n")}\n</p>\n${BAR_END}`;
}

/** Puts the bar in place of the old one, or after the badge block when there is none. */
export function placeBar(text, current) {
  const start = text.indexOf(BAR_START);
  const end = text.indexOf(BAR_END);
  if (start >= 0 && end > start) return text.slice(0, start) + bar(current) + text.slice(end + BAR_END.length);
  const lines = text.split("\n");
  let last = lines.findIndex((l) => l.startsWith("[![")) ;
  while (last >= 0 && lines[last + 1]?.startsWith("[![")) last++;
  if (last < 0) throw new Error("No badge block to put the language bar after");
  lines.splice(last + 1, 0, "", bar(current));
  return lines.join("\n");
}

/** A heading's anchor as GitHub makes it: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
export function anchors(text) {
  const seen = new Map();
  const out = [];
  for (const h of headings(text)) {
    const plain = h.text
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/[`*_]/g, "");
    const base = plain.trim().toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

/** Lines outside fenced code blocks, and the code blocks themselves. */
function split(text) {
  const prose = [];
  const code = [];
  let block = null;
  for (const line of text.split("\n")) {
    if (/^\s*```/.test(line)) {
      if (block === null) block = [line];
      else {
        block.push(line);
        code.push(block.join("\n"));
        block = null;
      }
      continue;
    }
    if (block !== null) block.push(line);
    else prose.push(line);
  }
  return { prose, code };
}

export function headings(text) {
  return split(text)
    .prose.map((line) => /^(#{1,6})\s+(.*)$/.exec(line))
    .filter(Boolean)
    .map((m) => ({ level: m[1].length, text: m[2] }));
}

/** Every link target in the prose: markdown links and href or src attributes. */
export function links(text) {
  const prose = split(text).prose.join("\n");
  const out = [];
  for (const m of prose.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) out.push(m[1]);
  for (const m of prose.matchAll(/\b(?:href|src)="([^"]+)"/g)) out.push(m[1]);
  return out;
}

const isRelative = (target) => !/^(https?:|mailto:|#|\/)/.test(target);

/** Rewrites links in a raw translation, written with README.md's own links, for its place in docs/i18n/. */
export function relink(text) {
  const fix = (target) => (isRelative(target) ? `../../${target.replace(/^\.\//, "")}` : target);
  const { prose } = split(text);
  const proseSet = new Set(prose);
  return text
    .split("\n")
    .map((line) =>
      proseSet.has(line)
        ? line.replace(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g, (_, t, title) => `](${fix(t)}${title})`).replace(/\b(href|src)="([^"]+)"/g, (_, a, t) => `${a}="${fix(t)}"`)
        : line,
    )
    .join("\n");
}

/** The structure a current translation must share with the English: what a reader navigates by and what they copy. */
export function structure(text, { inI18n = false } = {}) {
  const body = withoutBar(text);
  const { code } = split(body);
  const external = links(body)
    .filter((t) => !t.startsWith("#"))
    .map((t) => (inI18n && t.startsWith("../../") ? t.slice(6) : t))
    .map((t) => t.replace(/^\.\//, ""))
    .sort();
  const tables = [];
  let rows = 0;
  for (const line of [...split(body).prose, ""]) {
    if (line.startsWith("|")) rows++;
    else if (rows > 0) {
      tables.push(rows);
      rows = 0;
    }
  }
  return { headings: headings(body).map((h) => h.level), code, links: external, tables };
}

/** In-page links (#...) that point at no heading in the same file. */
export function brokenAnchors(text) {
  const have = new Set(anchors(text));
  return links(text)
    .filter((t) => t.startsWith("#"))
    .map((t) => decodeURIComponent(t.slice(1)))
    .filter((a) => !have.has(a.toLowerCase()) && !have.has(a));
}

export function sourceOf(text) {
  const m = SOURCE.exec(text);
  return m ? { hash: m[1], lang: m[2] } : null;
}

export function status() {
  const current = englishHash();
  return LANGUAGES.slice(1).map((l) => {
    if (!existsSync(join(ROOT, l.file))) return { ...l, state: "missing" };
    const src = sourceOf(read(l.file));
    return { ...l, state: src && src.hash === current ? "current" : "behind" };
  });
}

function finalize(code, rawFile) {
  const lang = LANGUAGES.find((l) => l.code === code);
  if (!lang || lang.code === "en") throw new Error(`Unknown language ${code}`);
  let text = readFileSync(rawFile, "utf8").replace(SOURCE, "");
  text = placeBar(relink(withoutBar(text).replace(/\n{3,}/g, "\n\n")), code);
  writeFileSync(join(ROOT, lang.file), `<!-- i18n: translated from README.md sha256:${englishHash()} lang:${code} -->\n${text}`);
  return lang.file;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, ...args] = process.argv.slice(2);
  if (command === "status") {
    for (const s of status()) console.log(`${s.state.padEnd(8)} ${s.code.padEnd(6)} ${s.name}`);
  } else if (command === "bar") {
    for (const l of LANGUAGES) {
      if (!existsSync(join(ROOT, l.file))) continue;
      const text = read(l.file);
      const head = SOURCE.exec(text)?.[0] ?? "";
      writeFileSync(join(ROOT, l.file), head + placeBar(text.slice(head.length), l.code));
    }
    console.log("Language bar written.");
  } else if (command === "check") {
    // A raw translation, links still as in README.md: what a translator runs before handing it back.
    const raw = readFileSync(args[1], "utf8");
    const mine = structure(raw);
    const theirs = structure(read(ENGLISH.file));
    const problems = [];
    const diff = (label, a, b) => {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (a.length !== b.length) problems.push(`${label}: ${a.length} in the translation, ${b.length} in English`);
      else a.forEach((x, i) => { if (JSON.stringify(x) !== JSON.stringify(b[i])) problems.push(`${label} #${i + 1} differs: ${JSON.stringify(x).slice(0, 120)} vs ${JSON.stringify(b[i]).slice(0, 120)}`); });
    };
    diff("headings (levels)", mine.headings, theirs.headings);
    diff("code blocks", mine.code, theirs.code);
    diff("links", mine.links, theirs.links);
    diff("table rows", mine.tables, theirs.tables);
    for (const a of brokenAnchors(raw)) problems.push(`in-page link #${a} points at no heading`);
    if (/[\u2014\u2013]/.test(withoutBar(raw))) problems.push("contains an em or en dash");
    if (problems.length === 0) console.log("OK");
    else {
      for (const p of problems.slice(0, 40)) console.log(p);
      process.exit(1);
    }
  } else if (command === "finalize") {
    console.log(`Wrote ${finalize(args[0], args[1])}`);
  } else {
    console.error("Usage: readme.mjs status | bar | check <code> <raw-file> | finalize <code> <raw-file>");
    process.exit(1);
  }
}
