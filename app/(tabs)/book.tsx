import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
	Alert,
	Animated,
	ActivityIndicator,
	FlatList,
	Modal,
	Platform,
	Pressable,
	SafeAreaView,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { SafeImage } from '../../components/SafeImage';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { collection, getDocs, query, where } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { scheduleBookingNotification } from '../../src/services/notifications';
import { createAppointment } from '../../src/services/appointmentService';
import { registerCompletedAppointment } from '../../store/loyaltyStore';
import { addNotification } from '../../store/notificationStore';
import { joinWaitlist } from '../../store/waitlistStore';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import {
	getFavoriteBarber,
	subscribe as subscribeFavorites,
} from '../../store/favoriteBarberStore';
import { fetchBarbers } from '../../src/services/barberService';
import { fetchServices } from '../../src/services/serviceService';
import { fetchVisualConfig } from '../../src/services/visualConfigService';

type Service = {
	id: string;
	name: string;
	price: number;
	duration: number;
	image?: string;
	gender?: 'MALE' | 'FEMALE' | 'men' | 'women';
};

type Barber = {
	id: string;
	user: {
		name: string;
	};
	profileImage?: string;
	phone?: string;
	zelle?: string;
	cashapp?: string;
	cash?: string;
	paymentMethods?: string[];
	specialties?: string;
	hourlyRate?: number;
	role?: 'barber' | 'stylist' | 'BARBER' | 'STYLIST';
	gender?: 'MALE' | 'FEMALE';
	rating?: number; // Keep for compatibility with existing UI
};

type RawBarber = {
	id?: string;
	_id?: string;
	barberId?: string;
	userId?: string;
	uid?: string;
	name?: string;
	user?: { name?: string; displayName?: string };
	profileImage?: string;
	image?: string;
	imageUrl?: string;
	avatar?: string;
	photoUrl?: string;
	phone?: string;
	zelle?: string;
	cashapp?: string;
	cash?: string;
	paymentMethods?: string[];
	payment_methods?: string[];
	paymentMethod?: string[];
	specialties?: string;
	hourlyRate?: number;
	role?: string;
	gender?: string;
	rating?: number;
};

type RawService = {
	id?: string;
	_id?: string;
	serviceId?: string;
	name?: string;
	price?: number | string;
	duration?: number | string;
	image?: string;
	imageUrl?: string;
	gender?: string;
};
const TODAY_TIMES = ['3:40 PM', '4:10 PM', '5:00 PM'];
const TOMORROW_TIMES = ['10:30 AM', '11:15 AM', '12:00 PM'];
const PICK_DAY_TIMES = ['10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM'];
const DEFAULT_BARBER_IMAGE = 'https://via.placeholder.com/300x300';
const DEFAULT_SERVICE_IMAGE = 'https://via.placeholder.com/300x300';
type DepositMethod = 'cashapp' | 'zelle';
type VisualConfig = {
	barberImage?: string;
	stylistImage?: string;
};

type CategoryKey = 'men' | 'women';

type Category = {
	id: CategoryKey;
	label: string;
	imageUrl?: string;
	type: 'BARBER' | 'STYLIST';
};

const CATEGORY_FALLBACKS: Category[] = [
	{
		id: 'men',
		label: 'Men',
		imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438',
		type: 'BARBER',
	},
	{
		id: 'women',
		label: 'Women',
		imageUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9',
		type: 'STYLIST',
	},
];

function toStartOfDay(date: Date) {
	const next = new Date(date);
	next.setHours(0, 0, 0, 0);
	return next;
}

function buildDateForTime(baseDate: Date, timeLabel: string) {
	const date = new Date(baseDate);
	const [timePart, meridiem] = timeLabel.split(' ');
	const [rawHours, rawMinutes] = timePart.split(':').map((value) => Number(value));
	if (Number.isNaN(rawHours) || Number.isNaN(rawMinutes)) {
		return date;
	}
	let hours = rawHours;
	if (meridiem) {
		const upper = meridiem.toUpperCase();
		if (upper === 'PM' && hours < 12) hours += 12;
		if (upper === 'AM' && hours === 12) hours = 0;
	}
	date.setHours(hours, rawMinutes, 0, 0);
	return date;
}

function isPastSlot(date: Date) {
	return date.getTime() <= Date.now();
}

function padTime(value: number) {
	return value.toString().padStart(2, '0');
}

function formatDateId(date: Date) {
	const year = date.getFullYear();
	const month = padTime(date.getMonth() + 1);
	const day = padTime(date.getDate());
	return `${year}${month}${day}`;
}

function formatTimeIdFromLabel(timeLabel: string) {
	const base = new Date(2000, 0, 1);
	const date = buildDateForTime(base, timeLabel);
	return `${padTime(date.getHours())}${padTime(date.getMinutes())}`;
}

function formatTimeIdFromDate(date: Date) {
	return `${padTime(date.getHours())}${padTime(date.getMinutes())}`;
}

function formatRequestDate(date: Date) {
	const year = date.getFullYear();
	const month = padTime(date.getMonth() + 1);
	const day = padTime(date.getDate());
	return `${year}-${month}-${day}`;
}

function formatPrice(value?: number) {
	if (typeof value !== 'number') return '';
	return `$${value}`;
}

function normalizeGender(value?: string): 'MALE' | 'FEMALE' | undefined {
	if (!value) return undefined;
	const normalized = value.toLowerCase();
	if (['male', 'men', 'm', 'barber'].includes(normalized)) return 'MALE';
	if (['female', 'women', 'f', 'stylist'].includes(normalized)) return 'FEMALE';
	return undefined;
}

function resolveGenderFromParam(value?: string): 'men' | 'women' | null {
	if (!value) return null;
	const normalized = value.toLowerCase();
	if (['women', 'female', 'f', 'stylist'].includes(normalized)) return 'women';
	if (['men', 'male', 'm', 'barber'].includes(normalized)) return 'men';
	return null;
}

function resolveBarberName(raw: RawBarber) {
	return raw.user?.name || raw.user?.displayName || raw.name || 'Barber';
}

