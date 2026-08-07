"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DELETE_CONFIRMATION = "SUPPRIMER MON COMPTE";

type DeleteTarget = {
  table: string;
  column: string;
};

const PERSONAL_DELETE_TARGETS: DeleteTarget[] = [
  // Parcours Academy : supprimer d'abord les objets qui référencent les dossiers.
  { table: "academy_qualifications_v137", column: "user_id" },
  { table: "academy_quiz_attempts_v143", column: "user_id" },
  { table: "academy_generated_licence_links_v142", column: "holder_user_id" },
  { table: "academy_licence_controls_v140", column: "holder_user_id" },
  { table: "academy_enrollments_v137", column: "user_id" },

  // Données personnelles et éléments temporaires du profil.
  { table: "vehicle_favorites", column: "user_id" },
  { table: "user_notifications", column: "user_id" },
  { table: "profile_badge_awards", column: "user_id" },
  { table: "loyalty_cards", column: "user_id" },
  { table: "loyalty_profiles", column: "user_id" },
  { table: "cart_items", column: "user_id" },
  { table: "pilot_license_cart_items", column: "user_id" },
  { table: "tombola_cart_items", column: "user_id" },
  { table: "bingo_cart_items", column: "user_id" },
  { table: "money_drop_registrations", column: "user_id" },
  { table: "team_registration_requests", column: "user_id" },
  { table: "recruitment_applications", column: "user_id" },
];

function isMissingRelationError(error: { code?: string | null; message?: string | null }) {
  const message = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

async function cleanupPersonalSiteData(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  // Les licences officielles sont des droits liés au compte : elles sont retirées
  // lors de la suppression. Le trigger V142 conserve sa trace administrative.
  const licenceDelete = await admin
    .from("nostra_licences")
    .delete()
    .eq("holder_user_id", userId);

  if (licenceDelete.error && !isMissingRelationError(licenceDelete.error)) {
    console.error("Account deletion: official licences cleanup failed", licenceDelete.error);
  }

  for (const target of PERSONAL_DELETE_TARGETS) {
    const result = await admin
      .from(target.table)
      .delete()
      .eq(target.column, userId);

    if (result.error && !isMissingRelationError(result.error)) {
      console.error(
        `Account deletion: cleanup failed for ${target.table}`,
        result.error,
      );
    }
  }

  const profileDelete = await admin
    .from("member_profiles")
    .delete()
    .eq("user_id", userId);

  if (profileDelete.error) {
    // Si une ancienne contrainte empêche la suppression de la ligne, on retire
    // quand même les informations identifiantes afin que le compte disparaisse
    // des listes citoyennes sous son ancienne identité.
    console.error("Account deletion: member profile delete failed", profileDelete.error);
    const anonymize = await admin
      .from("member_profiles")
      .update({
        discord_id: null,
        discord_name: "Compte supprimé",
        email: null,
        avatar_url: null,
        rp_first_name: "Compte",
        rp_last_name: "supprimé",
        phone: null,
        address: null,
        steam_id: null,
        role: "citizen",
        roles: ["citizen"],
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (anonymize.error) {
      console.error("Account deletion: member profile anonymization failed", anonymize.error);
    }
  }
}

export async function deleteOwnAccount(formData: FormData) {
  const confirmation = String(formData.get("confirmation") ?? "")
    .trim()
    .toUpperCase();
  const understood = formData.get("understood") === "on";

  if (!understood || confirmation !== DELETE_CONFIRMATION) {
    redirect("/profil/compte?error=confirmation");
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    redirect("/");
  }

  const admin = createAdminClient();
  const userId = data.user.id;
  const deletedAt = new Date().toISOString();

  // Suppression douce Supabase : l'accès est définitivement désactivé tout en
  // conservant l'UUID nécessaire aux anciennes écritures comptables/contractuelles.
  // On commence par cette étape afin de ne jamais modifier un compte encore actif
  // si Supabase refuse finalement sa suppression.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId, true);

  if (deleteError) {
    console.error("Account deletion: auth delete failed", deleteError);
    redirect("/profil/compte?error=delete_failed");
  }

  // Une fois le compte désactivé, on tente aussi de neutraliser les métadonnées
  // Auth restantes. Cette étape est non bloquante car le compte ne peut déjà plus
  // être utilisé pour se reconnecter.
  const scrub = await admin.auth.admin.updateUserById(userId, {
    email: `deleted-${userId}@deleted.nostra.invalid`,
    user_metadata: {
      account_deleted: true,
      deleted_at: deletedAt,
    },
  });

  if (scrub.error) {
    console.error("Account deletion: auth metadata scrub failed", scrub.error);
  }

  await cleanupPersonalSiteData(admin, userId);

  // Efface la session locale même si le compte Auth vient d'être désactivé.
  await supabase.auth.signOut();
  redirect("/compte-supprime");
}
