/**
 * Running a prompt in a real AI tool, headless, and seeing which skill it used.
 *
 * Each tool has its own command, its own event stream and its own sign that a
 * skill ran (facts tools.*.headless, each confirmed on the real tool). The
 * adapter for a tool knows those three things and nothing else, so adding a
 * tool is one entry here.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { value } from "./facts.mjs";

/**
 * The script an npm `.cmd` wrapper runs, read from the wrapper itself. On Windows,
 * tools installed through npm (Codex, Gemini CLI) are `.cmd` files, which Node
 * won't start without a shell, and a shell would mangle a prompt holding quotes
 * or `&`. Starting the script with Node directly needs neither.
 */
export function cmdTarget(cmdText, cmdDir) {
  const m = /"%(?:~?dp0)%\\([^"]+?\.(?:c?js|mjs))"/i.exec(cmdText) ?? /%~?dp0%\\(\S+?\.(?:c?js|mjs))/i.exec(cmdText);
  return m ? join(cmdDir, ...m[1].split("\\")) : null;
}

/** [command, leading args] to start `bin` on this system without a shell. */
export function resolveCommand(bin, platform = process.platform, path = process.env.PATH ?? "") {
  if (platform !== "win32") return [bin, []];
  for (const dir of path.split(delimiter)) {
    const cmd = join(dir, `${bin}.cmd`);
    if (existsSync(cmd)) {
      const target = cmdTarget(readFileSync(cmd, "utf8"), dirname(cmd));
      if (target && existsSync(target)) return [process.execPath, [target]];
    }
  }
  return [bin, []];
}

/** What a tool prints when headless mode refused a permission and the run stopped short. */
export const BLOCKED = /headless mode cannot prompt|so it was auto-denied/i;

/** The skill a SKILL.md path belongs to: its folder's name. */
function skillOfPath(text) {
  return /([a-z0-9]+(?:-[a-z0-9]+)*)\/SKILL\.md\b/.exec(text ?? "")?.[1] ?? null;
}

export const TOOLS = {
  claude: {
    label: "Claude Code",
    fact: "tools.claude-code.headless",
    command: (prompt, { write, allow } = {}) => [
      "claude",
      ["-p", prompt, "--output-format", "stream-json", "--verbose", ...(write ? ["--permission-mode", "acceptEdits"] : []), ...(allow?.length ? ["--allowedTools", allow.join(" ")] : [])],
    ],
    usage: (line) => (line?.type === "result" && line.usage ? { input: (line.usage.input_tokens ?? 0) + (line.usage.cache_read_input_tokens ?? 0) + (line.usage.cache_creation_input_tokens ?? 0), output: line.usage.output_tokens ?? 0 } : null),
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
    // in its workspace-write sandbox Codex may write only inside the run's folder, with no network
    command: (prompt, { write } = {}) => ["codex", ["exec", "--skip-git-repo-check", "--json", ...(write ? ["--sandbox", "workspace-write"] : []), prompt]],
    usage: (line) => (line?.type === "turn.completed" && line.usage ? { input: line.usage.input_tokens ?? 0, output: (line.usage.output_tokens ?? 0) + (line.usage.reasoning_output_tokens ?? 0) } : null),
    fired(line) {
      const item = line?.item;
      return item?.type === "command_execution" ? skillOfPath(item.command) : null;
    },
    answer: (line) => (line?.type === "item.completed" && line.item?.type === "agent_message" ? line.item.text : null),
  },
  antigravity: {
    label: "Antigravity",
    fact: "tools.antigravity.headless",
    command: (prompt, { timeoutS, write } = {}) => ["agy", ["-p", prompt, "--output-format", "stream-json", "--print-timeout", `${timeoutS}s`, ...(write ? ["--mode", "accept-edits", "--sandbox"] : [])]],
    usage: (line) => (line?.event === "result" && line.result?.usage ? { input: line.result.usage.input_tokens ?? 0, output: (line.result.usage.output_tokens ?? 0) + (line.result.usage.thinking_tokens ?? 0) } : null),
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
    usage: () => null,
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
export function runPrompt(tool, prompt, { cwd, timeoutS = 120, full = false, write = false, allow = [], extra = [], env = process.env } = {}) {
  const adapter = TOOLS[tool];
  const [bin, baseArgs] = adapter.command(prompt, { timeoutS, write, allow });
  const args = [...baseArgs, ...extra];
  // a Claude Code session sets CLAUDECODE, which a nested claude -p takes as an interactive clash
  const childEnv = { ...env };
  delete childEnv.CLAUDECODE;
  return new Promise((resolve) => {
    const started = Date.now();
    const [cmd, lead] = resolveCommand(bin);
    const child = spawn(cmd, [...lead, ...args], { cwd, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    const fired = [];
    const usage = { input: 0, output: 0 };
    let answer = "";
    let buffer = "";
    let error = "";
    let done = false;
    const finish = (raw) => {
      if (done) return;
      done = true;
      // a tool that needed a permission headless mode can't ask for and then stopped
      // measured the permission, not the skill: call it blocked (fact tools.headless.blocked)
      const status = raw !== "fired" && BLOCKED.test(error) ? "blocked" : raw;
      clearTimeout(timer);
      if (child.exitCode === null) child.kill("SIGTERM");
      resolve({ tool, prompt, fired, answer: answer.trim(), status, seconds: (Date.now() - started) / 1000, tokens: usage.input + usage.output ? usage : null, ...(error && (status === "error" || status === "blocked") ? { error: error.slice(-500) } : {}) });
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
        const u = adapter.usage?.(line);
        if (u) {
          usage.input += u.input;
          usage.output += u.output;
        }
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
      const [cmd, lead] = resolveCommand(bin);
      const child = spawn(cmd, [...lead, "--version"], { stdio: "ignore" });
      child.on("error", () => resolve(false));
      child.on("close", (code) => resolve(code === 0));
    });
    if (ok) out.push(id);
  }
  return out;
}
