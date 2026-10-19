/**
 * The review page: one self-contained HTML file a person opens to see every
 * run next to its grades, with the numbers on top, and to leave a note on any
 * run. Notes are kept in the browser as you type and download as
 * feedback.json, which the next round of improve reads.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pct = (x) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
const pm = (m) => (m ? `${Math.round(m.mean * 100)}% ± ${Math.round(m.sd * 100)}` : "n/a");

function runCard(dir, r) {
  const id = `${r.eval}-${r.config}-${r.n}`;
  const files = (r.files ?? [])
    .map((f) => {
      const p = join(dir, "runs", id, "outputs", f);
      const text = existsSync(p) ? readFileSync(p, "utf8").slice(0, 20_000) : "";
      return `<details><summary>${esc(f)}</summary><pre>${esc(text)}</pre></details>`;
    })
    .join("");
  const grades = r.grades
    .map((g) => `<tr class="${g.passed ? "pass" : "fail"}"><td>${g.passed ? "pass" : "fail"}</td><td>${esc(g.name)}${g.kind === "judge" ? ' <span class="tag">judged</span>' : ""}</td><td>${esc(g.evidence)}</td></tr>`)
    .join("");
  const passed = r.grades.filter((g) => g.passed).length;
  return `<article class="run ${r.config}">
  <header><strong>${r.config === "with" ? "With the skill" : r.config === "without" ? "Without" : esc(r.config)}</strong>, run ${r.n}
    <span class="meta">${passed}/${r.grades.length} passed, ${Math.round(r.seconds)} s${r.tokens ? `, ${r.tokens.input + r.tokens.output} tokens` : ""}${r.config === "with" && !r.skillFired ? ' <span class="warn">the skill never ran</span>' : ""}${r.status === "error" || r.status === "timeout" ? ` <span class="warn">${esc(r.status)}</span>` : ""}${r.status === "blocked" ? ' <span class="warn">blocked: it needed a permission headless mode can\'t ask for, so this run is left out of the numbers</span>' : ""}</span></header>
  <details open><summary>Answer</summary><pre>${esc(r.answer)}</pre></details>
  ${files}
  <table>${grades}</table>
  <label>Your note on this run<textarea data-run="${esc(id)}" rows="2" placeholder="What's wrong, or blank if it's fine"></textarea></label>
</article>`;
}

export function reviewHtml(dir, benchmark, runs, evals) {
  const b = benchmark;
  const w = b.configs.with;
  const wo = b.configs.without;
  const sections = evals
    .map((e) => {
      const rs = runs.filter((r) => r.eval === e.name);
      return `<section><h2>${esc(e.name)}</h2><p class="prompt">${esc(e.prompt)}</p><div class="runs">${rs.map((r) => runCard(dir, r)).join("")}</div></section>`;
    })
    .join("");
  const weak = b.nonDiscriminating.length
    ? `<p class="warn">These assertions passed exactly as often without the skill, so they say nothing about it: ${b.nonDiscriminating.map(esc).join("; ")}</p>`
    : "";
  const unused = w?.skillUnused ? `<p class="warn">In ${w.skillUnused} of ${w.runs} runs with the skill, the skill never ran. Those runs measure the model, not the skill.</p>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(b.skill)} review</title>
<style>
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--card:#fff;--line:#e7e5e4;--pass:#15803d;--fail:#b91c1c;--warn:#b45309;--accent:#4338ca}
@media (prefers-color-scheme:dark){:root{--bg:#0c0a09;--fg:#e7e5e4;--muted:#a8a29e;--card:#1c1917;--line:#292524;--pass:#4ade80;--fail:#f87171;--warn:#fbbf24;--accent:#a5b4fc}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:32px 0 8px}
.meta{color:var(--muted);font-size:13px;margin-left:8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:16px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px}
.card b{display:block;font-size:22px}
.prompt{background:var(--card);border-left:3px solid var(--accent);padding:8px 12px;white-space:pre-wrap}
.runs{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
.run{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;min-width:0}
pre{white-space:pre-wrap;word-break:break-word;font-size:13px;background:var(--bg);padding:8px;border-radius:6px;max-height:320px;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}td{border-top:1px solid var(--line);padding:4px;vertical-align:top}
tr.pass td:first-child{color:var(--pass);font-weight:600}tr.fail td:first-child{color:var(--fail);font-weight:600}
.warn{color:var(--warn)}.tag{font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:0 4px}
textarea{width:100%;box-sizing:border-box;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:6px;font:inherit;margin-top:4px}
button{background:var(--accent);color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer}
</style></head><body><main>
<h1>${esc(b.skill)}</h1>
<div class="meta">${esc(b.tool)}, ${b.runsEach} runs of each, ${esc(b.date.slice(0, 16).replace("T", " "))} UTC</div>
<div class="cards">
<div class="card">With the skill<b>${pm(w?.passRate)}</b>of assertions passed</div>
<div class="card">Without<b>${pm(wo?.passRate)}</b>of assertions passed</div>
<div class="card">Difference<b>${b.delta === null ? "n/a" : `${b.delta >= 0 ? "+" : ""}${Math.round(b.delta * 100)} points`}</b>with against without</div>
<div class="card">Time with / without<b>${w ? Math.round(w.seconds.mean) : "n/a"} s / ${wo ? Math.round(wo.seconds.mean) : "n/a"} s</b>average per run</div>
</div>
${unused}${weak}
<p><button id="save">Download your notes (feedback.json)</button> <span class="meta">Notes are kept in this browser as you type.</span></p>
${sections}
</main>
<script>
const key = ${JSON.stringify(`skill-review:${b.skill}:${b.date}`)};
let notes = {};
try { notes = JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) {}
for (const t of document.querySelectorAll("textarea[data-run]")) {
  t.value = notes[t.dataset.run] || "";
  t.addEventListener("input", () => { notes[t.dataset.run] = t.value; try { localStorage.setItem(key, JSON.stringify(notes)); } catch (e) {} });
}
document.getElementById("save").addEventListener("click", () => {
  const reviews = [...document.querySelectorAll("textarea[data-run]")].map((t) => ({ run: t.dataset.run, note: t.value }));
  const blob = new Blob([JSON.stringify({ skill: ${JSON.stringify(b.skill)}, date: ${JSON.stringify(b.date)}, reviews }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "feedback.json"; a.click();
});
</script></body></html>
`;
}

export function writeReview(dir, result) {
  const file = join(dir, "review.html");
  writeFileSync(file, reviewHtml(dir, result.benchmark, result.runs, result.evals));
  return file;
}
