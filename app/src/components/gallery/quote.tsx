import { z } from "zod";
import { tr, useT } from "@/i18n";
import type { GalleryComponent } from "@/lib/copilot/gallery-registry";
import { GalleryFrame } from "./frame";

export const QuoteCardProps = z.object({
  quote: z
    .string()
    .describe("The quotation itself, without surrounding quote marks"),
  attribution: z
    .string()
    .describe(
      "Who said or wrote it, e.g. 'Grace Hopper' or 'the 2026 annual report'",
    ),
  context: z
    .string()
    .optional()
    .describe(
      "One short line of context: where it is from, or why it matters here",
    ),
});

type QuoteArgs = z.infer<typeof QuoteCardProps>;

export function QuoteCard({ quote, attribution, context }: Partial<QuoteArgs>) {
  const t = useT();
  if (!quote) {
    return (
      <GalleryFrame title={t("components.quote.title")}>
        <p className="text-sm text-muted-foreground">
          {t("components.quote.nothing")}
        </p>
      </GalleryFrame>
    );
  }

  return (
    <GalleryFrame caption={context} title={t("components.quote.title")}>
      <blockquote className="border-l-2 border-border pl-4">
        <p className="text-sm leading-relaxed">{quote}</p>
        {/*
         * The attribution stands on its own line. It used to be written as ", the expense policy",
         * which put a stray comma at the start of a line with nothing before it to attach to.
         */}
        {attribution ? (
          <footer className="mt-2 text-xs text-muted-foreground">
            {attribution}
          </footer>
        ) : null}
      </blockquote>
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
    name: "showQuote",
    get title() {
      return tr("components.quote.galleryTitle");
    },
    kind: "card",
    description:
      "Show a quotation with its attribution. Use when the exact words matter, something a person said, or a line from a document you were given.",
    parameters: QuoteCardProps,
    Component: QuoteCard as GalleryComponent["Component"],
    get preview() {
      return {
        quote: tr("components.quote.previewQuote"),
        attribution: tr("components.quote.previewAttribution"),
        context: tr("components.quote.previewContext"),
      };
    },
    confirmation: "The quotation is now on screen for the person.",
  },
];
