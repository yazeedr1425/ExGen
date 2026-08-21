// CORS for the Edge Functions.
//
// ALLOWED_ORIGIN takes a comma-separated list, because the app runs from more
// than one origin: production on Vercel, branch previews, and localhost during
// development. A browser only accepts a single value in
// Access-Control-Allow-Origin, so the matching origin is echoed back rather
// than the whole list.
//
// The headers are applied by `withCors`, which wraps a handler and stamps them
// onto whatever Response comes out. That keeps `json()` callers unchanged and
// avoids tracking the current origin in module scope, which would be unsafe
// once two requests interleave on an await.

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type";
const ALLOW_METHODS = "POST, GET, OPTIONS";

function allowList(): string[] {
  return (Deno.env.get("ALLOWED_ORIGIN") ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/** The value to send back for this request's Origin. */
function resolveOrigin(req: Request): string {
  const list = allowList();
  if (list.includes("*")) return "*";

  const origin = req.headers.get("origin");
  if (origin && list.includes(origin)) return origin;

  // Not an allowed browser origin. Machine callers (n8n) send no Origin and do
  // not enforce CORS, so this only matters to browsers — and for them refusing
  // by naming a different origin is the correct outcome.
  return list[0] ?? "*";
}

export function corsFor(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveOrigin(req),
    "Access-Control-Allow-Headers": ALLOW_HEADERS,
    "Access-Control-Allow-Methods": ALLOW_METHODS,
    Vary: "Origin",
  };
}

/** Static fallback kept so existing `json()` calls compile unchanged; the real
 *  per-request values are stamped on by `withCors`. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": allowList()[0] ?? "*",
  "Access-Control-Allow-Headers": ALLOW_HEADERS,
  "Access-Control-Allow-Methods": ALLOW_METHODS,
};

export function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extra },
  });
}

export function preflight(req: Request): Response | null {
  return req.method === "OPTIONS" ? new Response("ok", { headers: corsFor(req) }) : null;
}

/** Wraps a handler so every response carries the right CORS headers for the
 *  requesting origin, and OPTIONS is answered before the handler runs. */
export function withCors(
  handler: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    const cors = corsFor(req);
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

    const res = await handler(req);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  };
}
