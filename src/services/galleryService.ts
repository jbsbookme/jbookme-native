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

export async function fetchBarberGalleryImages(barberId: string): Promise<GalleryItem[]> {
	try {
		const { collection, getDocs, orderBy, query, where } = await import('firebase/firestore');
		const { db } = await import('../config/firebase');
		const galleryQuery = query(
			collection(db, 'barberGallery'),
			where('barberId', '==', barberId),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(galleryQuery);
		return snapshot.docs.map((docItem) => ({
			...(docItem.data() as GalleryItem),
		}));
	} catch (error) {
		console.error('[GalleryService] fetchBarberGalleryImages error:', error);
		return [];
	}
}