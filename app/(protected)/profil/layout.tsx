import { Topbar } from "@/components/site/topbar";

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-shell">
      <Topbar />
      <main className="profile-main">{children}</main>
    </div>
  );
}
