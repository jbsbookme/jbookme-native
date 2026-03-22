type UploadOptions = {
  uri: string;
  resourceType: 'video' | 'image';
  fileName: string;
  mimeType: string;
  uploadPreset: string;
};

async function uploadToCloudinary({
  uri,
  resourceType,
  fileName,
  mimeType,
  uploadPreset,
}: UploadOptions): Promise<string> {
  const formData = new FormData();

  formData.append('file', {
    uri,
    type: mimeType,
    name: fileName,
  } as any);

  formData.append('upload_preset', uploadPreset);

  const endpoint = `https://api.cloudinary.com/v1_1/dmqfytqh8/${resourceType}/upload`;
  console.log('[Cloudinary] Upload start', {
    resourceType,
    endpoint,
    uri,
    type: mimeType,
    name: fileName,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
    // ❌ NO pongas headers aquí
    // Cloudinary necesita que fetch los calcule solo
  });

  let result: any = null;
  try {
    result = await response.json();
  } catch (error) {
    console.error('[Cloudinary] Invalid JSON response', error);
  }

  console.log('[Cloudinary] Upload response', {
    status: response.status,
    ok: response.ok,
    result,
  });

  if (!response.ok) {
    console.error('Cloudinary error:', result);
    throw new Error(result?.error?.message || 'Cloudinary upload failed');
  }

  if (!result.secure_url) {
    throw new Error('No secure_url returned from Cloudinary');
  }

  return result.secure_url as string;
}

export async function uploadVideoToCloudinary(
  uri: string
): Promise<string> {
  return uploadToCloudinary({
    uri,
    resourceType: 'video',
    fileName: `video_${Date.now()}.mp4`,
    mimeType: 'video/mp4',
    uploadPreset: 'jbookme_videos',
  });
}

export async function uploadImageToCloudinary(
  uri: string
): Promise<string> {
  return uploadToCloudinary({
    uri,
    resourceType: 'image',
    fileName: `image_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    uploadPreset: 'jbookme_videos',
  });
}

import { auth } from '../src/config/firebase';

const CLOUDINARY_DELETE_ENDPOINT = process.env.EXPO_PUBLIC_CLOUDINARY_DELETE_URL;

export async function deleteCloudinaryAsset(mediaUrl: string, ownerId?: string) {
  if (!CLOUDINARY_DELETE_ENDPOINT) {
    console.warn('[Cloudinary] Delete endpoint not configured');
    return;
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('User not authenticated');
  }

  const response = await fetch(CLOUDINARY_DELETE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: mediaUrl, ownerId }),
  });

  if (!response.ok) {
    throw new Error('Cloudinary delete failed');
  }
}