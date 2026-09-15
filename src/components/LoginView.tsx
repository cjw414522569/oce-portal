interface Props {
  reason: string | null;
}

export default function LoginView({ reason }: Props) {
  return (
    <div className="center">
      <div className="card login-card">
        <h1>OCE Portal</h1>
        <p className="muted">OpenContextEngine · 代码检索服务</p>
        {reason && (
          <div className="banner error">
            {reason === "denied" ? "登录被拒绝：账号状态或信任等级不满足要求" : reason}
          </div>
        )}
        <a className="button primary" href="/auth/login">
          使用 LinuxDo 登录
        </a>
      </div>
    </div>
  );
}
