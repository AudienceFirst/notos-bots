import { z } from "zod";
import { tr, useT } from "@/i18n";
import type { GalleryComponent } from "@/lib/copilot/gallery-registry";
import { Badge, GalleryFrame, type Tone } from "./frame";

const tone = z
  .enum(["neutral", "positive", "caution", "negative"])
  .describe(
    "How this reads at a glance. Use negative and caution sparingly, for a refusal, a breach or a failure, not for anything merely notable",
  );

export const RecordCardProps = z.object({
  title: z.string().describe("What this record is, e.g. a person or an order"),
  subtitle: z
    .string()
    .optional()
    .describe("One line of context under the title"),
  status: z.string().optional().describe("A short status word, e.g. Approved"),
  statusTone: tone.optional(),
  fields: z
    .array(
      z.object({
        label: z.string(),
        value: z.string().describe("Already formatted for a person to read"),
      }),
    )
    .describe("The fields, in the order they should be read"),
});

export function RecordCard({
  title,
  subtitle,
  status,
  statusTone,
  fields: given,
}: Partial<z.infer<typeof RecordCardProps>>) {
  const fields = given ?? [];
  return (
    <GalleryFrame
      action={
        status ? <Badge tone={statusTone as Tone}>{status}</Badge> : undefined
      }
      caption={subtitle}
      title={title}
    >
      <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-4 gap-y-2 text-sm">
        {fields.map((field) => (
          <div className="contents" key={field.label}>
            <dt className="truncate text-muted-foreground">{field.label}</dt>
            {/* Field values wrap because truncation can hide the reported data. */}
            <dd className="min-w-0 break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
    </GalleryFrame>
  );
}

export const MetricsCardProps = z.object({
  title: z.string().describe("What these figures are about"),
  caption: z.string().optional(),
  metrics: z
    .array(
      z.object({
        label: z.string(),
        value: z
          .string()
          .describe("Already formatted, including any unit or currency"),
        change: z
          .string()
          .optional()
          .describe("The movement, e.g. '+12% on last month'"),
        changeTone: tone.optional(),
      }),
    )
    .max(6)
    .describe("Up to six figures. More than that wanted a table"),
});

export function MetricsCard({
  title,
  caption,
  metrics: given,
}: Partial<z.infer<typeof MetricsCardProps>>) {
  const metrics = given ?? [];
  return (
    <GalleryFrame caption={caption} title={title}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="truncate text-xs text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">
              {metric.value}
            </p>
            {metric.change ? (
              <p className="mt-0.5">
                <Badge tone={metric.changeTone as Tone}>{metric.change}</Badge>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </GalleryFrame>
  );
}

export const ChecklistCardProps = z.object({
  title: z.string().describe("What this list is"),
  caption: z.string().optional(),
  items: z
    .array(
      z.object({
        text: z.string(),
        done: z.boolean().describe("Whether this one is already finished"),
        note: z
          .string()
          .optional()
          .describe("A short aside, e.g. who it is waiting on"),
      }),
    )
    .describe("The items, in the order they should be done"),
});

/**
 * A read-only checklist. Interactive decisions use the approval components where answers go back
 * to the Bot.
 */
export function ChecklistCard({
  title,
  caption,
  items: given,
}: Partial<z.infer<typeof ChecklistCardProps>>) {
  const t = useT();
  const items = given ?? [];
  const done = items.filter((item) => item.done).length;
  return (
    <GalleryFrame
      action={
        <Badge
          tone={
            done === items.length && items.length > 0 ? "positive" : "neutral"
          }
        >
          {t("components.cards.countOf", { done, total: items.length })}
        </Badge>
      }
      caption={caption}
      title={title}
    >
      <ul className="space-y-2">
        {items.map((item) => (
          <li className="flex items-start gap-2.5 text-sm" key={item.text}>
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-[10px] ${
                item.done
                  ? "border-transparent bg-emerald-500 text-white"
                  : "border-border"
              }`}
            >
              {item.done ? "✓" : ""}
            </span>
            <span className="min-w-0">
              <span
                className={
                  item.done ? "text-muted-foreground line-through" : ""
                }
              >
                {item.text}
              </span>
              {item.note ? (
                <span className="block text-xs text-muted-foreground">
                  {item.note}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </GalleryFrame>
  );
}

export const NoticeCardProps = z.object({
  title: z.string().describe("The headline, in a few words"),
  body: z.string().describe("The explanation, in one or two sentences"),
  tone: tone.optional(),
  points: z
    .array(z.string())
    .optional()
    .describe("Supporting points, if there are any"),
});

export function NoticeCard({
  title,
  body,
  tone: noticeTone,
  points,
}: Partial<z.infer<typeof NoticeCardProps>>) {
  const t = useT();
  return (
    <GalleryFrame
      action={
        noticeTone && noticeTone !== "neutral" ? (
          <Badge tone={noticeTone}>
            {noticeTone === "positive"
              ? t("components.cards.tonePositive")
              : noticeTone === "caution"
                ? t("components.cards.toneCaution")
                : t("components.cards.toneNegative")}
          </Badge>
        ) : undefined
      }
      title={title}
    >
      <p className="text-sm">{body}</p>
      {points?.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          {points.map((entry) => (
            <li className="flex gap-2" key={entry}>
              <span aria-hidden="true">·</span>
              <span className="min-w-0">{entry}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </GalleryFrame>
  );
}

/*
 * `title` and `preview` are getters: both are what a person sees, so they follow the interface
 * language at the moment they are read. `description` and `confirmation` are read by the model and
 * stay as written.
 */
export const GALLERY: GalleryComponent[] = [
  {
    name: "showRecord",
    get title() {
      return tr("components.cards.recordTitle");
    },
    kind: "card",
    description:
      "Show one thing and its fields, an order, a person, a ticket. Use instead of describing a record in prose.",
    parameters: RecordCardProps,
    Component: RecordCard as GalleryComponent["Component"],
    get preview() {
      return {
        title: tr("components.cards.previewRecordTitle"),
        subtitle: tr("components.cards.previewRecordSubtitle"),
        status: tr("components.cards.previewRecordStatus"),
        fields: [
          {
            label: tr("components.cards.previewRecordAmountLabel"),
            value: tr("components.cards.previewRecordAmountValue"),
          },
          {
            label: tr("components.cards.previewRecordRaisedLabel"),
            value: tr("components.cards.previewRecordRaisedValue"),
          },
          {
            label: tr("components.cards.previewRecordOwnerLabel"),
            value: tr("components.cards.previewRecordOwnerValue"),
          },
        ],
      };
    },
    confirmation: "The record is now on screen for the person.",
  },
  {
    name: "showMetrics",
    get title() {
      return tr("components.cards.metricsTitle");
    },
    kind: "card",
    description:
      "Show up to six headline figures, each with an optional movement. Use for a summary somebody reads at a glance.",
    parameters: MetricsCardProps,
    Component: MetricsCard as GalleryComponent["Component"],
    get preview() {
      return {
        title: tr("components.cards.previewMetricsTitle"),
        metrics: [
          {
            label: tr("components.cards.previewMetricsRevenueLabel"),
            value: tr("components.cards.previewMetricsRevenueValue"),
            change: tr("components.cards.previewMetricsRevenueChange"),
            changeTone: "positive",
          },
          {
            label: tr("components.cards.previewMetricsDealsLabel"),
            value: "38",
          },
          {
            label: tr("components.cards.previewMetricsChurnLabel"),
            value: tr("components.cards.previewMetricsChurnValue"),
            change: tr("components.cards.previewMetricsChurnChange"),
            changeTone: "caution",
          },
        ],
      };
    },
    confirmation: "The figures are now on screen for the person.",
  },
  {
    name: "showChecklist",
    get title() {
      return tr("components.cards.checklistTitle");
    },
    kind: "card",
    description:
      "Show a list of things and which are done. Reporting only, the person cannot tick these, so do not use it to ask for anything.",
    parameters: ChecklistCardProps,
    Component: ChecklistCard as GalleryComponent["Component"],
    get preview() {
      return {
        title: tr("components.cards.previewChecklistTitle"),
        items: [
          { text: tr("components.cards.previewChecklistItem1"), done: true },
          { text: tr("components.cards.previewChecklistItem2"), done: true },
          {
            text: tr("components.cards.previewChecklistItem3"),
            done: false,
            note: tr("components.cards.previewChecklistItem3Note"),
          },
        ],
      };
    },
    confirmation: "The checklist is now on screen for the person.",
  },
  {
    name: "showNotice",
    get title() {
      return tr("components.cards.noticeTitle");
    },
    kind: "card",
    description:
      "Show a headline, a short explanation and optional supporting points. Use instead of writing several paragraphs of prose.",
    parameters: NoticeCardProps,
    Component: NoticeCard as GalleryComponent["Component"],
    get preview() {
      return {
        title: tr("components.cards.previewNoticeTitle"),
        body: tr("components.cards.previewNoticeBody"),
        tone: "caution",
        points: [
          tr("components.cards.previewNoticePoint1"),
          tr("components.cards.previewNoticePoint2"),
        ],
      };
    },
    confirmation: "The notice is now on screen for the person.",
  },
];
