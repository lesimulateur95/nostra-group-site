import { HomeReviews } from "@/components/reviews/home-reviews";
import { getRequestUser } from "@/lib/auth/request-context";
import { getHomeReviewsData } from "@/lib/reviews/data";

export async function HomeReviewsLoader({
  saved,
  deleted,
  error,
}: {
  saved: boolean;
  deleted: boolean;
  error: string | null;
}) {
  const user = await getRequestUser();

  if (!user) {
    return null;
  }

  const reviews = await getHomeReviewsData(user.id);

  return (
    <HomeReviews
      initialData={reviews}
      saved={saved}
      deleted={deleted}
      error={error}
    />
  );
}
