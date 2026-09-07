// NOTOS: de kaart waarmee een Bot om een mens vraagt en blijft wachten (Mitch, 7 september 2026).
//
// Waarom dit een eigen component is en niet gewoon een zin in de chat: een Bot die vastloopt op
// iets dat alleen een mens kan doen (een tweestapscode, een login bij een leverancier, een vinkje
// in een systeem waar hij niet bij mag) heeft twee dingen nodig die tekst niet geeft. Hij moet de
// beurt vasthouden tot het gedaan is, en hij moet daarna weten óf het gedaan is of overgeslagen.
// Als hij het in tekst vraagt, loopt de beurt af, en wat er daarna gebeurt weet niemand meer.
//
// Vandaar `kind: "decision"`: het antwoord van de mens ís het resultaat van de aanroep, en de run
// gaat op dat antwoord verder.

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { tr, useT } from "@/i18n";
import type { GalleryComponent } from "@/lib/copilot/gallery-registry";
import { Badge, GalleryFrame } from "./frame";

type Waiting<T> =
  | {
      status: "inProgress";
      args: Partial<T>;
      respond: undefined;
      result: undefined;
    }
  | {
      status: "executing";
      args: T;
      respond: (result: unknown) => Promise<void>;
      result: undefined;
    }
  | { status: "complete"; args: T; respond: undefined; result: string };

export const HandoffCardProps = z.object({
  title: z.string().describe("What you need the person to do, in a few words"),
  reason: z
    .string()
    .describe(
      "Why you cannot do it yourself, in one sentence, e.g. the site asked for a code sent to their phone",
    ),
  steps: z
    .array(z.string())
    .optional()
    .describe("The steps they should take, shortest first. Omit if obvious."),
  where: z
    .string()
    .optional()
    .describe(
      "Where they should do it: a web address, or the name of the system. Shown as a link when it is a URL.",
    ),
});

type HandoffArgs = z.infer<typeof HandoffCardProps>;

export function HandoffCard(props: Waiting<HandoffArgs> & { name?: string }) {
  const t = useT();
  const { args, status, respond } = props;
  const [sending, setSending] = useState<"done" | "skipped" | null>(null);

  const answer = async (outcome: "done" | "skipped") => {
    if (!respond) return;
    setSending(outcome);
    await respond({ outcome });
  };

  if (status === "inProgress") {
    return (
      <GalleryFrame title={t("components.handoff.title")}>
        <p className="text-muted-foreground text-sm">
          {t("components.handoff.preparing")}
        </p>
      </GalleryFrame>
    );
  }

  const link = args.where?.startsWith("https://") ? args.where : null;

  return (
    <GalleryFrame title={t("components.handoff.title")}>
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-medium text-sm">{args.title}</p>
          <p className="mt-1 text-muted-foreground text-sm text-pretty">
            {args.reason}
          </p>
        </div>

        {args.steps && args.steps.length > 0 ? (
          <ol className="ml-4 list-decimal space-y-1 text-sm">
            {args.steps.map((step) => (
              <li className="text-pretty" key={step}>
                {step}
              </li>
            ))}
          </ol>
        ) : null}

        {args.where ? (
          <p className="text-sm">
            <span className="text-muted-foreground">
              {t("components.handoff.where")}{" "}
            </span>
            {link ? (
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href={link}
                rel="noreferrer"
                target="_blank"
              >
                {args.where}
              </a>
            ) : (
              args.where
            )}
          </p>
        ) : null}

        {status === "complete" ? (
          <Badge>
            {props.result === "skipped"
              ? t("components.handoff.wasSkipped")
              : t("components.handoff.wasDone")}
          </Badge>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={sending !== null}
              onClick={() => answer("done")}
              size="sm"
            >
              {sending === "done"
                ? t("components.handoff.continuing")
                : t("components.handoff.done")}
            </Button>
            <Button
              disabled={sending !== null}
              onClick={() => answer("skipped")}
              size="sm"
              variant="outline"
            >
              {t("components.handoff.skip")}
            </Button>
          </div>
        )}
        {status !== "complete" ? (
          /*
           * Wat "overslaan" betekent staat er letterlijk bij. Zonder die regel leest de knop als
           * "stoppen", terwijl de Bot gewoon doorgaat zonder deze stap, en dat is een ander besluit.
           */
          <p className="text-muted-foreground text-xs text-pretty">
            {t("components.handoff.skipExplained")}
          </p>
        ) : null}
      </div>
    </GalleryFrame>
  );
}

export const GALLERY: GalleryComponent[] = [
  {
    name: "askHandoff",
    get title() {
      return tr("components.handoff.galleryTitle");
    },
    kind: "decision",
    description:
      "Ask the person to do one step you cannot do yourself, and WAIT until they say it is done. Use when something blocks you that only a human can clear: a code sent to their phone, a login or consent screen at a vendor, a switch in a system you have no access to. You are given whether they did it or skipped it. Do not use this to ask a question or to get a decision; use askChoice or askApproval for those.",
    parameters: HandoffCardProps,
    Component: HandoffCard as GalleryComponent["Component"],
    get preview() {
      return {
        status: "executing",
        args: {
          title: tr("components.handoff.previewTitle"),
          reason: tr("components.handoff.previewReason"),
          steps: [
            tr("components.handoff.previewStepOne"),
            tr("components.handoff.previewStepTwo"),
          ],
          where: "https://business.facebook.com",
        },
        respond: async () => {},
      };
    },
  },
];
