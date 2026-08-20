-- The Manifest V3 rulebook the n8n Agent reads as a tool.
--
-- Written imperatively, for a model to obey rather than for a human to browse.
-- Each row pairs the rule with the Manifest V2 habit it replaces, because the
-- failure mode we are guarding against is a model reproducing MV2 patterns it
-- saw far more often during training.
--
-- When the agent gets something wrong in production, add a row here. That is
-- the whole point of owning this table instead of scraping docs at runtime.

insert into mv3_rules (topic, api, rule, example, antipattern, severity) values

-- ─────────────────────────── manifest ───────────────────────────
('manifest', null,
 'manifest.json must declare "manifest_version": 3 as an integer, never a string.',
 $e${"manifest_version": 3, "name": "My Extension", "version": "1.0.0"}$e$,
 '"manifest_version": "3" or 2', 'must'),

('manifest', null,
 'The required top-level keys are exactly manifest_version, name and version. Always include description and icons too.',
 $e${"name": "Tab Counter", "version": "1.0.0", "description": "Counts open tabs.", "icons": {"16": "icons/16.png", "48": "icons/48.png", "128": "icons/128.png"}}$e$,
 'omitting icons, which makes the extension look broken in chrome://extensions', 'must'),

('manifest', null,
 'The version string is one to four dot-separated integers, each between 0 and 65535, with no leading zeros and no suffixes.',
 '"version": "1.0.3"',
 '"version": "1.0.0-beta" or "v1.0" or "1.0.01"', 'must'),

('manifest', 'chrome.action',
 'Use the single "action" key for the toolbar button. browser_action and page_action were removed in MV3.',
 $e${"action": {"default_popup": "popup/popup.html", "default_title": "Tab Counter", "default_icon": {"16": "icons/16.png"}}}$e$,
 '"browser_action" or "page_action"', 'must'),

('manifest', null,
 'Declare "options_ui" with "open_in_tab": false for a settings page. options_page is legacy.',
 $e${"options_ui": {"page": "options/options.html", "open_in_tab": false}}$e$,
 '"options_page": "options.html"', 'should'),

('manifest', null,
 'Every path in the manifest is relative to the extension root with no leading slash and no "./" prefix, and must match a file that actually ships in the package.',
 '"default_popup": "popup/popup.html"',
 '"default_popup": "/popup/popup.html"', 'must'),

-- ─────────────────────── service worker ───────────────────────
('service_worker', 'background',
 'Background logic goes in a service worker declared as a single script. The "persistent" key does not exist in MV3 and background pages are gone.',
 $e${"background": {"service_worker": "background.js"}}$e$,
 $e${"background": {"scripts": ["bg.js"], "persistent": true}}$e$, 'must'),

('service_worker', 'background',
 'To use ES module import syntax in the service worker, add "type": "module". Without it, import statements throw at load.',
 $e${"background": {"service_worker": "background.js", "type": "module"}}$e$,
 'using import in background.js while omitting "type": "module"', 'must'),

('service_worker', null,
 'The service worker is ephemeral and is terminated when idle. Never keep state in module-level variables across events; persist it with chrome.storage.',
 'await chrome.storage.session.set({ count: n });',
 'let count = 0; then incrementing count and expecting it to survive', 'must'),

('service_worker', null,
 'Register every event listener synchronously at the top level of the service worker. A listener added inside an async callback or after an await will miss events on a cold start.',
 $e$chrome.runtime.onInstalled.addListener(() => { /* ... */ });$e$,
 $e$(async () => { await init(); chrome.action.onClicked.addListener(fn); })();$e$, 'must'),

('service_worker', 'chrome.alarms',
 'Use chrome.alarms for anything periodic or delayed. setTimeout and setInterval do not survive worker termination.',
 $e$chrome.alarms.create('refresh', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'refresh') refresh(); });$e$,
 'setInterval(refresh, 300000) inside the service worker', 'must'),

('service_worker', null,
 'The service worker has no DOM. There is no window, no document, no localStorage and no alert. Use chrome.storage instead of localStorage, and an offscreen document if DOM APIs are genuinely required.',
 'chrome.storage.local.set({ key: value })',
 'localStorage.setItem or document.querySelector in background.js', 'must'),

-- ─────────────────────── permissions ───────────────────────
('permissions', null,
 'API permissions go in "permissions". URL match patterns go in "host_permissions". Mixing them is an MV2 habit and fails validation.',
 $e${"permissions": ["storage", "tabs", "alarms"], "host_permissions": ["https://api.example.com/*"]}$e$,
 $e${"permissions": ["storage", "https://api.example.com/*"]}$e$, 'must'),

