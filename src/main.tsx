import ReactDOM from "react-dom/client";
import App from "./App";
import Settings from "./settings/Settings";
import Chat from "./chat/Chat";
import Games from "./games/Games";
import Alert from "./alert/Alert";
import { ErrorBoundary } from "./ui/ErrorBoundary";
import { installCrashHandlers } from "./ui/crashLog";
import "./styles.css";

// Before anything renders, so a throw during the first paint is still caught.
installCrashHandlers();

// One bundle, several windows, routed by hash:
//   ""  = the pet itself, "#settings", "#chat", "#games".
const route = window.location.hash.replace(/^#\/?/, "");
if (route === "chat") {
  // Chat manages its own scrolling inside the message log, so the window
  // itself stays fixed.
  document.body.classList.add("chat-window");
} else if (route.startsWith("alert")) {
  // Transparent and fullscreen, like the pet window rather than a document one.
  document.body.classList.add("alert-window");
} else if (route) {
  document.body.classList.add("settings-window");
  document.documentElement.classList.add("scroll-window");
}

// NOTE: no <React.StrictMode> — its double-invoked effects would start the pet
// engine (rAF loop + native listeners) twice in dev.
const view =
  route === "settings" ? <Settings /> : route === "chat" ? <Chat /> : route === "games" ? <Games /> : route.startsWith("alert") ? <Alert /> : <App />;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary variant={route ? "window" : "pet"}>{view}</ErrorBoundary>
);
