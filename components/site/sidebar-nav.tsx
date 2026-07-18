"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SidebarNavItem = {
  href: string;
  label: string;
  children?: Array<{ href: string; label: string }>;
};

function cleanHref(href: string): string {
  return href.split("#")[0];
}

export function SidebarNav({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="Navigation de la section">
      {items.map((item) => {
        if (!item.children?.length) {
          const active = pathname === cleanHref(item.href);
          return (
            <Link className={`side-link${active ? " side-link-active" : ""}`} href={item.href} key={item.href}>
              {item.label}
            </Link>
          );
        }

        const open = item.children.some((child) => pathname === cleanHref(child.href)) || pathname === cleanHref(item.href);
        return (
          <details className="side-group" key={item.href} open={open}>
            <summary className="side-group-title">
              <span>{item.label}</span>
              <span className="side-group-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="side-subnav">
              {item.children.map((child) => {
                const active = pathname === cleanHref(child.href);
                return (
                  <Link className={`side-sublink${active ? " side-sublink-active" : ""}`} href={child.href} key={child.href}>
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
