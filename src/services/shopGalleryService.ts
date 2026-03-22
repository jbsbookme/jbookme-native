import { addDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function fetchShopGallery(): Promise<string[]> {
	try {
		const snapshot = await getDocs(collection(db, 'shopGallery'));
		return snapshot.docs
			.map((doc) => doc.data() as { url?: string })
			.map((item) => item.url)
			.filter((url): url is string => Boolean(url));
	} catch {
		return [];
	}
}

export async function addShopGalleryImage(url: string) {
	try {
		await addDoc(collection(db, 'shopGallery'), {
			url,
			createdAt: new Date(),
		});
		return true;
	} catch {
		return false;
	}
}
