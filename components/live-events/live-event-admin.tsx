"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  EMPTY_BRACKET,
  EMPTY_TABLE,
  type CustomTableData,
  type EventCitizen,
  type LiveEventBoard,
  type LiveEventFormat,
  type LiveEventStatus,
  type TableColumn,
} from "@/lib/live-events/types";
import { EventBoardDisplay } from "./event-board-display";
import styles from "./live-events.module.css";

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function dbPayload(event: LiveEventBoard) {
  return {
    title: event.title,
    subtitle: event.subtitle,
    location: event.location,
    starts_at: event.starts_at || null,
    format: event.format,
    status: event.status,
    accent_color: event.accent_color,
    bracket_data: event.bracket_data,
    table_data: event.table_data,
  };
}

export function LiveEventAdmin({
  initialEvents,
  citizens,
}: {
  initialEvents: LiveEventBoard[];
  citizens: EventCitizen[];
}) {
  const [events, setEvents] = useState(initialEvents);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);

  function replaceLocal(event: LiveEventBoard) {
    setEvents((current) => current.map((item) => (item.id === event.id ? event : item)));
  }

  async function save(event: LiveEventBoard, successMessage?: string) {
    replaceLocal(event);
    const supabase = createClient();
    const { error } = await supabase
      .from("live_event_boards")
      .update(dbPayload(event))
      .eq("id", event.id);
    setMessage(error ? `Erreur : ${error.message}` : successMessage ?? "Modifications enregistrées.");
  }

  async function createEvent(formData: FormData) {
    setCreating(true);
    setMessage("");
    const format: LiveEventFormat = formData.get("format") === "table" ? "table" : "bracket";
    const payload = {
      title: String(formData.get("title") ?? "").trim(),
      subtitle: String(formData.get("subtitle") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      starts_at: String(formData.get("starts_at") ?? "") || null,
      format,
      status: "draft" as const,
      accent_color: String(formData.get("accent_color") ?? "#d4af37"),
      bracket_data: EMPTY_BRACKET,
      table_data: EMPTY_TABLE,
    };
    const supabase = createClient();
    const { data, error } = await supabase
      .from("live_event_boards")
      .insert(payload)
      .select("*")
      .single();
    if (error || !data) {
      setMessage(`Erreur : ${error?.message ?? "création impossible"}`);
    } else {
      setEvents((current) => [data as LiveEventBoard, ...current]);
      setMessage("Événement créé en brouillon.");
    }
    setCreating(false);
  }

  async function deleteEvent(id: number) {
    if (!window.confirm("Supprimer définitivement cet événement ?")) return;
    setEvents((current) => current.filter((event) => event.id !== id));
    const { error } = await createClient().from("live_event_boards").delete().eq("id", id);
    setMessage(error ? `Erreur : ${error.message}` : "Événement supprimé.");
  }

  function updateField<K extends keyof LiveEventBoard>(
    event: LiveEventBoard,
    key: K,
    value: LiveEventBoard[K],
  ) {
    replaceLocal({ ...event, [key]: value });
  }

  function saveCurrent(id: number) {
    const current = events.find((event) => event.id === id);
    if (current) void save(current);
  }

  function citizenFrom(value: string): EventCitizen | null {
    return citizens.find((citizen) => citizen.user_id === value) ?? null;
  }

  function setBracketSize(event: LiveEventBoard, size: 4 | 8 | 16) {
    void save({
      ...event,
      bracket_data: {
        size,
        participants: Array.from({ length: size }, (_, index) => event.bracket_data.participants[index] ?? null),
        winners: {},
      },
    });
  }

  function setParticipant(event: LiveEventBoard, index: number, value: string) {
    const participants = [...event.bracket_data.participants];
    participants[index] = citizenFrom(value);
    void save({
      ...event,
      bracket_data: { ...event.bracket_data, participants, winners: {} },
    });
  }

  function setWinner(event: LiveEventBoard, round: number, match: number, citizen: EventCitizen) {
    const key = `r${round}m${match}`;
    const winners = { ...event.bracket_data.winners, [key]: citizen };
    for (const existingKey of Object.keys(winners)) {
      const matchResult = /^r(\d+)m/.exec(existingKey);
      if (matchResult && Number(matchResult[1]) > round) delete winners[existingKey];
    }
    void save({ ...event, bracket_data: { ...event.bracket_data, winners } });
  }

  function saveTable(event: LiveEventBoard, table_data: CustomTableData) {
    void save({ ...event, table_data });
  }

  function addColumn(event: LiveEventBoard) {
    const column: TableColumn = { id: uid("col"), label: "Nouvelle colonne", kind: "text" };
    saveTable(event, { ...event.table_data, columns: [...event.table_data.columns, column] });
  }

  function updateColumn(event: LiveEventBoard, columnId: string, patch: Partial<TableColumn>) {
    saveTable(event, {
      ...event.table_data,
      columns: event.table_data.columns.map((column) =>
        column.id === columnId ? { ...column, ...patch } : column,
      ),
    });
  }

  function removeColumn(event: LiveEventBoard, columnId: string) {
    if (event.table_data.columns.length <= 1) return;
    saveTable(event, {
      columns: event.table_data.columns.filter((column) => column.id !== columnId),
      rows: event.table_data.rows.map((row) => {
        const cells = { ...row.cells };
        delete cells[columnId];
        return { ...row, cells };
      }),
    });
  }

  function addRow(event: LiveEventBoard) {
    saveTable(event, {
      ...event.table_data,
      rows: [...event.table_data.rows, { id: uid("row"), cells: {} }],
    });
  }

  function removeRow(event: LiveEventBoard, rowId: string) {
    saveTable(event, {
      ...event.table_data,
      rows: event.table_data.rows.filter((row) => row.id !== rowId),
    });
  }

  function updateCell(event: LiveEventBoard, rowId: string, columnId: string, value: string) {
    const column = event.table_data.columns.find((item) => item.id === columnId);
    const cell = column?.kind === "citizen" ? citizenFrom(value) : value;
    saveTable(event, {
      ...event.table_data,
      rows: event.table_data.rows.map((row) =>
        row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: cell } } : row,
      ),
    });
  }

  return (
    <div className={styles.page}>
      {message && <div className={styles.notice}>{message}</div>}

      <section className={styles.panel}>
        <p className="eyebrow">NOUVEL ÉVÉNEMENT</p>
        <h2>Créer un tableau en direct</h2>
        <p className={styles.muted}>Choisis le format. L’événement reste invisible tant que tu ne cliques pas sur « Lancer en direct ».</p>
        <form action={createEvent} className={styles.createGrid}>
          <label className={styles.field}>Nom de l’événement<input name="title" required placeholder="Tournoi Nostra" /></label>
          <label className={styles.field}>Format<select name="format"><option value="bracket">Tournoi à élimination</option><option value="table">Tableau libre</option></select></label>
          <label className={styles.field}>Couleur<input name="accent_color" type="color" defaultValue="#d4af37" /></label>
          <label className={styles.field}>Sous-titre<input name="subtitle" placeholder="Qualifications, soirée spéciale…" /></label>
          <label className={styles.field}>Lieu<input name="location" placeholder="Nostra Circuit" /></label>
          <label className={styles.field}>Date et heure<input name="starts_at" type="datetime-local" /></label>
          <div className={`${styles.buttonRow} ${styles.full}`}><button className={styles.primary} disabled={creating} type="submit">{creating ? "Création…" : "Créer l’événement"}</button></div>
        </form>
      </section>

      {events.length === 0 && <div className={styles.panel}>Aucun tableau créé pour le moment.</div>}

      {events.map((event) => (
        <article className={styles.eventCard} key={event.id}>
          <header className={styles.eventHeader}>
            <div>
              <span className={`${styles.status} ${event.status === "live" ? styles.live : ""}`}>{event.status === "draft" ? "Brouillon" : event.status === "live" ? "En direct" : "Terminé"}</span>
              <h2>{event.title}</h2>
              <div className={styles.eventMeta}><span>{event.format === "bracket" ? "Tournoi à élimination" : "Tableau libre"}</span><span>• Mise à jour publique en direct</span></div>
            </div>
            <button className={styles.danger} type="button" onClick={() => void deleteEvent(event.id)}>Supprimer</button>
          </header>

          <div className={styles.editor}>
            <div className={styles.settingsGrid}>
              <label className={styles.field}>Nom<input value={event.title} onChange={(e) => updateField(event, "title", e.target.value)} onBlur={() => saveCurrent(event.id)} /></label>
              <label className={styles.field}>Sous-titre<input value={event.subtitle} onChange={(e) => updateField(event, "subtitle", e.target.value)} onBlur={() => saveCurrent(event.id)} /></label>
              <label className={styles.field}>Lieu<input value={event.location} onChange={(e) => updateField(event, "location", e.target.value)} onBlur={() => saveCurrent(event.id)} /></label>
              <label className={styles.field}>Date<input type="datetime-local" value={event.starts_at?.slice(0, 16) ?? ""} onChange={(e) => updateField(event, "starts_at", e.target.value || null)} onBlur={() => saveCurrent(event.id)} /></label>
              <label className={styles.field}>Couleur<input type="color" value={event.accent_color} onChange={(e) => { const updated = { ...event, accent_color: e.target.value }; replaceLocal(updated); void save(updated); }} /></label>
            </div>

            <div className={styles.formatTabs}>
              <button className={event.format === "bracket" ? styles.activeTab : ""} type="button" onClick={() => void save({ ...event, format: "bracket" })}>Tournoi à élimination</button>
              <button className={event.format === "table" ? styles.activeTab : ""} type="button" onClick={() => void save({ ...event, format: "table" })}>Tableau libre</button>
            </div>

            {event.format === "bracket" && (
              <section>
                <div className={styles.buttonRow}>
                  <strong>Nombre de participants :</strong>
                  {([4, 8, 16] as const).map((size) => <button className={event.bracket_data.size === size ? styles.primary : styles.secondary} type="button" key={size} onClick={() => setBracketSize(event, size)}>{size}</button>)}
                </div>
                <div className={styles.participantGrid} style={{ marginTop: 14 }}>
                  {event.bracket_data.participants.map((participant, index) => (
                    <label className={styles.participant} key={index}><span className={styles.seed}>{index + 1}</span><select className={styles.select} value={participant?.user_id ?? ""} onChange={(e) => setParticipant(event, index, e.target.value)}><option value="">Choisir un citoyen</option>{citizens.map((citizen) => <option value={citizen.user_id} key={citizen.user_id}>{citizen.name}</option>)}</select></label>
                  ))}
                </div>
              </section>
            )}

            {event.format === "table" && (
              <section>
                <div className={styles.tableTools}><button className={styles.secondary} type="button" onClick={() => addColumn(event)}>＋ Ajouter une colonne</button><button className={styles.primary} type="button" onClick={() => addRow(event)}>＋ Ajouter une ligne</button></div>
                <div className={styles.adminTableWrap}>
                  <table className={styles.adminTable}>
                    <thead><tr>{event.table_data.columns.map((column) => <th key={column.id}><div className={styles.columnHead}><input className={styles.columnInput} value={column.label} onChange={(e) => updateField(event, "table_data", { ...event.table_data, columns: event.table_data.columns.map((item) => item.id === column.id ? { ...item, label: e.target.value } : item) })} onBlur={(e) => updateColumn(event, column.id, { label: e.target.value })} /><select className={styles.select} value={column.kind} onChange={(e) => updateColumn(event, column.id, { kind: e.target.value === "citizen" ? "citizen" : "text" })}><option value="text">Texte libre</option><option value="citizen">Citoyen</option></select><button className={styles.tinyButton} type="button" onClick={() => removeColumn(event, column.id)}>✕</button></div></th>)}<th>Actions</th></tr></thead>
                    <tbody>{event.table_data.rows.map((row) => <tr key={row.id}>{event.table_data.columns.map((column) => { const cell = row.cells[column.id]; return <td key={column.id}>{column.kind === "citizen" ? <select className={styles.select} value={cell && typeof cell === "object" ? cell.user_id : ""} onChange={(e) => updateCell(event, row.id, column.id, e.target.value)}><option value="">Choisir un citoyen</option>{citizens.map((citizen) => <option value={citizen.user_id} key={citizen.user_id}>{citizen.name}</option>)}</select> : <input className={styles.cellInput} defaultValue={typeof cell === "string" ? cell : ""} onBlur={(e) => updateCell(event, row.id, column.id, e.target.value)} placeholder="Écrire…" />}</td>; })}<td><button className={styles.tinyButton} type="button" onClick={() => removeRow(event, row.id)}>Supprimer</button></td></tr>)}</tbody>
                  </table>
                </div>
              </section>
            )}

            <div className={styles.buttonRow}>
              <button className={event.status === "draft" ? styles.primary : styles.statusButton} type="button" onClick={() => void save({ ...event, status: "draft" as LiveEventStatus }, "Événement repassé en brouillon et masqué du public.")}>Brouillon</button>
              <button className={event.status === "live" ? styles.statusButtonLive : styles.primary} type="button" onClick={() => void save({ ...event, status: "live" as LiveEventStatus }, "Événement lancé : il est maintenant visible et actualisé en direct.")}>▶ Lancer en direct</button>
              <button className={event.status === "completed" ? styles.primary : styles.statusButton} type="button" onClick={() => void save({ ...event, status: "completed" as LiveEventStatus }, "Événement terminé. Le résultat reste visible.")}>✓ Terminer</button>
            </div>

            <div style={{ marginTop: 24 }}><p className="eyebrow">APERÇU ET RÉSULTATS</p><EventBoardDisplay event={event} onWinner={event.format === "bracket" ? (round, match, citizen) => setWinner(event, round, match, citizen) : undefined} /></div>
          </div>
        </article>
      ))}
    </div>
  );
}
