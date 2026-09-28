import { AIUnavailableError, type AIProvider, type GenerateRequest } from "../types";
import { readSSE } from "./sse";

/** Google Gemini over REST (streamGenerateContent with SSE). */
export class GeminiProvider implements AIProvider {
  readonly id = "gemini" as const;
  readonly model: string;

  constructor(private apiKey: string, model?: string) {
    this.model = model || "gemini-2.5-flash";
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`;
    const res = await fetch(url, {
      method: "POST",
      signal: req.signal,
      headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 4000,
          ...(req.json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    }).catch((e) => {
      throw new AIUnavailableError("Gemini unreachable", e);
    });
    if (!res.ok) throw new AIUnavailableError(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    for await (const data of readSSE(res)) {
      try {
        const parts = JSON.parse(data).candidates?.[0]?.content?.parts as { text?: string }[] | undefined;
        for (const p of parts ?? []) if (p.text) yield p.text;
      } catch {
        /* ignore */
      }
    }
  }

  async complete(req: GenerateRequest) {
    let out = "";
    for await (const c of this.stream(req)) out += c;
    return out;
  }
}
