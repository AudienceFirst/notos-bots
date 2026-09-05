// NOTOS: Admin › Models: de deployment-keys voor Anthropic, OpenAI, OpenRouter en Google AI Studio
// (Mitch, 5 september 2026).
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageSection, PageShell } from "@/components/layout/page-shell";
import { ModelKeysPanel } from "@/components/models/model-keys-panel";

export const Route = createFileRoute("/_authed/admin/models")({
  component: ModelsPage,
});

function ModelsPage() {
  return (
    <PageShell
      description="Gemini on Vertex AI runs on this server's own Google credentials and needs no key. Every other provider needs an API key. A workspace without a key of its own uses the ones here; pick the model per workspace under Workspaces."
      title="Models"
    >
      <PageSection>
        <p className="mb-4 text-muted-foreground text-sm text-pretty">
          A subscription is not a key: Claude Max and Gemini CLI sign a person
          in on their own laptop and cannot be used from a server. Bots here run
          on API access, billed per use by the provider. Keys are sealed with
          this deployment's encryption key and never shown again; only the last
          four characters are.
        </p>
        <ModelKeysPanel scope="deployment" />
        <p className="mt-4 text-muted-foreground text-xs">
          Choose which model each workspace runs on under{" "}
          <Link className="underline underline-offset-2" to="/admin/workspaces">
            Workspaces
          </Link>
          .
        </p>
      </PageSection>
    </PageShell>
  );
}
