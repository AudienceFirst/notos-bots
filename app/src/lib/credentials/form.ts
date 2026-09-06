import { z } from "zod";
import { tr } from "@/i18n";

export const credentialFormSchema = z.object({
  kind: z.enum(["model", "connector"]),
  provider: z
    .string()
    .trim()
    .min(1, { error: () => tr("lib.credentials.providerRequired") }),
  keyId: z
    .string()
    .trim()
    .min(1, { error: () => tr("lib.credentials.keyIdRequired") }),
  plaintext: z
    .string()
    .min(1, { error: () => tr("lib.credentials.secretRequired") }),
});

export type CredentialFormValues = z.infer<typeof credentialFormSchema>;
