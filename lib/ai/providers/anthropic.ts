import Anthropic from "@anthropic-ai/sdk";
import { AIUnavailableError, type AIProvider, type GenerateRequest } from "../types";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  readonly model: string;
  private client: Anthropic;
  private effort: Effort;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-opus-5";
    // Mentor chat is conversational: medium effort keeps it quick and affordable.
    this.effort = (process.env.ANTHROPIC_EFFORT as Effort) || "medium";
  }

  private params(req: GenerateRequest) {
    return {
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      system: req.system + (req.json ? "\n\nRespond with a single JSON object and nothing else." : ""),
      messages: req.messages,
      output_config: { effort: this.effort },
    };
  }

  async *stream(req: GenerateRequest): AsyncIterable<string> {
    try {
      const stream = this.client.messages.stream(this.params(req), { signal: req.signal });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") yield "\n\nI can't help with that one — let's get back to the mission.";
    } catch (err) {
      if (err instanceof Anthropic.APIError) throw new AIUnavailableError(`Anthropic ${err.status ?? ""}: ${err.message}`, err);
      throw err;
    }
  }

  async complete(req: GenerateRequest): Promise<string> {
    let out = "";
    for await (const chunk of this.stream(req)) out += chunk;
    return out;
  }
}
