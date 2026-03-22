import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	Alert,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	Pressable,
	View,
} from 'react-native';
import {
	addDoc,
	collection,
	getDocs,
	onSnapshot,
	query,
	serverTimestamp,
	Timestamp,
	where,
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';

type AppointmentItem = {
	id: string;
	price?: number;
	date?: unknown;
	time?: unknown;
};

type ManualPayment = {
	id: string;
	amount?: number;
	type?: 'walkin' | 'tip' | 'product';
	description?: string;
	date?: unknown;
};

function parseDateValue(value: unknown) {
	if (!value) return null;
	if (value instanceof Date) return value;
	if (typeof value === 'string') {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	if (typeof value === 'object' && value && 'toDate' in value) {
		const withToDate = value as { toDate: () => Date };
		return withToDate.toDate();
	}
	return null;
}

function isSameDay(left: Date, right: Date) {
	return (
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate()
	);
}

function formatMoney(value?: number) {
	if (typeof value !== 'number' || Number.isNaN(value)) return '$0';
	return `$${value.toFixed(2)}`;
}

function normalizeManualType(value?: string) {
	if (value === 'tip') return 'tips' as const;
	if (value === 'product') return 'products' as const;
	return 'walkins' as const;
}

export default function BarberAccounting() {
	const { user } = useAuth();
	const [barberId, setBarberId] = useState<string | null>(null);
	const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
	const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
	const [loading, setLoading] = useState(true);
	const [savingWalkIn, setSavingWalkIn] = useState(false);
	const [walkInAmount, setWalkInAmount] = useState('');
	const [walkInClient, setWalkInClient] = useState('');
	const [walkInDescription, setWalkInDescription] = useState('');
	const [showWalkInForm, setShowWalkInForm] = useState(false);
	const [manualType, setManualType] = useState<'walkin' | 'tip' | 'product'>('walkin');
	const [manualMethod, setManualMethod] = useState<'cash' | 'zelle' | 'cashapp' | 'card'>('cash');

	useEffect(() => {
		setWalkInDescription((current) => {
			const trimmed = current.trim().toLowerCase();
			if (!trimmed || trimmed === 'walkin' || trimmed === 'tip' || trimmed === 'product') {
				return manualType;
			}
			return current;
		});
	}, [manualType]);

	useEffect(() => {
		const loadBarberId = async () => {
			const uid = user?.uid;
			if (!uid) {
				setBarberId(null);
				setLoading(false);
				return;
			}
			const barberQuery = query(
				collection(db, 'barbers'),
				where('userId', '==', uid)
			);
			const barberSnapshot = await getDocs(barberQuery);
			if (barberSnapshot.empty) {
				setBarberId(null);
				setLoading(false);
				return;
			}
			const barberSnapshotDoc = barberSnapshot.docs[0];
			setBarberId(barberSnapshotDoc.id);
		};

		void loadBarberId();
	}, [user?.uid]);

	useEffect(() => {
		if (!barberId) {
			setAppointments([]);
			setManualPayments([]);
			setLoading(false);
			return;
		}
		setLoading(true);
		const appointmentsQuery = query(
			collection(db, 'appointments'),
			where('barberId', '==', barberId),
			where('status', '==', 'completed')
		);
		const paymentsQuery = query(
			collection(db, 'manualPayments'),
			where('barberId', '==', barberId)
		);

		const unsubscribeAppointments = onSnapshot(
			appointmentsQuery,
			(snapshot) => {
				const data = snapshot.docs.map((docItem) => {
					const docData = docItem.data() as Omit<AppointmentItem, 'id'>;
					return { ...docData, id: docItem.id };
				});
				setAppointments(data);
				setLoading(false);
			},
			(error) => {
				console.log('[BarberAccounting] appointments error:', error);
				setAppointments([]);
				setLoading(false);
			}
		);

		const unsubscribePayments = onSnapshot(
			paymentsQuery,
			(snapshot) => {
				const data = snapshot.docs.map((docItem) => {
					const docData = docItem.data() as Omit<ManualPayment, 'id'>;
					return { ...docData, id: docItem.id } as ManualPayment;
				});
				setManualPayments(data);
			},
			(error) => {
				console.log('[BarberAccounting] manual payments error:', error);
				setManualPayments([]);
			}
		);

		return () => {
			unsubscribeAppointments();
			unsubscribePayments();
		};
	}, [barberId]);

	const handleSaveWalkIn = useCallback(async () => {
		if (!barberId) {
			Alert.alert('Missing barber', 'Barber ID is not available yet.');
			return;
		}
		const parsedAmount = Number(walkInAmount.replace(/[^0-9.]/g, ''));
		if (!parsedAmount || Number.isNaN(parsedAmount)) {
			Alert.alert('Enter an amount');
			return;
		}
		setSavingWalkIn(true);
		try {
			await addDoc(collection(db, 'manualPayments'), {
				barberId,
				amount: parsedAmount,
				method: manualMethod,
				type: manualType,
				clientName: walkInClient.trim() || 'Client',
				description: walkInDescription.trim() || manualType,
				date: Timestamp.fromDate(new Date()),
				createdAt: serverTimestamp(),
			});
			setWalkInAmount('');
			setWalkInClient('');
									setWalkInDescription('');
			setManualType('walkin');
			setManualMethod('cash');
			setShowWalkInForm(false);
			Alert.alert('Walk-in saved');
		} catch (error) {
			console.log('[BarberAccounting] walk-in save error:', error);
			Alert.alert('Failed to save walk-in');
		} finally {
			setSavingWalkIn(false);
		}
	}, [barberId, manualMethod, manualType, walkInAmount, walkInClient, walkInDescription]);

	const summary = useMemo(() => {
		const today = new Date();
		let appointmentsCompleted = 0;
		let appointmentsRevenue = 0;
		let walkins = 0;
		let tips = 0;
		let products = 0;

		appointments.forEach((item) => {
			const date = parseDateValue(item.time ?? item.date);
			if (!date || !isSameDay(date, today)) return;
			appointmentsCompleted += 1;
			appointmentsRevenue += typeof item.price === 'number' ? item.price : 0;
		});

		manualPayments.forEach((item) => {
			const date = parseDateValue(item.date);
			if (!date || !isSameDay(date, today)) return;
			const amount = typeof item.amount === 'number' ? item.amount : 0;
			const category = normalizeManualType(item.type);
			if (category === 'tips') tips += amount;
			else if (category === 'products') products += amount;
			else walkins += amount;
		});

		const total = appointmentsRevenue + walkins + tips + products;
		return {
			appointmentsRevenue,
			appointmentsCompleted,
			walkins,
			tips,
			products,
			total,
		};
	}, [appointments, manualPayments]);

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView
				contentContainerStyle={styles.content}
				showsVerticalScrollIndicator={false}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="on-drag"
			>
				<View style={styles.header}>
					<Text style={styles.title}>Accounting</Text>
					<Text style={styles.subtitle}>Today summary</Text>
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.cardTitle}>Today Revenue</Text>
					{loading ? (
						<View style={styles.loadingRow}>
							<ActivityIndicator color="#00f0ff" size="small" />
							<Text style={styles.loadingText}>Loading...</Text>
						</View>
					) : (
						<Text style={styles.cardValue}>{formatMoney(summary.appointmentsRevenue)}</Text>
					)}
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.cardTitle}>Appointments Completed</Text>
					<Text style={styles.cardValue}>{summary.appointmentsCompleted}</Text>
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Pressable
						style={styles.cardHeaderRow}
						onPress={() => setShowWalkInForm((current) => !current)}
					>
						<Text style={styles.cardTitle}>Register Manual Payment</Text>
						<Text style={styles.cardToggle}>{showWalkInForm ? '▴' : '▾'}</Text>
					</Pressable>
					{showWalkInForm ? (
						<>
								<Text style={styles.inputLabel}>Type</Text>
								<View style={styles.typeRow}>
									{['walkin', 'tip', 'product'].map((typeOption) => (
										<Pressable
											key={typeOption}
											style={[
												styles.typeButton,
												manualType === typeOption && styles.typeButtonActive,
											]}
											onPress={() => setManualType(typeOption as 'walkin' | 'tip' | 'product')}
										>
											<Text
												style={[
													styles.typeButtonText,
													manualType === typeOption && styles.typeButtonTextActive,
												]}
											>
												{typeOption.toUpperCase()}
											</Text>
										</Pressable>
									))}
								</View>
								<Text style={styles.inputLabel}>Method</Text>
								<View style={styles.typeRow}>
									{['cash', 'zelle', 'cashapp', 'card'].map((methodOption) => (
										<Pressable
											key={methodOption}
											style={[
												styles.typeButton,
												manualMethod === methodOption && styles.typeButtonActive,
											]}
											onPress={() =>
												setManualMethod(
													methodOption as 'cash' | 'zelle' | 'cashapp' | 'card'
												)
											}
										>
											<Text
												style={[
													styles.typeButtonText,
													manualMethod === methodOption && styles.typeButtonTextActive,
												]}
											>
												{methodOption.toUpperCase()}
											</Text>
										</Pressable>
									))}
								</View>
							<Text style={styles.inputLabel}>Amount</Text>
							<TextInput
								style={styles.input}
								value={walkInAmount}
								onChangeText={setWalkInAmount}
								placeholder="$35"
								placeholderTextColor="#6b7280"
								keyboardType="decimal-pad"
							/>
							<Text style={styles.inputLabel}>Client Name</Text>
							<TextInput
								style={styles.input}
								value={walkInClient}
								onChangeText={setWalkInClient}
								placeholder="Walk-in"
								placeholderTextColor="#6b7280"
							/>
							<Text style={styles.inputLabel}>Description</Text>
							<TextInput
								style={styles.input}
								value={walkInDescription}
								onChangeText={setWalkInDescription}
								placeholder="walk-in"
								placeholderTextColor="#6b7280"
							/>
							<Pressable
								style={[styles.registerButton, savingWalkIn && styles.primaryButtonDisabled]}
								onPress={handleSaveWalkIn}
								disabled={savingWalkIn}
							>
								<Text style={styles.registerButtonText}>
									{savingWalkIn ? 'Saving...' : 'Save'}
								</Text>
							</Pressable>
						</>
					) : null}
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.cardTitle}>Walk-ins</Text>
					<Text style={styles.cardValue}>{formatMoney(summary.walkins)}</Text>
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.cardTitle}>Tips</Text>
					<Text style={styles.cardValue}>{formatMoney(summary.tips)}</Text>
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.cardTitle}>Products</Text>
					<Text style={styles.cardValue}>{formatMoney(summary.products)}</Text>
				</View>

				<View style={[styles.card, { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(225, 6, 0, 0.85)' }]}>
					<Text style={styles.cardTitle}>Total</Text>
					<Text style={styles.totalValue}>{formatMoney(summary.total)}</Text>
				</View>
			</ScrollView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: '#000000',
	},
	content: {
		padding: 20,
		gap: 16,
		paddingBottom: 40,
	},
	header: {
		gap: 6,
	},
	title: {
		color: '#ffffff',
		fontSize: 22,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	card: {
backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 8,
	},
	cardTitle: {
		color: '#9aa0a6',
		fontSize: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	cardHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	cardToggle: {
		color: '#9aa0a6',
		fontSize: 16,
		fontWeight: '700',
	},
	typeRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	typeButton: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	typeButtonActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: 'rgba(0,240,255,0.15)',
	},
	typeButtonText: {
		color: '#9aa0a6',
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	typeButtonTextActive: {
		color: '#00f0ff',
	},
	cardValue: {
		color: '#ffffff',
		fontSize: 20,
		fontWeight: '700',
	},
	inputLabel: {
		color: '#9aa0a6',
		fontSize: 11,
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	input: {
backgroundColor: '#000',
		borderRadius: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		color: '#ffffff',
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 13,
	},
	primaryButton: {
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
		alignItems: 'center',
	},
	primaryButtonDisabled: {
		opacity: 0.6,
	},
	primaryButtonText: {
		color: '#000000',
		fontSize: 12,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	registerButton: {
		backgroundColor: '#00f0ff',
		borderRadius: 12,
		paddingVertical: 16,
		paddingHorizontal: 18,
		alignItems: 'center',
	},
	registerButtonText: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
	},
	totalValue: {
		color: '#00f0ff',
		fontSize: 22,
		fontWeight: '700',
	},
	loadingRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	loadingText: {
		color: '#9aa0a6',
		fontSize: 12,
	},
});
