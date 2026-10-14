/**
 * Reads the YAML frontmatter of SKILL.md and agent files.
 *
 * Every AI tool parses this frontmatter with its own YAML library, so a value
 * that one parser reads differently from another breaks a skill in one tool
 * and not the next. This reader accepts only the small, unambiguous part of
 * YAML that skills need (scalars, block scalars, one-level maps and lists)
 * and rejects anything a real YAML parser could read another way, such as a
 * plain value containing ": " or " #". Node has no YAML parser, and the build
 * must run before `npm install`, which is why it is written here.
 */

export class FrontmatterError extends Error {
  constructor(file, line, message) {
    super(line ? `${file}:${line}: ${message}` : `${file}: ${message}`);
    this.name = "FrontmatterError";
  }
}

const KEY = /^([A-Za-z0-9_-]+):(?:[ \t]+(.*?))?[ \t]*$/;
const BLOCK_SCALAR = /^([|>])([+-]?)[ \t]*(?:#.*)?$/;
// A plain value may not start with a character YAML treats as syntax.
const PLAIN_START_FORBIDDEN = /^[-?:,[\]{}#&*!|>'"%@`]/;

/**
 * Splits a Markdown file into its frontmatter data and body.
 * @param {string} text the whole file
 * @param {string} file the path used in error messages
 * @returns {{ data: Record<string, unknown>, body: string }}
 */
export function parseFrontmatter(text, file) {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0] !== "---") {
    throw new FrontmatterError(file, 1, "must start with a `---` line, because every tool only reads frontmatter that opens on line 1");
  }
  const end = lines.indexOf("---", 1);
  if (end === -1) throw new FrontmatterError(file, 1, "frontmatter is not closed with a `---` line");
  const data = parseMapping(lines.slice(1, end), file, 2);
  return { data, body: lines.slice(end + 1).join("\n") };
}

function isBlank(line) {
  return line.trim() === "" || /^\s*#/.test(line);
}

function indentOf(line) {
  return /^[ ]*/.exec(line)[0].length;
}

function parseMapping(lines, file, firstLine) {
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const lineNo = firstLine + i;
    if (isBlank(raw)) {
      i++;
      continue;
    }
    if (/^\t/.test(raw)) throw new FrontmatterError(file, lineNo, "tabs are not allowed for indentation in YAML");
    if (/^\s/.test(raw)) throw new FrontmatterError(file, lineNo, "unexpected indentation");
    const match = KEY.exec(raw);
    if (!match) throw new FrontmatterError(file, lineNo, "expected `key: value`");
    const key = match[1];
    if (Object.hasOwn(out, key)) throw new FrontmatterError(file, lineNo, `duplicate key "${key}"`);
    i++;
    const block = [];
    while (i < lines.length && (lines[i].trim() === "" || /^\s/.test(lines[i]))) {
      if (/^ *\t/.test(lines[i]) && lines[i].trim() !== "") {
        throw new FrontmatterError(file, firstLine + i, "tabs are not allowed for indentation in YAML");
      }
      block.push(lines[i]);
      i++;
    }
    while (block.length > 0 && block[block.length - 1].trim() === "") block.pop();
    out[key] = parseValue(match[2] ?? "", block, file, lineNo);
  }
  return out;
}

function parseValue(inline, block, file, lineNo) {
  const blockScalar = BLOCK_SCALAR.exec(inline);
  if (blockScalar) return parseBlockScalar(blockScalar[1], blockScalar[2], block, file, lineNo);
  if (inline === "") {
    if (block.length === 0) return null;
    const first = block.find((line) => !isBlank(line));
    if (/^\s*-(\s|$)/.test(first)) return parseList(block, file, lineNo);
    return parseNestedMap(block, file, lineNo);
  }
  if (inline.startsWith('"')) return single(parseDoubleQuoted(inline, file, lineNo), block, file, lineNo);
  if (inline.startsWith("'")) return single(parseSingleQuoted(inline, file, lineNo), block, file, lineNo);
  if (inline.startsWith("[")) return single(parseFlowList(inline, file, lineNo), block, file, lineNo);
  if (inline.startsWith("{")) throw new FrontmatterError(file, lineNo, "inline `{...}` maps are not supported; use an indented map");
  const continuation = block.map((line) => line.trim());
  return parsePlain([inline, ...continuation], file, lineNo);
}

function single(value, block, file, lineNo) {
  if (block.length > 0) throw new FrontmatterError(file, lineNo + 1, "a quoted value must end on its own line");
  return value;
}

function parsePlain(parts, file, lineNo) {
  const text = foldLines(parts);
  if (PLAIN_START_FORBIDDEN.test(text)) {
    throw new FrontmatterError(file, lineNo, `value "${preview(text)}" starts with a YAML symbol; wrap it in quotes`);
  }
  if (/:(\s|$)/.test(text)) {
    throw new FrontmatterError(file, lineNo, `value "${preview(text)}" contains ": ", which YAML reads as a new key; wrap it in quotes`);
  }
  if (/\s#/.test(text)) {
    throw new FrontmatterError(file, lineNo, `value "${preview(text)}" contains " #", which YAML reads as a comment; wrap it in quotes`);
  }
  return text;
}

