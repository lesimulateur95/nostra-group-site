import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase réservé au serveur.
 * La clé secrète ne doit jamais être exposée dans un composant client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Configuration Steam incomplète : NEXT_PUBLIC_SUPABASE_URL ou clé secrète Supabase manquante.",
    );
  }

  return createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
