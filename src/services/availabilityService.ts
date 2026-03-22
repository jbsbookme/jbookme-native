import { collection, getDocs, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { fetchServices, type Service } from './serviceService';

export const ALL_TIME_SLOTS = [
	'09:00',
	'09:30',
	'10:00',
	'10:30',
	'11:00',
	'11:30',
	'12:00',
	'12:30',
	'13:00',
	'13:30',
	'14:00',
	'14:30',
	'15:00',
	'15:30',
	'16:00',
	'16:30',
	'17:00',
	'17:30',
];

const APPOINTMENTS_BASE_URL = 'https://jbsbookme.com/api';

type AppointmentLite = {
	id?: string;
	barberId: string;
	date: string | Date | Timestamp;
	time: string | Date | Timestamp;
	serviceId?: string;
	duration?: number;
};

const DEFAULT_DURATION_MINUTES = 30;
let serviceDurationCache: Record<string, number> | null = null;

function padTime(value: number) {
	return value.toString().padStart(2, '0');
}

function toDateString(value: string | Date | Timestamp | undefined) {
	if (!value) return null;
	if (typeof value === 'string') {
		if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.toISOString().slice(0, 10);
		}
		return null;
	}
	if (value instanceof Date) {
		return value.toISOString().slice(0, 10);
	}
	if (typeof value === 'object' && typeof value.toDate === 'function') {
		return value.toDate().toISOString().slice(0, 10);
	}
	return null;
}

function toTimeString(value: string | Date | Timestamp | undefined) {
	if (!value) return null;
	if (typeof value === 'string') {
		if (/^\d{2}:\d{2}$/.test(value)) return value;
		const parsed = new Date(value);
		if (!Number.isNaN(parsed.getTime())) {
			return `${padTime(parsed.getHours())}:${padTime(parsed.getMinutes())}`;
		}
		return null;
	}
	if (value instanceof Date) {
		return `${padTime(value.getHours())}:${padTime(value.getMinutes())}`;
	}
	if (typeof value === 'object' && typeof value.toDate === 'function') {
		const date = value.toDate();
		return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
	}
	return null;
}

function getSlotIntervalMinutes() {
	if (ALL_TIME_SLOTS.length < 2) return DEFAULT_DURATION_MINUTES;
	const start = timeStringToMinutes(ALL_TIME_SLOTS[0]);
	const next = timeStringToMinutes(ALL_TIME_SLOTS[1]);
	if (start === null || next === null) return DEFAULT_DURATION_MINUTES;
	return Math.max(1, next - start);
}

function timeStringToMinutes(value: string) {
	const [hours, minutes] = value.split(':').map(Number);
	if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
	return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes: number) {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${padTime(hours)}:${padTime(minutes)}`;
}

async function getServiceDurationMap() {
	if (serviceDurationCache) return serviceDurationCache;
	try {
		const services = await fetchServices();
		serviceDurationCache = services.reduce<Record<string, number>>((acc, service: Service) => {
			if (service.id && typeof service.duration === 'number') {
				acc[service.id] = service.duration;
			}
			return acc;
		}, {});
		return serviceDurationCache;
	} catch {
		return {};
	}
}

function workingSlotsForDate(dateString: string) {
	const date = new Date(`${dateString}T00:00:00`);
	const day = date.getDay();
	if (day === 0) return [];
	return ALL_TIME_SLOTS;
}

async function fetchAppointmentsFromApi(barberId: string, date: string) {
	try {
		const response = await fetch(
			`${APPOINTMENTS_BASE_URL}/appointments?barberId=${encodeURIComponent(
				barberId
			)}&date=${encodeURIComponent(date)}`
		);
		if (!response.ok) return null;
		const data = (await response.json()) as { appointments?: AppointmentLite[] };
		return data.appointments ?? [];
	} catch {
		return null;
	}
}

async function fetchAppointmentsFromFirestore(barberId: string, date: string) {
	const [year, month, day] = date.split('-').map(Number);
	const start = new Date(year, month - 1, day, 0, 0, 0, 0);
	const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
	const appointmentsRef = collection(db, 'appointments');
	const q = query(
		appointmentsRef,
		where('barberId', '==', barberId),
		where('date', '>=', Timestamp.fromDate(start)),
		where('date', '<', Timestamp.fromDate(end))
	);
	try {
		const snapshot = await getDocs(q);
		return snapshot.docs.map((doc) => doc.data() as AppointmentLite);
	} catch {
		return [];
	}
}

export async function getBookedTimes(barberId: string, date: string) {
	const apiAppointments = await fetchAppointmentsFromApi(barberId, date);
	const appointments = apiAppointments ?? (await fetchAppointmentsFromFirestore(barberId, date));
	const workingSlots = workingSlotsForDate(date);
	const workingSet = new Set(workingSlots);
	const interval = getSlotIntervalMinutes();
	const durationsByService = await getServiceDurationMap();
	const blocked = new Set<string>();

	appointments.forEach((appointment) => {
		const startTime = toTimeString(appointment.time);
		if (!startTime) return;
		const duration =
			typeof appointment.duration === 'number'
				? appointment.duration
				: appointment.serviceId
				? durationsByService[appointment.serviceId]
				: undefined;
		const minutes = timeStringToMinutes(startTime);
		if (minutes === null) return;
		const blocks = Math.max(1, Math.ceil((duration ?? DEFAULT_DURATION_MINUTES) / interval));
		for (let i = 0; i < blocks; i += 1) {
			const slot = minutesToTimeString(minutes + i * interval);
			if (workingSet.has(slot)) {
				blocked.add(slot);
			}
		}
	});

	return Array.from(blocked);
}

export async function getAvailableTimeSlots(barberId: string, date: string) {
	const workingSlots = workingSlotsForDate(date);
	const booked = new Set(await getBookedTimes(barberId, date));
	return workingSlots.filter((slot) => !booked.has(slot));
}
