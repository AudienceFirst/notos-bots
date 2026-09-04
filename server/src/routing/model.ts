// NOTOS: de router en de skill-keuze praten met het model via de AI SDK op Vertex, niet via /chat/completions met een sleutel (stap 3).
import type { ModelFactory } from "../notos/model";
import { createTextCompleter } from "../notos/model";

/**
 * One text answer for one prompt, on the deployment's default model.
 *
 * Upstream POSTed to an OpenAI-compatible `/chat/completions` with a stored key. Here the same
 * factory the Bots run on answers, so the router and the Bots can never end up on different
 * credentials, and there is no key to store or rotate.
 */
export function createModelCompleter(deps: {
  modelFor: ModelFactory;
  timeoutMs?: number;
}): (prompt: string) => Promise<string> {
  const complete = createTextCompleter(deps.modelFor, {
    // Gemini 2.5 Pro takes a few seconds even on a short prompt; the first call also fetches an ADC token.
    timeoutMs: deps.timeoutMs ?? 30_000,
  });
  return (prompt) => complete(prompt);
}
