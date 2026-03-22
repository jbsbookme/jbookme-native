const CLOUD_NAME = 'dmqfytqh8';
const UPLOAD_PRESET = 'jbookme_videos';
const VIDEO_UPLOAD_FOLDER = 'jbookme/videos';
const IMAGE_UPLOAD_FOLDER = 'jbookme/images';

type MediaType = 'image' | 'video';

export async function uploadMediaToCloudinary(
  fileUri: string,
  mediaType: MediaType,
  mimeType?: string | null,
  onProgress?: (progress: number) => void
) {
  const resourceType = mediaType === 'video' ? 'video' : 'image';
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;
  const data = new FormData();
  const fallbackMime = mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
  const fallbackName = mediaType === 'video' ? 'video.mp4' : 'image.jpg';
  const resolvedType = mimeType || fallbackMime;
  const resolvedName = fallbackName;

  data.append('file', {
    uri: fileUri,
    type: resolvedType,
    name: resolvedName,
  } as unknown as Blob);
  data.append('upload_preset', UPLOAD_PRESET);
  data.append('folder', mediaType === 'video' ? VIDEO_UPLOAD_FOLDER : IMAGE_UPLOAD_FOLDER);

  return new Promise<string>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', endpoint);

    console.log('[Cloudinary] Upload start', {
      mediaType,
      endpoint,
      uri: fileUri,
      type: resolvedType,
      name: resolvedName,
    });

    if (onProgress) {
      request.upload.onloadstart = () => {
        onProgress(1);
      };
    }

    if (request.upload && onProgress) {
      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(Math.min(100, Math.max(0, percentage)));
      };
    }

    request.onerror = () => {
      console.log('[Cloudinary] Upload error', {
        status: request.status,
        responseText: request.responseText,
      });
      reject(new Error('Network error while uploading media.'));
    };

    request.ontimeout = () => {
      console.log('[Cloudinary] Upload timeout');
      reject(new Error('Upload timeout while uploading media.'));
    };

    request.onload = () => {
      console.log('[Cloudinary] Upload response', {
        status: request.status,
        responseText: request.responseText?.slice(0, 500),
      });
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(request.responseText || `Failed to upload ${mediaType}`));
        return;
      }

      try {
        const json = JSON.parse(request.responseText);
        if (!json?.secure_url) {
          reject(new Error('No secure_url returned from Cloudinary.'));
          return;
        }
        if (onProgress) {
          onProgress(100);
        }
        resolve(json.secure_url as string);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Invalid upload response.'));
      }
    };

    request.send(data);
  });
}

export async function uploadVideoToCloudinary(fileUri: string) {
  return uploadMediaToCloudinary(fileUri, 'video');
}
