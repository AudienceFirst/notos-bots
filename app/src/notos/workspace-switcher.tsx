// NOTOS: van workspace wisselen in de zijbalk (bouwplan stap 2).
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/lib/auth/queries";
import { useT } from "@/i18n";

/**
 * ZUID ziet elke workspace, in dezelfde volgorde als de NOTOS-switcher; een klantgast met één
 * workspace ziet alleen de naam, want er valt niets te kiezen. Wisselen gaat naar de wortel van de
 * andere workspace: een kanaal-URL uit de ene bestaat in de andere niet.
 */
export function WorkspaceSwitcher({ className }: { className?: string }) {
  const { data: user } = useQuery(currentUserQueryOptions());
  const params = useParams({ strict: false }) as { workspace?: string };
  const navigate = useNavigate();
  const t = useT();
  // NOTOS: the personal space first (5 September 2026); the rest in NOTOS order.
  const workspaces = [...(user?.workspaces ?? [])].sort(
    (a, b) => Number(b.kind === "personal") - Number(a.kind === "personal"),
  );
  const current = workspaces.find((w) => w.notosClientId === params.workspace);

  if (workspaces.length <= 1) {
    return (
      <span className={className} title={current?.notosClientId}>
        {current?.displayName ?? workspaces[0]?.displayName ?? ""}
      </span>
    );
  }

  return (
    <select
      aria-label={t("workspace.workspaceSwitcher.label")}
      className={`bg-transparent outline-none cursor-pointer max-w-full truncate ${className ?? ""}`}
      value={current?.notosClientId ?? ""}
      onChange={(event) => {
        const slug = event.target.value;
        if (!slug || slug === current?.notosClientId) return;
        void navigate({ to: "/w/$workspace", params: { workspace: slug } });
      }}
    >
      {workspaces.map((workspace) => (
        <option key={workspace.id} value={workspace.notosClientId}>
          {workspace.displayName}
          {workspace.kind === "demo"
            ? ` ${t("workspace.workspaceSwitcher.demo")}`
            : workspace.kind === "personal"
              ? ` ${t("workspace.workspaceSwitcher.private")}`
              : ""}
        </option>
      ))}
    </select>
  );
}
