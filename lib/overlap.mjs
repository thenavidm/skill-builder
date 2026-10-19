/**
 * Was anything copied? Lists every run of `min` or more words that our text
 * shares with another skill's, word for word, ignoring case and punctuation.
 * Two independent writers rarely share eight words in a row outside fixed
 * phrases, so a run that long is worth a look.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const words = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/** Every text file under a path (or the file itself), as [relative path, text]. */
export function texts(path) {
  const root = resolve(path);
  if (statSync(root).isFile()) return [[root.split("/").pop(), readFileSync(root, "utf8")]];
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d).sort()) {
      if (e === "node_modules" || e.startsWith(".git")) continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(md|txt|json|ya?ml|mjs|js|ts|py|sh)$/i.test(e) && statSync(p).size < 2_000_000) out.push([relative(root, p), readFileSync(p, "utf8")]);
    }
  };
  walk(root);
  return out;
}

/** Shared runs of at least `min` words between our files and theirs, longest first. */
export function overlap(oursPath, theirsPath, { min = 8 } = {}) {
  const theirs = new Map();
  for (const [file, text] of texts(theirsPath)) {
    const w = words(text);
    for (let i = 0; i + min <= w.length; i++) {
      const key = w.slice(i, i + min).join(" ");
      if (!theirs.has(key)) theirs.set(key, file);
    }
  }
  const runs = [];
  for (const [file, text] of texts(oursPath)) {
    const w = words(text);
    let i = 0;
    while (i + min <= w.length) {
      const key = w.slice(i, i + min).join(" ");
      if (!theirs.has(key)) {
        i++;
        continue;
      }
      let end = i + min;
      while (end < w.length && theirs.has(w.slice(end - min + 1, end + 1).join(" "))) end++;
      runs.push({ file, theirs: theirs.get(key), words: end - i, text: w.slice(i, end).join(" ") });
      i = end;
    }
  }
  return runs.sort((a, b) => b.words - a.words);
}
