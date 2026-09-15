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
      {issued ? (
        <div className="issued">
          <div className="banner warn">
            新 key 只显示这一次，旧 key 已立即失效。请复制保存：
          </div>
          <code className="key-plaintext">{issued.api_key}</code>
          <div className="row">
            <button className="button" onClick={() => copy(issued.api_key)}>
              {copied ? "已复制" : "复制"}
            </button>
            <button className="button ghost" onClick={() => setIssued(null)}>
              完成
            </button>
          </div>
        </div>
      ) : apiKey ? (
        <>
          <div className="key-row">
            <code>sk-oce-••••••••{apiKey.key_last4}</code>
            <span className="badge ok">{apiKey.status}</span>
          </div>
          {confirming ? (
            <div className="row">
              <span className="muted small">确认轮换？旧 key 将立即失效。</span>
              <button className="button danger" disabled={busy} onClick={doRotate}>
                {busy ? "轮换中…" : "确认"}
              </button>
              <button className="button ghost" onClick={() => setConfirming(false)}>
                取消
              </button>
            </div>
          ) : (
            <button className="button" onClick={() => setConfirming(true)}>
              轮换 Key
            </button>
          )}
        </>
      ) : (
        <p className="muted">尚无 key</p>
      )}
      {error && <div className="banner error">{error}</div>}
    </div>
  );
}
