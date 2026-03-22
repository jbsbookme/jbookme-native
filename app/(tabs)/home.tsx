import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
	Animated,
	FlatList,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	useWindowDimensions,
	View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import ImageViewing from 'react-native-image-viewing';
import { SafeImage } from '../../components/SafeImage';
import { fetchTodayAppointments } from '../../src/services/appointmentService';
import { getAverageRating } from '../../src/services/reviewService';
import { fetchTrendingServices, type Service } from '../../src/services/serviceService';
import { fetchBarbers } from '../../src/services/barberService';

type Barber = {
	id: string;
	name: string;
	image: string;
	userId?: string;
	uid?: string;
	rating?: number;
	role?: string;
	gender?: string;
};

type GalleryItem = {
	gender?: string;
	imageUrl?: string;
};

const MOCK_GALLERY: GalleryItem[] = [
	{ gender: 'men', imageUrl: 'https://picsum.photos/300?random=301' },
	{ gender: 'men', imageUrl: 'https://picsum.photos/300?random=302' },
	{ gender: 'men', imageUrl: 'https://picsum.photos/300?random=303' },
	{ gender: 'women', imageUrl: 'https://picsum.photos/300?random=304' },
	{ gender: 'women', imageUrl: 'https://picsum.photos/300?random=305' },
	{ gender: 'women', imageUrl: 'https://picsum.photos/300?random=306' },
];

async function fetchTopBarbers(): Promise<Barber[]> {
	try {
		const barbers = await fetchBarbers();
		return barbers.map((barber: any, index: number) => ({
			id: barber.id ?? barber.userId ?? barber.uid ?? `${index}`,
			name: barber.user?.name ?? barber.name ?? 'Barber',
			image:
				barber.profileImage ||
				barber.image ||
				barber.imageUrl ||
				barber.photoUrl ||
				`https://i.pravatar.cc/300?img=${index + 1}`,
			role: barber.role,
			gender: barber.gender,
			userId: barber.userId,
			uid: barber.uid,
		}));
	} catch (error) {
		return [];
	}
}

function formatTimeLabel(value: string) {
	const [rawHour, rawMinute] = value.split(':').map(Number);
	if (Number.isNaN(rawHour) || Number.isNaN(rawMinute)) return value;
	const period = rawHour >= 12 ? 'PM' : 'AM';
	const hour = rawHour % 12 === 0 ? 12 : rawHour % 12;
	const minute = rawMinute.toString().padStart(2, '0');
	return `${hour}:${minute} ${period}`;
}

const GalleryItem = memo(function GalleryItem({
	uri,
	size,
	onPress,
}: {
	uri: string;
	size: number;
	onPress: () => void;
}) {
	if (!uri) return null;
	return (
		<Pressable style={[styles.galleryImageWrapper, { width: size, height: size }]} onPress={onPress}>
			<SafeImage
				uri={uri}
				fallbackSource={require('../../assets/placeholder-gallery.png')}
				style={styles.galleryImage}
				resizeMode="cover"
			/>
		</Pressable>
	);
});


function normalizeGender(value?: string) {
	if (!value) return null;
	const normalized = value.toLowerCase();
	if (['men', 'male', 'm'].includes(normalized)) return 'men';
	if (['women', 'female', 'f'].includes(normalized)) return 'women';
	return null;
}

function normalizeRole(value?: string) {
	if (!value) return null;
	const normalized = value.toLowerCase();
	if (['barber', 'barbero'].includes(normalized)) return 'barber';
	if (['stylist', 'estilista'].includes(normalized)) return 'stylist';
	return null;
}

function resolveTopRole(value?: { role?: string; gender?: string }) {
	const direct = normalizeRole(value?.role);
	if (direct) return direct;
	const gender = normalizeGender(value?.gender);
	if (gender === 'women') return 'stylist';
	if (gender === 'men') return 'barber';
	return null;
}


