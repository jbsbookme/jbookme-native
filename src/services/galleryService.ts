type GalleryItem = {
	gender?: string;
	imageUrl?: string;
	cloud_storage_path?: string;
	barberId?: string;
};

const API_BASE_URL = 'https://jbsbookme.com/api';

export async function fetchShopGalleryImages(): Promise<GalleryItem[]> {
	try {
		const response = await fetch(`${API_BASE_URL}/gallery`);
		if (!response.ok) {
			return [];
		}
		const data = (await response.json()) as GalleryItem[] | { gallery?: GalleryItem[] };
		if (Array.isArray(data)) return data;
		return data.gallery ?? [];
	} catch {
		return [];
	}
}

export async function fetchBarberGalleryImages(barberId: string | string[]): Promise<GalleryItem[]> {
	try {
		const { collection, getDocs } = await import('firebase/firestore');
		const { db } = await import('../config/firebase');
		const ids = Array.isArray(barberId) ? barberId : [barberId];
		const snapshots = await Promise.all(
			ids
				.filter((id) => id)
				.map((id) => getDocs(collection(db, 'barbers', id, 'portfolio')))
		);
		const items = snapshots.flatMap((snapshot) =>
			snapshot.docs.map((docItem) => ({
				id: docItem.id,
				...(docItem.data() as GalleryItem),
			}))
		);
		const seen = new Set<string>();
		return items.filter((item) => {
			const key = item.imageUrl ?? item.cloud_storage_path ?? item.id ?? '';
			if (!key) return true;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	} catch (error) {
		console.error('[GalleryService] fetchBarberGalleryImages error:', error);
		return [];
	}
}