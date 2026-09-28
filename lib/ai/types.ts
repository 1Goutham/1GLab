/** Shared AI types — imported by providers and the provider registry. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type GenerateRequest = {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  /** Ask for a JSON object back (providers enforce it where they can). */
  json?: boolean;
  signal?: AbortSignal;
};

export interface AIProvider {
  readonly id: "anthropic" | "openai" | "gemini";
  readonly model: string;
  /** Streams text deltas. Throws AIUnavailableError on transport/auth failures. */
  stream(req: GenerateRequest): AsyncIterable<string>;
  complete(req: GenerateRequest): Promise<string>;
}

export class AIUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "AIUnavailableError";
  }
}

