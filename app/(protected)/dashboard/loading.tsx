export default function DashboardLoading() {
  return (
    <main
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "65vh",
        display: "grid",
        placeItems: "center",
        padding: "32px",
      }}
    >
      <section
        style={{
          width: "min(520px, 100%)",
          padding: "28px",
          border: "1px solid rgba(212, 175, 55, 0.45)",
          borderRadius: "18px",
          background: "rgba(10, 10, 10, 0.96)",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "block",
            marginBottom: "10px",
            color: "#d4af37",
            fontSize: "0.72rem",
            fontWeight: 900,
            letterSpacing: "0.15em",
          }}
        >
          NOSTRA GROUP
        </span>
        <h1 style={{ margin: "0 0 10px", color: "#fff", fontSize: "1.5rem" }}>
          Ouverture du Dashboard…
        </h1>
        <p style={{ margin: 0, color: "rgba(255, 255, 255, 0.68)", lineHeight: 1.5 }}>
          Chargement des commandes, licences et outils de gestion.
        </p>
      </section>
    </main>
  );
}
