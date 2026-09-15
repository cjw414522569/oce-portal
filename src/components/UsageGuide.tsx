import CodeBlock from "./CodeBlock";

const HOST = "https://oce.melikeme.cn";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card guide-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function UsageGuide() {
  return (
    <div className="guide">
      <div className="card intro">
        <h2>如何使用你的 API Key</h2>
        <p>
          每位用户拥有独立的 <code>sk-oce-*</code> key（在「总览」页获取或轮换）。
          下方命令中的 <code>&lt;你的APIKey&gt;</code> 请替换为你自己的 key。
        </p>
      </div>

      <Section title="一、CLI 接入（Linux / macOS）">
        <CodeBlock>{`uv tool install opencontextengine-client

export OCE_API_URL="${HOST}"
export OCE_API_KEY="<你的APIKey>"

cd ~/my-project
oce-client sync                              # 首次全量索引，之后增量
oce-client retrieve "认证是在哪里实现的？"`}</CodeBlock>
      </Section>

      <Section title="二、CLI 接入（Windows PowerShell）">
        <CodeBlock>{`winget install astral-sh.uv              # 已装跳过，装完重开终端
uv tool install "opencontextengine-client[mcp]"

$env:OCE_API_URL = "${HOST}"         # 临时；持久用 setx
$env:OCE_API_KEY = "<你的APIKey>"

cd C:\\src\\my-project
oce-client sync
oce-client retrieve "认证是在哪里实现的？"`}</CodeBlock>
        <p className="muted small">
          持久化环境变量：<code>setx OCE_API_URL "{HOST}"</code>（新开终端生效）。
          项目 .gitignore 建议加一行 <code>.oce-client/</code>。
        </p>
      </Section>

      <Section title="三、MCP 接入 · Claude Code">
        <p className="muted small">Windows PowerShell（多行用反引号续行）：</p>
        <CodeBlock>{`claude mcp add oce --scope user \`
  -e OCE_API_URL=${HOST} \`
  -e OCE_API_KEY=<你的APIKey> \`
  -- oce-client-mcp --workspace "C:\\src\\my-project"`}</CodeBlock>
        <p className="muted small">Linux / macOS：</p>
        <CodeBlock>{`claude mcp add oce --scope user \\
  -e OCE_API_URL=${HOST} \\
  -e OCE_API_KEY=<你的APIKey> \\
  -- oce-client-mcp --workspace /path/to/project`}</CodeBlock>
        <p className="muted small">
          注册后输入 <code>/mcp</code> 确认连接；多项目重复传{" "}
          <code>--workspace</code>。key 只放环境变量，不要写进配置文件或仓库。
        </p>
      </Section>

      <Section title="四、MCP 接入 · Cursor 及其他宿主">
        <p className="muted small">设置 → MCP → 添加 stdio 服务器：</p>
        <table className="table">
          <tbody>
            <tr>
              <td>Command</td>
              <td>
                <code>oce-client-mcp</code>
              </td>
            </tr>
            <tr>
              <td>Args</td>
              <td>
                <code>--workspace &lt;项目路径&gt;</code>
              </td>
            </tr>
            <tr>
              <td>Env</td>
              <td>
                <code>OCE_API_URL={HOST}</code>
                <br />
                <code>OCE_API_KEY=&lt;你的APIKey&gt;</code>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section title="五、连通性自检">
        <CodeBlock>{`curl -s ${HOST}/health
# {"status":"ok"}`}</CodeBlock>
      </Section>

      <Section title="六、常见问题">
        <table className="table">
          <tbody>
            <tr>
              <td>sync 卡在等待就绪</td>
              <td>首次索引较慢（约 350 文件 / 3 分钟），稍后重跑会续传</td>
            </tr>
            <tr>
              <td>401 / 未授权</td>
              <td>
                确认用的是总览页的 <code>sk-oce-*</code> key 且无多余空格/换行；
                轮换后旧 key 立即失效
              </td>
            </tr>
            <tr>
              <td>MCP 连接失败</td>
              <td>
                重开终端让 PATH/env 生效；<code>/mcp</code> 看状态；必要时用全路径
                <code>%USERPROFILE%\\.local\\bin\\oce-client-mcp.exe</code>
              </td>
            </tr>
            <tr>
              <td>检索结果为空</td>
              <td>项目是否已 sync；查询是否超出已索引内容范围</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}
