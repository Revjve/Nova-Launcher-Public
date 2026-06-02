import { Toaster } from "sonner";

export const AppToaster = () => (
  <Toaster
    richColors
    closeButton
    position="bottom-left"
    theme="dark"
    duration={2400}
    toastOptions={{
      style: {
        background: "var(--surface-2)",
        border: "1px solid var(--panel-border)",
        color: "#fff",
        backdropFilter: "blur(16px)"
      }
    }}
  />
);
