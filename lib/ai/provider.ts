import "server-only";
import { AnthropicProvider } from "./providers/anthropic";
import { OpenAIProvider } from "./providers/openai";
import { GeminiProvider } from "./providers/gemini";

/**
 * Provider abstraction. Nothing outside `lib/ai` talks to a model vendor.
 *
 * Selection (first match wins):
 *   1. AI_PROVIDER=anthropic|openai|gemini|offline
 *   2. whichever key is present: ANTHROPIC_API_KEY → OPENAI_API_KEY → GEMINI_API_KEY
 *   3. null — callers fall back to their offline behaviour
 */
export * from "./types";
import type { AIProvider } from "./types";

let cached: AIProvider | null | undefined;

export function getProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  const pick = (id: string | undefined) => {
    switch (id) {
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY ? new AnthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL) : null;
      case "openai":
        return process.env.OPENAI_API_KEY ? new OpenAIProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL) : null;
      case "gemini":
        return process.env.GEMINI_API_KEY ? new GeminiProvider(process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL) : null;
      default:
        return null;
    }
  };
  if (forced === "offline") cached = null;
  else if (forced) cached = pick(forced);
  else cached = pick("anthropic") ?? pick("openai") ?? pick("gemini");
  return cached;
}

export function providerStatus() {
  const p = getProvider();
  return p ? { online: true as const, provider: p.id, model: p.model } : { online: false as const, provider: "offline", model: null };
}

/** Parse a JSON object out of a model reply, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object in reply");
  return JSON.parse(body.slice(start, end + 1));
}
