import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./worker-experience.css";
import "./mobile-polish.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="boot-loading">
        <h1>Something interrupted your workspace.</h1>
        <p>Your server records have not been reset. Reload to try again.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reload the page
        </button>
        <a href="/">Back to home</a>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
