/* eslint-disable @next/next/no-img-element */

import { qrImageUrl, verificationUrl } from "@/lib/documents/format";

import styles from "./document-qr.module.css";

export function DocumentQr({
  code,
  size = 150,
  compact = false,
}: {
  code: string;
  size?: number;
  compact?: boolean;
}) {
  const target = verificationUrl(code);

  return (
    <div className={compact ? styles.compact : styles.root}>
      <a href={target} target="_blank" rel="noreferrer">
        <img
          src={qrImageUrl(code, size)}
          width={size}
          height={size}
          alt={`QR code de vérification du document ${code}`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </a>
      {!compact && (
        <div>
          <strong>Vérification publique</strong>
          <span>{code}</span>
          <a href={target} target="_blank" rel="noreferrer">
            Vérifier le document ↗
          </a>
        </div>
      )}
    </div>
  );
}
