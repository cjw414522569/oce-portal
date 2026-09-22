// 会话（LinuxDo OAuth2）客户端：cookie 鉴权，同源部署无需 URL/Key。
const BASE = "";

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    ...options,
  });
  if (response.status === 401) {
    const error = new Error("UNAUTHORIZED");
    error.status = 401;
    throw error;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `HTTP ${response.status}`);
  }
  return response.json();
}

export const loginUrl = () => `${BASE}/auth/login`;

export const fetchMe = () => request("/auth/me");

export const rotateKey = () =>
  request("/auth/key/rotate", { method: "POST" });

export const logout = () =>
  request("/auth/logout", { method: "POST" });

export const fetchLeaderboard = () => request("/auth/leaderboard");
