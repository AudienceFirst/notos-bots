// NOTOS: Better Auth eruit; inloggen gebeurt in NOTOS, dit is alleen nog uitloggen en de link ernaartoe (stap 1).
import { notosLoginUrl, signOutOfNotos } from "@/notos/supabase";
import type { AuthProviderId } from "./queries";

/** Wat de ene provider op het scherm heet. */
const PROVIDER_NAMES: Record<AuthProviderId, string> = {
  notos: "NOTOS",
};

export function providerName(provider: AuthProviderId): string {
  return PROVIDER_NAMES[provider];
}

/** Waar de knop "Log in via NOTOS" heen gaat. */
export function signInUrl(): string {
  return notosLoginUrl();
}

export async function signOut(): Promise<void> {
  await signOutOfNotos();
}
