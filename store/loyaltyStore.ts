export type LoyaltyProfile = {
  userId: string;
  haircutsCount: number;
  rewardCredit: number;
};

export type LastHaircut = {
	barberId: string;
	date: number;
};

const users: LoyaltyProfile[] = [
  {
    userId: '123',
    haircutsCount: 5,
    rewardCredit: 10,
  },
];

const lastHaircuts = new Map<string, LastHaircut>();
const lastRebookReminders = new Map<string, number>();

const listeners = new Set<() => void>();
const completedAppointments = new Set<string>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function incrementHaircuts(userId: string) {
  const user = users.find((item) => item.userId === userId);
  if (!user) return;

  user.haircutsCount += 1;
  if (user.haircutsCount % 5 === 0) {
    user.rewardCredit += 10;
  }

  emitChange();
}

export function registerCompletedAppointment(userId: string, appointmentId: string, barberId?: string) {
  if (!appointmentId || completedAppointments.has(appointmentId)) return false;
  completedAppointments.add(appointmentId);
  incrementHaircuts(userId);
  setLastHaircut(userId, barberId ?? 'barber', Date.now());
  return true;
}

export function setLastHaircut(userId: string, barberId: string, date: number) {
  lastHaircuts.set(userId, { barberId, date });
  lastRebookReminders.delete(userId);
  emitChange();
}

export function getLastHaircut(userId: string) {
  return lastHaircuts.get(userId) ?? null;
}

export function getLastRebookReminder(userId: string) {
  return lastRebookReminders.get(userId) ?? null;
}

export function setLastRebookReminder(userId: string, date: number) {
  lastRebookReminders.set(userId, date);
}

export function getHaircuts(userId: string) {
  return users.find((item) => item.userId === userId)?.haircutsCount ?? 0;
}

export function getRewardCredit(userId: string) {
  return users.find((item) => item.userId === userId)?.rewardCredit ?? 0;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
