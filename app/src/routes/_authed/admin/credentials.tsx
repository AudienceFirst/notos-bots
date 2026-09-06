import { IconChevronRight, IconPlus } from "@tabler/icons-react";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, useT } from "@/i18n";
import {
  type CredentialFormValues,
  credentialFormSchema,
} from "@/lib/credentials/form";
import {
  createCredentialMutationOptions,
  revokeCredentialMutationOptions,
} from "@/lib/credentials/mutations";
import {
  type CredentialStatus,
  credentialListQueryOptions,
} from "@/lib/credentials/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/admin/credentials")({
  component: CredentialsPage,
});

function CredentialsPage() {
  const t = useT();
  const [adding, setAdding] = useState(false);
  /** Revoked rows are kept for the record and folded away by default; see the list below. */
  const [showRevoked, setShowRevoked] = useState(false);
  const queryClient = useQueryClient();
  const credentials = useQuery(credentialListQueryOptions());
  const createCredential = useMutation(
    createCredentialMutationOptions(queryClient),
  );
  const revokeCredential = useMutation(
    revokeCredentialMutationOptions(queryClient),
  );
  const defaultValues: CredentialFormValues = {
    kind: "model",
    provider: "",
    keyId: "",
    plaintext: "",
  };
  const form = useForm({
    defaultValues,
    validators: { onSubmit: credentialFormSchema },
    onSubmit: async ({ value }) => {
      await createCredential.mutateAsync({ ...value, metadata: {} });
      form.reset();
      setAdding(false);
    },
  });

  const active = (credentials.data ?? []).filter(
    (credential) => credential.revokedAt === null,
  );
  const revoked = (credentials.data ?? []).filter(
    (credential) => credential.revokedAt !== null,
  );

  return (
    <PageShell
      action={
        <Button onClick={() => setAdding(true)} size="sm" variant="ghost">
          <IconPlus />
          {t("admin-a.credentials.addCredential")}
        </Button>
      }
      description={t("admin-a.credentials.description")}
      title={t("admin-a.credentials.title")}
    >
      {/*
       * THE FORM IS NOT ON THE PAGE. A credential is added once and then lived with, so a permanent
       * four-field form sat above the list somebody actually came to read, and the secret field
       * invited a password manager to fill it on every visit.
       */}
      <Dialog onOpenChange={setAdding} open={adding}>
        <DialogContent>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              form.handleSubmit();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {t("admin-a.credentials.addCredential")}
              </DialogTitle>
              <DialogDescription>
                {t("admin-a.credentials.dialogDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="mt-4">
              <FieldGroup className="sm:grid sm:grid-cols-2">
                <form.Field name="kind">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {t("admin-a.credentials.kindLabel")}
                        </FieldLabel>
                        <Select
                          onValueChange={(value) =>
                            field.handleChange(value as "model" | "connector")
                          }
                          value={field.state.value}
                        >
                          <SelectTrigger
                            aria-invalid={isInvalid}
                            id={field.name}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="model">
                                {t("admin-a.credentials.kindModel")}
                              </SelectItem>
                              <SelectItem value="connector">
                                {t("admin-a.credentials.kindConnector")}
                              </SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    );
                  }}
                </form.Field>
                <form.Field name="provider">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {t("admin-a.credentials.providerLabel")}
                        </FieldLabel>
                        <Input
                          aria-invalid={isInvalid}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          /* A provider's name, the same in every language. */
                          placeholder="OpenAI"
                          value={field.state.value}
                        />
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    );
                  }}
                </form.Field>
                <form.Field name="keyId">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {t("admin-a.credentials.keyIdLabel")}
                        </FieldLabel>
                        <Input
                          aria-invalid={isInvalid}
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder={t(
                            "admin-a.credentials.keyIdPlaceholder",
                          )}
                          value={field.state.value}
                        />
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    );
                  }}
                </form.Field>
                <form.Field name="plaintext">
                  {(field) => {
                    const isInvalid =
                      field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                      <Field data-invalid={isInvalid}>
                        <FieldLabel htmlFor={field.name}>
                          {t("admin-a.credentials.secretLabel")}
                        </FieldLabel>
                        <Input
                          aria-invalid={isInvalid}
                          autoComplete="off"
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          type="password"
                          value={field.state.value}
                        />
                        {isInvalid ? (
                          <FieldError errors={field.state.meta.errors} />
                        ) : null}
                      </Field>
                    );
                  }}
                </form.Field>
              </FieldGroup>
              {/*
               * Said before the write, not after it.
               *
               * A key holds one live credential, so saving onto a key that already has one is a
               * replacement: the old credential is revoked in the same transaction. The page calls
               * this Add and has no rotate control, so without this line an administrator retires
               * the credential an MCP server or an agent is currently authenticating with, and
               * nothing on screen mentions it until something stops working.
               */}
              <form.Subscribe
                selector={(state) => [
                  state.values.kind,
                  state.values.provider,
                  state.values.keyId,
                ]}
              >
                {([kind, provider, keyId]) =>
                  liveCredentialFor(credentials.data, kind, provider, keyId) ? (
                    <p className="text-amber-600 text-sm dark:text-amber-500">
                      {t("admin-a.credentials.replaceWarning")}
                    </p>
                  ) : null
                }
              </form.Subscribe>
              {createCredential.error ? (
                <p className="text-destructive text-sm" role="alert">
                  {t("admin-a.credentials.saveFailed")}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter className="mt-4">
              <Button
                onClick={() => setAdding(false)}
                size="sm"
                type="button"
                variant="ghost"
              >
                {t("admin-a.credentials.cancel")}
              </Button>
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    disabled={
                      !canSubmit || isSubmitting || createCredential.isPending
                    }
                    size="sm"
                    type="submit"
                  >
                    {isSubmitting || createCredential.isPending
                      ? t("admin-a.credentials.saving")
                      : t("admin-a.credentials.save")}
                  </Button>
                )}
              </form.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/*
       * Live credentials first, and only those. Revoked rows are kept because the audit trail points
       * at them, but a list of 236 with 199 revoked buried the 37 that still work, each revoked row
       * wearing a Revoke button it could not use.
       */}
      <PageSection title={t("admin-a.credentials.sectionTitle")}>
        {credentials.isPending ? null : credentials.error ? (
          <p className="mt-4 text-destructive text-sm" role="alert">
            {t("admin-a.credentials.loadFailed")}
          </p>
        ) : credentials.data?.length === 0 ? (
          <PageEmpty>{t("admin-a.credentials.none")}</PageEmpty>
        ) : (
          <>
            {active.length === 0 ? (
              <PageEmpty>{t("admin-a.credentials.noneActive")}</PageEmpty>
            ) : (
              <PageRows>
                {active.map((credential, index) => (
                  <StaggerItem index={index} key={credential.id}>
                    <Item size="sm">
                      <ItemContent>
                        <ItemTitle>{credential.provider}</ItemTitle>
                        <ItemDescription>
                          {credential.kind} · {credential.keyId}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          disabled={revokeCredential.isPending}
                          onClick={() => revokeCredential.mutate(credential.id)}
                          size="sm"
                          variant="outline"
                        >
                          {t("admin-a.credentials.revoke")}
                        </Button>
                      </ItemActions>
                    </Item>
                    {index !== active.length - 1 && <Separator />}
                  </StaggerItem>
                ))}
              </PageRows>
            )}
            {revoked.length > 0 ? (
              <>
                <button
                  aria-expanded={showRevoked}
                  className="mt-3 flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
                  onClick={() => setShowRevoked((value) => !value)}
                  type="button"
                >
                  <IconChevronRight
                    className={cn(
                      "size-3.5 transition-transform duration-150",
                      showRevoked && "rotate-90",
                    )}
                  />
                  {t(
                    revoked.length === 1
                      ? "admin-a.credentials.revokedCountOne"
                      : "admin-a.credentials.revokedCountOther",
                    { count: revoked.length },
                  )}
                </button>
                {showRevoked ? (
                  <PageRows className="mt-2">
                    {revoked.map((credential, index) => (
                      <StaggerItem index={index} key={credential.id}>
                        <Item size="sm">
                          <ItemContent>
                            <ItemTitle>{credential.provider}</ItemTitle>
                            <ItemDescription>
                              {credential.kind} · {credential.keyId} ·{" "}
                              {credential.revokedAt
                                ? t("admin-a.credentials.revokedOn", {
                                    date: formatDateTime(credential.revokedAt, {
                                      dateStyle: "medium",
                                    }),
                                  })
                                : t("admin-a.credentials.revoked")}
                            </ItemDescription>
                          </ItemContent>
                        </Item>
                        {index !== revoked.length - 1 && <Separator />}
                      </StaggerItem>
                    ))}
                  </PageRows>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </PageSection>
    </PageShell>
  );
}

/**
 * The live credential a key already holds, if it holds one.
 *
 * `(kind, provider, keyId)` is what `credentials_active_key_idx` is unique on, and revoked rows are
 * outside it, so this is the same question the database asks when the save lands.
 */
function liveCredentialFor(
  credentials: CredentialStatus[] | undefined,
  kind: unknown,
  provider: unknown,
  keyId: unknown,
): CredentialStatus | undefined {
  if (!provider || !keyId) return undefined;
  return credentials?.find(
    (credential) =>
      credential.revokedAt === null &&
      credential.kind === kind &&
      credential.provider === provider &&
      credential.keyId === keyId,
  );
}
