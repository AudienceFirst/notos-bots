import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import {
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { useTheme } from "@/components/theme-provider";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatHotkey, HOTKEYS } from "@/lib/hotkeys/hotkeys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LOCALE_LABELS, LOCALES, useT } from "@/i18n";
import { setLocaleMutationOptions } from "@/lib/auth/mutations";
import { currentUserQueryOptions } from "@/lib/auth/queries";

export const Route = createFileRoute("/_authed/settings/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { dark, setDark } = useTheme();
  // NOTOS: the interface language, chosen here and kept on the server (6 September 2026).
  const t = useT();
  const queryClient = useQueryClient();
  const { data: user } = useQuery(currentUserQueryOptions());
  const setLocale = useMutation(setLocaleMutationOptions(queryClient));

  /*
   * The measurements that used to be written out here now live in `PageShell`, which Skills, Admin
   * and this screen all render through. The reason they match is no longer that somebody remembered
   * to copy them.
   *
   * Connected accounts used to be a section below. It is its own screen now: a connector can need
   * more from a person than one switch, and a section cannot grow a page's worth of that.
   */
  return (
    <PageShell
      description="How Bots looks and behaves for you. These apply to your account alone, on every deployment you sign in to."
      title="Preferences"
    >
      <PageSection title="General">
        <PageRows>
          <Item size="sm">
            <ItemContent>
              <ItemTitle>{t("common.language.title")}</ItemTitle>
              <ItemDescription>
                {t("common.language.description")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <select
                aria-label={t("common.language.title")}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                disabled={setLocale.isPending}
                onChange={(event) =>
                  setLocale.mutate(
                    event.target.value === "nl" || event.target.value === "en"
                      ? event.target.value
                      : null,
                  )
                }
                value={user?.locale ?? ""}
              >
                <option value="">{t("common.language.browser")}</option>
                {LOCALES.map((locale) => (
                  <option key={locale} value={locale}>
                    {LOCALE_LABELS[locale]}
                  </option>
                ))}
              </select>
            </ItemActions>
          </Item>
          <Separator />
          <Item size="sm">
            <ItemContent>
              <ItemTitle>Dark theme</ItemTitle>
              <ItemDescription>
                Use the dark appearance across Bots.
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                aria-label="Dark theme"
                checked={dark}
                onCheckedChange={setDark}
              />
            </ItemActions>
          </Item>
        </PageRows>
      </PageSection>
      {/*
       * Drawn from the same registry the listeners match against, so this list is what the keys
       * actually do rather than what somebody remembered they did. Read-only on purpose: these
       * are not rebindable, and a row with nothing to click says so by having nothing to click.
       */}
      <PageSection title="Keyboard shortcuts">
        <PageRows>
          {HOTKEYS.map((hotkey, index) => (
            <React.Fragment key={hotkey.id}>
              <Item size="sm">
                <ItemContent>
                  <ItemTitle>{hotkey.label}</ItemTitle>
                  <ItemDescription>{hotkey.description}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="flex gap-1">
                    {formatHotkey(hotkey.combo).map((part) => (
                      <kbd
                        className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-xs text-muted-foreground"
                        key={part}
                      >
                        {part}
                      </kbd>
                    ))}
                  </span>
                </ItemActions>
              </Item>
              {index !== HOTKEYS.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </PageRows>
      </PageSection>
    </PageShell>
  );
}
