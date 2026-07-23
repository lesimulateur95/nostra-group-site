import { createClient } from "@/lib/supabase/server";

import type {
  HomeReview,
  HomeReviewsData,
} from "@/lib/reviews/types";

const EMPTY_REVIEWS: HomeReviewsData = {
  configured: false,
  reviews: [],
  total: 0,
  average: 0,
  current_user_review: null,
};

/**
 * userId est optionnel pour conserver la compatibilité avec les autres pages.
 * Sur l'accueil, il est fourni afin d'éviter une nouvelle requête auth.getUser().
 */
export async function getHomeReviewsData(
  userId?: string | null,
): Promise<HomeReviewsData> {
  const supabase = await createClient();
  let resolvedUserId = userId ?? null;

  if (!resolvedUserId) {
    const { data: authData } = await supabase.auth.getUser();
    resolvedUserId = authData.user?.id ?? null;
  }

  if (!resolvedUserId) {
    return EMPTY_REVIEWS;
  }

  const { data, error } = await supabase
    .from("home_reviews")
    .select(
      "id,user_id,author_name,rating,title,comment,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return EMPTY_REVIEWS;
  }

  const reviews = (data ?? []) as HomeReview[];
  const total = reviews.length;
  const average =
    total === 0
      ? 0
      : reviews.reduce(
          (sum, review) => sum + Number(review.rating),
          0,
        ) / total;

  return {
    configured: true,
    reviews,
    total,
    average,
    current_user_review:
      reviews.find((review) => review.user_id === resolvedUserId) ?? null,
  };
}
