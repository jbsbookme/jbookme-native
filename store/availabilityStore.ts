export type BarberAvailability = {
  barberId: string;
  barberName: string;
  nextAvailable: string;
};

const availability: BarberAvailability[] = [
  {
    barberId: '1',
    barberName: 'Jorge',
    nextAvailable: '3:10 PM',
  },
  {
    barberId: '2',
    barberName: 'Luis',
    nextAvailable: '3:25 PM',
  },
  {
    barberId: '3',
    barberName: 'Carlos',
    nextAvailable: '4:00 PM',
  },
];

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function getAvailability() {
  return availability;
}

export function getNextAvailable(barberId: string) {
  return availability.find((item) => item.barberId === barberId)?.nextAvailable ?? '';
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

