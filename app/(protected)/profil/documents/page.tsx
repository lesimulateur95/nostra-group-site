import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getProfileCommerceData } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function ProfileDocumentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const commerce = await getProfileCommerceData(data.user.id);

  return (
    <>
      <ProfileSectionHeader eyebrow="ESPACE DOCUMENTAIRE" title="Documents & factures" description="Retrouve ici les factures et documents mis à disposition par Nostra Group." />
      <section className="profile-data-section profile-standalone-section">
        <div className="profile-data-heading"><div><p className="eyebrow">DOCUMENTS</p><h2>Mes factures</h2></div><span>{commerce.invoices.length}</span></div>
        <div className="profile-table-wrap">
          <table className="profile-data-table">
            <thead><tr><th>Facture</th><th>Date</th><th>Statut</th><th>Montant</th><th>Document</th></tr></thead>
            <tbody>
              {commerce.invoices.length === 0 && <tr><td colSpan={5} className="empty-table-cell">Aucun document disponible.</td></tr>}
              {commerce.invoices.map((invoice) => <tr key={invoice.id}><td><strong>{invoice.invoice_number}</strong></td><td>{new Date(invoice.issued_at).toLocaleDateString("fr-FR")}</td><td>{invoice.status}</td><td>{money(invoice.amount)}</td><td>{invoice.download_url ? <a href={invoice.download_url} target="_blank" rel="noreferrer">Ouvrir ↗</a> : "À venir"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
