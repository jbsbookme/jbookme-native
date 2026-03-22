import { memo, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchShopGalleryImages } from '@/src/services/galleryService';
import { SafeImage } from '../../components/SafeImage';

type GalleryItem = {
	gender?: string;
	imageUrl?: string;
};

function normalizeGender(value?: string) {
	if (!value) return null;
	const normalized = value.toLowerCase();
	if (['men', 'male', 'm'].includes(normalized)) return 'men';
	if (['women', 'female', 'f'].includes(normalized)) return 'women';
	return null;
}

const GalleryItem = memo(function GalleryItem({
	uri,
	onPress,
}: {
	uri: string;
	onPress: () => void;
}) {
	return (
		<Pressable style={styles.imageWrapper} onPress={onPress}>
			<SafeImage
				uri={uri}
				fallbackSource={require('../../assets/placeholder-gallery.png')}
				style={styles.image}
				resizeMode="cover"
			/>
		</Pressable>
	);
});

export default function ShopGalleryScreen() {
	const [loading, setLoading] = useState(true);
	const [gallery, setGallery] = useState<string[]>([]);
	const [viewerOpen, setViewerOpen] = useState(false);
	const [viewerIndex, setViewerIndex] = useState(0);
	const insets = useSafeAreaInsets();
	const { gender } = useLocalSearchParams<{ gender?: string }>();

	useEffect(() => {
		const loadGallery = async () => {
			setLoading(true);
			const normalizedGender = normalizeGender(gender);
			const galleryItems = (await fetchShopGalleryImages()) as GalleryItem[];
			const filtered = normalizedGender
				? galleryItems.filter(
						(item) => normalizeGender(item.gender) === normalizedGender
					)
				: galleryItems;
			setGallery(
				filtered
					.map((item) => item.imageUrl)
					.filter((url): url is string => Boolean(url))
			);
			setLoading(false);
		};

		loadGallery();
	}, [gender]);

	const images = useMemo(() => gallery.map((uri) => ({ uri })), [gallery]);

	if (loading) {
		return (
			<SafeAreaView style={styles.screen}>
				<View style={styles.loadingContainer}>
					<ActivityIndicator color="#00f0ff" size="large" />
					<Text style={styles.loadingText}>Loading gallery...</Text>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.screen}>
			<View style={styles.header}>
				<Text style={styles.headerTitle}>Shop Gallery</Text>
			</View>
			<FlatList
				data={gallery}
				keyExtractor={(item, index) => `${item}-${index}`}
				numColumns={3}
				contentContainerStyle={styles.grid}
				renderItem={({ item, index }) =>
					item ? (
						<GalleryItem
							uri={item}
							onPress={() => {
								setViewerIndex(index);
								setViewerOpen(true);
							}}
						/>
					) : null
				}
				ListEmptyComponent={
					<Text style={styles.emptyText}>No gallery photos uploaded yet.</Text>
				}
				showsVerticalScrollIndicator={false}
			/>

			<ImageViewing
				images={images}
				imageIndex={viewerIndex}
				visible={viewerOpen}
				onRequestClose={() => setViewerOpen(false)}
				HeaderComponent={() => (
					<View style={[styles.viewerHeader, { paddingTop: insets.top + 8 }]}>
						<Pressable
							onPress={() => setViewerOpen(false)}
							style={styles.closeButton}
							hitSlop={10}
						>
							<Text style={styles.closeButtonText}>X</Text>
						</Pressable>
					</View>
				)}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	header: {
		paddingHorizontal: 16,
		paddingBottom: 8,
	},
	headerTitle: {
		color: '#ffffff',
		fontSize: 20,
		fontWeight: '700',
	},
	grid: {
		padding: 16,
		gap: 10,
	},
	imageWrapper: {
		flex: 1,
		marginBottom: 10,
		borderRadius: 10,
		overflow: 'hidden',
backgroundColor: '#000',
	},
	image: {
		width: '100%',
		aspectRatio: 1,
	},
	emptyText: {
		color: '#9aa0a6',
		fontSize: 13,
		padding: 16,
	},
	loadingContainer: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 12,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	viewerHeader: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		paddingHorizontal: 16,
		alignItems: 'flex-end',
		zIndex: 2,
	},
	closeButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0, 0, 0, 0.6)',
	},
	closeButtonText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
});