function resolveBarberPhone(raw: RawBarber) {
	return (
		raw.phone ||
		raw.phoneNumber ||
		raw.whatsapp ||
		raw.whatsappPhone ||
		raw.user?.phone ||
		raw.user?.phoneNumber ||
		raw.user?.whatsapp ||
		raw.user?.whatsappPhone ||
		null
	);
}

function resolveBarberId(raw: RawBarber, index: number) {
	return (
		raw.id ||
		raw._id ||
		raw.barberId ||
		raw.userId ||
		raw.uid ||
		`barber-${index}`
	);
}

function resolveServiceId(raw: RawService, index: number) {
	return raw.id || raw._id || raw.serviceId || `service-${index}`;
}

function normalizeBarber(raw: RawBarber, index: number): Barber {
	const name = resolveBarberName(raw);
	const role = raw.role as Barber['role'] | undefined;
	const gender = normalizeGender(raw.gender) || normalizeGender(role);
	const paymentMethods =
		raw.paymentMethods || raw.payment_methods || raw.paymentMethod || [];
	return {
		id: resolveBarberId(raw, index),
		user: { name },
		profileImage:
			raw.profileImage ||
			raw.image ||
			raw.imageUrl ||
			raw.avatar ||
			raw.photoUrl ||
			DEFAULT_BARBER_IMAGE,
		phone: resolveBarberPhone(raw) ?? undefined,
		zelle: raw.zelle,
		cashapp: raw.cashapp,
		cash: raw.cash,
		paymentMethods: Array.isArray(paymentMethods) ? paymentMethods : [],
		specialties: raw.specialties,
		hourlyRate:
			typeof raw.hourlyRate === 'number' && Number.isFinite(raw.hourlyRate)
				? raw.hourlyRate
				: undefined,
		role,
		gender,
		rating: raw.rating,
	};
}

function normalizeService(raw: RawService, index: number): Service {
	const price =
		typeof raw.price === 'number'
			? raw.price
			: Number(raw.price ?? 0);
	const duration =
		typeof raw.duration === 'number'
			? raw.duration
			: Number(raw.duration ?? 0);
	return {
		id: resolveServiceId(raw, index),
		name: raw.name || 'Service',
		price: Number.isFinite(price) ? price : 0,
		duration: Number.isFinite(duration) ? duration : 0,
		image: raw.image || raw.imageUrl,
		gender: normalizeGender(raw.gender),
	};
}

