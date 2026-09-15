import { useState } from "react";
import { rotateKey } from "../api";
import type { AuthApiKey, RotateResponse } from "../types";

interface Props {
  apiKey: AuthApiKey | null;
  onRotated: () => Promise<void>;
}

export default function KeyCard({ apiKey, onRotated }: Props) {
  const [issued, setIssued] = useState<RotateResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const doRotate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await rotateKey();
      setIssued(result);
      setConfirming(false);
      await onRotated();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card">
      <h2>API Key</h2>
      {issued && (
        <div className="banner warn">
          新 key 已生效，旧 key 立即失效：
          <code className="key-plaintext">{issued.api_key}</code>
        </div>
      )}
      {apiKey && apiKey.api_key ? (
        <>
          <div className="key-row">
            <code className="key-full">{apiKey.api_key}</code>
            <span className="badge ok">{apiKey.status}</span>
          </div>
          <div className="row">
            <button className="button" onClick={() => copy(apiKey.api_key as string)}>
              {copied ? "已复制" : "复制"}
            </button>
            {confirming ? (
              <>
                <button className="button danger" disabled={busy} onClick={doRotate}>
                  {busy ? "轮换中…" : "确认轮换（旧 key 立即失效）"}
                </button>
                <button className="button ghost" onClick={() => setConfirming(false)}>
                  取消
                </button>
              </>
            ) : (
              <button className="button" onClick={() => setConfirming(true)}>
                轮换 Key
              </button>
            )}
          </div>
        </>
      ) : apiKey ? (
        <>
          <div className="key-row">
            <code>sk-oce-••••••••{apiKey.key_last4}</code>
            <span className="badge ok">{apiKey.status}</span>
          </div>
          <p className="muted small">
            这把 key 早于「常显」功能签发，轮换一次后即可完整显示。
          </p>
          <button className="button" disabled={busy} onClick={doRotate}>
            {busy ? "轮换中…" : "轮换以启用完整显示"}
          </button>
        </>
      ) : (
        <p className="muted">尚无 key</p>
      )}
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}
