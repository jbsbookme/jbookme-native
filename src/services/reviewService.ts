import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

type Review = {
  id: string;
  barberId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt?: { seconds?: number } | null;
};

type RawReview = {
  barberId?: string;
  userId?: string;
  rating?: number;
  comment?: string;
  createdAt?: { seconds?: number } | null;
};

export async function addReview(barberId: string, userId: string, rating: number, comment: string) {
  const q = query(
    collection(db, 'reviews'),
    where('barberId', '==', barberId),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    throw {
      code: 'ALREADY_REVIEWED',
      message: 'You have already left a review for this barber.',
    };
  }
  await addDoc(collection(db, 'reviews'), {
    barberId,
    userId,
    rating,
    comment,
    createdAt: serverTimestamp(),
  });
}

export async function getReviews(barberId: string): Promise<Review[]> {
  const q = query(collection(db, 'reviews'), where('barberId', '==', barberId));
  const snapshot = await getDocs(q);
  const reviews = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as RawReview),
  })) as Review[];
  return reviews.sort((left, right) => {
    const leftSeconds = left.createdAt?.seconds ?? 0;
    const rightSeconds = right.createdAt?.seconds ?? 0;
    return rightSeconds - leftSeconds;
  });
}

export async function getAverageRating(barberId: string): Promise<number> {
  const reviews = await getReviews(barberId);
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0);
  return Number((total / reviews.length).toFixed(1));
}
