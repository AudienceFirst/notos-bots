import { useQuery } from "@tanstack/react-query";
import Avatar from "boring-avatars";
import { memo } from "react";
import { type AgentProfile, agentListQueryOptions } from "@/lib/agents/queries";
import { cn } from "@/lib/utils";

/** Stable selector, so the map only rebuilds when the roster changes (the bot-names idiom). */
const toSeeds = (agents: AgentProfile[]): Map<string, string> =>
  new Map(agents.map((agent) => [agent.id, agent.avatarSeed]));

/**
 * ONE FACE PER BOT, EVERYWHERE. The profile beside a conversation and the Bot dialog draw from
 * `avatarSeed`, which a tenant package may set to something other than the id; this component drew
 * from the id, so the same Bot wore one face in the header and the sidebar and another in the panel
 * next to it, which reads as two identities. The roster is already in the cache on every screen
 * that draws this, so the lookup costs nothing; the id stays the fallback for a participant the
 * roster does not list (deleted, or hidden from you), which is also what the server falls back to.
 */
function useAvatarSeeds(): (participantId: string) => string {
  const { data: seeds } = useQuery({
    ...agentListQueryOptions(),
    select: toSeeds,
  });
  return (participantId) => seeds?.get(participantId) ?? participantId;
}

/**
 * Memoized roster avatar. Row updates usually change preview/timestamp only, and
 * `use-channel-events` preserves participant id arrays for unchanged rows.
 *
 * `size-full` opts the generated SVG out of ancestor icon selectors such as
 * `[&_svg:not([class*='size-'])]:size-4`.
 *
 * `typing` overlays a working indicator at the bottom-right — three bouncing dots, so a channel
 * whose agent is mid-turn reads as busy from the roster without moving the row's layout.
 */
export const ChannelAvatar = memo(function ChannelAvatar({
  participantIds,
  size = 32,
  typing = false,
}: {
  participantIds: string[];
  size?: number;
  typing?: boolean;
}) {
  const channelSize = participantIds?.length;
  const seedFor = useAvatarSeeds();

  const avatar =
    channelSize === 1 ? (
      <Avatar
        className="size-full"
        name={seedFor(participantIds[0])}
        size={size}
      />
    ) : (
      <div className="flex flex-row items-center size-full">
        {participantIds.slice(0, 3).map((c, i, shown) => (
          <div
            className="shrink-0 border-2 border-sidebar rounded-full flex items-center justify-center"
            key={c}
            style={{
              height: size / (shown.length / 2),
              width: size / (shown.length / 2),
              transform: `translateX(${i * -75}%)`,
            }}
          >
            <Avatar
              className="size-full"
              name={seedFor(c)}
              size={size / (shown.length / 2)}
            />
          </div>
        ))}
      </div>
    );

  return (
    <div className="relative" style={{ height: size, width: size }}>
      {avatar}
      {typing ? <TypingBadge /> : null}
    </div>
  );
});

/**
 * Three bouncing dots in a small badge, ringed in the sidebar's own colour so it sits on the
 * avatar as a badge rather than floating over it. The staggered negative delays start each dot at
 * a different point in the same bounce, which is what makes the three read as one wave.
 */
function TypingBadge() {
  return (
    <div className="absolute -bottom-0.5 -right-0.5 flex items-center gap-0.5 rounded-full bg-sidebar p-0.5 ring-2 ring-sidebar">
      <span className="sr-only">Working…</span>
      <Dot className="[animation-delay:-0.3s]" />
      <Dot className="[animation-delay:-0.15s]" />
      <Dot />
    </div>
  );
}

function Dot({ className }: { className?: string }) {
  return (
    <span
      className={cn("size-1 rounded-full bg-primary animate-bounce", className)}
    />
  );
}
