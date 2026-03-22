export type LastMinuteOpening = {
  barberId: string;
  barberName: string;
  availableInMinutes: number;
};

const openings: LastMinuteOpening[] = [
  {
    barberId: '1',
    barberName: 'Jorge',
    availableInMinutes: 20,
  },
  {
    barberId: '2',
    barberName: 'Luis',
    availableInMinutes: 35,
  },
  {
    barberId: '3',
    barberName: 'Carlos',
    availableInMinutes: 50,
  },
];

const listeners = new Set<() => void>();

export function getOpenings() {
  return openings;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
