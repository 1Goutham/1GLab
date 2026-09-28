import { AIUnavailableError, type AIProvider, type GenerateRequest } from "../types";
import { readSSE } from "./sse";

/** OpenAI Chat Completions over REST (streaming). Also works with compatible gateways via OPENAI_BASE_URL. */
export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  readonly model: string;
  private baseUrl: string;

  constructor(private apiKey: string, model?: string) {
    this.model = model || "gpt-5-mini";
    this.baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      signal: req.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        stream: true,
        max_completion_tokens: req.maxTokens ?? 4000,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        messages: [{ role: "system", content: req.system }, ...req.messages],
      }),
    }).catch((e) => {
      throw new AIUnavailableError("OpenAI unreachable", e);
    });
    if (!res.ok) throw new AIUnavailableError(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    for await (const data of readSSE(res)) {
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) yield delta as string;
      } catch {
        /* keep-alive or partial line */
      }
    }
  }

  async complete(req: GenerateRequest) {
    let out = "";
    for await (const c of this.stream(req)) out += c;
    return out;
  }
}
