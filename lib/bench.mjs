/**
 * The same evals in every installed tool, so "works in Codex too" is a number,
 * not a hope. Each tool gets its own eval run and review page; the bench puts
 * them side by side and says where the tools disagree about a task.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { evaluate } from "./eval.mjs";
import { writeReview } from "./review.mjs";

export async function bench(skillDir, { tools, runs = 3, out, onRun, timeoutS } = {}) {
  const perTool = {};
  for (const tool of tools) {
    const dir = join(out, tool);
    mkdirSync(dir, { recursive: true });
    const r = await evaluate(skillDir, { tool, runs, out: dir, onRun, timeoutS });
    perTool[tool] = { benchmark: r.benchmark, review: writeReview(dir, r), runs: r.runs };
  }
  // a task where the skill passes everywhere in one tool and fails in another is worth a look
  const evals = [...new Set(Object.values(perTool).flatMap((t) => t.runs.map((r) => r.eval)))];
  const disagree = evals.filter((e) => {
    const verdicts = Object.values(perTool).map((t) => {
      const rs = t.runs.filter((r) => r.eval === e && r.config === "with");
      return rs.length && rs.every((r) => r.grades.every((g) => g.passed));
    });
    return new Set(verdicts).size > 1;
  });
  return { perTool, disagree };
}
