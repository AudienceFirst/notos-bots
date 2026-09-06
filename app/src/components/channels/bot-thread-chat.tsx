// NOTOS (stap 10): het gesprek met één Bot op één thread (de /bot-pagina), op onze eigen
// AG-UI-laag in plaats van react-core's CopilotChat (5 september 2026).
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toAgentOptions } from "@/components/channels/composer";
import { ConversationView } from "@/components/channels/conversation-view";
import { transcriptMessages } from "@/components/channels/transcript-messages";
import { agentListQueryOptions } from "@/lib/agents/queries";
import { useActiveBot } from "@/lib/copilot/active-bot";
import { ConversationProvider } from "@/lib/copilot/conversation";
import { afterMs, joinWithin } from "@/lib/copilot/join-thread";
import { repairUnansweredToolCalls } from "@/lib/copilot/repair-history";
import { stoppedReason } from "@/lib/copilot/stopped-turn";
import { readThreadMessages } from "@/lib/copilot/thread-messages";
import { newId } from "@/lib/new-id";
import { useSkillCommands } from "@/lib/plugins/skill-commands";
import { useAgent, useBotsCore } from "@/notos/agui/react";

const JOIN_DEADLINE_MS = 1500;

/**
 * The same shape as a channel's chat, minus the channel: no activity rows, no busy flag for a
 * roster, no seed from the home screen. History comes from the thread store; a run already going
 * on this thread is joined first, so a page reload mid-answer shows the rest of the answer.
 */
export function BotThreadChat({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  const core = useBotsCore();
  const { data: profiles } = useQuery(agentListQueryOptions());
  // Who this thread is with, for the empty state; the route already checked the id is known.
  const profile = profiles?.find((candidate) => candidate.id === agentId);
  const { agent } = useAgent({
    agentId: `bot:${agentId}`,
    runtimeAgentId: agentId,
    threadId,
  });
  const [restoring, setRestoring] = useState(true);
  const [unreadable, setUnreadable] = useState(0);
  const [stopped, setStopped] = useState<string | null>(null);
  const awaitingReply = useRef(false);

  useActiveBot(agentId);
  const skillCommands = useSkillCommands(agentId);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        await joinWithin({
          connect: core.connectAgent({ agent }),
          deadline: afterMs(JOIN_DEADLINE_MS),
          detach: () => agent.detachActiveRun(),
        });
      } catch {
        // Nothing to join, or the join could not be told apart from a fresh thread: fine.
      }
      try {
        const stored = await readThreadMessages(threadId, agentId);
        const known = new Set(agent.messages.map((message) => message.id));
        const ahead =
          stored.messages.length > agent.messages.length &&
          agent.messages.every((message) => known.has(message.id));
        if (live && stored.messages.length > 0 && ahead) {
          agent.setMessages(stored.messages);
        }
        if (live) setUnreadable(stored.unreadable);
      } finally {
        if (live) setRestoring(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [core, agent, threadId, agentId]);

  useEffect(() => {
    const subscription = agent.subscribe({
      onRunInitialized: () => setStopped(null),
      onRunErrorEvent: ({ event }) => {
        if (awaitingReply.current) setStopped(stoppedReason(event?.message));
        awaitingReply.current = false;
      },
      onRunFailed: ({ error }) => {
        if (awaitingReply.current) setStopped(stoppedReason(error));
        awaitingReply.current = false;
      },
      onRunFinalized: () => {
        awaitingReply.current = false;
      },
    });
    return () => subscription.unsubscribe();
  }, [agent]);

  const say = useCallback(
    async (text: string, skillInstructions: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setStopped(null);
      awaitingReply.current = true;
      for (const instruction of skillInstructions) {
        agent.addMessage({ content: instruction, id: newId(), role: "system" });
      }
      agent.addMessage({ content: trimmed, id: newId(), role: "user" });
      const repaired = repairUnansweredToolCalls(agent.messages);
      if (repaired !== agent.messages) {
        agent.setMessages(repaired as typeof agent.messages);
      }
      await core.runAgent({ agent });
    },
    [agent, core],
  );

  const askFromComponent = useCallback(
    (text: string) => {
      void say(text);
    },
    [say],
  );

  return (
    <ConversationProvider ask={askFromComponent}>
      <ConversationView
        agents={toAgentOptions(profiles, [agentId])}
        autoFocus
        bot={profile}
        busy={agent.isRunning}
        commands={skillCommands}
        messages={transcriptMessages(agent.messages, null)}
        notice={
          unreadable > 0 ? (
            <p className="pb-2 text-sm text-muted-foreground" role="status">
              {unreadable === 1
                ? "One earlier message could not be read and is not shown."
                : `${unreadable} earlier messages could not be read and are not shown.`}
            </p>
          ) : null
        }
        onStop={() => {
          awaitingReply.current = false;
          core.stopAgent({ agent });
        }}
        onSubmit={async (draft) => {
          const skillInstructions = draft.commandIds
            .map(
              (id) =>
                skillCommands.find((command) => command.id === id)?.prompt,
            )
            .filter((instruction): instruction is string =>
              Boolean(instruction),
            );
          await say(draft.text, skillInstructions);
        }}
        pending={agent.isRunning}
        queueWhileBusy
        restoring={restoring}
        stoppable={agent.isRunning}
        stopped={stopped ?? undefined}
      />
    </ConversationProvider>
  );
}
