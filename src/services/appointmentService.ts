import { addDoc, collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';

const PLACEHOLDER_IMAGE = 'https://i.pravatar.cc/300?img=8';
const MOCK_TODAY: TodayAppointment[] = [
  {
    barberId: '1',
    barberName: 'Adolfo',
    serviceName: 'Signature Fade',
    time: '10:00',
	profileImage: PLACEHOLDER_IMAGE,
  },
  {
    barberId: '2',
    barberName: 'Luis',
    serviceName: 'Beard Sculpt',
    time: '11:30',
	profileImage: PLACEHOLDER_IMAGE,
  },
];

export type TodayAppointment = {
  barberId: string;
  barberName: string;
  barberRole?: string;
  serviceName: string;
  time: string;
  profileImage?: string;
};

export type Appointment = {
  id: string;
  barberName: string;
  serviceName: string;
  date: string;
  time: string;
  price: number;
  status: string;
};

type TimestampLike = { toDate?: () => Date; seconds?: number };

type RawAppointment = {
  id?: string;
  barberId?: string;
  barberName?: string;
  serviceName?: string;
  price?: number | string;
  status?: string;
  date?: string | Date | TimestampLike;
  time?: string | Date | TimestampLike;
  appointmentDate?: string | Date | TimestampLike;
  startTime?: string | Date | TimestampLike;
  barber?: { id?: string; name?: string; user?: { name?: string }; profileImage?: string };
  service?: { name?: string };
  barberImage?: string;
  barberProfileImage?: string;
  profileImage?: string;
  image?: string;
  imageUrl?: string;
  photoUrl?: string;
};

type BarberLookupItem = {
  name?: string;
  profileImage?: string;
  role?: string;
};

async function fetchAppointmentsFromFirestore(): Promise<RawAppointment[]> {
  const snapshot = await getDocs(collection(db, 'appointments'));
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as RawAppointment),
  }));
}

export async function fetchAppointments(): Promise<Appointment[]> {
  try {
    const data = await fetchAppointmentsFromFirestore();
    if (!Array.isArray(data)) return [];
    return data.map((raw, index) => ({
      id: raw.id ?? `appointment-${index}`,
      barberName: resolveBarberName(raw),
      serviceName: resolveServiceName(raw),
      date: toDateKey(raw.date ?? raw.appointmentDate ?? raw.startTime ?? raw.time) ?? '',
      time: toTimeString(raw.time ?? raw.startTime ?? raw.date ?? raw.appointmentDate) ?? '',
      price: typeof raw.price === 'number' ? raw.price : Number(raw.price) || 0,
      status: raw.status ?? 'CONFIRMED',
    }));
  } catch {
    return [];
  }
}

function padTime(value: number) {
  return value.toString().padStart(2, '0');
}

function toDateKey(value?: string | Date | TimestampLike | null) {
  if (!value) return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString().slice(0, 10);
  }
  return null;
}

function toTimeString(value?: string | Date | TimestampLike | null) {
  if (!value) return null;
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return `${padTime(parsed.getHours())}:${padTime(parsed.getMinutes())}`;
    }
    return null;
  }
  if (value instanceof Date) {
    return `${padTime(value.getHours())}:${padTime(value.getMinutes())}`;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const date = value.toDate();
      return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
    }
    if (typeof value.seconds === 'number') {
      const date = new Date(value.seconds * 1000);
      return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
    }
  }
  return null;
}

function resolveBarberName(raw: RawAppointment) {
  return raw.barberName || raw.barber?.name || raw.barber?.user?.name || 'Barber';
}

function resolveServiceName(raw: RawAppointment) {
  return raw.serviceName || raw.service?.name || 'Service';
}

