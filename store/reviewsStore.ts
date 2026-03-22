export type Review = {
  id: string;
  barberId: string;
  barberName: string;
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
};

const reviews: Review[] = [];

export function addReview(review: Review) {
  reviews.unshift(review);
}

export function getReviewsForBarber(barberId: string) {
  return reviews.filter((review) => review.barberId === barberId);
}

export function getAverageRating(barberId: string) {
  const barberReviews = getReviewsForBarber(barberId);
  if (barberReviews.length === 0) {
    return 0;
  }

  const total = barberReviews.reduce((sum, review) => sum + review.rating, 0);
  return total / barberReviews.length;
}
