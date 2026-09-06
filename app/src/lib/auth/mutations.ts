import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { client } from "@/lib/client";
import { tr } from "@/i18n";
import { signOut } from "./client";
import { authKeys } from "./queries";

// NOTOS: uitloggen gaat via de gedeelde Supabase-sessie, niet via /api/auth/sign-out (stap 1).
export function signOutMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: signOut,
    onSuccess: () => queryClient.removeQueries({ queryKey: authKeys.all }),
  });
}

/** NOTOS: the interface language, kept on the server so it follows the person everywhere. */
export function setLocaleMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: async (locale: "nl" | "en" | null) => {
      await client("/api/me/locale", {
        method: "PUT",
        body: { locale },
        fallback: tr("lib.auth.localeSaveFailed"),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authKeys.all }),
  });
}
