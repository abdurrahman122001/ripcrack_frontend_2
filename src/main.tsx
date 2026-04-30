import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

const rootEl = document.getElementById("root");

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch() { }

  render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: 16,
            fontFamily:
              "ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace",
            color: "#b91c1c",
            background: "#fff",
          }}
        >
          {`React render error\n\n${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack || ""}`}
        </pre>
      );
    }
    return this.props.children;
  }
}

const showFatal = (title: string, err: unknown) => {
  const msg =
    err instanceof Error
      ? `${err.name}: ${err.message}\n${err.stack || ""}`
      : typeof err === "string"
        ? err
        : JSON.stringify(err);

  if (rootEl) {
    rootEl.innerHTML = `<pre style="white-space:pre-wrap;padding:16px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace;color:#b91c1c;background:#fff">${title}\n\n${msg}</pre>`;
  }
};

window.addEventListener("error", (e) => {
  showFatal("Runtime error", (e as ErrorEvent).error || (e as ErrorEvent).message);
});

window.addEventListener("unhandledrejection", (e) => {
  showFatal("Unhandled promise rejection", (e as PromiseRejectionEvent).reason);
});

// Handle hard refresh (Ctrl+F5) - ensure page reloads properly
if (typeof window !== "undefined") {
  // Prevent infinite loading on hard refresh
  let reloadAttempted = false;

  // Handle hard refresh attempts
  const handleHardRefresh = () => {
    if (reloadAttempted) return;
    reloadAttempted = true;

    // Small delay to ensure browser processes the refresh
    setTimeout(() => {
      if (document.readyState !== "complete") {
        window.location.reload();
      }
    }, 50);
  };

  // Listen for Ctrl+F5 or Shift+F5
  window.addEventListener("keydown", (e) => {
    if (e.shiftKey && e.key === "F5") {
      // Shift+F5 is hard refresh - let browser handle it
      reloadAttempted = true;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "F5") {
      // Ctrl+F5 - ensure reload happens
      handleHardRefresh();
    }
  });

  // Ensure page loads completely
  if (document.readyState === "loading") {
    window.addEventListener("load", () => {
      reloadAttempted = false;
    });
  } else {
    // Already loaded
    reloadAttempted = false;
  }
}

try {
  if (!rootEl) throw new Error("Missing #root element");
  createRoot(rootEl).render(
    <>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </>
  );
} catch (e) {
  showFatal("Bootstrap error", e);
}
