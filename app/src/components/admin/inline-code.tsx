import { Fragment } from "react";

/**
 * A translated sentence with identifiers in it, drawn with the identifiers as `<code>`.
 *
 * Dictionary strings are plain text, and a sentence such as "set `COMPUTER_SUPERVISOR_URL` to…"
 * has to be one string per language rather than a row of fragments stitched around a `<code>`,
 * because the words around an identifier land in a different order in Dutch than in English. The
 * backticks mark the identifiers, as they do in Markdown; nothing else is interpreted.
 */
export function InlineCode({ text }: { text: string }) {
  const parts = text.split(/`([^`]+)`/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional and never reorder.
          <code key={index}>{part}</code>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts are positional and never reorder.
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
