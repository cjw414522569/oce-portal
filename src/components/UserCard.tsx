import type { AuthUser } from "../types";

// avatar_template 是 Discourse 模板（{size} 占位）；相对路径基于 linux.do 站点，
// 其余无法解析的情况回退首字母
function avatarUrl(template: string | null): string | null {
  if (!template) return null;
  const sized = template.includes("{size}")
    ? template.replace("{size}", "144")
    : template;
  if (sized.startsWith("http")) return sized;
  if (sized.startsWith("/")) return `https://linux.do${sized}`;
  return null;
}

export default function UserCard({ user }: { user: AuthUser }) {
  const url = avatarUrl(user.avatar_template);
  return (
    <div className="card">
      <h2>账号</h2>
      <div className="user-row">
        {url ? (
          <img className="avatar" src={url} alt={user.username} />
        ) : (
          <div className="avatar fallback">
            {(user.name || user.username).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <div className="username">{user.name || user.username}</div>
          <div className="muted">@{user.username}</div>
        </div>
        <span className="badge">TL{user.trust_level}</span>
      </div>
    </div>
  );
}
