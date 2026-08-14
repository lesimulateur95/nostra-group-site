import { saveWarrantyPlanV163, updateWarrantyStatusV163 } from "@/app/actions/v163";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import styles from "@/components/v163/v163.module.css";
import { getWarrantyAdminV163 } from "@/lib/v163/data";

export const dynamic = "force-dynamic";

const money = (value: unknown) =>
  Number(value ?? 0).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

const date = (value: unknown) =>
  value ? new Date(String(value)).toLocaleDateString("fr-FR") : "—";

const dateInput = (value: unknown) => {
  if (!value) return "";
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
};

export default async function WarrantyAdmin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const data = await getWarrantyAdminV163();
  const vehicles = new Map(data.vehicles.map((row: any) => [Number(row.id), row]));

  return (
    <DashboardShell allowedRoles={["manager", "employee", "commercial"]}>
      <div className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>NOSTRA CARE</p>
          <h1>Contrats de garantie</h1>
          <p className={styles.muted}>
            Les formules sont facturées en pourcentage du prix réellement payé par le
            client. Tu peux modifier le taux, la durée et la date de fin d’un contrat
            actif à tout moment.
          </p>
        </section>

        {!data.configured && <div className={styles.error}>Exécute le SQL V163 puis V163.1.</div>}
        {params.saved && <div className={styles.success}>Formule enregistrée.</div>}
        {params.contract_saved && <div className={styles.success}>Contrat mis à jour.</div>}
        {params.error && <div className={styles.error}>Une modification n’a pas pu être enregistrée.</div>}

        <section className={styles.card}>
          <p className={styles.eyebrow}>NOUVELLE GARANTIE</p>
          <form action={saveWarrantyPlanV163} className={styles.form}>
            <label>
              Nom
              <input name="name" required placeholder="Nostra Care+" />
            </label>
            <label>
              Durée en jours
              <input name="duration_days" type="number" min="1" required defaultValue="180" />
            </label>
            <label>
              Taux sur le prix du VL (%)
              <input name="rate_percent" type="number" min="0.01" max="100" step="0.01" required defaultValue="5" />
            </label>
            <label>
              Franchise
              <input name="deductible" type="number" min="0" defaultValue="0" />
            </label>
            <label className={styles.wide}>
              Description
              <textarea name="description" />
            </label>
            {[
              ["engine", "Moteur"],
              ["gearbox", "Boîte"],
              ["electronics", "Électronique"],
              ["suspension", "Suspension"],
              ["bodywork", "Carrosserie"],
              ["tyres", "Pneus"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  type="checkbox"
                  defaultChecked={["engine", "gearbox", "electronics", "suspension"].includes(name)}
                />
              </label>
            ))}
            <label>
              Active
              <input name="active" type="checkbox" defaultChecked />
            </label>
            <button className={`${styles.button} ${styles.wide}`}>Créer la formule</button>
          </form>
        </section>

        <section className={styles.grid}>
          {data.plans.map((plan: any) => (
            <form action={saveWarrantyPlanV163} className={styles.card} key={plan.id}>
              <input type="hidden" name="id" value={plan.id} />
              <p className={styles.eyebrow}>FORMULE #{plan.id}</p>
              <div className={styles.form}>
                <label>
                  Nom
                  <input name="name" required defaultValue={plan.name} />
                </label>
                <label>
                  Durée en jours
                  <input name="duration_days" type="number" min="1" required defaultValue={plan.duration_days} />
                </label>
                <label>
                  Taux (%)
                  <input name="rate_percent" type="number" min="0.01" max="100" step="0.01" required defaultValue={Number(plan.rate_percent ?? 3)} />
                </label>
                <label>
                  Franchise
                  <input name="deductible" type="number" min="0" defaultValue={Number(plan.deductible ?? 0)} />
                </label>
                <label className={styles.wide}>
                  Description
                  <textarea name="description" defaultValue={plan.description ?? ""} />
                </label>
                {[
                  ["engine", "Moteur"],
                  ["gearbox", "Boîte"],
                  ["electronics", "Électronique"],
                  ["suspension", "Suspension"],
                  ["bodywork", "Carrosserie"],
                  ["tyres", "Pneus"],
                ].map(([name, label]) => (
                  <label key={name}>
                    {label}
                    <input name={name} type="checkbox" defaultChecked={Boolean(plan[name])} />
                  </label>
                ))}
                <label>
                  Active
                  <input name="active" type="checkbox" defaultChecked={Boolean(plan.active)} />
                </label>
              </div>
              <div className={styles.row}>
                <strong>{Number(plan.rate_percent ?? 0)} % du prix payé</strong>
                <span className={styles.pill}>{plan.duration_days} jours</span>
              </div>
              <button className={styles.button}>Enregistrer la formule</button>
            </form>
          ))}
        </section>

        <section className={styles.card}>
          <h2>Contrats clients</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Contrat</th>
                  <th>Véhicule</th>
                  <th>Formule</th>
                  <th>Base</th>
                  <th>Prix</th>
                  <th>Début</th>
                  <th>Fin modifiable</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.contracts.map((contract: any) => {
                  const vehicle: any = vehicles.get(Number(contract.customer_vehicle_id));
                  return (
                    <tr key={contract.id}>
                      <td>{contract.contract_number}</td>
                      <td>
                        {vehicle
                          ? `${vehicle.brand ?? ""} ${vehicle.model ?? ""}`.trim() || vehicle.vehicle_name
                          : `VL #${contract.customer_vehicle_id}`}
                      </td>
                      <td>
                        {contract.plan_name}
                        <div className={styles.mini}>
                          {Number(contract.rate_percent ?? 0)} % · {contract.duration_days} jours
                        </div>
                      </td>
                      <td>{money(contract.reference_vehicle_price ?? vehicle?.purchase_price)}</td>
                      <td>{money(contract.amount)}</td>
                      <td>{date(contract.starts_at)}</td>
                      <td colSpan={2}>
                        <form action={updateWarrantyStatusV163} className={styles.row}>
                          <input type="hidden" name="id" value={contract.id} />
                          <input type="date" name="ends_at" defaultValue={dateInput(contract.ends_at)} />
                          <select name="status" defaultValue={contract.status}>
                            <option value="pending_payment">Paiement attendu</option>
                            <option value="active">Actif</option>
                            <option value="expired">Expiré</option>
                            <option value="cancelled">Annulé</option>
                          </select>
                          <button className={styles.buttonAlt}>Enregistrer</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
