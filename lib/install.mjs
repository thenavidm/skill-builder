/**
 * Does the plugin install, and run, in each tool? Two steps per tool:
 *
 *   validate  the tool's own validator on the folder, offline (Claude Code,
 *             Gemini CLI and Antigravity have one; Codex doesn't, so its
 *             manifest is only checked against product.json by package)
 *   load      the plugin loaded the way the tool loads one, for this run only,
 *             and the entry skill asked for: Claude Code with --plugin-dir,
 *             Antigravity from a throwaway project's .agents/plugins/, Codex
 *             from the project's skill folder (its plugin manifest can't be
 *             loaded without changing the user's own setup, so the skills
 *             are tested and that is said). Nothing is installed for the user.
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { TOOLS, resolveCommand, runPrompt, skillDirFor } from "./tools.mjs";

function exec(bin, args, cwd) {
  return new Promise((resolveP) => {
    const [cmd, lead] = resolveCommand(bin);
    const child = spawn(cmd, [...lead, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolveP({ code: -1, out, err: e.message }));
    child.on("close", (code) => resolveP({ code, out, err }));
  });
}

/** The first JSON value in a command's output, which may carry log lines after it. */
function firstJson(text) {
  const start = text.indexOf("{");
  if (start < 0) return null;
  for (let end = text.lastIndexOf("}"); end > start; end = text.lastIndexOf("}", end - 1)) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      // keep shortening
    }
  }
  return null;
}

export const VALIDATORS = {
  claude: async (dir) => {
    const r = await exec("claude", ["plugin", "validate", dir, "--json"]);
    const j = firstJson(r.out);
    if (!j) return { ok: false, problems: [r.err.trim() || "no report"] };
    const all = [j.manifest, ...(j.contents ?? [])].filter(Boolean);
    return {
      ok: Boolean(j.success),
      problems: all.flatMap((c) => (c.errors ?? []).map((e) => `${basename(c.file)}: ${e.message}`)),
      warnings: all.flatMap((c) => (c.warnings ?? []).map((w) => `${basename(c.file)}: ${w.message}`)),
    };
  },
  gemini: async (dir) => {
    const r = await exec("gemini", ["extensions", "validate", dir]);
    const ok = r.code === 0 && /successfully validated/i.test(r.out + r.err);
    return { ok, problems: ok ? [] : [(r.err || r.out).trim().split("\n").slice(-3).join(" ")], warnings: [] };
  },
  antigravity: async (dir) => {
    const r = await exec("agy", ["plugin", "validate", dir, "--json"]);
    const j = firstJson(r.out);
    if (!j) return { ok: false, problems: [r.err.trim() || "no report"] };
    const by = (s) => (j.findings ?? []).filter((f) => f.severity === s).map((f) => `${f.file}: ${f.message}`);
    return { ok: by("error").length === 0, problems: by("error"), warnings: by("warning") };
  },
  codex: async () => ({ ok: null, problems: [], warnings: [], note: "Codex has no validator; its manifest is checked against product.json by skill-builder package" }),
};

/** The plugin's name and its entry skill (the one named after the prefix, else the first). */
export function entryOf(root) {
  const product = existsSync(join(root, "product.json")) ? JSON.parse(readFileSync(join(root, "product.json"), "utf8")) : {};
  const skills = existsSync(join(root, "skills")) ? readdirSync(join(root, "skills")).filter((n) => existsSync(join(root, "skills", n, "SKILL.md"))).sort() : [];
  const entry = skills.includes(product.prefix) ? product.prefix : skills[0];
  return { name: product.name ?? basename(root), entry, skills };
}

async function load(tool, root, { entry, name, skills }, timeoutS) {
  const ws = mkdtempSync(join(tmpdir(), "skill-install-"));
  try {
    const prompt = `Use the ${entry} skill, then tell me in one sentence what it can do.`;
    let extra = [];
    let scope = "the plugin";
    if (tool === "claude") extra = ["--plugin-dir", root];
    else if (tool === "antigravity") cpSync(root, join(ws, ".agents", "plugins", name), { recursive: true, filter: (s) => !s.includes("/node_modules") && !s.includes("/.git/") });
    else {
      scope = "the skills only";
      mkdirSync(join(ws, skillDirFor(tool)), { recursive: true });
      for (const s of skills) cpSync(join(root, "skills", s), join(ws, skillDirFor(tool), s), { recursive: true });
    }
    const r = await runPrompt(tool, prompt, { cwd: ws, timeoutS, extra });
    return { ran: r.fired.includes(entry), scope, status: r.status, fired: r.fired };
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}

export async function installTest(path, { tools, live = true, timeoutS = 150 } = {}) {
  const root = resolve(path);
  const info = entryOf(root);
  if (!info.entry) throw new Error(`${root} has no skills/<name>/SKILL.md to test`);
  const results = {};
  await Promise.all(
    tools.map(async (tool) => {
      const validate = await VALIDATORS[tool](root);
      const loaded = live && !TOOLS[tool].unverified ? await load(tool, root, info, timeoutS) : null;
      results[tool] = { label: TOOLS[tool].label, validate, load: loaded };
    }),
  );
  return { root, ...info, results };
}
