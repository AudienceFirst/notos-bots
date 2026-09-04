import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { signOut } from "./client";
import { authKeys } from "./queries";

// NOTOS: uitloggen gaat via de gedeelde Supabase-sessie, niet via /api/auth/sign-out (stap 1).
export function signOutMutationOptions(queryClient: QueryClient) {
  return mutationOptions({
    mutationFn: signOut,
    onSuccess: () => queryClient.removeQueries({ queryKey: authKeys.all }),
  });
}
