import { saveCircuitStatus, saveMotorsStatus } from "@/app/actions/backoffice";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCircuitSetting, getMotorsSetting, getMotorsStatusConfigured } from "@/lib/backoffice/data";

const CIRCUIT_STATUS_OPTIONS = [
  { value: "open", label: "Ouvert", description: "Le circuit accueille normalement les membres." },
  { value: "closed", label: "Fermé", description: "Le circuit est fermé au public et aux pilotes." },
  { value: "maintenance", label: "Maintenance", description: "La piste ou les installations sont en maintenance." },
  { value: "reserved", label: "Réservé", description: "Le circuit est réservé pour une activité privée." },
  { value: "competition", label: "Compétition en cours", description: "Une compétition officielle est actuellement organisée." },
] as const;

const MOTORS_STATUS_OPTIONS = [
  { value: "open", label: "Ouverte", description: "La concession accueille normalement les clients." },
  { value: "closed", label: "Fermée", description: "La concession est actuellement fermée." },
  { value: "appointment", label: "Sur rendez-vous", description: "La concession reçoit uniquement sur rendez-vous." },
  { value: "inventory", label: "Mise à jour du stock", description: "Le catalogue ou le stock est en cours de mise à jour." },
  { value: "event", label: "Événement privé", description: "Une vente privée ou un événement Nostra Motors est en cours." },
] as const;

const MOTORS_STATUS_SQL = `create table if not exists public.motors_settings (
  id integer primary key default 1 check (id = 1),
  status text not null default 'open',
  label text not null default 'Concession ouverte',
  message text not null default 'Nostra Motors accueille actuellement ses clients.',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.motors_settings (id) values (1) on conflict (id) do nothing;

alter table public.motors_settings enable row level security;

drop policy if exists "motors settings readable" on public.motors_settings;
create policy "motors settings readable" on public.motors_settings
for select to authenticated using (true);

drop policy if exists "manager manages motors settings" on public.motors_settings;
create policy "manager manages motors settings" on public.motors_settings
for all to authenticated
using (public.has_nostra_dashboard_access())
with check (public.has_nostra_dashboard_access());`;

