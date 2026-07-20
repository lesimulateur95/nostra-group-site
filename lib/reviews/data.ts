
import { createClient } from "@/lib/supabase/server";
import type {
  HomeReview,
  HomeReviewsData,
} from "@/lib/reviews/types";

export async function getHomeReviewsData(): Promise<HomeReviewsData> {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return {
      configured: false,
      reviews: [],
      total: 0,
      average: 0,
      current_user_review: null,
    };
  }

  const { data, error } = await supabase
    .from("home_reviews")
    .select(
      "id,user_id,author_name,rating,title,comment,created_at,updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return {
      configured: false,
      reviews: [],
      total: 0,
      average: 0,
      current_user_review: null,
    };
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
      reviews.find(
        (review) => review.user_id === authData.user.id,
      ) ?? null,
  };
}
