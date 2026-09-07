// NOTOS: Admin › Models: de deployment-keys voor Anthropic, OpenAI, OpenRouter en Google AI Studio
// (Mitch, 5 september 2026).
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ModelKeysPanel } from "@/components/models/model-keys-panel";
import { ModelUsagePanel } from "@/components/models/model-usage-panel";
import { useT } from "@/i18n";

export const Route = createFileRoute("/_authed/admin/models")({
  component: ModelsPage,
});

function ModelsPage() {
  const t = useT();
  return (
    <PageShell
      description={t("admin-a.models.description")}
      title={t("admin-a.models.title")}
    >
      <PageSection>
        <p className="mb-4 text-muted-foreground text-sm text-pretty">
          {t("admin-a.models.subscriptionNote")}
        </p>
        <ModelKeysPanel scope="deployment" />
        <p className="mt-4 text-muted-foreground text-xs">
          {t("admin-a.models.chooseModelBefore")}{" "}
          <Link className="underline underline-offset-2" to="/admin/workspaces">
            {t("admin-a.models.workspacesLink")}
          </Link>
          {t("admin-a.models.chooseModelAfter")}
        </p>
      </PageSection>
      <PageSection>
        <h2 className="mb-2 font-medium text-sm">
          {t("admin-a.modelUsage.title")}
        </h2>
        <p className="mb-4 text-muted-foreground text-sm text-pretty">
          {t("admin-a.modelUsage.description")}
        </p>
        <ModelUsagePanel />
      </PageSection>
    </PageShell>
  );
}
