import { IconX } from "@tabler/icons-react";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A main pane with a detail pane that slides in beside it.
 *
 * The open/closed state belongs to the caller, in practice a search parameter, so opening a detail
 * is a real navigation: it survives a reload, it can be linked to, and Back closes it.
 *
 * The pane is animated by width and the content inside it is given that width outright, so the
 * content is laid out once and the pane reveals it.
 */

const ANIMATION_DURATION_SECONDS = 0.3;
const DEFAULT_DETAIL_WIDTH = 400;

/**
 * The content overlaps the tail of the pane rather than following it.
 *
 * Delaying content slightly but ending with the pane keeps the reveal as one motion.
 */
const CONTENT_ENTRANCE_SECONDS = 0.18;
const CONTENT_ENTRANCE_DELAY_SECONDS = 0.12;
const CONTENT_ENTRANCE_OFFSET = "translateY(8px)";

export function DetailPanel({
  open,
  onClose,
  title,
  detail,
  detailWidth = DEFAULT_DETAIL_WIDTH,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Rendered at the left of the detail pane's header row, beside the close button. */
  title?: ReactNode;
  detail?: ReactNode;
  /** Open width of the detail pane, in pixels. */
  detailWidth?: number;
  children: ReactNode;
}) {
  // Reduced motion keeps the fade, which explains the change, and drops the movement.
  const shouldReduceMotion = useReducedMotion();
  /*
   * Below md the pane is the whole screen, over the main column rather than beside it.
   *
   * Beside it, a 400px pane on a 420px phone left the page a 20px column of single letters and, in
   * a channel, let the composer's send button poke through the pane. There is no "beside" at that
   * width: the pane takes the viewport, the main column is hidden until it closes, and the width
   * animation is skipped because there is nothing left on screen to slide past.
   */
  const isMobile = useIsMobile();
  const fullscreen = isMobile && open;

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn("flex flex-1 min-w-0 flex-col", fullscreen && "hidden")}
      >
        {children}
      </div>
      <motion.div
        animate={{ width: open ? (isMobile ? "100%" : detailWidth) : 0 }}
        className={cn(
          "shrink-0 overflow-hidden",
          fullscreen && "fixed inset-0 z-40",
        )}
        // No entry animation on first paint: URL-opened panels should appear as initial state.
        initial={false}
        transition={{
          duration:
            shouldReduceMotion || isMobile ? 0 : ANIMATION_DURATION_SECONDS,
          ease: EASE_OUT,
        }}
      >
        <div
          className={cn(
            "flex h-full flex-col bg-sidebar",
            !fullscreen && "border-l border-border",
          )}
          style={{ width: fullscreen ? "100%" : detailWidth }}
        >
          {/* Rendered for the whole animation, so the way out is available immediately. */}
          <div className="h-12 shrink-0 sticky top-0 flex flex-row items-center justify-between px-2 gap-2">
            <div className="flex min-w-0 w-full items-center gap-1.5">
              {title}
            </div>
            <div className="flex flex-row gap-1.5">
              <Button onClick={onClose} variant="ghost" size="icon">
                <IconX className="size-4.5" />
              </Button>
            </div>
          </div>
          {/*
           * Unmount while closed so dismissed form state and detail queries do not remain active.
           */}
          {open ? (
            <motion.div
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              className="flex-1 min-h-0 overflow-y-auto"
              initial={{
                opacity: 0,
                transform: shouldReduceMotion
                  ? "none"
                  : CONTENT_ENTRANCE_OFFSET,
              }}
              transition={{
                delay: shouldReduceMotion ? 0 : CONTENT_ENTRANCE_DELAY_SECONDS,
                duration: CONTENT_ENTRANCE_SECONDS,
                ease: EASE_OUT,
              }}
            >
              {detail}
            </motion.div>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