function resolveImage(raw: RawAppointment) {
  return (
    raw.profileImage ||
    raw.barberProfileImage ||
    raw.barberImage ||
    raw.barber?.profileImage ||
    raw.image ||
    raw.imageUrl ||
    raw.photoUrl ||
    PLACEHOLDER_IMAGE
  );
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchBarbersByField(field: string, ids: string[]) {
  if (ids.length === 0) return [];
  const chunks = chunkArray(ids, 10);
  const results: Record<string, unknown>[] = [];
  for (const chunk of chunks) {
    const snap = await getDocs(
      query(collection(db, 'barbers'), where(field, 'in', chunk))
    );
    snap.docs.forEach((docSnap) => {
      results.push({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) });
    });
  }
  return results;
}

export async function fetchTodayAppointments(): Promise<TodayAppointment[]> {
  try {
    const appointments = await fetchAppointmentsFromFirestore();
    if (appointments.length === 0) return [];
    const todayKey = new Date().toISOString().slice(0, 10);
    const filtered = appointments.filter((appointment) => {
      const key = toDateKey(
        appointment.date ?? appointment.appointmentDate ?? appointment.startTime ?? appointment.time
      );
      return key === todayKey;
    });
    const uniqueBarberIds = Array.from(
      new Set(
        filtered
          .map((appointment) => appointment.barberId || appointment.barber?.id)
          .filter((value): value is string => Boolean(value))
      )
    );
    const barberDocs = await Promise.all(
      uniqueBarberIds.map(async (barberId) => {
        try {
          const snap = await getDoc(doc(db, 'barbers', barberId));
          return snap.exists() ? { id: barberId, ...(snap.data() as Record<string, unknown>) } : null;
        } catch {
          return null;
        }
      })
    );
    const barberLookup = barberDocs.reduce<Record<string, BarberLookupItem>>(
      (acc, barber) => {
        if (!barber || typeof barber.id !== 'string') return acc;
        const data = barber as {
          id: string;
          name?: string;
          user?: { name?: string };
          profileImage?: string;
          role?: string;
        };
        acc[barber.id] = {
          name: data.name ?? data.user?.name,
          profileImage: data.profileImage,
          role: data.role,
        };
        return acc;
      },
      {}
    );

    const barberByUserId = await fetchBarbersByField('userId', uniqueBarberIds);
    const barberByPrismaId = await fetchBarbersByField('prismaBarberId', uniqueBarberIds);
    const aliasLookup = [...barberByUserId, ...barberByPrismaId].reduce<Record<string, BarberLookupItem>>(
      (acc, barber) => {
        if (!barber) return acc;
        const data = barber as {
          id?: string;
          name?: string;
          user?: { name?: string };
          profileImage?: string;
          role?: string;
          userId?: string;
          prismaBarberId?: string;
        };
        const key = data.userId ?? data.prismaBarberId;
        if (!key) return acc;
        acc[key] = {
          name: data.name ?? data.user?.name,
          profileImage: data.profileImage,
          role: data.role,
        };
        return acc;
      },
      {}
    );
    const seen = new Set<string>();
    const results: TodayAppointment[] = [];
    filtered.forEach((appointment, index) => {
      const barberId =
        appointment.barberId ||
        appointment.barber?.id ||
        appointment.id ||
        `appointment-${index}`;
      const barberFallback = barberLookup[barberId] ?? aliasLookup[barberId];
      const time =
        toTimeString(
          appointment.time ?? appointment.startTime ?? appointment.date ?? appointment.appointmentDate
        ) ?? '00:00';
      const key = `${barberId}-${time}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({
        barberId,
        barberName: barberFallback?.name ?? resolveBarberName(appointment),
        barberRole: barberFallback?.role,
        serviceName: resolveServiceName(appointment),
        time,
        profileImage: barberFallback?.profileImage ?? resolveImage(appointment),
      });
    });
    return results;
  } catch {
    return [];
  }
}

type CreateAppointmentInput = {
  barberId: string;
  serviceId: string;
  userId: string;
  date: string | Date;
};

export async function createAppointment({
  barberId,
  serviceId,
  userId,
  date,
}: CreateAppointmentInput): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, 'appointments'), {
      barberId,
      serviceId,
      userId,
      date,
      status: 'confirmed',
      createdAt: new Date(),
    });

    console.log('APPOINTMENT CREATED:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('ERROR CREATING APPOINTMENT:', error);
    throw error;
  }
}

export async function getUserAppointments(userId: string): Promise<Appointment[]> {
  try {
    const q = query(collection(db, 'appointments'), where('userId', '==', userId));
    const snapshot = await getDocs(q);
    const appointments = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as Partial<Appointment> & {
          barberId?: string;
          serviceId?: string;
        };
        const barberRef = data.barberId ? doc(db, 'barbers', data.barberId) : null;
        const serviceRef = data.serviceId ? doc(db, 'services', data.serviceId) : null;
        const [barberSnap, serviceSnap] = await Promise.all([
          barberRef ? getDoc(barberRef) : Promise.resolve(null),
          serviceRef ? getDoc(serviceRef) : Promise.resolve(null),
        ]);

        return {
          id: docSnap.id,
          ...data,
          barberName:
            barberSnap && 'exists' in barberSnap && barberSnap.exists()
              ? (barberSnap.data() as { name?: string })?.name ?? 'Unknown'
              : 'Unknown',
          serviceName:
            serviceSnap && 'exists' in serviceSnap && serviceSnap.exists()
              ? (serviceSnap.data() as { name?: string })?.name ?? 'Unknown'
              : 'Unknown',
        };
      })
    );

    console.log('FULL APPOINTMENTS:', appointments);
    return appointments as Appointment[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getAllAppointments(): Promise<Appointment[]> {
  try {
    const snapshot = await getDocs(collection(db, 'appointments'));

    const appointments = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data() as Partial<Appointment> & {
          barberId?: string;
          serviceId?: string;
        };

        const barberRef = data.barberId ? doc(db, 'barbers', data.barberId) : null;
        const serviceRef = data.serviceId ? doc(db, 'services', data.serviceId) : null;
        const [barberSnap, serviceSnap] = await Promise.all([
          barberRef ? getDoc(barberRef) : Promise.resolve(null),
          serviceRef ? getDoc(serviceRef) : Promise.resolve(null),
        ]);

        return {
          id: docSnap.id,
          ...data,
          barberName:
            barberSnap && 'exists' in barberSnap && barberSnap.exists()
              ? (barberSnap.data() as { name?: string })?.name ?? 'Unknown'
              : 'Unknown',
          serviceName:
            serviceSnap && 'exists' in serviceSnap && serviceSnap.exists()
              ? (serviceSnap.data() as { name?: string })?.name ?? 'Unknown'
              : 'Unknown',
        };
      })
    );

    return appointments as Appointment[];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function updateAppointmentStatus(id: string, status: string): Promise<void> {
  try {
    const ref = doc(db, 'appointments', id);
    await updateDoc(ref, { status });
    console.log('STATUS UPDATED:', id, status);
  } catch (error) {
    console.error('ERROR UPDATING STATUS:', error);
  }
}

export async function getDashboardStats(): Promise<{
  revenue: number;
  todayCount: number;
  completed: number;
  cancelled: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, 'appointments'));
    const today = new Date().toDateString();

    let revenue = 0;
    let todayCount = 0;
    let completed = 0;
    let cancelled = 0;

    const appointments = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as { date?: string | Date; status?: string; serviceId?: string }),
    }));

    for (const item of appointments) {
      if (!item.date) continue;
      const date = new Date(item.date).toDateString();
      if (date !== today) continue;

      todayCount += 1;

      if (item.status === 'completed') {
        completed += 1;

        if (item.serviceId) {
          const serviceRef = doc(db, 'services', item.serviceId);
          const serviceSnap = await getDoc(serviceRef);
          if (serviceSnap.exists()) {
            const price = (serviceSnap.data() as { price?: number })?.price ?? 0;
            revenue += price;
          }
        }
      }

      if (item.status === 'cancelled') {
        cancelled += 1;
      }
    }

    return { revenue, todayCount, completed, cancelled };
  } catch (error) {
    console.error(error);
    return { revenue: 0, todayCount: 0, completed: 0, cancelled: 0 };
  }
}
