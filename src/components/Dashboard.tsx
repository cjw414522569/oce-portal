import { useState } from "react";
import { getMe, logout, UnauthorizedError } from "../api";
import type { MeResponse } from "../types";
import UserCard from "./UserCard";
import KeyCard from "./KeyCard";
import UsageCards from "./UsageCards";

interface Props {
  initial: MeResponse;
}

export default function Dashboard({ initial }: Props) {
  const [me, setMe] = useState<MeResponse>(initial);

  // 会话过期（401）时跳回登录页；其余错误静默保留现有视图
  const refresh = async () => {
    try {
      setMe(await getMe());
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        window.location.href = "/";
      }
    }
  };

  return (
    <div className="page">
      <header>
        <h1>OCE Portal</h1>
        <button
          className="button ghost"
          onClick={async () => {
            await logout().catch(() => undefined);
            window.location.href = "/";
          }}
        >
          退出登录
        </button>
      </header>
      <div className="grid">
        <UserCard user={me.user} />
        <KeyCard apiKey={me.api_key} onRotated={refresh} />
        <UsageCards usage24h={me.usage_24h} usage7d={me.usage_7d} />
      </div>
    </div>
  );
}
