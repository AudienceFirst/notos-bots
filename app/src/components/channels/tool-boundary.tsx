import { Component, type ReactNode } from "react";
import { useT } from "@/i18n";

/** The failure line, as its own component so it can read the interface language. */
function ToolRenderFailed({ name }: { name: string }) {
  const t = useT();
  return (
    <p className="my-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <span className="font-medium">{name}</span>{" "}
      {t("channels.tool-boundary.couldNotDraw")}{" "}
      {t("channels.tool-boundary.restUnaffected")}
    </p>
  );
}

/**
 * A component that throws must not take the conversation with it.
 *
 * Browser-authored components render in the transcript from model-supplied arguments, sometimes
 * while a tool call is still streaming. A render failure is isolated to the component card and shown
 * as a user-readable failure line; stacks stay in the developer console.
 */
export class ToolRenderBoundary extends Component<
  { name: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Keep stack details out of the conversation while preserving them for component authors.
    console.error(
      "[gallery] a component failed to render",
      this.props.name,
      error,
    );
  }

  render() {
    if (this.state.failed) {
      return <ToolRenderFailed name={this.props.name} />;
    }
    return this.props.children;
  }
}
