export type CheckInRecord = {
	appointmentId: string;
	userId: string;
	barberId: string;
	checkedIn: boolean;
	time: number;
};

const records = new Map<string, CheckInRecord>();
const listeners = new Set<() => void>();

function emitChange() {
	listeners.forEach((listener) => listener());
}

function parseAppointmentId(appointmentId: string) {
	const parts = appointmentId.split('-');
	if (parts.length < 4) return null;
	const userId = parts[0] || 'user';
	const timePart = parts[parts.length - 1];
	const datePart = parts[parts.length - 2];
	const barberId = parts.slice(1, parts.length - 2).join('-') || 'barber';
	return { userId, barberId, datePart, timePart };
}

export function checkInAppointment(appointmentId: string) {
	const parsed = parseAppointmentId(appointmentId);
	const userId = parsed?.userId ?? 'user';
	const barberId = parsed?.barberId ?? 'barber';
	const existing = records.get(appointmentId);
	if (existing?.checkedIn) return existing;

	const record: CheckInRecord = {
		appointmentId,
		userId,
		barberId,
		checkedIn: true,
		time: Date.now(),
	};
	records.set(appointmentId, record);
	emitChange();
	return record;
}

export function getCheckInStatus(appointmentId: string) {
	return records.get(appointmentId) ?? null;
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