export default function Home() {
	const router = useRouter();
	const { width } = useWindowDimensions();
	const [barbers, setBarbers] = useState<Barber[]>([]);
	const [barberRatings, setBarberRatings] = useState<Record<string, number>>({});
	const [services, setServices] = useState<Service[]>([]);
	const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [availableToday, setAvailableToday] = useState<
		{
			barberId: string;
			barberName: string;
			barberRole?: string;
			serviceName?: string;
			time: string;
			profileImage?: string;
		}[]
	>([]);
	const [selectedGender, setSelectedGender] = useState<'men' | 'women'>('men');
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [galleryIndex, setGalleryIndex] = useState(0);
	const fadeAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			setBarbers([]);
			setGalleryItems(MOCK_GALLERY);
			try {
				const barberData = await fetchTopBarbers();
				if (Array.isArray(barberData) && barberData.length > 0) {
					setBarbers(barberData);
					const ratings = await Promise.all(
						barberData.map(async (barber) => [barber.id, await getAverageRating(barber.id)])
					);
					setBarberRatings(Object.fromEntries(ratings));
				} else {
					setBarbers([]);
				}

				const serviceData = await fetchTrendingServices();
				setServices(serviceData);

				const todayAppointments = await fetchTodayAppointments();
				setAvailableToday(todayAppointments);
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	useEffect(() => {
		if (loading) {
			fadeAnim.setValue(0);
			return;
		}
		Animated.timing(fadeAnim, {
			toValue: 1,
			duration: 250,
			useNativeDriver: true,
		}).start();
	}, [fadeAnim, loading]);

	const topBarbers = useMemo(() => {
		const barberList = barbers.filter((item) => resolveTopRole(item) === 'barber');
		const stylistList = barbers.filter((item) => resolveTopRole(item) === 'stylist');
		const others = barbers.filter((item) => !resolveTopRole(item));
		const selected = [...barberList.slice(0, 3), ...stylistList.slice(0, 3)];
		if (selected.length >= 6) return selected.slice(0, 6);
		const remaining = 6 - selected.length;
		return [...selected, ...others.slice(0, remaining)];
	}, [barbers]);
	const renderStars = (rating: number) => {
		const rounded = Math.round(rating);
		const filled = '★'.repeat(Math.max(0, Math.min(rounded, 5)));
		const empty = '☆'.repeat(Math.max(0, 5 - filled.length));
		return `${filled}${empty}`;
	};
	const openMap = () => {
		Linking.openURL('https://maps.google.com/?q=JB+Barbershop+Lynn+MA');
	};
	const trendingServices = useMemo(() => services.slice(0, 4), [services]);
	const filteredGallery = useMemo(
		() =>
			galleryItems.filter((item) => normalizeGender(item.gender) === selectedGender),
		[galleryItems, selectedGender]
	);
	const shopGallery = useMemo(
		() =>
			filteredGallery
				.map((item) => item.imageUrl)
				.filter((url): url is string => Boolean(url)),
		[filteredGallery]
	);
	const limitedGallery = useMemo(() => shopGallery.slice(0, 9), [shopGallery]);
	const galleryImages = useMemo(
		() => shopGallery.map((uri) => ({ uri })),
		[shopGallery]
	);
	const visibleAvailable = useMemo(() => {
		const barbers = availableToday.filter((item) => normalizeRole(item.barberRole) === 'barber');
		const stylists = availableToday.filter((item) => normalizeRole(item.barberRole) === 'stylist');
		const others = availableToday.filter((item) => !normalizeRole(item.barberRole));
		const selected = [...barbers.slice(0, 2), ...stylists.slice(0, 2)];
		if (selected.length >= 4) return selected.slice(0, 4);
		const remaining = 4 - selected.length;
		const fillers = [...barbers.slice(2), ...stylists.slice(2), ...others];
		return [...selected, ...fillers.slice(0, remaining)];
	}, [availableToday]);
	const galleryPadding = 20;
	const galleryGap = 10;
	const galleryItemSize = Math.floor((width - galleryPadding * 2 - galleryGap * 2) / 3);

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.hero}>
					<Text style={styles.heroBrand}>JBSBookMe</Text>
					<Text style={styles.heroTitle}>Book Your Next Cut</Text>
					<Text style={styles.heroSubtitle}>Look sharp. Feel fresh.</Text>
					<TouchableOpacity onPress={openMap}>
						<Text style={{ color: '#00FFFF', marginTop: 5 }}>
							📍 JB’s Barbershop • Lynn, MA
						</Text>
					</TouchableOpacity>
					<Pressable style={styles.ctaButton} onPress={() => router.push('/book')}>
						<Text style={styles.ctaText}>Book Now</Text>
					</Pressable>
				</View>

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Top Barbers</Text>
					<Text style={styles.sectionAccent}>Book the best in town</Text>
				</View>
				{loading ? (
					<FlatList
						data={Array.from({ length: 4 })}
						keyExtractor={(_, index) => `barber-skeleton-${index}`}
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.horizontalList}
						renderItem={() => (
							<View style={styles.barberCard}>
								<View style={styles.skeletonSquare} />
								<View style={styles.skeletonLine} />
							</View>
						)}
					/>
				) : (
					<Animated.View style={{ opacity: fadeAnim }}>
						<FlatList
							data={topBarbers}
							keyExtractor={(item) => item.id}
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.horizontalList}
							renderItem={({ item }) => (
								<Pressable
									style={styles.barberCard}
									onPress={() => {
										const barberKey = item.userId ?? item.uid ?? item.id;
										if (!barberKey) return;
										router.push(`/barber/${barberKey}`);
									}}
									disabled={!item.userId && !item.uid && !item.id}
								>
									<View style={styles.barberPhotoWrapper}>
										<SafeImage
											uri={item.image}
											fallbackSource={require('../../assets/placeholder-barber.png')}
											style={styles.barberPhoto}
											resizeMode="cover"
										/>
									</View>
									<Text style={styles.barberName}>{item.name ?? 'Barber'}</Text>
									<Text style={styles.barberRating}>
										{renderStars(barberRatings[item.id] ?? item.rating ?? 0)}
									</Text>
								</Pressable>
							)}
							ListEmptyComponent={
								<Text style={styles.emptyState}>No barbers available.</Text>
							}
						/>
					</Animated.View>
				)}

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Trending Services</Text>
					<Text style={styles.sectionAccent}>Pick a service and book fast</Text>
				</View>
				{loading ? (
					<FlatList
						data={Array.from({ length: 4 })}
						keyExtractor={(_, index) => `service-skeleton-${index}`}
						horizontal
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.horizontalList}
						renderItem={() => (
							<View style={styles.serviceCard}>
								<View style={styles.skeletonRect} />
								<View style={styles.skeletonLine} />
								<View style={styles.skeletonLineSmall} />
							</View>
						)}
					/>
				) : (
					<Animated.View style={{ opacity: fadeAnim }}>
						<FlatList
							data={trendingServices}
							keyExtractor={(item) => item.id}
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={styles.horizontalList}
							renderItem={({ item }) => (
								<Pressable
									style={styles.serviceCard}
									onPress={() =>
										router.push({
											pathname: '/(tabs)/book',
											params: { serviceId: item.id },
										})
									}
								>
									<View style={styles.serviceImageWrapper}>
										<SafeImage
											uri={item.image}
											fallbackSource={require('../../assets/placeholder-service.png')}
											style={styles.serviceImage}
											resizeMode="cover"
										/>
									</View>
									<Text style={styles.serviceName}>{item.name}</Text>
									<Text style={styles.serviceMeta}>
										${item.price ?? 0} • {item.duration ?? 0} min
									</Text>
								</Pressable>
							)}
							ListEmptyComponent={
								<Text style={styles.emptyState}>No services available.</Text>
							}
						/>
					</Animated.View>
				)}

				<View style={styles.sectionHeader}>
					<Text style={styles.sectionTitle}>Available Today</Text>
					<Text style={styles.sectionAccent}>Grab an open slot</Text>
				</View>
				<View style={styles.availableList}>
					{visibleAvailable.length === 0 ? (
						<Text style={styles.emptyState}>
							{loading ? 'Checking availability...' : 'No open slots today.'}
						</Text>
					) : (
						<Animated.View style={{ opacity: fadeAnim }}>
							{visibleAvailable.map((item) => (
								<View key={`${item.barberId}-${item.time}`} style={styles.availableCard}>
										<View style={styles.availableInfo}>
											<SafeImage
												uri={item.profileImage}
												fallbackSource={require('../../assets/placeholder-barber.png')}
												style={styles.availableAvatar}
												resizeMode="cover"
											/>
											<View>
												<Text style={styles.availableName}>{item.barberName}</Text>
												{item.barberRole ? (
													<Text style={styles.availableRole}>{item.barberRole}</Text>
												) : null}
												<Text style={styles.availableTime}>{formatTimeLabel(item.time)}</Text>
											</View>
										</View>
									<Pressable
										style={styles.availableButton}
										onPress={() =>
											router.push({
												pathname: '/(tabs)/book',
												params: {
													barberId: item.barberId,
													targetGender:
														normalizeRole(item.barberRole) === 'stylist' ? 'women' : 'men',
												},
											})
										}
									>
										<Text style={styles.availableButtonText}>BOOK</Text>
									</Pressable>
								</View>
							))}
							<Pressable
								style={styles.seeAllLink}
								onPress={() => router.push('/(tabs)/book')}
							>
								<Text style={styles.seeAllText}>See all</Text>
							</Pressable>
						</Animated.View>
					)}
				</View>

				<View style={styles.galleryHeader}>
					<View>
						<Text style={styles.sectionTitle}>Shop Gallery</Text>
						<Text style={styles.sectionAccent}>Latest work from the shop</Text>
					</View>
					<View style={styles.genderToggle}>
						<Pressable
							style={[
								styles.genderButton,
								selectedGender === 'men' && styles.genderButtonActive,
							]}
							onPress={() => setSelectedGender('men')}
						>
							<Text
								style={[
									styles.genderButtonText,
									selectedGender === 'men' && styles.genderButtonTextActive,
								]}
							>
								Men
							</Text>
						</Pressable>
						<Pressable
							style={[
								styles.genderButton,
								selectedGender === 'women' && styles.genderButtonActive,
							]}
							onPress={() => setSelectedGender('women')}
						>
							<Text
								style={[
									styles.genderButtonText,
									selectedGender === 'women' && styles.genderButtonTextActive,
								]}
							>
								Women
							</Text>
						</Pressable>
					</View>
				</View>
				<FlatList
					data={limitedGallery}
					keyExtractor={(item, index) => `${item}-${index}`}
					numColumns={3}
					scrollEnabled={false}
					contentContainerStyle={styles.galleryGrid}
					columnWrapperStyle={styles.galleryRow}
					renderItem={({ item }) => (
						<GalleryItem
							uri={item}
							size={galleryItemSize}
							onPress={() => {
								const index = shopGallery.findIndex((uri) => uri === item);
								setGalleryIndex(index === -1 ? 0 : index);
								setGalleryOpen(true);
							}}
						/>
					)}
					ListEmptyComponent={
						<Text style={styles.emptyState}>No gallery photos uploaded yet.</Text>
					}
				/>
				{shopGallery.length > 0 ? (
					<Pressable
						style={styles.seeAllLink}
						onPress={() =>
							router.push({ pathname: '/gallery', params: { gender: selectedGender } })
						}
					>
						<Text style={styles.seeAllText}>See all</Text>
					</Pressable>
				) : null}

			</ScrollView>

			<ImageViewing
				images={galleryImages}
				imageIndex={galleryIndex}
				visible={galleryOpen}
				onRequestClose={() => setGalleryOpen(false)}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	content: {
		paddingBottom: 32,
		backgroundColor: '#000000',
	},
	hero: {
		paddingHorizontal: 20,
		paddingTop: 24,
		paddingBottom: 24,
backgroundColor: '#000',
		borderBottomWidth: 1,
		borderBottomColor: 'rgba(255,255,255,0.08)',
	},
	heroBrand: {
		color: '#ffd700',
		fontSize: 24,
		fontWeight: '700',
		letterSpacing: 1.2,
		textTransform: 'uppercase',
		marginBottom: 10,
	},
	heroTitle: {
		color: '#ffffff',
		fontSize: 28,
		fontWeight: '700',
	},
	heroSubtitle: {
		color: '#9aa0a6',
		marginTop: 6,
		fontSize: 15,
	},
	ctaButton: {
		marginTop: 18,
		backgroundColor: '#00f0ff',
		paddingVertical: 14,
		borderRadius: 14,
		alignItems: 'center',
	},
	ctaText: {
		color: '#000000',
		fontSize: 16,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1.2,
	},
	sectionHeader: {
		paddingHorizontal: 20,
		marginTop: 24,
		marginBottom: 12,
	},
	galleryHeader: {
		paddingHorizontal: 20,
		marginTop: 24,
		marginBottom: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	sectionTitle: {
		color: '#ffffff',
		fontSize: 18,
		fontWeight: '700',
	},
	sectionAccent: {
		color: '#ffd700',
		marginTop: 4,
		fontSize: 13,
		letterSpacing: 0.4,
	},
	genderToggle: {
		flexDirection: 'row',
		gap: 8,
	},
	genderButton: {
		alignItems: 'center',
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	genderCircleImage: {
		width: 34,
		height: 34,
		borderRadius: 17,
		marginBottom: 6,
backgroundColor: '#000',
	},
	genderCircleFallback: {
		width: 34,
		height: 34,
		borderRadius: 17,
		marginBottom: 6,
backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	genderButtonActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: 'rgba(0,240,255,0.12)',
	},
	genderButtonText: {
		color: '#9aa0a6',
		fontSize: 12,
		fontWeight: '600',
	},
	genderButtonTextActive: {
		color: '#00f0ff',
	},
	horizontalList: {
		paddingHorizontal: 20,
		paddingBottom: 4,
		gap: 12,
	},
	barberCard: {
		width: 150,
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 10,
	},
	barberPhotoWrapper: {
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.65)',
	},
	barberPhoto: {
		width: '100%',
		aspectRatio: 1,
	},
	barberName: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
	barberRating: {
		color: '#ffd700',
		fontSize: 12,
		fontWeight: '600',
	},
	serviceCard: {
		width: 200,
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
	},
	serviceImageWrapper: {
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.65)',
	},
	serviceImage: {
		width: '100%',
		height: 120,
	},
	serviceName: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
	serviceMeta: {
		color: '#9aa0a6',
		fontSize: 12,
	},
	skeletonSquare: {
		width: '100%',
		aspectRatio: 1,
		borderRadius: 12,
		backgroundColor: 'rgba(255,255,255,0.08)',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	skeletonRect: {
		width: '100%',
		height: 120,
		borderRadius: 12,
		backgroundColor: 'rgba(255,255,255,0.08)',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	skeletonLine: {
		height: 12,
		borderRadius: 8,
		backgroundColor: 'rgba(255,255,255,0.08)',
		marginTop: 10,
	},
	skeletonLineSmall: {
		height: 10,
		borderRadius: 8,
		backgroundColor: 'rgba(255,255,255,0.08)',
		marginTop: 8,
		width: '70%',
	},
	emptyState: {
		color: '#9aa0a6',
		fontSize: 13,
		paddingHorizontal: 20,
	},
	galleryGrid: {
		paddingHorizontal: 20,
		paddingTop: 4,
	},
	galleryRow: {
		justifyContent: 'space-between',
	},
	galleryImageWrapper: {
		marginBottom: 10,
		borderRadius: 10,
		overflow: 'hidden',
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.75)',
	},
	galleryImage: {
		width: '100%',
		height: '100%',
	},
	availableList: {
		paddingHorizontal: 20,
		gap: 16,
	},
	availableCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 4,
	},
	availableInfo: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	availableAvatar: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.65)',
	},
	availableName: {
		color: '#ffffff',
		fontSize: 15,
		fontWeight: '600',
	},
	availableRole: {
		color: '#9aa0a6',
		fontSize: 12,
		marginTop: 2,
	},
	availableTime: {
		color: '#ffd700',
		fontSize: 14,
		marginTop: 4,
	},
	availableButton: {
		backgroundColor: '#e10600',
		borderRadius: 10,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	availableButtonText: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
	seeAllLink: {
		marginTop: 4,
		alignSelf: 'flex-start',
	},
	seeAllText: {
		color: '#00f0ff',
		fontSize: 12,
		fontWeight: '600',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
	},
});
