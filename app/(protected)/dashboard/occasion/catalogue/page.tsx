import {
  deleteUsedVehiclePurchase,
  toggleUsedVehiclePublication,
} from "@/app/actions/used-vehicles";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { UsedVehicleDashboardNav } from "@/components/used-vehicles/used-dashboard-nav";
import styles from "@/components/used-vehicles/used-vehicles.module.css";
import { getRequestRoleKeys } from "@/lib/auth/request-context";
import { createClient } from "@/lib/supabase/server";

type UsedCatalogueVehicle = {
  id: number;
  brand: string;
  model: string;
  price: number | string;
  published: boolean;
  stock_quantity: number;
  used_vehicle_status: string | null;
};

function money(value: number | string) {
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function statusLabel(status: string | null) {
  if (status === "reserved") return "Réservé";
  if (status === "sold") return "Vendu";
  if (status === "unavailable") return "Indisponible";
  return "Disponible";
}

export default async function UsedVehicleCataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [params, roles, supabase] = await Promise.all([
    searchParams,
    getRequestRoleKeys(),
    createClient(),
  ]);

  const result = await (supabase as any)
    .from("catalog_vehicles")
    .select(
      "id,brand,model,price,published,stock_quantity,used_vehicle_status",
    )
    .eq("catalog_type", "used")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const configured = !result.error;
  const vehicles = (result.data ?? []) as UsedCatalogueVehicle[];
  const canDelete = roles.includes("manager");

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <DashboardHeader
        title="Catalogue — Véhicules d’occasion"
        description="Gère la visibilité publique et supprime les véhicules rachetés qui ne doivent plus rester dans le catalogue."
      />
      <UsedVehicleDashboardNav current="/dashboard/occasion/catalogue" />

      {params.saved && (
        <div className="dashboard-feedback dashboard-feedback-success">
          La visibilité du véhicule a été mise à jour.
        </div>
      )}
      {params.deleted && (
        <div className="dashboard-feedback dashboard-feedback-success">
          Le véhicule a été supprimé définitivement.
        </div>
      )}
      {params.error && (
        <div className="dashboard-feedback dashboard-feedback-error">
          {params.error === "active-order"
            ? "Impossible de supprimer ce véhicule : une commande ou une réservation est encore active. Termine ou supprime d’abord la demande concernée."
            : params.error === "sales"
              ? "Impossible de supprimer ce véhicule : il possède déjà un historique de vente. Tu peux le retirer du catalogue public en le dépubliant."
              : params.error === "not-found"
                ? "Ce véhicule d’occasion n’existe plus."
                : params.error === "forbidden"
                  ? "Seul un gérant peut supprimer définitivement un véhicule."
                  : "Impossible de supprimer ce véhicule. Vérifie qu’il ne possède aucune commande ou vente liée."}
        </div>
      )}

      {!configured ? (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Le catalogue des véhicules d’occasion ne répond pas</h2>
          <p>Vérifie que le SQL V92 des véhicules rachetés est bien installé.</p>
        </section>
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Véhicules rachetés</h2>
              <p>{vehicles.length} véhicule(s) enregistré(s).</p>
            </div>
          </div>

          {vehicles.length === 0 ? (
            <div className={styles.empty}>Aucun véhicule racheté enregistré.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Véhicule</th>
                    <th>Prix de vente</th>
                    <th>Stock</th>
                    <th>Statut</th>
                    <th>Catalogue public</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td>
                        <strong>
                          {vehicle.brand} {vehicle.model}
                        </strong>
                        <small className="order-client-note">
                          Identifiant #{vehicle.id}
                        </small>
                      </td>
                      <td>{money(vehicle.price)}</td>
                      <td>{vehicle.stock_quantity}</td>
                      <td>
                        <span className={styles.badge}>
                          {statusLabel(vehicle.used_vehicle_status)}
                        </span>
                      </td>
                      <td>
                        <form action={toggleUsedVehiclePublication}>
                          <input
                            type="hidden"
                            name="vehicle_id"
                            value={vehicle.id}
                          />
                          <input
                            type="hidden"
                            name="published"
                            value={vehicle.published ? "false" : "true"}
                          />
                          <button className={styles.primary} type="submit">
                            {vehicle.published
                              ? "Retirer du catalogue"
                              : "Publier dans le catalogue"}
                          </button>
                        </form>
                      </td>
                      <td>
                        {canDelete ? (
                          <form
                            action={deleteUsedVehiclePurchase}
                            className={styles.actions}
                          >
                            <input
                              type="hidden"
                              name="vehicle_id"
                              value={vehicle.id}
                            />
                            <input
                              type="hidden"
                              name="return_to"
                              value="catalogue"
                            />
                            <button className={styles.danger} type="submit">
                              Supprimer définitivement
                            </button>
                          </form>
                        ) : (
                          <span className={styles.muted}>Gérant uniquement</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </DashboardShell>
  );
}
