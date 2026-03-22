export type BarberNotification = {
	id: string;
	type: string;
	message: string;
	barberId: string;
	createdAt: number;
	read: boolean;
	actionLabel?: string;
	actionHref?: string;
	actionParams?: Record<string, string>;
};

const notificationsByBarber = new Map<string, BarberNotification[]>();
const listeners = new Set<() => void>();
const emptyNotifications: BarberNotification[] = [];
let counter = 0;

function emitChange() {
	listeners.forEach((listener) => listener());
}

function nextId() {
	counter += 1;
	return `n${Date.now()}-${counter}`;
}

export function addNotification(
	barberId: string,
	type: string,
	message: string,
	options?: {
		actionLabel?: string;
		actionHref?: string;
		actionParams?: Record<string, string>;
	}
) {
	const entry: BarberNotification = {
		id: nextId(),
		type,
		message,
		barberId,
		createdAt: Date.now(),
		read: false,
		actionLabel: options?.actionLabel,
		actionHref: options?.actionHref,
		actionParams: options?.actionParams,
	};

	const list = notificationsByBarber.get(barberId);
	if (list) {
		list.unshift(entry);
	} else {
		notificationsByBarber.set(barberId, [entry]);
	}

	emitChange();
}

export function addUserNotification(
	userId: string,
	type: string,
	message: string,
	options?: {
		actionLabel?: string;
		actionHref?: string;
		actionParams?: Record<string, string>;
	}
) {
	addNotification(userId, type, message, options);
}

export function addWaitlistNotification(userId: string, message: string) {
	addUserNotification(userId, 'waitlist', message, {
		actionLabel: 'Book Now',
		actionHref: '/(tabs)/book',
	});
}

export function getNotifications(barberId: string) {
	return notificationsByBarber.get(barberId) ?? emptyNotifications;
}

export function markAsRead(notificationId: string) {
	for (const list of notificationsByBarber.values()) {
		const item = list.find((entry) => entry.id === notificationId);
		if (item && !item.read) {
			item.read = true;
			emitChange();
			return;
		}
	}
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
