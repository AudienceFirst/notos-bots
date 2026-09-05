// NOTOS (stap 10): de React-kant van de eigen AG-UI-laag: provider en hooks met dezelfde namen
// als react-core had, zodat de schermen alleen hun import wisselen (5 september 2026).
import type { ActivityMessage, ToolCall, ToolMessage } from "@ag-ui/core";
import type { z } from "zod";
import * as React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  BotsCore,
  type BotsCoreConfig,
  type FrontendTool,
  parseArguments,
  type RuntimeAgent,
  type ToolRenderProps,
  type ToolStatus,
} from "./core";

export type { FrontendTool, RuntimeAgent, ToolRenderProps, ToolStatus };

const CoreContext = createContext<BotsCore | null>(null);

export function BotsCoreProvider({
  children,
  ...config
}: BotsCoreConfig & { children: React.ReactNode }) {
  const headersRef = useRef(config.headers);
  headersRef.current = config.headers;
  // One core per runtime URL; the headers function is read through a ref so a token refresh
  // never rebuilds the core (which would drop every agent's messages).
  const core = useMemo(
    () =>
      new BotsCore({
        runtimeUrl: config.runtimeUrl,
        headers: () => headersRef.current(),
        ...(config.credentials ? { credentials: config.credentials } : {}),
      }),
    [config.runtimeUrl, config.credentials],
  );
  return <CoreContext.Provider value={core}>{children}</CoreContext.Provider>;
}

export function useBotsCore(): BotsCore {
  const core = useContext(CoreContext);
  if (!core) {
    throw new Error("useBotsCore needs a BotsCoreProvider above it.");
  }
  return core;
}

/** Re-renders when the core's registrations or tool executions change. */
function useCoreRevision(core: BotsCore): number {
  return useSyncExternalStore(
    (listener) => core.subscribe(listener),
    () => core.revision,
    () => core.revision,
  );
}

/**
 * The agent for a Bot on a thread. Re-renders the caller on message changes, coalesced to one
 * per animation frame so a streaming answer does not render per token, and on run start and end.
 * `isReady` is always true: our runtime has no `/info` handshake to wait for.
 */
export function useAgent({
  agentId,
  runtimeAgentId,
  threadId,
}: {
  agentId: string;
  runtimeAgentId?: string;
  threadId: string;
}): { agent: RuntimeAgent; isReady: true } {
  const core = useBotsCore();
  const agent = useMemo(
    () =>
      core.getAgent({
        agentId,
        ...(runtimeAgentId ? { runtimeAgentId } : {}),
        threadId,
      }),
    [core, agentId, runtimeAgentId, threadId],
  );
  const [, bump] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    let frame: number | null = null;
    const later = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        bump();
      });
    };
    const now = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      bump();
    };
    const subscription = agent.subscribe({
      onMessagesChanged: later,
      onRunInitialized: now,
      onRunStartedEvent: now,
      onRunFinalized: now,
      onRunFailed: now,
      onRunErrorEvent: now,
    });
    return () => {
      subscription.unsubscribe();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [agent]);
  return { agent, isReady: true };
}

function useRegistration(
  kind: "tool" | "decision" | "render-only",
  tool: FrontendTool<Record<string, unknown>>,
  render: ((props: ToolRenderProps) => unknown) | undefined,
) {
  const core = useBotsCore();
  const latest = useRef({ tool, render });
  latest.current = { tool, render };
  useEffect(
    () =>
      core.register({
        name: tool.name,
        ...(tool.agentId ? { agentId: tool.agentId } : {}),
        kind,
        get: () => ({
          tool: latest.current.tool,
          ...(latest.current.render ? { render: latest.current.render } : {}),
        }),
      }),
    [core, kind, tool.name, tool.agentId],
  );
}

/** A tool the browser runs when the Bot calls it, drawn in the transcript by `render`. */
export function useFrontendTool<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  tool: FrontendTool<T> & {
    render?: (props: ToolRenderProps<T>) => React.ReactNode;
  },
  _deps?: ReadonlyArray<unknown>,
): void {
  const { render, ...rest } = tool;
  useRegistration(
    "tool",
    rest as unknown as FrontendTool<Record<string, unknown>>,
    render as ((props: ToolRenderProps) => unknown) | undefined,
  );
}

/**
 * A decision: the Bot stops, the person answers through the rendered UI's `respond`, and the
 * answer goes back as the tool's result.
 */
export function useHumanInTheLoop<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  tool: Omit<FrontendTool<T>, "handler"> & {
    render: React.ComponentType<ToolRenderProps<T>>;
  },
  _deps?: ReadonlyArray<unknown>,
): void {
  const { render: Render, ...rest } = tool;
  const render = useCallback(
    (props: ToolRenderProps) => (
      <Render {...(props as unknown as ToolRenderProps<T>)} />
    ),
    [Render],
  );
  useRegistration(
    "decision",
    rest as unknown as FrontendTool<Record<string, unknown>>,
    render,
  );
}

/** How a server-side tool reads in the transcript. Registers nothing with the Bot. */
export function useRenderTool<
  T extends Record<string, unknown> = Record<string, unknown>,
>(
  config: {
    name: string;
    /** A zod schema names `T` for the renderer; a JSON schema leaves the arguments untyped. */
    parameters?: z.ZodType<T> | Record<string, unknown>;
    agentId?: string;
    render: (props: ToolRenderProps<T>) => React.ReactNode;
  },
  _deps?: ReadonlyArray<unknown>,
): void {
  const { render, ...rest } = config;
  useRegistration(
    "render-only",
    rest as unknown as FrontendTool<Record<string, unknown>>,
    render as unknown as (props: ToolRenderProps) => unknown,
  );
}

/** Draws a tool call with whatever was registered for its name; null when nothing was. */
export function useRenderToolCall(): (input: {
  toolCall: ToolCall;
  toolMessage?: ToolMessage;
}) => React.ReactElement | null {
  const core = useBotsCore();
  useCoreRevision(core);
  return useCallback(
    ({ toolCall, toolMessage }) => {
      const registration = core.find(toolCall.function.name);
      if (!registration) return null;
      const { tool, render } = registration.get();
      if (!render) return null;
      const { args } = parseArguments(toolCall.function.arguments);
      const status = core.statusOf(toolCall.id, toolMessage);
      const result =
        toolMessage === undefined
          ? undefined
          : typeof toolMessage.content === "string"
            ? toolMessage.content
            : JSON.stringify(toolMessage.content);
      const drawn = render({
        name: tool.name,
        description: tool.description ?? "",
        toolCallId: toolCall.id,
        ...(tool.agentId ? { agentId: tool.agentId } : {}),
        args,
        parameters: args,
        status,
        result,
        respond:
          registration.kind === "decision" && status === "executing"
            ? core.respondTo(toolCall.id)
            : undefined,
      });
      return React.isValidElement(drawn) ? drawn : null;
    },
    [core],
  );
}

/**
 * Activity messages (generative UI, MCP apps) have no renderer in this deployment: generative UI
 * is off and no MCP app is configured. Kept so the transcript's call site stays one line.
 */
export function useRenderActivityMessage(): {
  renderActivityMessage: (
    message: ActivityMessage,
  ) => React.ReactElement | null;
  findRenderer: (activityType: string) => null;
} {
  return useMemo(
    () => ({
      renderActivityMessage: () => null,
      findRenderer: () => null,
    }),
    [],
  );
}
