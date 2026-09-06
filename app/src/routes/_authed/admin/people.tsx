import { IconLock, IconShieldCheck, IconUser } from "@tabler/icons-react";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  PageEmpty,
  PageRows,
  PageSection,
  PageShell,
} from "@/components/layout/page-shell";
import { StaggerItem } from "@/components/layout/stagger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { formatDateTime, useT } from "@/i18n";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { setPersonAccessMutationOptions } from "@/lib/people/mutations";
import { type Person, peopleListQueryOptions } from "@/lib/people/queries";
import { queryClient } from "@/query-client";

export const Route = createFileRoute("/_authed/admin/people")({
  component: PeoplePage,
});

/** What each provider is called, since the id it registers under is not a name. */
const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  microsoft: "Microsoft",
  okta: "Okta",
};

/**
 * The second line of a person's row: how they got here, and when they were last here.
 *
 * The address is the title, so this is everything else worth knowing at a glance while deciding
 * whether somebody should still have access. Takes the translator rather than calling the hook, so
 * it stays a plain function the row can call.
 */
function describe(
  person: Person,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const providers =
    person.providers
      .map((provider) => PROVIDER_NAMES[provider] ?? provider)
      .join(", ") || t("admin-a.people.noProvider");
  const when = person.lastSignedInAt
    ? t("admin-a.people.lastSignedIn", {
        date: formatDateTime(person.lastSignedInAt, { dateStyle: "medium" }),
      })
    : t("admin-a.people.neverSignedIn");

  if (person.revoked) return t("admin-a.people.accessRemoved", { providers });
  if (person.configuredAdmin) {
    return t("admin-a.people.adminByConfig", { when });
  }
  return t("admin-a.people.providerWhen", { providers, when });
}

function PeoplePage() {
  const t = useT();
  const [search, setSearch] = useState("");
  /*
   * Debounced, so typing a name is one request rather than one per keystroke against an aggregate
   * over every user in the deployment.
   */
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const people = useInfiniteQuery(peopleListQueryOptions(query));
  const rows = people.data?.pages.flatMap((page) => page.people) ?? [];
  const currentUser = useQuery(currentUserQueryOptions());
  const setAccess = useMutation(setPersonAccessMutationOptions(queryClient));

  // The server refuses these too. Disabling them here is so the screen does not offer something it
  // knows will be refused, not so the rule is enforced in the browser.
  const failure = setAccess.error;

  return (
    <PageShell
      description={t("admin-a.people.description")}
      title={t("admin-a.people.title")}
    >
      <PageSection
        description={t("admin-a.people.sectionDescription")}
        title={t("admin-a.people.sectionTitle")}
      >
        {failure ? (
          <p className="mt-4 text-destructive text-sm" role="alert">
            {failure.message}
          </p>
        ) : null}
        {/*
          Server-side search. Filtering what already arrived would only search the first page, which
          is the opposite of what somebody looking for a colleague needs.
        */}
        <Input
          aria-label={t("admin-a.people.searchAria")}
          className="mt-4"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("admin-a.people.searchPlaceholder")}
          value={search}
        />

        {people.isPending ? null : people.error ? (
          <p className="mt-4 text-destructive text-sm" role="alert">
            {t("admin-a.people.loadFailed")}
          </p>
        ) : rows.length === 0 ? (
          <PageEmpty>
            {query
              ? t("admin-a.people.noMatch", { query })
              : t("admin-a.people.empty")}
          </PageEmpty>
        ) : (
          <PageRows>
            {rows.map((person, index) => {
              const isSelf = person.id === currentUser.data?.id;
              const busy = setAccess.isPending;

              return (
                <StaggerItem index={index} key={person.id}>
                  <Item size="sm">
                    <ItemMedia variant="icon">
                      {person.revoked ? (
                        <IconLock />
                      ) : person.role === "admin" ? (
                        <IconShieldCheck />
                      ) : (
                        <IconUser />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{person.name ?? person.email}</ItemTitle>
                      <ItemDescription>
                        {person.name ? `${person.email} · ` : ""}
                        {describe(person, t)}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {/*
                       * Removing access is the louder decision, so it is a button rather than a
                       * second switch: two switches on one row invites somebody to flip the wrong
                       * one, and these two do very different things.
                       */}
                      <Button
                        disabled={busy || isSelf || person.configuredAdmin}
                        onClick={() =>
                          setAccess.mutate({
                            userId: person.id,
                            revoked: !person.revoked,
                          })
                        }
                        size="sm"
                        variant={person.revoked ? "outline" : "destructive"}
                      >
                        {person.revoked
                          ? t("admin-a.people.restore")
                          : t("admin-a.people.remove")}
                      </Button>
                      {/* NOTOS: no role switch; the admin role comes from team_members (stap 1). */}
                    </ItemActions>
                  </Item>
                  {index !== rows.length - 1 && <Separator />}
                </StaggerItem>
              );
            })}
          </PageRows>
        )}

        {/*
          Only when there is one. A button that says there is more when there is not is worse than
          no button, and this list ends for most deployments on the first page.
        */}
        {people.hasNextPage ? (
          <Button
            className="mt-4"
            disabled={people.isFetchingNextPage}
            onClick={() => people.fetchNextPage()}
            size="sm"
            variant="outline"
          >
            {people.isFetchingNextPage
              ? t("admin-a.people.loading")
              : t("admin-a.people.showMore")}
          </Button>
        ) : null}
      </PageSection>
    </PageShell>
  );
}
