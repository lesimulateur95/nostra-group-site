import { cache } from "react";
import type { User } from "@supabase/supabase-js";

import { getUserRoleKeys, type RoleKey } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";

/**
 * Déduplique la lecture Supabase de l'utilisateur pendant un même rendu Next.js.
 * Le layout, l'accueil et les loaders peuvent donc partager le même résultat.
 */
export const getRequestUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

/** Déduplique aussi le calcul des rôles pendant la requête courante. */
export const getRequestRoleKeys = cache(async (): Promise<RoleKey[]> => {
  const user = await getRequestUser();
  return getUserRoleKeys(user);
});
