/**
 * The facts registry: every format rule the engine enforces, with its source
 * and the date it was checked. Code reads a rule's value from here instead of
 * carrying it as a constant, so refreshing one fact updates every check that
 * uses it, and every finding can name the fact behind it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FACTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "facts");

let cache;

/** Every fact, keyed by id. */
export function facts() {
  if (cache) return cache;
  cache = new Map();
  for (const f of readdirSync(FACTS_DIR).filter((n) => n.endsWith(".json")).sort()) {
    for (const fact of JSON.parse(readFileSync(join(FACTS_DIR, f), "utf8"))) {
      if (cache.has(fact.id)) throw new Error(`facts: ${fact.id} is defined twice`);
      cache.set(fact.id, fact);
    }
  }
  return cache;
}

/** One fact's value; throws if the id is unknown, so a typo can't turn a check off. */
export function value(id) {
  const fact = facts().get(id);
  if (!fact) throw new Error(`facts: no fact named ${id}`);
  return fact.value;
}
