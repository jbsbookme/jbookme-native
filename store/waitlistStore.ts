import { addWaitlistNotification } from './notificationStore';

export type WaitlistEntry = {
	id: string;
	userId: string;
	barberId: string;
	requestedDate: string;
	createdAt: number;
	notified: boolean;
};

const waitlist: WaitlistEntry[] = [];
const listeners = new Set<() => void>();

function emitChange() {
	listeners.forEach((listener) => listener());
}

function nextId() {
	return `W${Date.now()}`;
}

export function joinWaitlist(userId: string, barberId: string, date: string) {
	const entry: WaitlistEntry = {
		id: nextId(),
		userId,
		barberId,
		requestedDate: date,
		createdAt: Date.now(),
		notified: false,
	};
	waitlist.push(entry);
	emitChange();
	return entry;
}

export function getWaitlist(barberId: string) {
	return waitlist.filter((entry) => entry.barberId === barberId);
}

export function removeFromWaitlist(id: string) {
	const index = waitlist.findIndex((entry) => entry.id === id);
	if (index === -1) return;
	waitlist.splice(index, 1);
	emitChange();
}

export function notifyNextCustomer(barberId: string) {
	const next = waitlist
		.filter((entry) => entry.barberId === barberId && !entry.notified)
		.sort((a, b) => a.createdAt - b.createdAt)[0];
	if (!next) return null;
	next.notified = true;
	addWaitlistNotification(next.userId, `Slot available with ${barberId}. Book now.`);
	emitChange();
	return next;
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
