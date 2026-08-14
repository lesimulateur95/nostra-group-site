import Link from "next/link";

import styles from "./global-temporary-banners.module.css";

type TemporaryBannerV155 = {
  id: string | number;
  title?: string | null;
  message?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  pole?: string | null;
};

function BannerLink({ href, label }: { href: string; label: string }) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a className={styles.cta} href={href} target="_blank" rel="noreferrer">
        {label}
      </a>
    );
  }

  return (
    <Link className={styles.cta} href={href}>
      {label}
    </Link>
  );
}

export function GlobalTemporaryBannersV155({
  banners,
}: {
  banners: TemporaryBannerV155[];
}) {
  if (!banners.length) return null;

  return (
    <section className={styles.stack} aria-label="Informations temporaires Nostra Group">
      {banners.map((banner) => {
        const title = String(banner.title ?? "").trim();
        const message = String(banner.message ?? "").trim();
        const href = String(banner.cta_url ?? "").trim();
        const label = String(banner.cta_label ?? "Découvrir").trim() || "Découvrir";

        return (
          <aside className={styles.banner} key={banner.id} role="status">
            <div className={styles.content}>
              {title ? <strong>{title}</strong> : null}
              {message ? <span>{message}</span> : null}
            </div>
            {href ? <BannerLink href={href} label={label} /> : null}
          </aside>
        );
      })}
    </section>
  );
}
