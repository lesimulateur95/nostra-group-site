import { redirect } from "next/navigation";
import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import { getProfileCommerceData } from "@/lib/backoffice/data";
import { createClient } from "@/lib/supabase/server";

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export default async function ProfileOrdersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/");
  const commerce = await getProfileCommerceData(data.user.id);
  const labels: Record<string, string> = { pending: "Envoyée", confirmed: "Confirmée", preparing: "En préparation", ready: "Prête", completed: "Terminée", cancelled: "Annulée" };

  return (
    <>
      <ProfileSectionHeader eyebrow="NOSTRA MOTORS" title="Mes commandes" description="Suis l’avancement de chaque commande et les messages transmis par l’équipe commerciale." />
      <section className="profile-data-section profile-standalone-section">
        <div className="profile-data-heading"><div><p className="eyebrow">HISTORIQUE</p><h2>Commandes enregistrées</h2></div><span>{commerce.orders.length}</span></div>
        <div className="profile-table-wrap">
          <table className="profile-data-table">
            <thead><tr><th>Numéro</th><th>Date</th><th>Statut</th><th>Total</th></tr></thead>
            <tbody>
              {commerce.orders.length === 0 && <tr><td colSpan={4} className="empty-table-cell">Aucune commande enregistrée.</td></tr>}
              {commerce.orders.map((order) => <tr key={order.id}><td><strong>{order.order_number}</strong>{order.admin_note && <small className="order-client-note">{order.admin_note}</small>}</td><td>{new Date(order.created_at).toLocaleDateString("fr-FR")}</td><td><span className={`order-status order-status-${order.status}`}>{labels[order.status] ?? order.status}</span></td><td>{money(order.total)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
