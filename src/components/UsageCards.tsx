import type { AuthUsageWindow } from "../types";

interface Props {
  usage24h: AuthUsageWindow;
  usage7d: AuthUsageWindow;
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="tile">
      <div className="tile-value">{value}</div>
      <div className="tile-label">{label}</div>
    </div>
  );
}

export default function UsageCards({ usage24h, usage7d }: Props) {
  return (
    <div className="card">
      <h2>用量</h2>
      <div className="tiles">
        <Tile label="24h 调用" value={usage24h.api_calls} />
        <Tile label="24h tokens" value={usage24h.total_tokens.toLocaleString()} />
        <Tile label="7 天调用" value={usage7d.api_calls} />
        <Tile label="7 天 tokens" value={usage7d.total_tokens.toLocaleString()} />
      </div>
    </div>
  );
}
