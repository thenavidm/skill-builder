/**
 * One source into every tool's plugin.
 *
 * The manifests come from product.json through scripts/manifests/build.mjs,
 * which already works on any repository. This adds what lives next to each
 * skill rather than at the root: Codex has no frontmatter field for "only run
 * when asked", it reads agents/openai.yaml beside the skill (fact
 * skills.codex.fields). So a skill marked disable-model-invocation: true, the
 * field Claude Code and Cursor read, gets that file written for it, and one
 * line in SKILL.md sets the behaviour in all three tools.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "../scripts/manifests/build.mjs";
import { parseFrontmatter } from "../scripts/manifests/frontmatter.mjs";

/** The first line of every sidecar this writes, so it only ever replaces or removes its own. */
export const SIDECAR_MARK = "# Written by skill-builder package from SKILL.md (disable-model-invocation: true). Edit SKILL.md, not this file.";

export function codexSidecar() {
  return `${SIDECAR_MARK}\npolicy:\n  allow_implicit_invocation: false\n`;
}

/**
 * Brings each skill's agents/openai.yaml in line with its SKILL.md.
 * @returns {{ written: string[], removed: string[], stale: string[], unchanged: string[], kept: string[] }}
 */
export function syncSidecars(root, { check = false } = {}) {
  const out = { written: [], removed: [], stale: [], unchanged: [], kept: [] };
  const dir = join(root, "skills");
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const md = join(dir, name, "SKILL.md");
    if (!existsSync(md)) continue;
    let manual = false;
    try {
      manual = parseFrontmatter(readFileSync(md, "utf8"), md).data["disable-model-invocation"] === "true";
    } catch {
      continue; // check reports the broken frontmatter
    }
    const rel = `skills/${name}/agents/openai.yaml`;
    const file = join(root, rel);
    const current = existsSync(file) ? readFileSync(file, "utf8") : null;
    const ours = current?.startsWith(SIDECAR_MARK) ?? false;
    if (manual) {
      if (current !== null && !ours) {
        // someone wrote their own; leave it, and say whether it already turns implicit invocation off
        out.kept.push(rel);
      } else if (current === codexSidecar()) {
        out.unchanged.push(rel);
      } else if (check) {
        out.stale.push(rel);
      } else {
        mkdirSync(join(root, "skills", name, "agents"), { recursive: true });
        writeFileSync(file, codexSidecar());
        out.written.push(rel);
      }
    } else if (ours) {
      if (check) out.stale.push(rel);
      else {
        rmSync(file);
        out.removed.push(rel);
      }
    }
  }
  return out;
}

/**
 * The manifest builder to use for a repository: its own, when it carries one,
 * because a repo's builder may know things this copy doesn't (a second plugin in
 * the same marketplace, for one); otherwise the one shipped here.
 */
export async function builderFor(root) {
  const own = join(root, "scripts", "manifests", "build.mjs");
  if (existsSync(own)) return { build: (await import(pathToFileURL(own).href)).build, own: true };
  return { build, own: false };
}

/** Builds every manifest and every sidecar, or with check only compares them. */
export async function packagePlugin(path, { check = false } = {}) {
  const root = resolve(path);
  const builder = await builderFor(root);
  const manifests = builder.build(root, { check });
  const sidecars = syncSidecars(root, { check });
  return { root, ownBuilder: builder.own, manifests, sidecars, stale: [...manifests.stale, ...sidecars.stale] };
}
