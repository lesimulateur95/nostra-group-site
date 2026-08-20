"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ProfileSectionHeader } from "@/components/profile/profile-section-header";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type BankAccount = {
  key: string;
  label: string;
  balance: number;
};

type BankingInformation = {
  status:
    | "connected"
    | "not_configured"
    | "identity_missing"
    | "not_found"
    | "unavailable";
  citizenName: string | null;
  steamId: string | null;
  cash: number | null;
  accounts: BankAccount[];
  total: number | null;
  checkedAt: string | null;
};

type BankApiResponse = {
  banking: BankingInformation;
  profileName: string;
  steamId: string | null;
};

const CLIENT_TIMEOUT_MS = 3000;

function money(value: number | null): string {
  if (value === null) return "—";
  return Number(value).toLocaleString("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
}

function maskSteamId(steamId: string | null): string {
  if (!steamId) return "Non lié";
  return `•••• ${steamId.slice(-4)}`;
}

function formatCheckedAt(value: string | null): string {
  if (!value) return "En attente de connexion";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Europe/Paris",
  }).format(new Date(value));
}

export default function BankingInformationPage() {
  const router = useRouter();

  const [banking, setBanking] = useState<BankingInformation | null>(null);
  const [profileName, setProfileName] = useState("Citoyen Nostra");
  const [steamId, setSteamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);

  const loadBanking = useCallback(async () => {
    setLoading(true);
    setTimedOut(false);

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const response = await fetch("/api/profile/bank-information", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      });

      if (response.status === 401) {
        router.replace("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`bank_api_${response.status}`);
      }

      const payload = (await response.json()) as BankApiResponse;

      setBanking(payload.banking);
      setProfileName(payload.profileName || "Citoyen Nostra");
      setSteamId(payload.steamId ?? payload.banking.steamId ?? null);
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === "AbortError";

      setTimedOut(aborted);

      setBanking({
        status: "unavailable",
        citizenName: null,
        steamId,
        cash: null,
        accounts: [],
        total: null,
        checkedAt: null,
      });
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  }, [router, steamId]);

  useEffect(() => {
    void loadBanking();
    // Un seul chargement automatique à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const citizenName =
    banking?.citizenName || profileName || "Citoyen Nostra";

  const unavailableCopy =
    banking?.status === "identity_missing"
      ? {
          eyebrow: "COMPTE NON LIÉ",
          title: "Ajoute ton identifiant Steam",
          text: "Ton compte du site doit être lié au même identifiant Steam que celui utilisé en jeu pour retrouver tes finances.",
        }
      : banking?.status === "not_found"
        ? {
            eyebrow: "COMPTE EN JEU INTROUVABLE",
            title: "Aucune donnée bancaire pour le moment",
            text: "Ton profil est bien lié, mais aucun personnage correspondant n’a encore été trouvé dans la base du serveur.",
          }
        : banking?.status === "not_configured"
          ? {
              eyebrow: "CONNEXION NON CONFIGURÉE",
              title: "La banque du serveur n’est pas configurée",
              text: "La page fonctionne normalement, mais la connexion bancaire serveur n’est pas disponible.",
            }
          : timedOut
            ? {
                eyebrow: "DÉLAI DE CONNEXION DÉPASSÉ",
                title: "La banque du serveur met trop de temps à répondre",
                text: "La page reste disponible. Tu peux relancer uniquement la consultation des soldes.",
              }
            : {
                eyebrow: "SERVICE TEMPORAIREMENT INDISPONIBLE",
                title: "La banque du serveur ne répond pas",
                text: "Tes données restent intactes. Tu peux réessayer sans recharger toute la page.",
              };

  return (
    <main className={styles.page}>
      <ProfileSectionHeader
        eyebrow="ESPACE CITOYEN"
        title="Informations bancaires"
        description="Consulte tes comptes et ton argent en jeu depuis un espace personnel sécurisé en lecture seule."
      />

      <section className={styles.identityBar}>
        <div>
          <span className={styles.onlineDot} aria-hidden="true" />
          <p>
            <small>Compte citoyen</small>
            <strong>{citizenName}</strong>
          </p>
        </div>

        <dl>
          <div>
            <dt>Identifiant Steam lié</dt>
            <dd>{maskSteamId(steamId)}</dd>
          </div>
          <div>
            <dt>Dernière consultation</dt>
            <dd>
              {loading
                ? "Connexion en cours…"
                : formatCheckedAt(banking?.checkedAt ?? null)}
            </dd>
          </div>
        </dl>

        {!loading && (
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void loadBanking()}
          >
            <span aria-hidden="true">↻</span>
            Actualiser les soldes
          </button>
        )}
      </section>

      {loading ? (
        <section className={styles.unavailable}>
          <span className={styles.lockIcon} aria-hidden="true">🏦</span>
          <p className={styles.eyebrow}>CONNEXION À LA BANQUE</p>
          <h2>Récupération de tes soldes…</h2>
          <p>
            La page est ouverte. Seules les informations bancaires sont en cours de récupération.
          </p>
        </section>
      ) : banking?.status === "connected" ? (
        <>
          <section className={styles.heroBalance}>
            <div>
              <p className={styles.eyebrow}>PATRIMOINE DISPONIBLE</p>
              <span>Solde total en jeu</span>
              <strong>{money(banking.total)}</strong>
              <small>Banque et espèces cumulées</small>
            </div>
            <span className={styles.bankMark} aria-hidden="true">NG</span>
          </section>

          <section className={styles.accountsSection}>
            <header>
              <div>
                <p className={styles.eyebrow}>MES COMPTES</p>
                <h2>Détail des soldes</h2>
              </div>
              <span className={styles.readOnlyBadge}>Lecture seule</span>
            </header>

            <div className={styles.accountGrid}>
              {banking.accounts.map((account, index) => (
                <article className={styles.accountCard} key={account.key}>
                  <span className={styles.accountIcon} aria-hidden="true">
                    {index === 0 ? "🏦" : "◆"}
                  </span>
                  <div>
                    <small>COMPTE BANCAIRE</small>
                    <h3>{account.label}</h3>
                    <strong>{money(account.balance)}</strong>
                  </div>
                  <span className={styles.activeBadge}>Actif</span>
                </article>
              ))}

              <article className={`${styles.accountCard} ${styles.cashCard}`}>
                <span className={styles.accountIcon} aria-hidden="true">💶</span>
                <div>
                  <small>PORTEFEUILLE</small>
                  <h3>Argent liquide</h3>
                  <strong>{money(banking.cash)}</strong>
                </div>
                <span className={styles.activeBadge}>En jeu</span>
              </article>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.unavailable}>
          <span className={styles.lockIcon} aria-hidden="true">🏦</span>
          <p className={styles.eyebrow}>{unavailableCopy.eyebrow}</p>
          <h2>{unavailableCopy.title}</h2>
          <p>{unavailableCopy.text}</p>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={() => void loadBanking()}
          >
            <span aria-hidden="true">↻</span>
            Réessayer
          </button>
        </section>
      )}

      <aside className={styles.securityNote}>
        <span aria-hidden="true">🔒</span>
        <div>
          <strong>Données personnelles protégées</strong>
          <p>
            Les soldes sont consultés côté serveur à partir du compte Steam lié.
            Aucun citoyen ne peut afficher les finances d’un autre joueur et aucune
            opération bancaire ne peut être effectuée depuis cette page.
          </p>
        </div>
      </aside>
    </main>
  );
}