export default async function ActivityStatusDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const [circuitSetting, motorsSetting, motorsConfigured] = await Promise.all([
    getCircuitSetting(),
    getMotorsSetting(),
    getMotorsStatusConfigured(),
  ]);
  const selectedCircuitStatus = CIRCUIT_STATUS_OPTIONS.some((option) => option.value === circuitSetting.status) ? circuitSetting.status : "closed";
  const selectedMotorsStatus = MOTORS_STATUS_OPTIONS.some((option) => option.value === motorsSetting.status) ? motorsSetting.status : "closed";

  return (
    <DashboardShell>
      <DashboardHeader title="État des activités" description="Gère au même endroit l’état public du Nostra Circuit et de Nostra Motors." />

      {params.saved && <div className="dashboard-feedback dashboard-feedback-success">L’état du circuit a été publié.</div>}
      {params.error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer l’état du circuit.</div>}
      {params.motors_saved && <div className="dashboard-feedback dashboard-feedback-success">L’état de Nostra Motors a été publié.</div>}
      {params.motors_error && <div className="dashboard-feedback dashboard-feedback-error">Impossible d’enregistrer l’état de Nostra Motors.</div>}

      {!motorsConfigured && (
        <section className="dashboard-setup">
          <span className="module-status">Activation nécessaire</span>
          <h2>Activer l’état de Nostra Motors</h2>
          <p>Cette opération est à faire une seule fois dans Supabase pour enregistrer et afficher l’état de la concession.</p>
          <details>
            <summary>Afficher le code SQL à copier dans Supabase</summary>
            <pre>{MOTORS_STATUS_SQL}</pre>
          </details>
          <ol>
            <li>Ouvre <strong>Supabase → SQL Editor → New query</strong>.</li>
            <li>Colle tout le code et clique sur <strong>Run query</strong>.</li>
            <li>Reviens ici et fais <strong>Ctrl + F5</strong>.</li>
          </ol>
        </section>
      )}

      <section className="dashboard-section-heading dashboard-section-heading-tight">
        <p className="eyebrow">NOSTRA CIRCUIT</p>
        <h2>État du circuit</h2>
        <p>Cette information apparaît en haut de toutes les pages du Nostra Circuit.</p>
      </section>
      <section className="dashboard-two-columns dashboard-circuit-columns">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">🏁</span><div><h2>Modifier l’état du circuit</h2><p>Choisis un état, un titre court et un message destiné aux membres.</p></div></div>
          <form action={saveCircuitStatus} className="backoffice-form" autoComplete="off">
            <fieldset className="status-choice-fieldset form-span-2">
              <legend>État du circuit</legend>
              <div className="status-choice-grid">
                {CIRCUIT_STATUS_OPTIONS.map((option) => (
                  <label className="status-choice" key={option.value}>
                    <input type="radio" name="circuit_status" value={option.value} defaultChecked={selectedCircuitStatus === option.value} />
                    <span className="status-choice-card"><strong>{option.label}</strong><small>{option.description}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="form-span-2">Titre affiché<input name="circuit_label" defaultValue={circuitSetting.label} required maxLength={100} /></label>
            <label className="form-span-2">Message<textarea name="circuit_message" defaultValue={circuitSetting.message} rows={6} required maxLength={500} /></label>
            <button className="btn" type="submit">Publier l’état du circuit</button>
          </form>
        </article>
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">◉</span><div><h2>Aperçu du circuit</h2><p>Voici ce que les membres voient en haut des pages.</p></div></div>
          <div className={`circuit-status-banner circuit-status-${circuitSetting.status}`}>
            <span className="circuit-status-dot" />
            <div><small>ÉTAT DU CIRCUIT</small><strong>{circuitSetting.label}</strong><p>{circuitSetting.message}</p></div>
          </div>
        </article>
      </section>

      <section className="dashboard-section-heading dashboard-section-heading-tight activity-status-separator">
        <p className="eyebrow">NOSTRA MOTORS</p>
        <h2>État de la concession</h2>
        <p>Cette information apparaît en haut de toutes les pages de Nostra Motors.</p>
      </section>
      <section className="dashboard-two-columns dashboard-circuit-columns">
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">🚗</span><div><h2>Modifier l’état de Nostra Motors</h2><p>Indique si la concession est ouverte, fermée, sur rendez-vous ou occupée par un événement.</p></div></div>
          <form action={saveMotorsStatus} className="backoffice-form" autoComplete="off">
            <fieldset className="status-choice-fieldset form-span-2" disabled={!motorsConfigured}>
              <legend>État de Nostra Motors</legend>
              <div className="status-choice-grid">
                {MOTORS_STATUS_OPTIONS.map((option) => (
                  <label className="status-choice" key={option.value}>
                    <input type="radio" name="motors_status" value={option.value} defaultChecked={selectedMotorsStatus === option.value} />
                    <span className="status-choice-card"><strong>{option.label}</strong><small>{option.description}</small></span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="form-span-2">Titre affiché<input name="motors_label" defaultValue={motorsSetting.label} required maxLength={100} disabled={!motorsConfigured} /></label>
            <label className="form-span-2">Message<textarea name="motors_message" defaultValue={motorsSetting.message} rows={6} required maxLength={500} disabled={!motorsConfigured} /></label>
            <button className="btn" type="submit" disabled={!motorsConfigured}>Publier l’état de Nostra Motors</button>
          </form>
        </article>
        <article className="backoffice-panel">
          <div className="panel-heading"><span className="panel-icon">◉</span><div><h2>Aperçu de la concession</h2><p>Voici ce que les clients voient en haut des pages Nostra Motors.</p></div></div>
          <div className={`circuit-status-banner circuit-status-${motorsSetting.status}`}>
            <span className="circuit-status-dot" />
            <div><small>ÉTAT DE NOSTRA MOTORS</small><strong>{motorsSetting.label}</strong><p>{motorsSetting.message}</p></div>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
