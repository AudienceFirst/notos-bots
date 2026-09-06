// NOTOS (stap 10): voorbeeld van een browser-geschreven component in een eigen sandbox-iframe,
// in plaats van de generative-UI-renderer van react-core (5 september 2026).

import { useT } from "@/i18n";

/**
 * The author's markup, styles and functions in a frame that can run scripts and nothing else:
 * no same-origin access, no forms, no navigation. `window.__args` carries the sample arguments,
 * the same way the published component is handed its arguments at run time.
 */
export function SandboxPreview({
  html,
  css,
  jsFunctions,
  args,
}: {
  html: string;
  css: string;
  jsFunctions: string;
  args: unknown;
}) {
  const t = useT();
  const document = [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<style>html,body{margin:0;padding:12px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;color:#111}${css}</style>`,
    "</head><body>",
    html,
    `<script>window.__args = ${JSON.stringify(args ?? {})};\n${jsFunctions}</script>`,
    "</body></html>",
  ].join("");
  return (
    <iframe
      className="min-h-[240px] w-full rounded-md border border-border bg-background"
      sandbox="allow-scripts"
      srcDoc={document}
      title={t("components.sandbox-preview.title")}
    />
  );
}
