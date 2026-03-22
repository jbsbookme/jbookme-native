import { apiFetch } from './apiClient';

export async function uploadService(
  formData: FormData,
  token: string,
  onUnauthorized?: () => Promise<void>,
) {
  const res = await apiFetch(
    `${process.env.EXPO_PUBLIC_API_URL}/upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
    onUnauthorized,
  );

  return res.json();
}
