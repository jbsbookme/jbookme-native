export type Promotion = {
	id: string;
	title: string;
	description: string;
	discount: number;
	barberId: string;
	expiresAt: number;
	active: boolean;
};

const promotions: Promotion[] = [
	{
		id: 'promo1',
		title: 'Today Only',
		description: '$5 off haircut with Luis',
		discount: 5,
		barberId: 'luis',
		expiresAt: Date.now() + 24 * 60 * 60 * 1000,
		active: true,
	},
	{
		id: 'promo2',
		title: 'Happy Hour',
		description: '$10 off fades with Jorge',
		discount: 10,
		barberId: 'jorge',
		expiresAt: Date.now() + 6 * 60 * 60 * 1000,
		active: true,
	},
];

const listeners = new Set<() => void>();
let version = 0;
let lastSnapshotVersion = -1;
let lastSnapshot: Promotion[] = [];
let lastPruneAt = 0;

function emitChange() {
	version += 1;
	listeners.forEach((listener) => listener());
}

function pruneExpired() {
	const now = Date.now();
	if (now - lastPruneAt < 60 * 1000) return;
	lastPruneAt = now;
	let changed = false;
	promotions.forEach((promo) => {
		if (promo.active && now > promo.expiresAt) {
			promo.active = false;
			changed = true;
		}
	});
	if (changed) {
		version += 1;
	}
}

export function getActivePromotions() {
	pruneExpired();
	if (lastSnapshotVersion === version) {
		return lastSnapshot;
	}
	lastSnapshot = promotions.filter((promo) => promo.active && Date.now() <= promo.expiresAt);
	lastSnapshotVersion = version;
	return lastSnapshot;
}

export function addPromotion(promotion: Promotion) {
	promotions.unshift(promotion);
	emitChange();
}

export function removePromotion(id: string) {
	const index = promotions.findIndex((promo) => promo.id === id);
	if (index === -1) return;
	promotions.splice(index, 1);
	emitChange();
}

export function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}