('permissions', null,
 'Request the narrowest permission set that satisfies the stated feature. Never add a permission the generated code does not actually call.',
 'a tab-counting extension needs only ["tabs"]',
 'adding "<all_urls>", "cookies" and "webRequest" to a popup that only counts tabs', 'must'),

('permissions', 'activeTab',
 'Prefer the activeTab permission over broad host permissions when the extension acts on the current tab after a user gesture. It grants temporary access without a scary install warning.',
 $e${"permissions": ["activeTab", "scripting"]}$e$,
 $e${"host_permissions": ["<all_urls>"]} merely to touch the current tab$e$, 'should'),

('permissions', 'chrome.permissions',
 'Permissions listed under optional_permissions must be requested with chrome.permissions.request from inside a user gesture handler, or the request is rejected.',
 $e$button.addEventListener('click', () => chrome.permissions.request({ permissions: ['downloads'] }));$e$,
 'calling chrome.permissions.request on page load', 'must'),

-- ─────────────────────────── csp ───────────────────────────
('csp', null,
 'MV3 forbids remote code. Every script must ship inside the package. Loading a script from a CDN cannot be enabled by any CSP relaxation and will be rejected by the Chrome Web Store.',
 '<script src="lib/vendor.js"></script> with the file vendored into the package',
 '<script src="https://cdn.jsdelivr.net/npm/lib.js"></script>', 'must'),

('csp', null,
 'Never use eval, new Function, or string-argument setTimeout. The default extension_pages CSP blocks them and the code will throw.',
 'JSON.parse(text)',
 $e$eval(text) or new Function('return ' + text)$e$, 'must'),

('csp', null,
 'No inline script and no inline event handler attributes in any extension HTML page. Put the code in a separate .js file and attach listeners with addEventListener.',
 $e$<button id="go"></button><script src="popup.js"></script>  /* popup.js: document.getElementById('go').addEventListener('click', run) */$e$,
 $e$<button onclick="run()"></button> or <script>run()</script>$e$, 'must'),

('csp', null,
 'If content_security_policy is declared, it is an object keyed by extension_pages and sandbox, not the MV2 string.',
 $e${"content_security_policy": {"extension_pages": "script-src 'self'; object-src 'self'"}}$e$,
 $e${"content_security_policy": "script-src 'self'"}$e$, 'should'),

-- ─────────────────────── content scripts ───────────────────────
('content_scripts', null,
 'Each static content script entry requires a "matches" array. run_at defaults to document_idle, which is usually correct.',
 $e${"content_scripts": [{"matches": ["https://example.com/*"], "js": ["content.js"], "run_at": "document_idle"}]}$e$,
 'a content_scripts entry with js but no matches', 'must'),

('content_scripts', null,
 'Content scripts run in an isolated world: they share the DOM with the page but not its JavaScript variables. Never expect to read a page variable directly.',
 'read data from the DOM, or postMessage to a script injected with world MAIN',
 'reading window.__APP_STATE__ from a default content script and expecting a value', 'must'),

('content_scripts', 'chrome.scripting',
 'Inject scripts at runtime with chrome.scripting.executeScript, which needs the "scripting" permission. chrome.tabs.executeScript was removed in MV3.',
 $e$await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });$e$,
 $e$chrome.tabs.executeScript(tabId, { file: 'content.js' })$e$, 'must'),

('content_scripts', 'chrome.scripting',
 'Inject CSS with chrome.scripting.insertCSS, not chrome.tabs.insertCSS.',
 $e$await chrome.scripting.insertCSS({ target: { tabId }, files: ['inject.css'] });$e$,
 'chrome.tabs.insertCSS(tabId, { file: "inject.css" })', 'must'),

('content_scripts', null,
 'A content script cannot call most chrome.* APIs. It may use chrome.runtime messaging and chrome.storage; anything else must be delegated to the service worker by message.',
 $e$chrome.runtime.sendMessage({ type: 'CLOSE_DUPES' });$e$,
 'calling chrome.tabs.query directly from a content script', 'must'),

-- ─────────────────────── messaging ───────────────────────
('messaging', 'chrome.runtime',
 'A chrome.runtime.onMessage listener that answers asynchronously must return true synchronously, or the message port closes before sendResponse runs.',
 $e$chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => { sendResponse(await handle(msg)); })();
  return true;
});$e$,
 'declaring the listener async and returning a Promise', 'must'),

