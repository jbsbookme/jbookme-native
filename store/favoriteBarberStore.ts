type FavoriteEntry = {
	userId: string;
	favoriteBarberId: string | null;
};

const favorites = new Map<string, FavoriteEntry>();
const listeners = new Set<() => void>();

function emitChange() {
	listeners.forEach((listener) => listener());
}

export function setFavoriteBarber(userId: string, barberId: string) {
	const existing = favorites.get(userId)?.favoriteBarberId ?? null;
	const next = existing === barberId ? null : barberId;
	favorites.set(userId, { userId, favoriteBarberId: next });
	emitChange();
}

export function getFavoriteBarber(userId: string) {
	return favorites.get(userId)?.favoriteBarberId ?? null;
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
