import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

export type Service = {
  id: string;
  name: string;
  price?: number;
  duration?: number;
  image?: string;
  category?: 'men' | 'women';
  role?: 'BARBER' | 'STYLIST';
};

type RawService = {
  id?: string;
  _id?: string;
  name?: string;
  title?: string;
  price?: number | string;
  duration?: number | string;
  image?: string;
  imageUrl?: string;
  photoUrl?: string;
  thumbnail?: string;
  category?: string;
  gender?: string;
  role?: string;
};

const DEFAULT_SERVICE_IMAGE = 'https://picsum.photos/300?random=101';

function normalizeCategory(value?: string): Service['category'] {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (['men', 'male', 'm', 'barber'].includes(normalized)) return 'men';
  if (['women', 'female', 'f', 'stylist'].includes(normalized)) return 'women';
  return undefined;
}

function normalizeRole(value?: string, category?: Service['category']): Service['role'] {
  if (value) {
    const normalized = value.toLowerCase();
    if (normalized === 'barber') return 'BARBER';
    if (normalized === 'stylist') return 'STYLIST';
  }
  if (category === 'women') return 'STYLIST';
  if (category === 'men') return 'BARBER';
  return undefined;
}

function normalizeService(raw: RawService, index: number): Service {
  const id = raw.id ?? raw._id ?? `service-${index}`;
  const name = raw.name ?? raw.title ?? 'Service';
  const priceValue = typeof raw.price === 'string' ? Number(raw.price) : raw.price;
  const durationValue =
    typeof raw.duration === 'string' ? Number(raw.duration) : raw.duration;
  const image = raw.image || raw.imageUrl || raw.photoUrl || raw.thumbnail || DEFAULT_SERVICE_IMAGE;
  const category = normalizeCategory(raw.category ?? raw.gender);
  const role = normalizeRole(raw.role, category);
  return {
    id,
    name,
    price: Number.isFinite(priceValue) ? priceValue : undefined,
    duration: Number.isFinite(durationValue) ? durationValue : undefined,
    image,
    category,
    role,
  };
}

async function fetchServicesFromFirestore(): Promise<Service[]> {
  const snapshot = await getDocs(collection(db, 'services'));
  const services = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as RawService),
  }));
  console.log('FIRESTORE SERVICES:', services);
  return services.map((service, index) => normalizeService(service, index));
}

export async function fetchTrendingServices(): Promise<Service[]> {
  try {
    return await fetchServicesFromFirestore();
  } catch {
    return [];
  }
}

export async function fetchServices(): Promise<Service[]> {
  try {
    return await fetchServicesFromFirestore();
  } catch (error) {
    console.error('Error loading services:', error);
    return [];
  }
}
