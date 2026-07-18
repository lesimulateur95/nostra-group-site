import { Topbar } from "@/components/site/topbar";
import { SidebarNav, type SidebarNavItem } from "@/components/site/sidebar-nav";

export function SectionLayout({ title, items, children }: { title: string; items: SidebarNavItem[]; children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <Topbar />
      <div className="section-shell">
        <aside className="sidebar">
          <div className="sidebar-title">{title}</div>
          <SidebarNav items={items} />
        </aside>
        <main className="section-content">{children}</main>
      </div>
    </div>
  );
}
