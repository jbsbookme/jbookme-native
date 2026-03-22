import { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	SafeAreaView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import {
	collection,
	getDocs,
	onSnapshot,
	orderBy,
	query,
	where,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';

type Review = {
	id: string;
	clientName?: string;
	rating?: number;
	comment?: string;
	createdAt?: { seconds: number } | Date | string | null;
};

function toDate(value: Review['createdAt']) {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value === 'string') {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') {
		return new Date(value.seconds * 1000);
	}
	return null;
}

function formatDate(value: Review['createdAt']) {
	const parsed = toDate(value);
	if (!parsed) return '';
	return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatStars(value?: number) {
	const rating = Math.max(1, Math.min(5, Math.round(value ?? 0)));
	return '⭐'.repeat(rating);
}

export default function ReviewsPage() {
	const { user } = useAuth();
	const [barberId, setBarberId] = useState<string | null>(null);
	const [reviews, setReviews] = useState<Review[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingBarber, setLoadingBarber] = useState(true);

	useEffect(() => {
		let active = true;
		const loadBarber = async () => {
			if (!user?.uid) {
				if (active) {
					setBarberId(null);
					setLoadingBarber(false);
				}
				return;
			}
			try {
				const barberQuery = query(
					collection(db, 'barbers'),
					where('userId', '==', user.uid)
				);
				const snapshot = await getDocs(barberQuery);
				if (!active) return;
				if (snapshot.empty) {
					setBarberId(null);
					setLoadingBarber(false);
					return;
				}
				const barberData = snapshot.docs[0].data() as { prismaBarberId?: string };
				setBarberId(barberData.prismaBarberId ?? null);
			} catch (error) {
				console.log('[Reviews] barber lookup error:', error);
				if (!active) return;
				setBarberId(null);
			} finally {
				if (active) setLoadingBarber(false);
			}
		};

		void loadBarber();
		return () => {
			active = false;
		};
	}, [user?.uid]);

	useEffect(() => {
		if (!barberId) {
			setReviews([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const reviewsQuery = query(
			collection(db, 'reviews'),
			where('barberId', '==', barberId),
			orderBy('createdAt', 'desc')
		);
		const unsubscribe = onSnapshot(
			reviewsQuery,
			(snapshot) => {
				const data = snapshot.docs.map((docItem) => ({
					id: docItem.id,
					...(docItem.data() as Review),
				}));
				setReviews(data);
				setLoading(false);
			},
			(error) => {
				console.log('[Reviews] load error:', error);
				setReviews([]);
				setLoading(false);
			}
		);
		return () => unsubscribe();
	}, [barberId]);

	const { average, count } = useMemo(() => {
		if (reviews.length === 0) return { average: 0, count: 0 };
		const total = reviews.reduce((sum, review) => sum + (review.rating ?? 0), 0);
		return { average: total / reviews.length, count: reviews.length };
	}, [reviews]);

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.title}>My Reviews</Text>
				<Text style={styles.summary}>
					⭐ {average.toFixed(1)} ({count} reviews)
				</Text>
			</View>

			{loadingBarber ? (
				<View style={styles.loadingRow}>
					<ActivityIndicator color="#00f0ff" size="small" />
					<Text style={styles.loadingText}>Loading barber profile...</Text>
				</View>
			) : null}

			{!loadingBarber && !barberId ? (
				<Text style={styles.emptyText}>No barber profile found.</Text>
			) : null}

			{loading ? (
				<View style={styles.loadingRow}>
					<ActivityIndicator color="#00f0ff" size="small" />
					<Text style={styles.loadingText}>Loading reviews...</Text>
				</View>
			) : (
				<FlatList
					data={reviews}
					keyExtractor={(item) => item.id}
					renderItem={({ item }) => (
						<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
							<View style={styles.cardHeader}>
								<View>
									<Text style={styles.clientName}>{item.clientName ?? 'Client'}</Text>
									{item.createdAt ? (
										<Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
									) : null}
								</View>
								<Text style={styles.starText}>{formatStars(item.rating)}</Text>
							</View>
							<Text style={styles.commentText}>
								{item.comment?.trim() ? item.comment : 'No comment provided.'}
							</Text>
						</View>
					)}
					ListEmptyComponent={
						<Text style={styles.emptyText}>No reviews yet.</Text>
					}
					contentContainerStyle={styles.list}
					showsVerticalScrollIndicator={false}
				/>
			)}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 12,
		gap: 6,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	summary: {
		color: '#ffd700',
		fontSize: 14,
		fontWeight: '700',
	},
	list: {
		paddingHorizontal: 20,
		paddingBottom: 32,
		gap: 12,
	},
	card: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 10,
	},
	cardHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	clientName: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '700',
	},
	dateText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	starText: {
		fontSize: 14,
	},
	commentText: {
		color: '#d1d5db',
		fontSize: 13,
		lineHeight: 18,
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
		paddingHorizontal: 20,
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 20,
		paddingTop: 8,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
});
