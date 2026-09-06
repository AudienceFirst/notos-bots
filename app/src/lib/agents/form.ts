import { z } from "zod";
import { tr } from "@/i18n";

/**
 * Browser-side coworker form contract. Limits match the server parser so validation errors can be
 * shown next to fields before submit.
 */
export const agentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => tr("lib.agents.nameRequired") })
    .max(80, { error: () => tr("lib.agents.nameTooLong") }),
  title: z
    .string()
    .trim()
    .min(1, { error: () => tr("lib.agents.titleRequired") })
    .max(120, { error: () => tr("lib.agents.titleTooLong") }),
  roleDescription: z
    .string()
    .trim()
    .min(1, { error: () => tr("lib.agents.roleRequired") })
    .max(1000, { error: () => tr("lib.agents.roleTooLong") }),
  visibility: z.enum(["public", "private"]),
  /**
   * The AG-UI endpoint this coworker runs on. Empty means the Bot in the box.
   *
   * Only URL shape is checked here; deployment allow/deny rules are server-side.
   */
  endpoint: z
    .string()
    .trim()
    .refine((value) => value === "" || /^https?:\/\/\S+$/.test(value), {
      error: () => tr("lib.agents.endpointInvalid"),
    }),
  /**
   * A key the agent sits behind. WRITE-ONLY: it is never sent back from the server, so this field is
   * always empty when editing, and leaving it empty keeps whatever key is already set.
   */
  authValue: z.string(),
});

export type AgentFormValues = z.infer<typeof agentFormSchema>;

export const emptyAgentForm: AgentFormValues = {
  name: "",
  title: "",
  roleDescription: "",
  visibility: "private",
  endpoint: "",
  authValue: "",
};

/** Convert form values to API input; omit an empty key so editing preserves the current credential. */
export function agentInputFrom(values: AgentFormValues) {
  return {
    name: values.name,
    title: values.title,
    roleDescription: values.roleDescription,
    visibility: values.visibility,
    endpoint: values.endpoint,
    ...(values.authValue.trim()
      ? { auth: { header: "Authorization", value: values.authValue.trim() } }
      : {}),
  };
}
