/**
 * Running a prompt in a real AI tool, headless, and seeing which skill it used.
 *
 * Each tool has its own command, its own event stream and its own sign that a
 * skill ran (facts tools.*.headless, each confirmed on the real tool). The
 * adapter for a tool knows those three things and nothing else, so adding a
 * tool is one entry here.
 */
import { spawn } from "node:child_process";
import { value } from "./facts.mjs";

/** The skill a SKILL.md path belongs to: its folder's name. */
function skillOfPath(text) {
  return /([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md\b/.exec(text ?? "")?.[1] ?? null;
}

export const TOOLS = {
  claude: {
    label: "Claude Code",
    fact: "tools.claude-code.headless",
    command: (prompt) => ["claude", ["-p", prompt, "--output-format", "stream-json", "--verbose"]],
    /** @returns {string|null} the skill a stream line shows running */
    fired(line) {
      for (const block of line?.message?.content ?? []) {
        if (block?.type === "tool_use" && block.name === "Skill" && typeof block.input?.skill === "string") {
          return block.input.skill.split(":").pop();
        }
      }
      return null;
    },
    answer: (line) => (line?.type === "result" && typeof line.result === "string" ? line.result : null),
  },
  codex: {
    label: "Codex",
    fact: "tools.codex.headless",
    command: (prompt) => ["codex", ["exec", "--skip-git-repo-check", "--json", prompt]],
    fired(line) {
      const item = line?.item;
      return item?.type === "command_execution" ? skillOfPath(item.command) : null;
    },
    answer: (line) => (line?.type === "item.completed" && line.item?.type === "agent_message" ? line.item.text : null),
  },
  antigravity: {
    label: "Antigravity",
    fact: "tools.antigravity.headless",
    command: (prompt, { timeoutS }) => ["agy", ["-p", prompt, "--output-format", "stream-json", "--print-timeout", `${timeoutS}s`]],
    fired(line) {
      const s = line?.step_update;
      return s?.tool_name === "view_file" ? skillOfPath(s.tool_info?.parameters?.AbsolutePath) : null;
    },
    answer: (line) => (line?.event === "result" ? line.result?.response ?? null : null),
  },
  gemini: {
    label: "Gemini CLI",
    fact: "tools.gemini-cli.headless",
    unverified: true,
    command: (prompt) => ["gemini", ["-p", prompt, "--output-format", "stream-json"]],
    fired(line) {
      const name = line?.tool_name ?? line?.name;
      return name === "activate_skill" ? line?.parameters?.name ?? line?.args?.name ?? null : null;
    },
    answer: (line) => (line?.type === "result" ? line.response ?? null : null),
  },
};

/** Where each tool reads a project's skills, from facts. */
export function skillDirFor(tool) {
  return value(TOOLS[tool].fact).skillDir;
}

/**
 * Runs one prompt and resolves with the skills the tool used, in order, and its
 * answer. Stops early once a skill has run, unless `full` is set, because the
 * rest of the run costs tokens and doesn't change which skill fired.
 */
export function runPrompt(tool, prompt, { cwd, timeoutS = 120, full = false, env = process.env } = {}) {
  const adapter = TOOLS[tool];
  const [bin, args] = adapter.command(prompt, { timeoutS });
  // a Claude Code session sets CLAUDECODE, which a nested claude -p takes as an interactive clash
  const childEnv = { ...env };
  delete childEnv.CLAUDECODE;
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(bin, args, { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    const fired = [];
    let answer = "";
    let buffer = "";
    let error = "";
    let done = false;
    const finish = (status) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (child.exitCode === null) child.kill("SIGTERM");
      resolve({ tool, prompt, fired, answer: answer.trim(), status, seconds: (Date.now() - started) / 1000, ...(error && status === "error" ? { error: error.slice(-500) } : {}) });
    };
    const timer = setTimeout(() => finish("timeout"), timeoutS * 1000 + 15_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const raw = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!raw.startsWith("{")) continue;
        let line;
        try {
          line = JSON.parse(raw);
        } catch {
          continue;
        }
        const skill = adapter.fired(line);
        if (skill && !fired.includes(skill)) fired.push(skill);
        const a = adapter.answer(line);
        if (a) answer += a;
        if (skill && !full) finish("fired");
      }
    });
    child.stderr.on("data", (d) => (error += d.toString("utf8")));
    child.on("error", (e) => {
      error = `${bin} could not start: ${e.message}`;
      finish("error");
    });
    child.on("close", (code) => finish(code === 0 ? "done" : "error"));
  });
}

/** Which of the tools are installed here, by running each one's --version. */
export async function installedTools() {
  const out = [];
  for (const [id, adapter] of Object.entries(TOOLS)) {
    const [bin] = adapter.command("x", { timeoutS: 1 });
    const ok = await new Promise((resolve) => {
      const child = spawn(bin, ["--version"], { stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
    if (ok) out.push(id);
  }
  return out;
}
