const STORAGE_KEY = "ml_playground_ai_key";
const ENABLED_KEY = "ml_playground_ai_enabled";

export type LLMSource = "user-key" | "server-key" | "static";

export interface LLMResponse {
  text: string;
  source: LLMSource;
}

interface LLMProvider {
  ask(prompt: string): Promise<string>;
}

/** Calls Groq directly using the key the user entered in the UI. */
class UserKeyProvider implements LLMProvider {
  constructor(private apiKey: string) {}

  async ask(prompt: string): Promise<string> {
    const res = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          max_tokens: 512,
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );
    if (!res.ok) throw new Error(`User-key LLM failed: ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content as string;
  }
}

/** Routes through our FastAPI backend, which holds the server-side API key. */
class BackendProvider implements LLMProvider {
  async ask(prompt: string): Promise<string> {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${base}/api/llm/ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.ok) throw new Error(`Server-key LLM failed: ${res.status}`);
    const data = await res.json();
    return data.text as string;
  }
}

function getUserProvider(): LLMProvider | null {
  if (typeof window === "undefined") return null;
  const enabled = localStorage.getItem(ENABLED_KEY) === "true";
  const key = localStorage.getItem(STORAGE_KEY) ?? "";
  if (!enabled || !key) return null;
  return new UserKeyProvider(key);
}

const _backendProvider = new BackendProvider();

/**
 * Single entry point for all AI calls in the app.
 *
 * Priority chain:
 *   1. User's own API key (direct browser → Anthropic)
 *   2. Server-side key   (browser → our backend → Anthropic)
 *   3. Static fallback   (no network call)
 */
export async function ask(
  prompt: string,
  staticFallback: string,
  onWarn?: (msg: string) => void
): Promise<LLMResponse> {
  const userProvider = getUserProvider();

  if (userProvider) {
    try {
      return { text: await userProvider.ask(prompt), source: "user-key" };
    } catch {
      onWarn?.("Your API key failed - falling back to server key.");
    }
  }

  try {
    return { text: await _backendProvider.ask(prompt), source: "server-key" };
  } catch {
    onWarn?.("AI unavailable - showing static content.");
    return { text: staticFallback, source: "static" };
  }
}
