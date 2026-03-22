export type ReferralUser = {
  userId: string;
  referralCode: string;
  creditBalance: number;
};

const users: ReferralUser[] = [
  {
    userId: '123',
    referralCode: 'JORGE482',
    creditBalance: 5,
  },
  {
    userId: '456',
    referralCode: 'CARLOS391',
    creditBalance: 0,
  },
];

const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function generateReferralCode(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = cleaned.slice(0, 5) || 'JB';
  const existing = new Set(users.map((user) => user.referralCode));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const number = Math.floor(Math.random() * 900) + 100;
    const code = `${prefix}${number}`;
    if (!existing.has(code)) {
      return code;
    }
  }

  const fallbackNumber = Math.floor(Math.random() * 900) + 100;
  return `${prefix}${fallbackNumber}`;
}

export function getReferralUser(userId: string) {
  return users.find((user) => user.userId === userId) ?? null;
}

export function ensureReferralUser(userId: string, name: string) {
  const existingUser = users.find((user) => user.userId === userId);
  if (existingUser?.referralCode) return existingUser;

  const referralCode = generateReferralCode(name);
  if (existingUser) {
    existingUser.referralCode = referralCode;
    emitChange();
    return existingUser;
  }

  const newUser: ReferralUser = {
    userId,
    referralCode,
    creditBalance: 0,
  };
  users.push(newUser);
  emitChange();
  return newUser;
}

export function applyReferralCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;

  const referrer = users.find((user) => user.referralCode === normalized);
  if (!referrer) return false;

  const currentUser = users.find((user) => user.userId === '123');
  if (!currentUser) return false;

  if (currentUser.userId === referrer.userId) return false;

  currentUser.creditBalance += 5;
  referrer.creditBalance += 5;
  emitChange();
  return true;
}

export function addCredit(userId: string, amount: number) {
  const user = users.find((item) => item.userId === userId);
  if (!user || amount <= 0) return;

  user.creditBalance += amount;
  emitChange();
}

export function getCredit(userId: string) {
  return users.find((item) => item.userId === userId)?.creditBalance ?? 0;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
