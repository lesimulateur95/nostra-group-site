
export type HomeReview = {
  id: number;
  user_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  comment: string;
  created_at: string;
  updated_at: string;
};

export type HomeReviewsData = {
  configured: boolean;
  reviews: HomeReview[];
  total: number;
  average: number;
  current_user_review: HomeReview | null;
};