/** Joins plain multi-line text the way YAML folds it: one space per line break, a blank line keeps a newline. */
function foldLines(parts) {
  let out = "";
  let pendingBreaks = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed === "") {
      pendingBreaks++;
      continue;
    }
    if (out === "") out = trimmed;
    else out += (pendingBreaks > 0 ? "\n".repeat(pendingBreaks) : " ") + trimmed;
    pendingBreaks = 0;
  }
  return out;
}

function parseBlockScalar(style, chomp, block, file, lineNo) {
  const contentLines = block.filter((line) => line.trim() !== "");
  if (contentLines.length === 0) return "";
  const indent = Math.min(...contentLines.map(indentOf));
  if (indent === 0) throw new FrontmatterError(file, lineNo + 1, "block scalar lines must be indented");
  const lines = block.map((line) => (line.trim() === "" ? "" : line.slice(indent)));
  let text;
  if (style === "|") {
    text = lines.join("\n");
  } else {
    text = "";
    let previousBlank = false;
    for (const line of lines) {
      if (line === "") {
        text += "\n";
        previousBlank = true;
        continue;
      }
      if (text === "" || previousBlank || line.startsWith(" ")) text += line;
      else text += " " + line;
      previousBlank = false;
    }
  }
  if (chomp === "-") return text.replace(/\n+$/, "");
  return text.replace(/\n+$/, "") + "\n";
}

function parseList(block, file, lineNo) {
  const items = [];
  const indent = indentOf(block.find((line) => !isBlank(line)));
  block.forEach((line, offset) => {
    if (isBlank(line)) return;
    const at = lineNo + 1 + offset;
    if (indentOf(line) !== indent) throw new FrontmatterError(file, at, "list items must share one indentation");
    const item = /^\s*-\s+(.*?)\s*$/.exec(line);
    if (!item) throw new FrontmatterError(file, at, "expected a `- item` line");
    items.push(parseScalar(item[1], file, at));
  });
  return items;
}

function parseNestedMap(block, file, lineNo) {
  const out = {};
  const indent = indentOf(block.find((line) => !isBlank(line)));
  block.forEach((line, offset) => {
    if (isBlank(line)) return;
    const at = lineNo + 1 + offset;
    if (indentOf(line) !== indent) throw new FrontmatterError(file, at, "only one level of nesting is supported");
    const match = KEY.exec(line.slice(indent));
    if (!match) throw new FrontmatterError(file, at, "expected `key: value`");
    if (Object.hasOwn(out, match[1])) throw new FrontmatterError(file, at, `duplicate key "${match[1]}"`);
    out[match[1]] = match[2] === undefined || match[2] === "" ? null : parseScalar(match[2], file, at);
  });
  return out;
}

function parseScalar(text, file, lineNo) {
  if (text.startsWith('"')) return parseDoubleQuoted(text, file, lineNo);
  if (text.startsWith("'")) return parseSingleQuoted(text, file, lineNo);
  return parsePlain([text], file, lineNo);
}

function parseSingleQuoted(text, file, lineNo) {
  const match = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(text);
  if (!match) throw new FrontmatterError(file, lineNo, "unterminated single-quoted value");
  return match[1].replace(/''/g, "'");
}

const ESCAPES = { '"': '"', "\\": "\\", "/": "/", n: "\n", t: "\t", r: "\r", "0": "\0" };

function parseDoubleQuoted(text, file, lineNo) {
  let out = "";
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const rest = text.slice(i + 1).trim();
      if (rest !== "" && !rest.startsWith("#")) throw new FrontmatterError(file, lineNo, "unexpected text after a quoted value");
      return out;
    }
    if (char === "\\") {
      const next = text[i + 1];
      if (next === "u" && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
        out += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 6), 16));
        i += 5;
        continue;
      }
      if (next === undefined || !Object.hasOwn(ESCAPES, next)) {
        throw new FrontmatterError(file, lineNo, `unsupported escape "\\${next ?? ""}" in a double-quoted value`);
      }
      out += ESCAPES[next];
      i++;
      continue;
    }
    out += char;
  }
  throw new FrontmatterError(file, lineNo, "unterminated double-quoted value");
}

function parseFlowList(text, file, lineNo) {
  const match = /^\[(.*)\]\s*(?:#.*)?$/.exec(text);
  if (!match) throw new FrontmatterError(file, lineNo, "a `[...]` list must close on the same line");
  if (match[1].trim() === "") return [];
  return match[1].split(",").map((item) => parseScalar(item.trim(), file, lineNo));
}

function preview(text) {
  return text.length > 40 ? `${text.slice(0, 40)}...` : text;
}
