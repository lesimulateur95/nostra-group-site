import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { signNostraDocument } from "@/app/actions/document-signatures";
import { DocumentQr } from "@/components/documents/document-qr";
import {
  effectiveStatus,
  signatureStatusLabel,
  verificationStatusLabel,
} from "@/lib/documents/format";
import type { DocumentRegistryRow } from "@/lib/documents/types";
import { createClient } from "@/lib/supabase/server";

import styles from "./signature.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{
  signed?: string;
  code?: string;
  error?: string;
}>;

function profileName(profile: Record<string, unknown> | null): string {
  if (!profile) return "";
  const firstName = typeof profile.rp_first_name === "string" ? profile.rp_first_name : "";
  const lastName = typeof profile.rp_last_name === "string" ? profile.rp_last_name : "";
  return `${firstName} ${lastName}`.trim();
}

export default async function DocumentSignaturePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const [{ id }, query, supabase] = await Promise.all([
    params,
    searchParams,
    createClient(),
  ]);

  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/");

  const [{ data: document, error }, profileResult] = await Promise.all([
    (supabase as any)
      .from("nostra_document_registry")
      .select(
        "id,verification_code,document_number,owner_user_id,citizen_name,document_type,document_title,source_table,source_id,status,issued_at,expires_at,signable,signature_status,signed_at,signed_by,signer_name,metadata",
      )
      .eq("id", id)
      .eq("owner_user_id", authData.user.id)
      .maybeSingle(),
    (supabase as any)
      .from("member_profiles")
      .select("rp_first_name,rp_last_name")
      .eq("user_id", authData.user.id)
      .maybeSingle(),
  ]);

  if (error || !document) notFound();

  const registry = document as DocumentRegistryRow;
  const status = effectiveStatus(registry);
  const defaultSignerName = profileName(
    (profileResult.data as Record<string, unknown> | null) ?? null,
  ) || registry.citizen_name;
  const isSigned = registry.signature_status === "signed";
  const canSign =
    registry.signable &&
    registry.signature_status === "pending" &&
    status === "valid";

  return (
    <main className={styles.page}>
      <div className={styles.topbar}>
        <Link href="/profil/documents">← Retour à mes documents</Link>
      </div>

      <section className={styles.hero}>
        <p>SIGNATURE ÉLECTRONIQUE NOSTRA GROUP</p>
        <h1>{registry.document_title}</h1>
        <span>{registry.document_number}</span>
      </section>

      {query.error && <div className={styles.error}>{query.error}</div>}
      {query.signed === "1" && (
        <div className={styles.success}>
          Le document a été signé et ajouté au registre sécurisé de Nostra Group.
        </div>
      )}

      <section className={styles.grid}>
        <article className={styles.card}>
          <h2>Document à signer</h2>
          <dl className={styles.details}>
            <div>
              <dt>Citoyen</dt>
              <dd>{registry.citizen_name}</dd>
            </div>
            <div>
              <dt>Document</dt>
              <dd>{registry.document_title}</dd>
            </div>
            <div>
              <dt>Numéro</dt>
              <dd>{registry.document_number}</dd>
            </div>
            <div>
              <dt>Émis le</dt>
              <dd>{new Date(registry.issued_at).toLocaleDateString("fr-FR")}</dd>
            </div>
            <div>
              <dt>Authenticité</dt>
              <dd>{verificationStatusLabel(status)}</dd>
            </div>
            <div>
              <dt>Signature</dt>
              <dd>{signatureStatusLabel(registry.signature_status)}</dd>
            </div>
          </dl>

          {isSigned && (
            <div className={styles.signedBlock}>
              <strong>Signé électroniquement</strong>
              <span>Par {registry.signer_name || registry.citizen_name}</span>
              {registry.signed_at && (
                <span>
                  Le {new Date(registry.signed_at).toLocaleString("fr-FR", {
                    dateStyle: "long",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
          )}

          {!registry.signable && (
            <div className={styles.information}>
              Ce document ne nécessite pas de signature. Les bons de commande
              provenant des jeux, comme le Bingo ou la Tombola, sont exclus.
            </div>
          )}

          {status !== "valid" && (
            <div className={styles.information}>
              Un document {status === "expired" ? "expiré" : "annulé"} ne peut
              pas être signé.
            </div>
          )}

          {canSign && (
            <form className={styles.form} action={signNostraDocument}>
              <input type="hidden" name="document_id" value={registry.id} />

              <label>
                Nom et prénom du signataire
                <input
                  name="signer_name"
                  defaultValue={defaultSignerName}
                  required
                  minLength={3}
                  maxLength={160}
                />
              </label>

              <label className={styles.consent}>
                <input type="checkbox" name="consent" required />
                <span>
                  Je certifie avoir lu ce document et j’accepte de le signer
                  électroniquement. Cette validation vaut signature dans le cadre
                  du serveur Nostra Group.
                </span>
              </label>

              <button type="submit">Signer définitivement le document</button>
            </form>
          )}
        </article>

        <aside className={styles.qrCard}>
          <p>AUTHENTICITÉ PUBLIQUE</p>
          <h2>QR code unique</h2>
          <DocumentQr code={registry.verification_code} size={210} />
          <small>
            Toute personne peut scanner ce QR code pour vérifier le numéro, le
            titulaire, le statut et la signature du document.
          </small>
        </aside>
      </section>
    </main>
  );
}
