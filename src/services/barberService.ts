import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

type RawBarber = {
  id?: string;
  profileImage?: string;
  image?: string;
  imageUrl?: string;
  avatar?: string;
  photoUrl?: string;
  user?: { name?: string };
  name?: string;
};

const DEFAULT_BARBER_IMAGE = 'https://i.pravatar.cc/300?img=1';

function resolveProfileImage(raw: RawBarber): string {
  const candidate =
    raw.image || raw.profileImage || raw.imageUrl || raw.avatar || raw.photoUrl || '';
  return candidate.trim().length > 0 ? candidate : DEFAULT_BARBER_IMAGE;
}

export async function fetchBarbers() {
  try {
    const snapshot = await getDocs(collection(db, 'barbers'));
    const barbers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as RawBarber),
    }));
    console.log('FIRESTORE BARBERS:', barbers);
    return barbers.map((barber: RawBarber) => {
      const name = barber.name ?? barber.user?.name ?? 'Barber';
      const image = resolveProfileImage(barber);
      return {
        ...barber,
        name,
        image,
        profileImage: image,
        user: barber.user ?? { name },
      };
    });
  } catch (error) {
    console.warn('Error loading barbers (firestore):', error);
    return [];
  }
}