export default function Book() {
	const router = useRouter();
	const params = useLocalSearchParams<{ barberId?: string; targetGender?: string }>();
	const { user } = useAuth();
	const loyaltyUserId = '123';
	const waitlistUserId = `U${loyaltyUserId}`;
	const favoriteUserId = 'user_001';
	const [allBarbers, setAllBarbers] = useState<Barber[]>([]);
	const [services, setServices] = useState<Service[]>([]);
	const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
	const [selectedCategory, setSelectedCategory] = useState<'MALE' | 'FEMALE'>('MALE');
	const [selectedGender, setSelectedGender] = useState<'men' | 'women'>('men');
	const [categories, setCategories] = useState<Category[]>([]);
	const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey>('men');
	const [selectedService, setSelectedService] = useState<string | null>(null);
	const [appointmentDateTime, setAppointmentDateTime] = useState<Date | null>(null);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedTime, setSelectedTime] = useState<string | null>(null);
	const [takenSlots, setTakenSlots] = useState<string[]>([]);
	const [availableSlots, setAvailableSlots] = useState<string[]>([]);
	const [blockedSlots, setBlockedSlots] = useState<string[]>([]);
	const [showCalendar, setShowCalendar] = useState(false);
	const [policyAccepted, setPolicyAccepted] = useState(false);
	const [showPolicyModal, setShowPolicyModal] = useState(false);
	const [showDepositModal, setShowDepositModal] = useState(false);
	const [depositMethod, setDepositMethod] = useState<DepositMethod | null>(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const [visualConfig, setVisualConfig] = useState<VisualConfig | null>(null);
	const favoriteBarberId = useSyncExternalStore(
		subscribeFavorites,
		() => getFavoriteBarber(favoriteUserId),
		() => getFavoriteBarber(favoriteUserId)
	);
	const servicesFade = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(servicesFade, {
			toValue: 1,
			duration: 250,
			useNativeDriver: true,
		}).start();
	}, [servicesFade]);

	useEffect(() => {
		void Notifications.requestPermissionsAsync();
	}, []);

	useEffect(() => {
		const loadData = async () => {
			const [barberData, serviceData] = await Promise.all([
				fetchBarbers(),
				fetchServices(),
			]);
			const normalizedBarbers = barberData.map((item, index) =>
				normalizeBarber(item as RawBarber, index)
			);
			const normalizedServices = serviceData.map((item, index) =>
				normalizeService(item as RawService, index)
			);
			setAllBarbers(normalizedBarbers);
			setServices(normalizedServices);
			if (normalizedBarbers.length > 0) {
				const matched = params.barberId
					? normalizedBarbers.find((barber) => barber.id === params.barberId)
					: null;
				setSelectedBarber((current) => current ?? matched?.id ?? normalizedBarbers[0].id);
			}
		};

		loadData();
	}, [params.barberId]);

	useEffect(() => {
		const loadCategories = async () => {
			try {
				const snapshot = await getDocs(collection(db, 'categories'));
				const next = snapshot.docs
					.map((docSnap) => {
						const id = docSnap.id as CategoryKey;
						const data = docSnap.data() as Omit<Category, 'id'>;
						return {
							id,
							label: data.label ?? (id === 'women' ? 'Women' : 'Men'),
							imageUrl: data.imageUrl,
							type: data.type ?? (id === 'women' ? 'STYLIST' : 'BARBER'),
						};
					})
					.filter((item) => item.id === 'men' || item.id === 'women');
				setCategories(next);
			} catch (error) {
				console.warn('Error loading categories (firestore):', error);
				setCategories([]);
			}
		};

		void loadCategories();
	}, []);

	useEffect(() => {
		const resolved = resolveGenderFromParam(params.targetGender);
		if (!resolved) return;
		setSelectedGender(resolved);
		setSelectedCategory(resolved === 'women' ? 'FEMALE' : 'MALE');
		setSelectedCategoryKey(resolved);
	}, [params.targetGender]);

	useEffect(() => {
		const loadVisualConfig = async () => {
			const config = await fetchVisualConfig();
			setVisualConfig(config);
		};

		void loadVisualConfig();
	}, []);
	const barbers = useMemo(() => {
		const filtered = allBarbers.filter((barber) => barber.gender === 'MALE');
		if (!favoriteBarberId) return filtered;
		const favorite = filtered.find((barber) => barber.id === favoriteBarberId);
		if (!favorite) return filtered;
		return [favorite, ...filtered.filter((barber) => barber !== favorite)];
	}, [allBarbers, favoriteBarberId]);

	const stylists = useMemo(() => {
		const filtered = allBarbers.filter((barber) => barber.gender === 'FEMALE');
		if (!favoriteBarberId) return filtered;
		const favorite = filtered.find((barber) => barber.id === favoriteBarberId);
		if (!favorite) return filtered;
		return [favorite, ...filtered.filter((barber) => barber !== favorite)];
	}, [allBarbers, favoriteBarberId]);

	const selectedBarberData = useMemo(() => {
		return allBarbers.find((barber) => barber.id === selectedBarber) ?? null;
	}, [allBarbers, selectedBarber]);

	const barberPaymentMethods = useMemo(() => {
		const methods = new Set<string>();
		const rawMethods = (selectedBarberData as Barber | null)?.paymentMethods ?? [];
		rawMethods.forEach((method) => methods.add(method.toLowerCase()));
		if ((selectedBarberData as Barber | null)?.cashapp) methods.add('cashapp');
		if ((selectedBarberData as Barber | null)?.zelle) methods.add('zelle');
		if ((selectedBarberData as Barber | null)?.cash) methods.add('cash');
		const labelFor = (value: string) => {
			switch (value) {
				case 'cashapp':
					return 'CashApp';
				case 'zelle':
					return 'Zelle';
				case 'cash':
					return 'Cash';
				default:
					return value.charAt(0).toUpperCase() + value.slice(1);
			}
		};
		return Array.from(methods).map(labelFor);
	}, [selectedBarberData]);

	const selectedCategoryType = useMemo(() => {
		const match = categories.find((item) => item.id === selectedCategoryKey);
		return match?.type ?? (selectedCategoryKey === 'women' ? 'STYLIST' : 'BARBER');
	}, [categories, selectedCategoryKey]);

	const filteredProfessionals = useMemo(() => {
		const targetRole = selectedCategoryType.toLowerCase();
		const filtered = allBarbers.filter((barber) => {
			const role = barber.role?.toLowerCase();
			return role === targetRole;
		});
		return filtered.length > 0 ? filtered : allBarbers;
	}, [allBarbers, selectedCategoryType]);

	const selectedBarberName = useMemo(() => {
		return allBarbers.find((barber) => barber.id === selectedBarber)?.user?.name ?? 'Unknown';
	}, [allBarbers, selectedBarber]);
	const selectedBarberPhone = useMemo(() => {
		return allBarbers.find((barber) => barber.id === selectedBarber)?.phone ?? null;
	}, [allBarbers, selectedBarber]);

	const servicesWithGender = useMemo(() => {
		const baseServices =
			services && services.length > 0
				? services
				: [
						{ id: '1', name: 'Haircut', price: 35 },
						{ id: '2', name: 'Beard Trim', price: 20 },
						{ id: '3', name: 'Color', price: 50 },
						{ id: '4', name: 'Styling', price: 40 },
					];
		return baseServices.map((service, index) => {
			const normalizedGender = service.gender
				? service.gender === 'MALE'
					? 'men'
					: service.gender === 'FEMALE'
					? 'women'
					: service.gender
				: index % 2 === 0
				? 'men'
				: 'women';
			return {
				...service,
				gender: normalizedGender,
			};
		});
	}, [services]);

	const filteredServices = useMemo(() => {
		return servicesWithGender.filter((service) => {
			if (!selectedGender) return true;
			return service.gender === selectedGender;
		});
	}, [servicesWithGender, selectedGender]);

	const finalServices = useMemo(() => filteredServices, [filteredServices]);

	const servicesWithImages = useMemo(() => {
		const salt = selectedGender === 'women' ? 200 : 30;
		return finalServices.map((service, index) => ({
			...service,
			image: service.image || `https://picsum.photos/300?random=${index + salt}`,
		}));
	}, [finalServices, selectedGender]);

	useEffect(() => {
		setSelectedService((current) => {
			if (servicesWithImages.length === 0) return null;
			if (!current) return servicesWithImages[0].id;
			const isStillValid = servicesWithImages.some((service) => service.id === current);
			return isStillValid ? current : servicesWithImages[0].id;
		});
	}, [servicesWithImages]);

	useEffect(() => {
		setSelectedBarber(null);
	}, [selectedGender]);

	useEffect(() => {
		setSelectedBarber((current) => {
			if (filteredProfessionals.length === 0) return null;
			if (!current) return filteredProfessionals[0]?.id ?? null;
			const stillValid = filteredProfessionals.some((barber) => barber.id === current);
			return stillValid ? current : (filteredProfessionals[0]?.id ?? null);
		});
	}, [filteredProfessionals]);

	const todayDate = useMemo(() => toStartOfDay(new Date()), []);
	const tomorrowDate = useMemo(() => {
		const next = new Date();
		next.setDate(next.getDate() + 1);
		return toStartOfDay(next);
	}, []);

	const isSameDay = (left: Date, right: Date) =>
		left.getFullYear() === right.getFullYear() &&
		left.getMonth() === right.getMonth() &&
		left.getDate() === right.getDate();

	const selectedDateSlots = useMemo(() => {
		if (isSameDay(toStartOfDay(selectedDate), todayDate)) return TODAY_TIMES;
		if (isSameDay(toStartOfDay(selectedDate), tomorrowDate)) return TOMORROW_TIMES;
		return PICK_DAY_TIMES;
	}, [selectedDate, todayDate, tomorrowDate]);

	const hasAvailableSlots = useMemo(() => {
		return selectedDateSlots.some((time) => !isPastSlot(buildDateForTime(selectedDate, time)));
	}, [selectedDateSlots, selectedDate]);

	const filteredTodaySlots = useMemo(
		() =>
			availableSlots.length > 0
				? TODAY_TIMES.filter(
						(time) =>
							availableSlots.includes(time) &&
							!takenSlots.includes(time) &&
							!blockedSlots.includes(time)
					)
				: TODAY_TIMES.filter(
						(time) => !takenSlots.includes(time) && !blockedSlots.includes(time)
					),
			[availableSlots, takenSlots, blockedSlots]
	);
	const filteredTomorrowSlots = useMemo(
		() =>
			availableSlots.length > 0
				? TOMORROW_TIMES.filter(
						(time) =>
							availableSlots.includes(time) &&
							!takenSlots.includes(time) &&
							!blockedSlots.includes(time)
					)
				: TOMORROW_TIMES.filter(
						(time) => !takenSlots.includes(time) && !blockedSlots.includes(time)
					),
			[availableSlots, takenSlots, blockedSlots]
	);
	const filteredPickDaySlots = useMemo(
		() =>
			availableSlots.length > 0
				? PICK_DAY_TIMES.filter(
						(time) =>
							availableSlots.includes(time) &&
							!takenSlots.includes(time) &&
							!blockedSlots.includes(time)
					)
				: PICK_DAY_TIMES.filter(
						(time) => !takenSlots.includes(time) && !blockedSlots.includes(time)
					),
			[availableSlots, takenSlots, blockedSlots]
	);

	const formatDate = (date: Date) =>
		date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
	const parseDateString = (dateString: string) => {
		const [year, month, day] = dateString.split('-').map((value) => Number(value));
		if (!year || !month || !day) return new Date();
		return new Date(year, month - 1, day);
	};

	const dayName = useMemo(
		() =>
			new Date(selectedDate).toLocaleDateString('en-US', {
				weekday: 'long',
			}),
		[selectedDate]
	);

	const loadAvailability = async (barberId: string | null, day: string) => {
		if (!barberId) return;
		const q = query(
			collection(db, 'barberAvailability'),
			where('barberId', '==', barberId),
			where('day', '==', day)
		);
		const snapshot = await getDocs(q);
		if (!snapshot.empty) {
			const data = snapshot.docs[0]?.data() as { slots?: string[] };
			setAvailableSlots(data?.slots ?? []);
			return;
		}
		setAvailableSlots([]);
	};

	const loadTakenSlots = async (date: Date, barberId: string | null) => {
		if (!barberId) return;
		const q = query(
			collection(db, 'appointments'),
			where('date', '==', date),
			where('barberId', '==', barberId)
		);
		const snapshot = await getDocs(q);
		const times = snapshot.docs
			.map((docSnap) => docSnap.data() as { date?: Date | { toDate?: () => Date } })
			.map((data) => {
				const raw = data?.date;
				if (!raw) return null;
				const dateValue = raw instanceof Date ? raw : raw.toDate?.();
				if (!dateValue) return null;
				return dateValue.toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit',
				});
			})
			.filter((value): value is string => Boolean(value));
		setTakenSlots(times);
	};

	const loadBlockedSlots = async (barberId: string | null, date: Date) => {
		if (!barberId) return;
		const q = query(
			collection(db, 'barberBlocks'),
			where('barberId', '==', barberId),
			where('date', '==', date)
		);
		const snapshot = await getDocs(q);
		if (!snapshot.empty) {
			const data = snapshot.docs[0]?.data() as { blockedSlots?: string[] };
			setBlockedSlots(data?.blockedSlots ?? []);
			return;
		}
		setBlockedSlots([]);
	};

	useEffect(() => {
		if (selectedDate && selectedBarber) {
			void loadTakenSlots(selectedDate, selectedBarber);
		}
	}, [selectedDate, selectedBarber]);

	useEffect(() => {
		setTakenSlots([]);
	}, [selectedBarber]);

	useEffect(() => {
		setAvailableSlots([]);
	}, [selectedBarber]);

	useEffect(() => {
		setAvailableSlots([]);
	}, [selectedDate]);

	useEffect(() => {
		setBlockedSlots([]);
	}, [selectedBarber]);

	useEffect(() => {
		setBlockedSlots([]);
	}, [selectedDate]);

	useEffect(() => {
		if (selectedBarber && selectedDate) {
			void loadAvailability(selectedBarber, dayName);
		}
	}, [selectedBarber, selectedDate, dayName]);

	useEffect(() => {
		if (selectedBarber && selectedDate) {
			void loadBlockedSlots(selectedBarber, selectedDate);
		}
	}, [selectedBarber, selectedDate]);

	const handleConfirm = async (method: DepositMethod) => {
		if (!policyAccepted) return false;
		if (!appointmentDateTime) {
			Alert.alert('Select a time', 'Choose a date and time before confirming.');
			return false;
		}
		if (!user) {
			Alert.alert('Sign in required', 'Please sign in to confirm your booking.');
			return false;
		}
		if (!selectedBarber || !selectedService) {
			Alert.alert('Missing details', 'Please select a barber and service.');
			return false;
		}
		const acknowledged = await new Promise<boolean>((resolve) => {
			Alert.alert(
				'Payment notice',
				'You will pay $5 now and the rest in person',
				[
					{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
					{ text: 'OK', onPress: () => resolve(true) },
				]
			);
		});
		if (!acknowledged) return false;

		setIsConfirming(true);
		let appointmentDocId = `local-${Date.now()}`;
		try {
			const appointmentDate = appointmentDateTime ?? selectedDate;
			appointmentDocId = await createAppointment({
				barberId: selectedBarber,
				serviceId: selectedService,
				userId: user.uid,
				date: appointmentDate,
			});
			await Notifications.scheduleNotificationAsync({
				content: {
					title: 'Appointment Confirmed 💈',
					body: 'Your booking was successful',
				},
				trigger: null,
			});
		} catch (error) {
			setIsConfirming(false);
			Alert.alert('Booking failed', 'Please try again.');
			return false;
		}

		const notificationDate = appointmentDateTime ?? selectedDate;
		if (notificationDate) {
			await scheduleBookingNotification(notificationDate);
		}

		addNotification(selectedBarber ?? 'barber', 'booking', 'New booking received');

		const appointmentEndTime = new Date(appointmentDateTime.getTime() + 45 * 60 * 1000);
		const delayMs = appointmentEndTime.getTime() - Date.now();
		const userId = `U${loyaltyUserId}`;
		const dateId = formatDateId(selectedDate ?? appointmentDateTime);
		const timeId = selectedTime
			? formatTimeIdFromLabel(selectedTime)
			: formatTimeIdFromDate(appointmentDateTime);
		const appointmentId = `${userId}-${selectedBarber ?? 'barber'}-${dateId}-${timeId}`;
		if (delayMs > 0) {
			setTimeout(() => {
				registerCompletedAppointment(loyaltyUserId, appointmentId);
			}, delayMs);
		}

		setIsConfirming(false);
		Alert.alert(
			'Appointment confirmed.',
			'You will receive a reminder before your appointment.'
		);
		router.push({
			pathname: '/booking/confirmation',
			params: {
				appointmentId: appointmentDocId,
				barberId: selectedBarber ?? 'barber',
				barberName: selectedBarberName,
				serviceId: selectedService ?? undefined,
				date: appointmentDateTime.toISOString(),
				time: appointmentDateTime.toISOString(),
				userId: user.uid,
				userName: user.displayName ?? 'Customer',
			},
		});
		return true;
	};

	const handleConfirmBooking = async () => {
		if (!policyAccepted) return;
		if (!appointmentDateTime) {
			Alert.alert('Select a time', 'Choose a date and time before confirming.');
			return;
		}
		if (!depositMethod) {
			setShowDepositModal(true);
			return;
		}
		const success = await handleConfirm(depositMethod);
		if (success) {
			setShowDepositModal(false);
			setDepositMethod(null);
		}
	};

	const handleDepositConfirm = async () => {
		if (!depositMethod) return;
		const success = await handleConfirm(depositMethod);
		if (success) {
			setShowDepositModal(false);
			setDepositMethod(null);
		}
	};

	const openWhatsApp = (phone: string | null) => {
		if (!phone) return;
		const url = `https://wa.me/${phone.replace('+', '')}`;
		Linking.openURL(url);
	};

	return (
		<SafeAreaView style={styles.screen}>
			<ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
							<Text style={styles.title}>Book Appointment</Text>
							<Text style={styles.subtitle}>
								Select your barber and schedule your next cut
							</Text>
						</View>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Select Category</Text>
					<View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
						{(categories.length > 0 ? categories : CATEGORY_FALLBACKS).map(
							(categoryItem) => {
								const isActive = selectedCategoryKey === categoryItem.id;
								return (
									<TouchableOpacity
										key={categoryItem.id}
										onPress={() => {
											setSelectedCategoryKey(categoryItem.id);
											setSelectedGender(categoryItem.id);
											setSelectedCategory(
												categoryItem.id === 'women' ? 'FEMALE' : 'MALE'
											);
										}}
										style={{
											flex: 1,
											backgroundColor: isActive ? '#00d4ff' : '#000',
											borderColor: '#111',
											borderWidth: 1,
											borderRadius: 16,
											overflow: 'hidden',
										}}
									>
										<SafeImage
											uri={categoryItem.imageUrl}
											fallbackSource={require('../../assets/placeholder-service.png')}
											style={{ width: '100%', height: 120 }}
											resizeMode="cover"
										/>
										<Text
											style={{
												color: isActive ? '#000' : '#fff',
												textAlign: 'center',
												padding: 10,
												fontWeight: 'bold',
											}}
										>
											{categoryItem.label.toUpperCase()}
										</Text>
									</TouchableOpacity>
								);
							}
						)}
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Select Professional</Text>
					<FlatList
						data={filteredProfessionals}
						horizontal
						showsHorizontalScrollIndicator={false}
						keyExtractor={(item) => item.id}
						contentContainerStyle={styles.barberList}
						renderItem={({ item }) => {
							const isActive = item.id === selectedBarber;
							return (
								<Pressable
									style={[styles.barberCard, isActive && styles.barberCardActive]}
									onPress={() => setSelectedBarber(item.id)}
								>
									<SafeImage
										uri={item.profileImage ?? DEFAULT_BARBER_IMAGE}
										fallbackSource={require('../../assets/placeholder-barber.png')}
										style={styles.barberImage}
										resizeMode="cover"
									/>
									<Text style={styles.barberName}>{item.user?.name ?? 'Barber'}</Text>
									<Text style={styles.barberRating}>
										⭐ {(Number.isFinite(item.rating) ? item.rating : 4.8).toFixed(1)}
									</Text>
								</Pressable>
							);
						}}
					/>
					{selectedBarberPhone ? (
						<TouchableOpacity
							onPress={() => openWhatsApp(selectedBarberPhone)}
							style={{
								backgroundColor: '#25D366',
								padding: 12,
								borderRadius: 10,
								marginTop: 10,
							}}
						>
							<Text style={{ color: 'white', textAlign: 'center' }}>
								Chat on WhatsApp
							</Text>
						</TouchableOpacity>
					) : null}

				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Select Service</Text>
					{servicesWithImages.length === 0 ? (
						<View style={styles.emptyStateContainer}>
							<Ionicons name="cut-outline" size={26} color="#00f0ff" />
							<Text style={styles.emptyStateTitle}>No services available yet.</Text>
							<Text style={styles.emptyStateSubtitle}>Please check back soon.</Text>
						</View>
					) : (
						<Animated.View style={[styles.serviceList, { opacity: servicesFade }]}>
							{servicesWithImages.map((service) => {
								const isActive = service.id === selectedService;
								return (
									<Pressable
										key={service.id}
										style={styles.serviceCard}
										onPress={() => {
											setSelectedService(service.id);
											router.push({
												pathname: '/booking/select-time',
												params: {
													barberId: selectedBarber ?? 'barber',
													serviceId: service.id,
												},
											});
										}}
									>
										<SafeImage
											uri={service.image || DEFAULT_SERVICE_IMAGE}
											fallbackSource={require('../../assets/placeholder-service.png')}
											style={styles.serviceImage}
											resizeMode="cover"
										/>
										<View style={styles.serviceInfo}>
											<Text style={styles.serviceName}>{service.name}</Text>
											<Text style={styles.serviceMeta}>
												{service.duration} min • ${service.price}
											</Text>
										</View>
										<View style={styles.serviceButton}>
											<Text style={styles.serviceButtonText}>Book</Text>
										</View>
									</Pressable>
								);
							})}
						</Animated.View>
					)}
					<View style={styles.dateContainer}>
						<Text style={styles.dateLabel}>Selected Date</Text>
						<Text style={styles.dateValue}>{formatDate(selectedDate)}</Text>
					</View>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Available Times</Text>
					<Text style={styles.subSectionTitle}>Today</Text>
					<View style={styles.row}>
						{filteredTodaySlots.map((time) => {
							const date = buildDateForTime(todayDate, time);
							const isActive = appointmentDateTime?.getTime() === date.getTime();
							const isTaken = takenSlots.includes(time);
							const isDisabled = isPastSlot(date) || isTaken;
							return (
								<Pressable
									key={`today-${time}`}
									style={[
										styles.timeSlot,
										isActive && styles.timeSlotActive,
										isDisabled && styles.timeSlotDisabled,
									]}
									onPress={() => {
										setAppointmentDateTime(date);
										setSelectedDate(todayDate);
										setSelectedTime(time);
									}}
									disabled={isDisabled}
								>
									<Text
										style={[
											styles.timeText,
											isActive && styles.timeTextActive,
											isDisabled && styles.timeTextDisabled,
										]}
									>
										{time} {isTaken ? '(Booked)' : ''}
									</Text>
								</Pressable>
							);
						})}
					</View>

					<Text style={styles.subSectionTitle}>Tomorrow</Text>
					<View style={styles.row}>
						{filteredTomorrowSlots.map((time) => {
							const date = buildDateForTime(tomorrowDate, time);
							const isActive = appointmentDateTime?.getTime() === date.getTime();
							const isTaken = takenSlots.includes(time);
							const isDisabled = isPastSlot(date) || isTaken;
							return (
								<Pressable
									key={`tomorrow-${time}`}
									style={[
										styles.timeSlot,
										isActive && styles.timeSlotActive,
										isDisabled && styles.timeSlotDisabled,
									]}
									onPress={() => {
										setAppointmentDateTime(date);
										setSelectedDate(tomorrowDate);
										setSelectedTime(time);
									}}
									disabled={isDisabled}
								>
									<Text
										style={[
											styles.timeText,
											isActive && styles.timeTextActive,
											isDisabled && styles.timeTextDisabled,
										]}
									>
										{time} {isTaken ? '(Booked)' : ''}
									</Text>
								</Pressable>
							);
						})}
					</View>

					<Text style={styles.subSectionTitle}>Pick another day</Text>
					<Pressable
						style={styles.pickDateButton}
						onPress={() => setShowCalendar((current) => !current)}
					>
						<Ionicons name="calendar" size={18} color="#00f0ff" />
						<Text style={styles.pickDateText}>Pick another day</Text>
					</Pressable>
					{showCalendar ? (
						<View style={styles.datePickerInline}>
							<Calendar
								minDate={todayDate.toISOString().slice(0, 10)}
								onDayPress={(day) => {
									setSelectedDate(parseDateString(day.dateString));
									setShowCalendar(false);
								}}
								markedDates={{
									[todayDate.toISOString().slice(0, 10)]: {
										marked: true,
										selected: isSameDay(selectedDate, todayDate),
										selectedColor: '#00f0ff',
									},
									[selectedDate.toISOString().slice(0, 10)]: {
										selected: true,
										selectedColor: '#00f0ff',
									},
								}}
								theme={{
									backgroundColor: '#000',
									calendarBackground: '#000',
									textSectionTitleColor: '#9aa0a6',
									dayTextColor: '#ffffff',
									monthTextColor: '#ffffff',
									todayTextColor: '#ffd700',
									arrowColor: '#00f0ff',
									textDisabledColor: 'rgba(255,255,255,0.3)',
								}}
							/>
						</View>
					) : null}

					{selectedDate ? (
						<View style={styles.row}>
							{filteredPickDaySlots.map((time) => {
								const date = buildDateForTime(selectedDate, time);
								const isActive = appointmentDateTime?.getTime() === date.getTime();
								const isTaken = takenSlots.includes(time);
								const isDisabled = isPastSlot(date) || isTaken;
								return (
									<Pressable
										key={`custom-${time}`}
										style={[
											styles.timeSlot,
											isActive && styles.timeSlotActive,
											isDisabled && styles.timeSlotDisabled,
										]}
										onPress={() => {
											setAppointmentDateTime(date);
											setSelectedTime(time);
										}}
										disabled={isDisabled}
									>
										<Text
											style={[
												styles.timeText,
												isActive && styles.timeTextActive,
												isDisabled && styles.timeTextDisabled,
											]}
										>
											{time} {isTaken ? '(Booked)' : ''}
										</Text>
									</Pressable>
								);
							})}
						</View>
					) : null}

					{!hasAvailableSlots ? (
						<Pressable
							style={styles.waitlistButton}
							onPress={() => {
								const barberId = selectedBarber ?? 'barber';
								joinWaitlist(waitlistUserId, barberId, formatRequestDate(selectedDate));
								Alert.alert('Added to waitlist', 'We will notify you if a slot opens.');
							}}
						>
							<Text style={styles.waitlistButtonText}>📅 Join Waitlist</Text>
						</Pressable>
					) : null}
				</View>

				<Pressable
					style={styles.confirmButton}
					onPress={() => {
						setPolicyAccepted(false);
						setShowPolicyModal(true);
					}}
				>
					<Text style={styles.confirmText}>Confirm Booking</Text>
				</Pressable>
			</ScrollView>

			<Modal
				visible={showPolicyModal}
				transparent
				animationType="fade"
				onRequestClose={() => setShowPolicyModal(false)}
			>
				<View style={styles.policyModalBackdrop}>
					<View style={styles.policyModalCard}>
						<Text style={styles.policyModalTitle}>Booking Policy</Text>
						<View style={styles.policyModalBody}>
							<Text style={styles.policyModalBullet}>• Please arrive on time.</Text>
							<Text style={styles.policyModalBullet}>• 10-minute late limit before cancellation.</Text>
							<Text style={styles.policyModalBullet}>
								• Deposits are non-refundable (if applicable).
							</Text>
							<Text style={styles.policyModalBullet}>
								• No-shows may be restricted from future bookings.
							</Text>
						</View>

						{barberPaymentMethods.length > 0 ? (
							<View style={styles.policyModalBody}>
								<Text style={styles.policyModalSectionTitle}>Barber accepts:</Text>
								{barberPaymentMethods.map((method) => (
									<Text key={method} style={styles.policyModalBullet}>
										• {method}
									</Text>
								))}
							</View>
						) : null}

						<Pressable
							style={styles.policyCheckRow}
							onPress={() => setPolicyAccepted((prev) => !prev)}
						>
							<View
								style={[
									styles.checkbox,
									policyAccepted && styles.checkboxChecked,
								]}
							>
								{policyAccepted ? <Text style={styles.checkboxMark}>✓</Text> : null}
							</View>
							<Text style={styles.policyCheckText}>I agree to the booking policy</Text>
						</Pressable>

						<View style={styles.policyModalActions}>
							<Pressable
								style={styles.policyCancelButton}
								onPress={() => setShowPolicyModal(false)}
							>
								<Text style={styles.policyCancelText}>Cancel</Text>
							</Pressable>
							<Pressable
								style={[
									styles.policyConfirmButton,
									!policyAccepted && styles.policyConfirmDisabled,
								]}
								onPress={async () => {
									if (!policyAccepted) return;
									setShowPolicyModal(false);
									await handleConfirmBooking();
								}}
								disabled={!policyAccepted}
							>
								<Text style={styles.policyConfirmText}>Accept & Confirm</Text>
							</Pressable>
						</View>
					</View>
				</View>
			</Modal>

			<Modal
				visible={showDepositModal}
				transparent
				animationType="fade"
				onRequestClose={() => {
					setShowDepositModal(false);
					setDepositMethod(null);
				}}
			>
				<View style={styles.depositModalBackdrop}>
					<View style={styles.depositModalCard}>
						<Text style={styles.depositTitle}>Deposit Required</Text>
						<Text style={styles.depositAmount}>$5</Text>

						<Pressable
							style={[
								styles.depositOption,
								depositMethod === 'cashapp' && styles.depositOptionActive,
							]}
							onPress={() => {
								setDepositMethod('cashapp');
								Linking.openURL('https://cash.app/$JBSBARBERSHOP');
							}}
						>
							<Text
								style={[
									styles.depositOptionText,
									depositMethod === 'cashapp' && styles.depositOptionTextActive,
								]}
							>
								Pay with CashApp
							</Text>
						</Pressable>

						<Pressable
							style={[
								styles.depositOption,
								depositMethod === 'zelle' && styles.depositOptionActive,
							]}
							onPress={() => setDepositMethod('zelle')}
						>
							<Text
								style={[
									styles.depositOptionText,
									depositMethod === 'zelle' && styles.depositOptionTextActive,
								]}
							>
								Pay with Zelle
							</Text>
						</Pressable>

						{depositMethod === 'zelle' ? (
							<View style={styles.depositInfoBox}>
								<Text style={styles.depositInfoText}>Send $5 deposit to:</Text>
								<Text style={styles.depositInfoValue}>jbsbarbershop@email.co</Text>
							</View>
						) : null}

						<Pressable
							style={[
								styles.depositActionButton,
								(!depositMethod || isConfirming) && styles.depositActionButtonDisabled,
							]}
							onPress={handleDepositConfirm}
							disabled={!depositMethod || isConfirming}
						>
							<Text style={styles.depositActionText}>I sent the deposit</Text>
						</Pressable>
					</View>
				</View>
			</Modal>

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
		paddingBottom: 40,
		gap: 24,
	},
	header: {
		gap: 6,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
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
		fontSize: 30,
		fontWeight: '700',
	},
	subtitle: {
		color: '#9aa0a6',
		fontSize: 14,
	},
	section: {
		gap: 12,
	},
	sectionTitle: {
		color: '#00f0ff',
		fontSize: 16,
		fontWeight: '600',
	},
	categoryRow: {
		flexDirection: 'row',
		gap: 12,
	},
	categoryCard: {
		flex: 1,
		borderRadius: 14,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		padding: 12,
		alignItems: 'center',
		backgroundColor: '#000',
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	categoryImage: {
		width: '100%',
		height: 120,
		borderRadius: 12,
		marginBottom: 10,
		backgroundColor: '#000',
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	categoryCardActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: 'rgba(225, 6, 0, 0.18)',
	},
	categoryText: {
		color: '#9aa0a6',
		fontSize: 14,
		fontWeight: '600',
	},
	categoryTextActive: {
		color: '#ffffff',
	},
	subSectionTitle: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
		marginTop: 6,
	},
	calendarWrapper: {
		marginTop: 12,
		backgroundColor: '#000',
		borderRadius: 12,
		padding: 8,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	barberList: {
		gap: 10,
		paddingRight: 8,
	},
	barberCard: {
		width: 100,
backgroundColor: '#000',
		borderRadius: 16,
		padding: 8,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	barberCardActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
		shadowColor: '#00f0ff',
		shadowOpacity: 0.2,
		shadowRadius: 10,
	},
	barberImage: {
		width: '100%',
		height: 62,
		borderRadius: 12,
		marginBottom: 8,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	barberName: {
		color: '#ffffff',
		fontSize: 11,
		fontWeight: '600',
	},
	barberRating: {
		color: '#ffd700',
		marginTop: 4,
		fontSize: 9,
	},
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 10,
	},
	serviceList: {
		gap: 10,
	},
	loadingRow: {
		paddingVertical: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptyStateContainer: {
		marginTop: 6,
		paddingVertical: 16,
		paddingHorizontal: 12,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		backgroundColor: '#000',
		alignItems: 'center',
		gap: 6,
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	emptyStateTitle: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
		textAlign: 'center',
	},
	emptyStateSubtitle: {
		color: '#9aa0a6',
		fontSize: 12,
		textAlign: 'center',
	},
	emptyStateButton: {
		marginTop: 6,
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: 'rgba(225, 6, 0, 0.18)',
		minWidth: 160,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
	},
	emptyStateButtonPressed: {
		opacity: 0.7,
	},
	emptyStateButtonDisabled: {
		opacity: 0.5,
	},
	emptyStateButtonText: {
		color: '#ffffff',
		fontSize: 12,
		fontWeight: '600',
	},
	emptyStateButtonOverlayText: {
		position: 'absolute',
	},
	serviceCard: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 12,
		marginBottom: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 4 },
	},
	serviceImage: {
		width: 70,
		height: 70,
		borderRadius: 10,
		marginRight: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	serviceInfo: {
		flex: 1,
	},
	serviceName: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '600',
	},
	serviceMeta: {
		color: '#aaaaaa',
		fontSize: 13,
		marginTop: 4,
	},
	serviceButton: {
		backgroundColor: '#e10600',
		paddingVertical: 6,
		paddingHorizontal: 12,
		borderRadius: 8,
	},
	serviceButtonText: {
		color: '#ffffff',
		fontWeight: '700',
	},
	dateContainer: {
		marginTop: 6,
		backgroundColor: '#000',
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	dateLabel: {
		color: '#9aa0a6',
		fontSize: 12,
		fontWeight: '600',
	},
	dateValue: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
		marginTop: 4,
	},
	timeSlot: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	timeSlotActive: {
		borderColor: '#ffd700',
		backgroundColor: 'rgba(255,215,0,0.12)',
	},
	timeText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	timeTextActive: {
		color: '#ffd700',
	},
	timeSlotDisabled: {
		opacity: 0.45,
	},
	timeTextDisabled: {
		color: '#9aa0a6',
	},
	datePickerButton: {
		backgroundColor: '#000',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
	},
	datePickerText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
	},
	waitlistButton: {
		marginTop: 12,
		backgroundColor: '#e10600',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	waitlistButtonText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
	pickDateButton: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	pickDateText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	policyCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		gap: 10,
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	policyTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	policyText: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	policyList: {
		gap: 6,
	},
	policyBullet: {
		color: '#ffffff',
		fontSize: 13,
	},
	policyCheckRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	checkbox: {
		width: 22,
		height: 22,
		borderRadius: 6,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	checkboxChecked: {
		backgroundColor: '#00f0ff',
	},
	checkboxMark: {
		color: '#000000',
		fontSize: 14,
		fontWeight: '700',
	},
	policyCheckText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '600',
	},
	policyModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.6)',
		justifyContent: 'center',
		padding: 20,
	},
	policyModalCard: {
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 18,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		gap: 14,
	},
	policyModalTitle: {
		color: '#ffffff',
		fontSize: 18,
		fontWeight: '700',
	},
	policyModalBody: {
		gap: 6,
	},
	policyModalSectionTitle: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
		marginTop: 2,
	},
	policyModalBullet: {
		color: '#9aa0a6',
		fontSize: 13,
	},
	policyModalActions: {
		flexDirection: 'row',
		gap: 10,
	},
	policyCancelButton: {
		flex: 1,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	policyCancelText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
	},
	policyConfirmButton: {
		flex: 1,
		backgroundColor: '#e10600',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	policyConfirmDisabled: {
		opacity: 0.5,
	},
	policyConfirmText: {
		color: '#ffffff',
		fontSize: 13,
		fontWeight: '700',
	},
	confirmButton: {
		backgroundColor: '#e10600',
		paddingVertical: 16,
		borderRadius: 14,
		alignItems: 'center',
		marginTop: 6,
	},
	confirmButtonDisabled: {
		opacity: 0.5,
	},
	datePickerInline: {
		marginTop: 10,
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 10,
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		height: 320,
	},
	calendarModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.6)',
		justifyContent: 'center',
		padding: 20,
	},
	calendarModalCard: {
		backgroundColor: '#000',
		borderRadius: 14,
		padding: 16,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		gap: 12,
		overflow: 'hidden',
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	calendarModalTitle: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
	},
	calendarPickerContainer: {
		width: '100%',
		height: 320,
	},
	calendarPicker: {
		width: '100%',
		height: 320,
	},
	datePickerDone: {
		marginTop: 10,
		alignItems: 'center',
	},
	datePickerDoneText: {
		color: '#00f0ff',
		fontSize: 13,
		fontWeight: '600',
	},
	confirmText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '700',
		letterSpacing: 0.6,
		textTransform: 'uppercase',
	},
	depositModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.65)',
		justifyContent: 'center',
		padding: 20,
	},
	depositModalCard: {
		backgroundColor: '#000',
		borderRadius: 16,
		padding: 18,
		gap: 12,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	depositTitle: {
		color: '#ffffff',
		fontSize: 18,
		fontWeight: '700',
	},
	depositAmount: {
		color: '#00f0ff',
		fontSize: 24,
		fontWeight: '700',
	},
	depositOption: {
		borderWidth: 1,
		borderColor: 'rgba(225, 6, 0, 0.85)',
		borderRadius: 12,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	depositOptionActive: {
		borderColor: 'rgba(225, 6, 0, 0.85)',
		backgroundColor: 'rgba(0,240,255,0.08)',
	},
	depositOptionText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '600',
	},
	depositOptionTextActive: {
		color: '#00f0ff',
	},
	depositInfoBox: {
backgroundColor: '#000',
		borderRadius: 12,
		padding: 12,
		borderWidth: 1,
		borderColor: '#2a2a2a',
		gap: 4,
		shadowColor: '#fff',
		shadowOpacity: 0.1,
		shadowRadius: 6,
	},
	depositInfoText: {
		color: '#9aa0a6',
		fontSize: 12,
		fontWeight: '600',
	},
	depositInfoValue: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
	},
	depositActionButton: {
		marginTop: 6,
		backgroundColor: '#e10600',
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: 'center',
	},
	depositActionButtonDisabled: {
		opacity: 0.5,
	},
	depositActionText: {
		color: '#ffffff',
		fontSize: 14,
		fontWeight: '700',
		letterSpacing: 0.4,
		textTransform: 'uppercase',
	},
});
