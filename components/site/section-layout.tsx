import Link from "next/link";
import { Topbar } from "@/components/site/topbar";

type Item = { href: string; label: string };

export function SectionLayout({ title, items, children }: { title: string; items: Item[]; children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <Topbar />
      <div className="section-shell">
        <aside className="sidebar">
          <div className="sidebar-title">{title}</div>
          <nav className="side-nav">
            {items.map((item) => (
              <Link className="side-link" href={item.href} key={item.href}>{item.label}</Link>
            ))}
          </nav>
        </aside>
        <main className="section-content">{children}</main>
      </div>
    </div>
  );
}
