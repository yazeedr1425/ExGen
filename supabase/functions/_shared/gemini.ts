// A small, explicit Gemini client.
//
// This replaces n8n's AI Agent node. That node hid the parts that actually
// broke this pipeline in practice: which model id it sent, how it coerced the
// output into a schema, how many times it retried, and what it did when the
// model returned prose around the JSON. All of that is visible here.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export interface GenerateOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Retries on transient failures (429/5xx/network). Not on 4xx. */
  retries?: number;
  signal?: AbortSignal;
}

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
    super(message);
    this.name = "GeminiError";
  }
}

function apiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set on this project");
  return key;
}

export function defaultModel(): string {
  return Deno.env.get("GEMINI_MODEL") ?? "gemini-3.1-pro-preview";
}

/** Strips markdown fences and any prose around the JSON body. Models wrap JSON
 *  in ```json blocks often enough that failing on it is not acceptable. */
export function extractJson(text: string): string {
  let t = text.trim();

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();

  // Fall back to the outermost braces, which survives a stray leading sentence.
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first !== -1 && last > first) t = t.slice(first, last + 1);

  return t.trim();
}

async function callOnce(
  system: string,
  user: string,
  opts: GenerateOptions,
): Promise<string> {
  const model = opts.model ?? defaultModel();
  const url = `${ENDPOINT}/${model}:generateContent?key=${apiKey()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 8192,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    // 429 and 5xx are worth another go; a 400 means our request is wrong and
    // repeating it just burns time.
    const retryable = res.status === 429 || res.status >= 500;
    throw new GeminiError(`Gemini ${res.status}: ${detail}`, res.status, retryable);
  }

  const body = await res.json();

  const blocked = body?.promptFeedback?.blockReason;
  if (blocked) throw new GeminiError(`Gemini refused the prompt: ${blocked}`);

  const candidate = body?.candidates?.[0];
  const finish = candidate?.finishReason;
  if (finish && finish !== "STOP") {
    // MAX_TOKENS here means the file was cut mid-way; surfacing it beats
    // handing a truncated file to the validator.
    throw new GeminiError(`Gemini stopped early: ${finish}`, undefined, finish === "MAX_TOKENS");
  }

  const text = candidate?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new GeminiError("Gemini returned an empty response");

  return text;
}

/** One call, returning parsed JSON of the shape the caller expects. */
export async function generateJson<T>(
  system: string,
  user: string,
  opts: GenerateOptions = {},
): Promise<T> {
  const attempts = (opts.retries ?? 2) + 1;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await callOnce(system, user, opts);
      try {
        return JSON.parse(extractJson(raw)) as T;
      } catch {
        // Bad JSON is worth one more attempt — it is usually a stray token
        // rather than a stable failure.
        throw new GeminiError(`Gemini returned unparseable JSON: ${raw.slice(0, 200)}`, undefined, true);
      }
    } catch (e) {
      lastError = e;
      const retryable = e instanceof GeminiError ? e.retryable : true;
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new GeminiError(String(lastError));
}
