import { useState } from "react";

interface Props {
  children: string;
}

export default function CodeBlock({ children }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="codeblock">
      <button className="button ghost copy-btn" onClick={copy}>
        {copied ? "已复制" : "复制"}
      </button>
      <pre>
        <code>{children}</code>
      </pre>
    </div>
  );
}
