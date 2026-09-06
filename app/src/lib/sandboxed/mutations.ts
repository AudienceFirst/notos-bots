import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";
import { sandboxedKeys } from "./queries";

/**
 * A browser-authored component as the server accepts it.
 *
 * `argumentSchema` and `sampleArguments` arrive parsed. The playground holds them as text while
 * somebody is typing, and text that does not parse is not a draft the server should be asked to
 * store — so parsing is the editor's job and this is what survives it.
 */
export type SandboxedDraftInput = {
  slug: string;
  title: string;
  description: string;
  html: string;
  css: string;
  jsFunctions: string;
  argumentSchema: Record<string, unknown>;
  sampleArguments: Record<string, unknown>;
};

const failed = () => tr("lib.sandboxed.failed");

function invalidateSandboxed(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: sandboxedKeys.all });
}

/** The name the server knows a browser-authored component by. */
function sandboxedName(slug: string): string {
  return `custom_${slug}`;
}

export function saveSandboxedDraftMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: SandboxedDraftInput) => {
      await client("/api/sandboxed", {
        method: "POST",
        body: input,
        fallback: failed(),
      });
    },
    onSuccess: () => invalidateSandboxed(queryClient),
  });
}

/**
 * Publish what is on screen.
 *
 * Saves first, in the same mutation, because publishing acts on the stored draft rather than on the
 * editors. Two calls rather than one endpoint, so a save that fails stops the publish — which is the
 * behaviour worth keeping: publishing a draft the server never received would put something on
 * screen that nobody wrote.
 */
export function publishSandboxedMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (input: SandboxedDraftInput) => {
      await client("/api/sandboxed", {
        method: "POST",
        body: input,
        fallback: failed(),
      });
      await client(
        `/api/sandboxed/${encodeURIComponent(sandboxedName(input.slug))}/publish`,
        { method: "POST", fallback: failed() },
      );
    },
    onSuccess: () => invalidateSandboxed(queryClient),
  });
}

export function deleteSandboxedMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (name: string) => {
      await client(`/api/sandboxed/${encodeURIComponent(name)}`, {
        method: "DELETE",
        fallback: failed(),
      });
    },
    onSuccess: () => invalidateSandboxed(queryClient),
  });
}
