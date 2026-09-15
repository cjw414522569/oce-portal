import { useEffect, useState } from "react";
import { getMe, UnauthorizedError } from "./api";
import type { MeResponse } from "./types";
import LoginView from "./components/LoginView";
import Dashboard from "./components/Dashboard";
import UsageGuide from "./components/UsageGuide";

type State =
  | { kind: "loading" }
  | { kind: "login"; reason: string | null }
  | { kind: "ready"; me: MeResponse };

type Tab = "dashboard" | "guide";

export default function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [tab, setTab] = useState<Tab>("dashboard");

  useEffect(() => {
    // 指南不含敏感信息，支持 #guide 直达（未登录也可阅读）
    if (window.location.hash === "#guide") {
      setTab("guide");
    }
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

  const me = state.kind === "ready" ? state.me : null;
  const loginReason = state.kind === "login" ? state.reason : null;

  return (
    <div className="page">
      <header>
        <h1>OCE Portal</h1>
        <nav className="tabs">
          <button
            className={"tab" + (tab === "dashboard" ? " active" : "")}
            onClick={() => setTab("dashboard")}
          >
            总览
          </button>
          <button
            className={"tab" + (tab === "guide" ? " active" : "")}
            onClick={() => setTab("guide")}
          >
            使用指南
          </button>
        </nav>
      </header>

      {tab === "guide" ? (
        <UsageGuide />
      ) : me ? (
        <Dashboard initial={me} />
      ) : state.kind === "loading" ? (
        <div className="muted">加载中…</div>
      ) : (
        <LoginView reason={loginReason} />
      )}
    </div>
  );
}
