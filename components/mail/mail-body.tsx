import Link from "next/link";
import styles from "./mail.module.css";

const actionPattern = /\[\[ACTION:([^|\]]+)\|([^\]]+)\]\]/g;

export function mailPreviewText(body: string): string {
  return body.replace(actionPattern, "$2").replace(/\s+/g, " ").trim();
}

export function MailBody({ body }: { body: string }) {
  actionPattern.lastIndex = 0;
  const parts: Array<{ type: "text" | "action"; text: string; href?: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = actionPattern.exec(body)) !== null) {
    const before = body.slice(lastIndex, match.index).trim();
    if (before) parts.push({ type: "text", text: before });
    parts.push({ type: "action", text: match[2].trim(), href: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  const after = body.slice(lastIndex).trim();
  if (after) parts.push({ type: "text", text: after });
  if (parts.length === 0) parts.push({ type: "text", text: body });

  return (
    <div className={styles.richMailBody}>
      {parts.map((part, index) =>
        part.type === "action" && part.href?.startsWith("/") ? (
          <Link className={styles.mailActionButton} href={part.href} key={`${part.href}-${index}`}>
            {part.text}
          </Link>
        ) : (
          <p key={index}>{part.text}</p>
        ),
      )}
    </div>
  );
}
