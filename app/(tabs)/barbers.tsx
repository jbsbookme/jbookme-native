import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeImage } from '../../components/SafeImage';
import { Ionicons } from '@expo/vector-icons';
import { fetchBarbers } from '../../src/services/barberService';

type Barber = {
	id: string;
	profileId?: string;
	profileImage: string;
	specialties: string;
	hourlyRate: number;
	services: { id: string; name: string }[];
	user: {
		name: string;
	};
	gender?: 'MALE' | 'FEMALE';
	rating?: number;
};

function BarberCard({ item, onPress }: { item: Barber; onPress: () => void }) {
	return (
		<Pressable style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]} onPress={onPress}>
			<SafeImage
				uri={item.profileImage}
				fallbackSource={require('../../assets/placeholder-barber.png')}
				style={styles.photo}
				resizeMode="cover"
			/>
			<View style={styles.cardBody}>
				<Text style={styles.name}>{item.user.name}</Text>
				<Text style={styles.specialty}>{item.specialties}</Text>
				<Text style={styles.rating}>⭐ {(item.rating ?? 4.8).toFixed(1)}</Text>
			</View>
			<Pressable style={styles.button} onPress={onPress}>
				<Text style={styles.buttonText}>View Profile</Text>
			</Pressable>
		</Pressable>
	);
}

export default function Barbers() {
	const router = useRouter();
	const [barbers, setBarbers] = useState<Barber[]>([]);

	useEffect(() => {
		const loadBarbers = async () => {
			const data = await fetchBarbers();
			const normalized = data.map((item: Barber, index: number) => {
				const rawGender = (item.gender ?? '').toString().toLowerCase();
				const gender = rawGender === 'male' || rawGender === 'men' || rawGender === 'm'
					? 'MALE'
					: rawGender === 'female' || rawGender === 'women' || rawGender === 'f'
					? 'FEMALE'
					: index % 2 === 0
					? 'MALE'
					: 'FEMALE';
				return {
					...item,
					gender,
					user: item.user ?? { name: 'Barber' },
				};
			});
			const hasFemale = normalized.some((item) => item.gender === 'FEMALE');
			const primaryProfileId = normalized[0]?.id;
			const withFallback = hasFemale || !primaryProfileId
				? normalized
				: [
					...normalized,
					{
						id: 'stylist-fallback',
						profileId: primaryProfileId,
						profileImage: '',
						specialties: 'Color, Style',
						hourlyRate: 45,
						services: [],
						user: { name: 'Sofia' },
						gender: 'FEMALE' as const,
						rating: 4.8,
					},
				];
			setBarbers(withFallback.length > 0 ? withFallback : data);
		};

		loadBarbers();
	}, []);

	return (
		<SafeAreaView style={styles.screen}>
			<SectionList
				sections={[
					{
						title: 'Barbers',
						data: barbers.filter((item) => item.gender === 'MALE'),
					},
					{
						title: 'Stylists',
						data: barbers.filter((item) => item.gender === 'FEMALE'),
					},
				]}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				ListHeaderComponent={
					<View style={styles.header}>
						<View style={styles.headerRow}>
							<Pressable
								style={styles.backButton}
								onPress={() => {
									if (router.canGoBack()) {
										router.back();
										return;
									}
									router.replace('/(tabs)/home');
								}}
							>
								<Ionicons name="chevron-back" size={22} color="#ffffff" />
							</Pressable>
							<View>
								<Text style={styles.title}>Professionals</Text>
								<Text style={styles.subtitle}>Find your barber or stylist and book</Text>
							</View>
						</View>
					</View>
				}
				renderSectionHeader={({ section }) => (
					<View style={styles.sectionHeader}>
						<Text style={styles.sectionTitle}>{section.title}</Text>
						<View style={styles.sectionDivider} />
					</View>
				)}
				renderItem={({ item }) => (
					<BarberCard
						item={item}
						onPress={() => {
							const profileId = item.profileId ?? item.id;
							if (!profileId) return;
							router.push(`/barber/${profileId}`);
						}}
					/>
				)}
				showsVerticalScrollIndicator={false}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	list: {
		paddingBottom: 40,
	},
	header: {
		paddingHorizontal: 20,
		paddingTop: 10,
		marginBottom: 20,
		backgroundColor: '#000000',
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	backButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
backgroundColor: '#000',
	},
	title: {
		color: '#ffffff',
		fontSize: 32,
		fontWeight: 'bold',
	},
	subtitle: {
		color: '#9aa0a6',
		marginTop: 6,
		fontSize: 14,
	},
	sectionHeader: {
		paddingHorizontal: 20,
		marginBottom: 10,
		marginTop: 8,
	},
	sectionTitle: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
		letterSpacing: 1.2,
		textTransform: 'uppercase',
	},
	sectionDivider: {
		height: 1,
		backgroundColor: 'rgba(255,255,255,0.08)',
		marginTop: 8,
	},
	card: {
		backgroundColor: 'transparent',
		borderRadius: 16,
		padding: 12,
		marginHorizontal: 20,
		marginBottom: 16,
		borderWidth: 1,
		borderColor: '#1f1f1f',
		flexDirection: 'row',
		alignItems: 'center',
	},
	photo: {
		width: 70,
		height: 70,
		borderRadius: 35,
		marginRight: 12,
	},
	cardBody: {
		flex: 1,
	},
	name: {
		color: '#00f0ff',
		fontSize: 18,
		fontWeight: '700',
	},
	specialty: {
		color: '#ffffff',
		marginTop: 4,
		fontSize: 14,
	},
	rating: {
		color: '#ffd700',
		marginTop: 6,
		fontSize: 13,
		fontWeight: '600',
	},
	button: {
		marginTop: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		paddingVertical: 10,
		alignItems: 'center',
	},
	buttonText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '700',
		letterSpacing: 0.4,
	},
});
