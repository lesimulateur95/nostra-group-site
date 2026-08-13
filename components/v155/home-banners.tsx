import Link from "next/link";
import styles from "./v155.module.css";
export function HomeBannersV155({banners}:{banners:any[]}){if(!banners.length)return null;return <section>{banners.map(b=><article className={styles.banner} key={b.id}><strong>{b.title}</strong><p>{b.message}</p>{b.cta_url&&<Link className={styles.buttonAlt} href={b.cta_url}>{b.cta_label||"Découvrir"}</Link>}</article>)}</section>}
