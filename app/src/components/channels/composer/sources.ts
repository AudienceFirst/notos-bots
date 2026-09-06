import { tr } from "@/i18n";
import type { CommandOption } from "./draft";

/**
 * Placeholder slash commands.
 *
 * Channels can carry seeded suggested prompts, but nothing serves them to the browser
 * yet, `AgentChannel` currently stops at `agentIds`. These stand in so `/` is exercisable, and
 * `commands` is a plain prop on `<Composer>`, so replacing them is a call site change.
 *
 * Agents are deliberately not placeheld: `agentListQueryOptions` already returns the real roster,
 * so the `@` source is wired to it at the call sites.
 */
export const PLACEHOLDER_COMMANDS: CommandOption[] = [
  {
    id: "summarize",
    name: "summarize",
    // Getters, so the menu and the expanded text follow the interface language at render time.
    get description() {
      return tr("channels.sources.summarizeDescription");
    },
    kind: "prompt",
    get prompt() {
      return tr("channels.sources.summarizePrompt");
    },
  },
];
