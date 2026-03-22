import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function startAppointment(id: string) {
	if (!id) {
		throw new Error('Missing appointment id');
	}
	await updateDoc(doc(db, 'appointments', id), {
		status: 'started',
	});
}

export async function completeAppointment(id: string) {
	if (!id) {
		throw new Error('Missing appointment id');
	}
	await updateDoc(doc(db, 'appointments', id), {
		status: 'completed',
	});
}

export async function cancelAppointment(id: string) {
	if (!id) {
		throw new Error('Missing appointment id');
	}
	await updateDoc(doc(db, 'appointments', id), {
		status: 'cancelled',
	});
}