('messaging', 'chrome.runtime',
 'Most chrome.* APIs return promises in MV3, so prefer await over callbacks. Do not pass a callback and also await the same call.',
 'const tabs = await chrome.tabs.query({});',
 'chrome.tabs.query({}, tabs => { ... }) mixed with await', 'should'),

('messaging', 'chrome.runtime',
 'Guard against a missing receiver. Sending a message when no listener exists rejects, so wrap sendMessage in try/catch.',
 $e$try { await chrome.runtime.sendMessage(msg); } catch (e) { /* no receiver */ }$e$,
 'an unhandled sendMessage rejection logging Unchecked runtime.lastError', 'should'),

-- ─────────────────────── storage ───────────────────────
('storage', 'chrome.storage',
 'Use chrome.storage.local for general persistence, chrome.storage.session for data that should die with the browser session, and chrome.storage.sync only for small user settings. All require the "storage" permission.',
 $e$await chrome.storage.local.set({ settings });
const { settings } = await chrome.storage.local.get('settings');$e$,
 'using localStorage, which does not exist in a service worker', 'must'),

('storage', 'chrome.storage',
 'chrome.storage.sync is tightly quota-limited, roughly 100KB in total and about 8KB per item. Never put page content or caches in it.',
 'sync for a handful of booleans and strings; local for anything larger',
 'writing a scraped article body into chrome.storage.sync', 'should'),

-- ─────────────────────── ui ───────────────────────
('ui', 'chrome.action',
 'chrome.action.onClicked only fires when no default_popup is declared. Declaring both a popup and an onClicked handler means the handler never runs.',
 'either a default_popup, or an onClicked listener, not both',
 'shipping default_popup plus chrome.action.onClicked.addListener and wondering why nothing happens', 'must'),

('ui', null,
 'A popup is a normal HTML document that closes as soon as it loses focus. Never rely on long-running work inside it; hand the work to the service worker.',
 $e$popup.js sends a message and renders the reply$e$,
 'starting a 30-second loop in popup.js', 'should'),

('ui', null,
 'Popup HTML must set an explicit width in CSS. With no width the popup collapses to a narrow strip.',
 'body { width: 320px; margin: 0; font: 13px/1.4 system-ui, sans-serif; }',
 'a popup body with no width rule', 'should'),

-- ─────────────────────── web accessible resources ───────────────────────
('web_accessible_resources', null,
 'web_accessible_resources is an array of objects, each pairing "resources" with "matches". The MV2 flat array of strings is invalid.',
 $e${"web_accessible_resources": [{"resources": ["inject.css", "img/*.png"], "matches": ["https://example.com/*"]}]}$e$,
 $e${"web_accessible_resources": ["inject.css"]}$e$, 'must'),

-- ─────────────────────── network ───────────────────────
('network', 'chrome.declarativeNetRequest',
 'Blocking webRequest is unavailable to normal MV3 extensions. Use declarativeNetRequest with a static rule_resources file to block or redirect.',
 $e${"permissions": ["declarativeNetRequest"], "declarative_net_request": {"rule_resources": [{"id": "ruleset", "enabled": true, "path": "rules.json"}]}}$e$,
 $e$chrome.webRequest.onBeforeRequest.addListener(fn, filter, ['blocking'])$e$, 'must'),

('network', null,
 'fetch from the service worker is subject to host_permissions. Declare every origin the generated code contacts, and never send user data to an origin the prompt did not ask for.',
 $e${"host_permissions": ["https://api.example.com/*"]}$e$,
 'fetching an undeclared third-party endpoint, or beaconing data anywhere', 'must'),

-- ─────────────────────── i18n and packaging ───────────────────────
('i18n', 'chrome.i18n',
 'For localized extensions set default_locale and provide _locales/<code>/messages.json, then reference strings as __MSG_name__ in the manifest and chrome.i18n.getMessage in code.',
 $e${"default_locale": "en"} with _locales/en/messages.json$e$,
 'setting default_locale without shipping any _locales directory, which fails to load', 'should'),

('packaging', null,
 'The zip root must contain manifest.json directly, not a wrapper folder. Chrome rejects a package whose manifest is one level down.',
 'manifest.json, popup/popup.html, background.js at the archive root',
 'my-extension/manifest.json inside the archive', 'must');
