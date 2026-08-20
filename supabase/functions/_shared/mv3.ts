// The canonical Manifest V3 validator. Deterministic — no model, no network.
//
// Why this lives in an Edge Function rather than an n8n Code node (which is what
// the plan originally specified): one implementation, reachable over HTTP by the
// n8n main flow, by the Repair agent as a tool, by CI, and by the frontend if a
// user ever edits generated files. It is also testable without n8n, which a Code
// node buried in a workflow is not.
//
// Every rule here exists because a language model reliably gets it wrong: the
// training data is overwhelmingly Manifest V2, so MV2 habits leak into MV3 output.

export interface GeneratedFile {
  path: string;
  content?: string | null;
  language?: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** chrome.<api> to the manifest permission it requires. Only APIs where the
 *  mapping is unambiguous — a false error here costs a wasted repair cycle. */
const API_PERMISSION: Record<string, string> = {
  storage: "storage",
  alarms: "alarms",
  scripting: "scripting",
  cookies: "cookies",
  downloads: "downloads",
  notifications: "notifications",
  contextMenus: "contextMenus",
  bookmarks: "bookmarks",
  history: "history",
  topSites: "topSites",
  webNavigation: "webNavigation",
  declarativeNetRequest: "declarativeNetRequest",
  offscreen: "offscreen",
  sidePanel: "sidePanel",
  idle: "idle",
  management: "management",
  tabGroups: "tabGroups",
};

export function validateExtension(files: GeneratedFile[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byPath: Record<string, string> = {};

  for (const f of files ?? []) {
    if (!f || typeof f.path !== "string") continue;
    byPath[f.path] = f.content == null ? "" : String(f.content);
  }
  const allPaths = Object.keys(byPath);

  if (allPaths.length === 0) {
    return { ok: false, errors: ["no files were generated"], warnings: [] };
  }
  for (const p of allPaths) {
    if (p.includes("..") || p.startsWith("/")) {
      errors.push(`illegal file path ${p}: must be relative to the package root`);
    }
  }

  // Chrome rejects a package whose manifest sits one level down, so this is not
  // just a missing-file check — it also catches a wrapper-folder layout.
  if (!byPath["manifest.json"]) {
    errors.push("manifest.json is missing from the package root");
    return { ok: false, errors, warnings };
  }

  let m: Record<string, any>;
  try {
    m = JSON.parse(byPath["manifest.json"]);
  } catch (e) {
    errors.push(`manifest.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
    return { ok: false, errors, warnings };
  }

  // ───────────────────── MV3 basics ─────────────────────
  if (m.manifest_version !== 3) {
    errors.push(`manifest_version must be the integer 3, got ${JSON.stringify(m.manifest_version)}`);
  }
  if (!m.name) errors.push("manifest.name is required");
  if (!m.version) {
    errors.push("manifest.version is required");
  } else if (!/^[0-9]{1,5}(\.[0-9]{1,5}){0,3}$/.test(String(m.version))) {
    errors.push(`manifest.version must be 1 to 4 dot-separated integers, got ${m.version}`);
  }

  // ───────────────────── MV2 leftovers ─────────────────────
  if (m.browser_action) errors.push("browser_action was removed in MV3; use action");
  if (m.page_action) errors.push("page_action was removed in MV3; use action");
  if (m.background) {
    if (m.background.scripts) {
      errors.push("background.scripts was removed in MV3; use background.service_worker");
    }
    if (Object.prototype.hasOwnProperty.call(m.background, "persistent")) {
      errors.push("background.persistent does not exist in MV3; remove it");
    }
  }
  if (typeof m.content_security_policy === "string") {
    errors.push(
      "content_security_policy must be an object keyed by extension_pages/sandbox in MV3, not a string",
    );
  }
  if (Array.isArray(m.web_accessible_resources)) {
    for (const w of m.web_accessible_resources) {
      if (typeof w === "string") {
        errors.push("web_accessible_resources must be objects with resources and matches in MV3, not bare strings");
        break;
      }
      if (!Array.isArray(w?.matches) || w.matches.length === 0) {
        errors.push("each web_accessible_resources entry needs a matches array");
      }
    }
  }

  // ───────────────────── permissions vs host_permissions ─────────────────────
  const perms: string[] = Array.isArray(m.permissions) ? m.permissions.map(String) : [];
  const hostPerms: string[] = Array.isArray(m.host_permissions) ? m.host_permissions.map(String) : [];
  for (const p of perms) {
    if (p.includes("://") || p === "<all_urls>" || p.startsWith("*.")) {
      errors.push(`${p} is a match pattern and belongs in host_permissions, not permissions`);
    }
  }

  // ───────────────────── referenced files must exist ─────────────────────
  const referenced: Record<string, boolean> = {};
  const refs: Array<{ p: string; where: string }> = [];
  const addRef = (p: unknown, where: string) => {
    if (p && typeof p === "string") refs.push({ p: p.replace(/^\.?\//, ""), where });
  };

  if (m.background?.service_worker) addRef(m.background.service_worker, "background.service_worker");
  if (m.action) {
    addRef(m.action.default_popup, "action.default_popup");
    const icon = m.action.default_icon;
    if (icon) {
      if (typeof icon === "string") addRef(icon, "action.default_icon");
      else for (const k of Object.keys(icon)) addRef(icon[k], `action.default_icon.${k}`);
    }
  }
  if (m.icons) for (const k of Object.keys(m.icons)) addRef(m.icons[k], `icons.${k}`);
  if (m.options_ui) addRef(m.options_ui.page, "options_ui.page");
  if (m.options_page) addRef(m.options_page, "options_page");
  if (m.devtools_page) addRef(m.devtools_page, "devtools_page");
  if (m.side_panel) addRef(m.side_panel.default_path, "side_panel.default_path");
  if (Array.isArray(m.content_scripts)) {
    m.content_scripts.forEach((cs: Record<string, any>, i: number) => {
      if (!Array.isArray(cs?.matches) || cs.matches.length === 0) {
        errors.push(`content_scripts[${i}] has no matches array`);
      }
      for (const j of cs?.js ?? []) addRef(j, `content_scripts[${i}].js`);
      for (const c of cs?.css ?? []) addRef(c, `content_scripts[${i}].css`);
    });
  }
  if (Array.isArray(m.declarative_net_request?.rule_resources)) {
    m.declarative_net_request.rule_resources.forEach((r: Record<string, any>, i: number) => {
      addRef(r?.path, `declarative_net_request.rule_resources[${i}].path`);
    });
  }
  for (const r of refs) {
    referenced[r.p] = true;
    if (!byPath[r.p]) {
      errors.push(`manifest ${r.where} references ${r.p} but no such file was generated`);
    }
  }

  // ───────────────────── per-file static checks ─────────────────────
  const swPath: string | null = m.background?.service_worker
    ? String(m.background.service_worker).replace(/^\.?\//, "")
    : null;

  for (const p of allPaths) {
    const src = byPath[p];
    const isJs = /\.(js|mjs)$/i.test(p);
    const isHtml = /\.html?$/i.test(p);

    if (isHtml) {
      if (/<script(?![^>]*\bsrc\b)[^>]*>\s*[^\s<]/i.test(src)) {
        errors.push(`${p}: inline script content is blocked by the MV3 CSP; move it to a .js file`);
      }
      const onAttr = src.match(
        /\son(click|load|change|submit|input|mouseover|keydown|keyup|focus|blur)\s*=/i,
      );
      if (onAttr) {
        errors.push(
          `${p}: inline event handler attribute ${onAttr[0].trim()} is blocked by the MV3 CSP; use addEventListener`,
        );
      }
      if (/<(?:script|link)[^>]+(?:src|href)\s*=\s*["'](https?:)?\/\//i.test(src)) {
        errors.push(`${p}: loads a remote resource; MV3 forbids remote code and every asset must ship in the package`);
      }

      const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/") + 1) : "";
      const resolveLocal = (raw: string) =>
        raw.startsWith("/") ? raw.slice(1) : dir + raw.replace(/^\.\//, "");

      for (const tag of src.match(/<script[^>]+src\s*=\s*["'][^"']+["']/gi) ?? []) {
        const mm = tag.match(/src\s*=\s*["']([^"']+)["']/i);
        if (!mm || /^(https?:)?\/\//i.test(mm[1])) continue;
        const resolved = resolveLocal(mm[1]);
        referenced[resolved] = true;
        if (!byPath[resolved]) {
          errors.push(`${p}: references script ${mm[1]} which resolves to ${resolved}, but no such file was generated`);
        }
      }
      for (const tag of src.match(/<link[^>]+href\s*=\s*["'][^"']+["']/gi) ?? []) {
        const mm = tag.match(/href\s*=\s*["']([^"']+)["']/i);
        if (!mm || /^(https?:)?\/\//i.test(mm[1])) continue;
        const resolved = resolveLocal(mm[1]);
        referenced[resolved] = true;
        if (!byPath[resolved]) {
          errors.push(`${p}: references stylesheet ${mm[1]} which resolves to ${resolved}, but no such file was generated`);
        }
      }
    }

    if (isJs) {
      if (/\beval\s*\(/.test(src)) errors.push(`${p}: eval() is blocked by the MV3 CSP`);
      if (/new\s+Function\s*\(/.test(src)) errors.push(`${p}: new Function() is blocked by the MV3 CSP`);
      if (/chrome\.tabs\.executeScript/.test(src)) {
        errors.push(`${p}: chrome.tabs.executeScript was removed in MV3; use chrome.scripting.executeScript`);
      }
      if (/chrome\.tabs\.insertCSS/.test(src)) {
        errors.push(`${p}: chrome.tabs.insertCSS was removed in MV3; use chrome.scripting.insertCSS`);
      }
      if (/chrome\.extension\.getURL/.test(src)) {
        errors.push(`${p}: chrome.extension.getURL was removed in MV3; use chrome.runtime.getURL`);
      }
      if (/chrome\.(browserAction|pageAction)\b/.test(src)) {
        errors.push(`${p}: chrome.browserAction and chrome.pageAction were removed in MV3; use chrome.action`);
      }
      if (/\bchrome\.runtime\.onMessage\.addListener\s*\(\s*async\b/.test(src)) {
        errors.push(
          `${p}: an async onMessage listener returns a Promise, which closes the message port; use a sync listener that returns true`,
        );
      }

      if (swPath && p === swPath) {
        if (/\blocalStorage\b/.test(src)) {
          errors.push(`${p} (service worker): localStorage does not exist in a service worker; use chrome.storage`);
        }
        if (/\bdocument\s*\./.test(src)) {
          errors.push(`${p} (service worker): there is no DOM in a service worker; document is undefined`);
        }
        if (/\bwindow\s*\./.test(src)) {
          errors.push(`${p} (service worker): there is no window in a service worker; use self or globalThis`);
        }
        if (/\bset(Timeout|Interval)\s*\(/.test(src)) {
          warnings.push(
            `${p} (service worker): setTimeout/setInterval do not survive worker termination; prefer chrome.alarms`,
          );
        }
        const usesEsm = /^\s*import\s.+from\s/m.test(src) || /^\s*export\s/m.test(src);
        if (usesEsm && m.background?.type !== "module") {
          errors.push(`${p} (service worker): uses ES module syntax, so the manifest needs type module on background`);
        }
      }
    }
  }

  // ───────────────────── permission coverage ─────────────────────
  const usedApis: Record<string, boolean> = {};
  for (const p of allPaths) {
    if (!/\.(js|mjs)$/i.test(p)) continue;
    for (const hit of byPath[p].match(/\bchrome\.([a-zA-Z][a-zA-Z0-9]*)/g) ?? []) {
      usedApis[hit.replace("chrome.", "")] = true;
    }
  }
  for (const api of Object.keys(usedApis)) {
    const needed = API_PERMISSION[api];
    if (needed && !perms.includes(needed)) {
      errors.push(`code calls chrome.${api} but ${needed} is not declared in manifest.permissions`);
    }
  }
  if (usedApis.tabs && !perms.includes("tabs") && !perms.includes("activeTab")) {
    warnings.push(
      "code calls chrome.tabs but neither tabs nor activeTab is declared; reading tab url or title will return undefined",
    );
  }
  for (const p of perms) {
    let stillUsed = Object.keys(usedApis).some((api) => API_PERMISSION[api] === p);
    if (p === "tabs") stillUsed = stillUsed || !!usedApis.tabs || !!usedApis.scripting;
    if (!stillUsed && p !== "activeTab") {
      warnings.push(
        `manifest declares the ${p} permission but no generated code appears to use it; drop it to avoid an unnecessary install warning`,
      );
    }
  }
  if (hostPerms.includes("<all_urls>")) {
    warnings.push(
      "host_permissions includes <all_urls>, which triggers the broadest install warning; narrow it or use activeTab if possible",
    );
  }

  // ───────────────────── dead weight ─────────────────────
  for (const p of allPaths) {
    if (p === "manifest.json") continue;
    if (/^_locales\//.test(p) || /\.md$/i.test(p)) continue;
    if (!referenced[p]) {
      warnings.push(`${p} is never referenced by the manifest or any HTML page; it will ship as dead weight`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Human/agent-readable rendering. The agent tool returns this string, because a
 *  model acts on prose far more reliably than on a nested JSON blob. */
export function renderReport(res: ValidationResult): string {
  const lines: string[] = [];
  if (res.errors.length) {
    lines.push(`ERRORS (${res.errors.length}) - these MUST be fixed:`);
    for (const e of res.errors) lines.push(`- ${e}`);
  }
  if (res.warnings.length) {
    lines.push(`WARNINGS (${res.warnings.length}) - fix if easy, they do not block:`);
    for (const w of res.warnings) lines.push(`- ${w}`);
  }
  if (!lines.length) lines.push("No problems found. This is valid Manifest V3.");
  return lines.join("\n");
}
