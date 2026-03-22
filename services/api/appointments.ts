import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

type CreateAppointmentPayload = {
	barberId: string;
	clientId: string;
	clientName: string;
	barberName: string;
	serviceName: string;
	price: number;
	date: string; // YYYY-MM-DD
	time: string; // HH:mm
	status?: string;
};

function toScheduledAt(date: string, time: string) {
	return `${date}T${time}:00.000Z`;
}

export async function createAppointment(payload: CreateAppointmentPayload) {
	try {
		const scheduledAt = toScheduledAt(payload.date, payload.time);
		const docRef = await addDoc(collection(db, 'appointments'), {
			...payload,
			scheduledAt,
			status: payload.status ?? 'confirmed',
			createdAt: serverTimestamp(),
		});

		return { id: docRef.id } as unknown;
	} catch (error) {
		console.error('[createAppointment] error:', error);
		throw error;
	}
}
