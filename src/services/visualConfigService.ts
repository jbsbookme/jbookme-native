type VisualConfig = {
	barberImage?: string;
	stylistImage?: string;
	galleryMaleCircleImage?: string;
	galleryFemaleCircleImage?: string;
};

const API_BASE_URL = 'https://jbsbookme.com/api';

export async function fetchVisualConfig(): Promise<VisualConfig | null> {
	try {
		const response = await fetch(`${API_BASE_URL}/settings`);
		if (!response.ok) return null;
		const data = (await response.json()) as {
			maleGenderImage?: string;
			femaleGenderImage?: string;
			galleryMaleCircleImage?: string;
			galleryFemaleCircleImage?: string;
		};
		console.log('VISUAL CONFIG RESPONSE:', data);
		return {
			barberImage: data.maleGenderImage,
			stylistImage: data.femaleGenderImage,
			galleryMaleCircleImage: data.galleryMaleCircleImage,
			galleryFemaleCircleImage: data.galleryFemaleCircleImage,
		};
	} catch {
		return null;
	}
}
