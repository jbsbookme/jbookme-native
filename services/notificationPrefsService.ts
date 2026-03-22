export type NotificationPrefs = {
  likes: boolean;
  comments: boolean;
  system: boolean;
  quietFrom?: string; // "22:00"
  quietTo?: string;   // "08:00"
};

export async function getNotificationPrefs(token: string) {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/notifications/prefs`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error('GET_PREFS_FAILED');
  return res.json();
}

export async function saveNotificationPrefs(
  prefs: NotificationPrefs,
  token: string
) {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/notifications/prefs`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(prefs),
    }
  );
  if (!res.ok) throw new Error('SAVE_PREFS_FAILED');
  return res.json();
}
