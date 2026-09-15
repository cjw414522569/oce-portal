import { useEffect, useState } from "react";
import { getMe, UnauthorizedError } from "./api";
import type { MeResponse } from "./types";
import LoginView from "./components/LoginView";
import Dashboard from "./components/Dashboard";

type State =
  | { kind: "loading" }
  | { kind: "login"; reason: string | null }
  | { kind: "ready"; me: MeResponse };

export default function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("login_error");
    getMe()
      .then((me) => setState({ kind: "ready", me }))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          setState({ kind: "login", reason });
        } else {
          setState({ kind: "login", reason: `服务暂不可用（${String(err)}）` });
        }
      });
  }, []);

  if (state.kind === "loading") {
    return <div className="center muted">加载中…</div>;
  }
  if (state.kind === "login") {
    return <LoginView reason={state.reason} />;
  }
  return <Dashboard initial={state.me} />;
}
