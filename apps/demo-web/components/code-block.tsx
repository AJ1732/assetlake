import { CopyButton } from "./copy-button";

export function CodeBlock({
  code,
  caption,
}: {
  code: string;
  caption: string;
}) {
  return (
    <figure className="code-block">
      <figcaption>
        <span className="font-mono text-xs">{caption}</span>
        <CopyButton value={code} label="Copy code" />
      </figcaption>
      <pre tabIndex={0} translate="no">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
