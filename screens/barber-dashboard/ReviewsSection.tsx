import { memo } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { styles } from './styles';
import type { ReviewItem, ReviewsSummary } from './types';

export const ReviewsSection = memo(function ReviewsSection({
	loading,
	reviews,
	reviewsSummary,
	reviewDate,
	reviewStars,
}: {
	loading: boolean;
	reviews: ReviewItem[];
	reviewsSummary: ReviewsSummary;
	reviewDate: (value?: ReviewItem['createdAt']) => string;
	reviewStars: (value?: number) => string;
}) {
	return (
		<View style={styles.reviewsCard}>
			<View style={styles.reviewsHeader}>
				<Text style={styles.reviewsTitle}>My Reviews</Text>
				<Text style={styles.reviewsSummary}>
					⭐ {reviewsSummary.average.toFixed(1)} ({reviewsSummary.count} reviews)
				</Text>
			</View>
			{loading ? (
				<View style={styles.reviewsLoading}>
					<ActivityIndicator color="#00f0ff" size="small" />
					<Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
				</View>
			) : reviews.length === 0 ? (
				<Text style={styles.reviewsEmpty}>No reviews yet.</Text>
			) : (
				reviews.map((review) => (
					<View key={review.id} style={styles.reviewRow}>
						<View style={styles.reviewHeaderRow}>
							<View>
								<Text style={styles.reviewName}>{review.clientName ?? 'Client'}</Text>
								{review.createdAt ? (
									<Text style={styles.reviewDate}>{reviewDate(review.createdAt)}</Text>
								) : null}
							</View>
							<Text style={styles.reviewStars}>{reviewStars(review.rating)}</Text>
						</View>
						<Text style={styles.reviewComment}>
							{review.comment?.trim() ? review.comment : 'No comment provided.'}
						</Text>
					</View>
				))
			)}
		</View>
	);
});
