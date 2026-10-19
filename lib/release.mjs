/**
 * A release, done the same way every time.
 *
 * Every tool decides whether a user's copy is out of date from the version in
 * the plugin's manifest, so a release that keeps the old number never reaches
 * anyone. This bumps the version in package.json (every manifest takes it from
 * there), moves the changelog's Unreleased notes under the new version with the
 * date, rebuilds the manifests, and lists the steps that reach live systems
 * (commit, tag, push, the GitHub release, npm) for a yes on each.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { packagePlugin } from "./package.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The next version: a bump name or an exact version. */
export function nextVersion(current, bump = "patch") {
  if (/^\d+\.\d+\.\d+$/.test(bump)) return bump;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current);
  if (!m) throw new Error(`package.json version "${current}" isn't major.minor.patch`);
  const [maj, min, pat] = m.slice(1).map(Number);
  if (bump === "major") return `${maj + 1}.0.0`;
  if (bump === "minor") return `${maj}.${min + 1}.0`;
  if (bump === "patch") return `${maj}.${min}.${pat + 1}`;
  throw new Error(`bump must be patch, minor, major or a version such as 1.2.0, not "${bump}"`);
}

/** The date the way this changelog already writes it: "18 October 2026" or "2026-10-18" (the default). */
export function dateFor(changelog, now = new Date()) {
  const words = /^## \d+\.\d+\.\d+, \d{1,2} [A-Z][a-z]+ \d{4}/m.test(changelog);
  const d = now.getUTCDate();
  const iso = now.toISOString().slice(0, 10);
  return words ? `${d} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}` : iso;
}

/** The Unreleased section's text, or null when there is none. */
export function unreleased(changelog) {
  const m = /^## Unreleased[^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(changelog);
  if (!m) return null;
  return m[1].replace(/^\s*---\s*$/gm, "").trim();
}

/** Moves the Unreleased notes under the new version and leaves an empty Unreleased on top. */
export function moveNotes(changelog, version, date) {
  const notes = unreleased(changelog);
  if (notes === null) throw new Error("CHANGELOG.md has no \"## Unreleased\" section to release");
  if (!notes) throw new Error("CHANGELOG.md's Unreleased section is empty: write what changed, in words a user understands, before releasing");
  // keep the "---" between versions where the changelog already uses it
  const rule = /^---\s*$/m.test(changelog) ? "---\n\n" : "";
  return changelog.replace(/^## Unreleased[^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/m, `## Unreleased\n\n${rule}## ${version}, ${date}\n\n${notes}\n\n${rule}`);
}

/** The notes of one released version, for the GitHub release. */
export function notesFor(changelog, version) {
  const esc = version.replace(/\./g, "\\.");
  const m = new RegExp(`^## ${esc}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(changelog);
  return m ? m[1].replace(/^\s*---\s*$/gm, "").trim() : "";
}

function git(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** Commits since the last version tag, for writing the Unreleased notes. */
export function changesSinceTag(root) {
  const tag = git(root, ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"]);
  const log = git(root, ["log", "--format=%h %s", ...(tag ? [`${tag}..HEAD`] : [])]);
  return { since: tag, commits: log ? log.split("\n").filter(Boolean) : [] };
}

/**
 * Prepares a release. With dry, changes nothing and shows what would change.
 * @returns {{ from, version, date, notes, steps: { what, run }[] }}
 */
export async function release(path, { bump = "patch", dry = false, now = new Date() } = {}) {
  const root = resolve(path);
  const pkgFile = join(root, "package.json");
  const logFile = join(root, "CHANGELOG.md");
  if (!existsSync(pkgFile) || !existsSync(logFile)) throw new Error("A release needs package.json and CHANGELOG.md at the root");
  const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
  const changelog = readFileSync(logFile, "utf8");
  const version = nextVersion(pkg.version, bump);
  const date = dateFor(changelog, now);
  const updated = moveNotes(changelog, version, date);
  const notes = notesFor(updated, version);
  if (git(root, ["rev-parse", "--verify", "--quiet", `refs/tags/v${version}`])) throw new Error(`v${version} is already tagged`);
  if (!dry) {
    writeFileSync(pkgFile, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`);
    writeFileSync(logFile, updated);
    await packagePlugin(root);
  }
  const repo = (pkg.repository?.url ?? "").replace(/^git\+/, "").replace(/\.git$/, "").replace("https://github.com/", "");
  const steps = [
    { what: "Commit the release", run: `git add -A && git commit -m "Release ${version}"` },
    { what: "Tag it", run: `git tag v${version}` },
    { what: "Push the branch and the tag", run: `git push && git push origin v${version}` },
    { what: "Publish the GitHub release with this version's notes", run: `gh release create v${version}${repo ? ` --repo ${repo}` : ""} --title v${version} --notes-file -   (the notes below on standard input)` },
    ...(pkg.private ? [] : [{ what: "Publish to npm", run: "npm publish --access public" }]),
  ];
  return { from: pkg.version, version, date, notes, steps, dry };
}
