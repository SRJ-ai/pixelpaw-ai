/**
 * Last line of defence for each window.
 *
 * The pet lives in a transparent, frameless, always-on-top window with no
 * chrome. If a render throws there, React unmounts the tree and the user is
 * left with an invisible window and a cat that vanished, with nothing to click
 * and no hint that anything failed. The Settings and Chat windows fail less
 * dramatically but just as silently.
 *
 * So every route gets a boundary. The pet shows a small tappable marker that
 * keeps the right-click menu reachable; the document windows show the error
 * and a way to recover.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** The pet window has no chrome, so it needs a different fallback. */
  variant: "pet" | "window";
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PixelPaw] render failed", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.variant === "pet") {
      // Deliberately tiny and still hit-testable: the native right-click menu
      // is bound to this window, so as long as something is drawn the user can
      // still reach Settings and Quit.
      return (
        <div className="pp-crash" role="alert" title={`PixelPaw hit an error: ${error.message}`}>
          <span aria-hidden="true">!</span>
        </div>
      );
    }

    return (
      <div className="crash-root" role="alert">
        <h1>Something broke.</h1>
        <p>{error.message || "An unexpected error occurred."}</p>
        <div className="crash-actions">
          <button className="set-btn" onClick={this.reset}>
            Try again
          </button>
          <button className="set-btn" onClick={() => window.location.reload()}>
            Reload window
          </button>
        </div>
      </div>
    );
  }
}
