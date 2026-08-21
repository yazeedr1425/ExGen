// Cross-file checks that only make sense once every file exists.
//
// mv3.ts validates each file against the Manifest V3 rules. It cannot catch the
// failure mode that keeps shipping broken extensions: files that are each valid
// but disagree with one another. Every file is written in its own model call
// with no sight of the others, so each invents plausible names and nothing
// compares them. The build passes validation, loads in Chrome, renders a
// complete UI — and does nothing.
//
// Three disagreements have actually shipped:
//   1. popup.html defines id="tab-count", popup.js looks up "total-tabs"
//   2. popup.js sends {action:'start'}, background.js handles 'START'
//   3. a button exists in the markup that no script ever wires up
//
// All three are decidable without running anything, so they are errors here
// rather than something a reviewer model might notice.

import type { GeneratedFile } from "./mv3.ts";

export interface CrossCheckResult {
  errors: string[];
  warnings: string[];
}

const isHtml = (p: string) => p.toLowerCase().endsWith(".html");
const isJs = (p: string) => /\.(js|mjs)$/i.test(p);

function collect(re: RegExp, text: string, into: Set<string>, group = 1) {
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[group]) into.add(m[group]);
  }
}

/* ── 1. element ids ─────────────────────────────────────────────── */

const HTML_ID = /\bid\s*=\s*["']([A-Za-z0-9_\-:.]+)["']/g;
const JS_ASSIGNED_ID = /\.id\s*=\s*["']([A-Za-z0-9_\-:.]+)["']/g;
const JS_SET_ATTR_ID = /setAttribute\(\s*["']id["']\s*,\s*["']([A-Za-z0-9_\-:.]+)["']\s*\)/g;
const GET_BY_ID = /getElementById\(\s*["']([A-Za-z0-9_\-:.]+)["']\s*\)/g;
const QUERY_ID = /querySelector(?:All)?\(\s*["']#([A-Za-z0-9_\-:.]+)["']\s*\)/g;

function checkIds(files: GeneratedFile[], errors: string[]) {
  const defined = new Set<string>();
  const referenced = new Map<string, string[]>();

  for (const f of files) {
    const t = String(f.content ?? "");
    // Ids can be authored in markup or built at runtime; both count, otherwise
    // a content script that injects its own UI trips a false error.
    if (isHtml(f.path)) collect(HTML_ID, t, defined);
    if (isJs(f.path)) {
      collect(HTML_ID, t, defined); // ids inside template literals
      collect(JS_ASSIGNED_ID, t, defined);
      collect(JS_SET_ATTR_ID, t, defined);
    }
  }

  for (const f of files) {
    if (!isJs(f.path)) continue;
    const t = String(f.content ?? "");
    const found = new Set<string>();
    collect(GET_BY_ID, t, found);
    collect(QUERY_ID, t, found);
    for (const id of found) {
      if (!referenced.has(id)) referenced.set(id, []);
      referenced.get(id)!.push(f.path);
    }
  }

  for (const [id, where] of referenced) {
    if (defined.has(id)) continue;
    const near = closest(id, [...defined]);
    errors.push(
      `${where.join(", ")} looks up element id "${id}", which no file defines` +
        (near ? `. The markup defines "${near}" — the two must match exactly.` : "."),
    );
  }
}

/* ── 2. runtime message protocol ────────────────────────────────── */

// popup.js: chrome.runtime.sendMessage({ action: 'start' })
const MSG_SENT = /sendMessage\(\s*(?:[A-Za-z0-9_.]+\s*,\s*)?\{[^{}]*?\b(?:action|type|cmd|command)\s*:\s*["']([^"']+)["']/g;
// background.js: message.action === 'START'   /   case 'START':
const MSG_HANDLED_EQ = /\b[A-Za-z_$][\w$]*\s*\.\s*(?:action|type|cmd|command)\s*===?\s*["']([^"']+)["']/g;
const MSG_HANDLED_CASE = /\bcase\s+["']([^"']+)["']\s*:/g;

function checkMessages(files: GeneratedFile[], errors: string[]) {
  const sent = new Map<string, string[]>();
  const handled = new Set<string>();

  for (const f of files) {
    if (!isJs(f.path)) continue;
    const t = String(f.content ?? "");

    const s = new Set<string>();
    collect(MSG_SENT, t, s);
    for (const a of s) {
      if (!sent.has(a)) sent.set(a, []);
      sent.get(a)!.push(f.path);
    }

    collect(MSG_HANDLED_EQ, t, handled);
    collect(MSG_HANDLED_CASE, t, handled);
  }

  if (!sent.size || !handled.size) return; // nothing to compare

  for (const [action, where] of sent) {
    if (handled.has(action)) continue;
    const near = [...handled].find((h) => h.toLowerCase() === action.toLowerCase());
    errors.push(
      near
        ? `${where.join(", ")} sends the message "${action}" but the listener checks for "${near}" — the case differs, so the handler never runs.`
        : `${where.join(", ")} sends the message "${action}", which no listener handles. Nothing happens when it fires.`,
    );
  }
}

/* ── 3. storage keys ────────────────────────────────────────────── */

const STORAGE_SET = /storage\.(?:local|sync|session)\.set\(\s*\{([^{}]*)\}/g;
const STORAGE_GET = /storage\.(?:local|sync|session)\.(?:get|remove)\(\s*(\[[^\]]*\]|["'][^"']+["']|\{[^{}]*\})/g;
const KEY_IN_OBJ = /(?:^|,)\s*(?:["']([A-Za-z0-9_$]+)["']|([A-Za-z_$][\w$]*))\s*(?::|,|$)/g;
const KEY_IN_LIST = /["']([A-Za-z0-9_$]+)["']/g;

function checkStorage(files: GeneratedFile[], errors: string[]) {
  const written = new Set<string>();
  const read = new Map<string, string[]>();

  for (const f of files) {
    if (!isJs(f.path)) continue;
    const t = String(f.content ?? "");

    STORAGE_SET.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = STORAGE_SET.exec(t)) !== null) {
      collect(KEY_IN_OBJ, m[1], written, 1);
      collect(KEY_IN_OBJ, m[1], written, 2);
    }

    STORAGE_GET.lastIndex = 0;
    while ((m = STORAGE_GET.exec(t)) !== null) {
      const keys = new Set<string>();
      collect(KEY_IN_LIST, m[1], keys);
      for (const k of keys) {
        if (!read.has(k)) read.set(k, []);
        read.get(k)!.push(f.path);
      }
    }
  }

  if (!written.size) return; // nothing is stored; reads are all defaults

  for (const [key, where] of read) {
    if (written.has(key)) continue;
    const near = closest(key, [...written]);
    if (!near) continue; // unrelated key, probably a genuine default read
    errors.push(
      `${where.join(", ")} reads storage key "${key}" but the code only ever writes "${near}". The value will always be undefined.`,
    );
  }
}

/* ── 4. dead controls ───────────────────────────────────────────── */

const HTML_BUTTON_ID = /<button[^>]*\bid\s*=\s*["']([A-Za-z0-9_\-:.]+)["']/g;

function checkDeadControls(files: GeneratedFile[], errors: string[]) {
  const buttons = new Map<string, string>();
  for (const f of files) {
    if (!isHtml(f.path)) continue;
    const found = new Set<string>();
    collect(HTML_BUTTON_ID, String(f.content ?? ""), found);
    for (const id of found) buttons.set(id, f.path);
  }
  if (!buttons.size) return;

  const js = files.filter((f) => isJs(f.path)).map((f) => String(f.content ?? "")).join("\n");
  for (const [id, where] of buttons) {
    if (js.includes(id)) continue;
    errors.push(
      `${where} renders a button with id "${id}" that no script references. It will do nothing when clicked.`,
    );
  }
}

/* ── entry point ────────────────────────────────────────────────── */

export function crossCheckDom(files: GeneratedFile[]): CrossCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  checkIds(files, errors);
  checkMessages(files, errors);
  checkStorage(files, errors);
  checkDeadControls(files, errors);

  return { errors, warnings };
}

/* ── helpers ────────────────────────────────────────────────────── */

/** Nearest candidate by edit distance, to make the error actionable. */
function closest(target: string, pool: string[]): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const cand of pool) {
    const d = distance(target.toLowerCase(), cand.toLowerCase());
    if (d < bestScore) {
      bestScore = d;
      best = cand;
    }
  }
  return best && bestScore <= Math.max(4, Math.floor(target.length / 2)) ? best : null;
}

function distance(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
