import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../src/config/firebase';
import { addNotification } from './notificationStore';
import { getFavoriteBarber } from './favoriteBarberStore';

type FeedComment = {
  id: string;
  user: string;
  text: string;
  createdAt: string;
};

type BarberReview = {
  id: string;
  user: string;
  rating: number;
  comment: string;
  createdAt: string;
};

type BarberProfile = {
  id: string;
  name: string;
  reviews: BarberReview[];
};

// Update FeedVideo type to handle Firestore Timestamp
type FeedVideo = {
  id: string;
  title?: string;
  caption?: string;
  barberId?: string;
  barber?: string;
  barberName?: string;
  rating?: number;
  serviceType?: string;
  likes: number;
  views: number;
  comments: FeedComment[];
  commentsCount: number;
  liked: boolean;
  createdAt: string | Date; // Can be string or Date after processing
  shop?: string;
  address?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  videoUrl?: string;
};

// This array will be populated from Firestore
export let feedVideos: FeedVideo[] = [];

// NOTE: This is a placeholder. For full persistence, the barbers data should also be fetched from Firestore.
export const barbers: BarberProfile[] = [
  {
    id: 'jorge-benites',
    name: 'Jorge Benites',
    reviews: [],
  },
];

export const followedBarbers: string[] = [];
const followedByViewer = new Map<string, Set<string>>();
const DEFAULT_VIEWER_ID = 'defaultViewer';

const listeners = new Set<() => void>();
let version = 0;
let lastSortedViewerId: string | null = null;
let lastSortedVersion = -1;
let lastSortedFeed: Array<FeedVideo & { score: number }> = [];

let isListenerInitialized = false;

// Function to initialize the Firestore listener
function initFeedListener() {
  if (isListenerInitialized) {
    return;
  }
  isListenerInitialized = true;

  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

  onSnapshot(
    q,
    (snapshot) => {
      const newVideos = snapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt as Timestamp | null;

        // Convert Firestore Timestamp to ISO string for consistency
        const createdAtString = createdAt ? createdAt.toDate().toISOString() : new Date().toISOString();

        const mediaUrl = (data.mediaUrl ?? data.videoUrl ?? '') as string;
        const mediaType = (data.mediaType ?? (data.videoUrl ? 'video' : 'image')) as
          | 'image'
          | 'video';

        return {
          id: doc.id,
          ...data,
          createdAt: createdAtString,
          mediaUrl,
          mediaType,
          videoUrl: data.videoUrl ?? (mediaType === 'video' ? mediaUrl : undefined),
          // Set default values for fields that might be missing
          likes: data.likes ?? 0,
          views: data.views ?? 0,
          comments: data.comments ?? [],
          commentsCount: data.commentsCount ?? 0,
          liked: data.liked ?? false,
        } as FeedVideo;
      });

      feedVideos = newVideos;
      emitChange();
    },
    (error) => {
      console.error('Error fetching posts from Firestore:', error);
    }
  );
}

function emitChange() {
  version += 1;
  listeners.forEach((listener) => listener());
}

function toBarberId(value?: string) {
  if (!value) return 'barber';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getFollowedSet(viewerId?: string) {
  const resolvedViewerId = viewerId || DEFAULT_VIEWER_ID;
  let set = followedByViewer.get(resolvedViewerId);
  if (!set) {
    set = new Set(resolvedViewerId === DEFAULT_VIEWER_ID ? followedBarbers : []);
    followedByViewer.set(resolvedViewerId, set);
  }
  return { set, resolvedViewerId };
}

function isRecent(createdAt: string | Date) {
  const createdAtMs = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs <= 48 * 60 * 60 * 1000;
}


function getEngagementScore(video: FeedVideo) {
  return video.likes * 4 + video.commentsCount * 5 + video.views * 1;
}

function getVideoScore(video: FeedVideo, viewerId: string) {
  let score = getEngagementScore(video);
  const barberId = video.barberId ?? toBarberId(video.barber);
  const favoriteBarberId = getFavoriteBarber(viewerId);
  if (favoriteBarberId && favoriteBarberId === barberId) {
    score += 800;
  }
  if (isFollowing(viewerId, barberId)) {
    score += 500;
  }
  if (isRecent(video.createdAt)) {
    score += 150;
  }
  return score;
}

// Rewritten addVideo to persist to Firestore
export async function addVideo(video: Partial<FeedVideo>) {
  try {
    const mediaUrl = video.mediaUrl || video.videoUrl || '';
    const mediaType = video.mediaType || (video.videoUrl ? 'video' : 'image');
    const docData: Record<string, unknown> = {
      mediaUrl,
      mediaType,
      caption: video.caption || '',
      title: video.title || video.caption || 'New Upload',
      barberId: video.barberId,
      barberName: video.barberName,
      barber: video.barber || video.barberName,
      serviceType: video.serviceType || 'Haircut',
      shop: video.shop,
      address: video.address,
      likes: 0,
      views: 0,
      commentsCount: 0,
      liked: false,
      // Use serverTimestamp for accurate, server-side time
      createdAt: serverTimestamp(),
    };
    if (mediaType === 'video') {
      docData.videoUrl = mediaUrl;
    }
    await addDoc(collection(db, 'posts'), docData);
    // We don't need to call emitChange() here,
    // onSnapshot will detect the change and trigger it.
  } catch (error) {
    console.error('Error adding video to Firestore:', error);
  }
}

// NOTE: The functions below (toggleLike, addComment, etc.) are still operating on the
// in-memory store. For full persistence, these would also need to be refactored
// to update the corresponding document in Firestore.

export function toggleLike(id: string) {
  const video = feedVideos.find((item) => item.id === id);
  if (!video) return;

  if (video.liked) {
    video.likes = Math.max(0, video.likes - 1);
    video.liked = false;
  } else {
    video.likes += 1;
    video.liked = true;
    const barberId = video.barberId ?? toBarberId(video.barber);
    addNotification(barberId, 'like', 'Someone liked your video');
  }

  emitChange();
}

export function incrementViews(id: string) {
  const video = feedVideos.find((item) => item.id === id);
  if (!video) return;

  video.views += 1;
  emitChange();
}

export function addReview(barberId: string, rating: number, comment: string) {
  const barber = barbers.find((item) => item.id === barberId);
  if (!barber) return;

  const trimmed = comment.trim();
  if (!trimmed) return;

  const review: BarberReview = {
    id: Date.now().toString(),
    user: 'Client',
    rating,
    comment: trimmed,
    createdAt: new Date().toISOString(),
  };

  barber.reviews.unshift(review);
  emitChange();
}

export function toggleFollow(viewerId: string, barberId: string) {
  const normalizedBarberId = toBarberId(barberId);
  const { set, resolvedViewerId } = getFollowedSet(viewerId);
  if (set.has(normalizedBarberId)) {
    set.delete(normalizedBarberId);
  } else {
    set.add(normalizedBarberId);
    addNotification(normalizedBarberId, 'follow', 'New follower');
  }
  if (resolvedViewerId === DEFAULT_VIEWER_ID) {
    followedBarbers.length = 0;
    followedBarbers.push(...set);
  }

  emitChange();
}

export function isFollowing(viewerId: string, barberId: string) {
  const normalizedBarberId = toBarberId(barberId);
  const { set } = getFollowedSet(viewerId);
  return set.has(normalizedBarberId);
}

export function addComment(videoId: string, text: string) {
  const video = feedVideos.find((item) => item.id === videoId);
  if (!video) return;

  const trimmed = text.trim();
  if (!trimmed) return;

  const comment: FeedComment = {
    id: Date.now().toString(),
    user: 'Client',
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  video.comments.push(comment);
  video.commentsCount += 1;
  const barberId = video.barberId ?? toBarberId(video.barber);
  addNotification(barberId, 'comment', 'New comment on your video');
  emitChange();
}

export function getBarberMetrics(barberName: string) {
  const barberId = toBarberId(barberName);
  const totals = {
    likes: 0,
    views: 0,
    comments: 0,
    videos: 0,
  };

  feedVideos.forEach((video) => {
    const videoBarberId = video.barberId ?? toBarberId(video.barber);
    if (videoBarberId !== barberId) return;
    totals.likes += video.likes;
    totals.views += video.views;
    totals.comments += video.commentsCount;
    totals.videos += 1;
  });

  return totals;
}

export function getTopBarbers() {
  const scoreByBarber = new Map<
    string,
    { id: string; name: string; likes: number; comments: number; views: number }
  >();

  feedVideos.forEach((video) => {
    const name = video.barber ?? 'Barber';
    const id = video.barberId ?? toBarberId(name);
    const current = scoreByBarber.get(id) ?? {
      id,
      name,
      likes: 0,
      comments: 0,
      views: 0,
    };

    current.likes += video.likes;
    current.comments += video.commentsCount;
    current.views += video.views;
    scoreByBarber.set(id, current);
  });

  return Array.from(scoreByBarber.values())
    .map((barber) => ({
      ...barber,
      score: barber.likes * 2 + barber.comments * 3 + barber.views * 0.1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function getBarberOfTheWeek() {
  if (feedVideos.length === 0) return null;

  const scoreByBarber = new Map<
    string,
    { name: string; likes: number; comments: number; views: number; score: number }
  >();

  feedVideos.forEach((video) => {
    const name = video.barber ?? 'Barber';
    const key = video.barberId ?? toBarberId(name);
    const current = scoreByBarber.get(key) ?? {
      name,
      likes: 0,
      comments: 0,
      views: 0,
      score: 0,
    };

    current.likes += video.likes;
    current.comments += video.commentsCount;
    current.views += video.views;
    current.score = current.likes * 3 + current.comments * 4 + current.views * 1;
    scoreByBarber.set(key, current);
  });

  let winner: { name: string; likes: number; comments: number; views: number; score: number } | null = null;
  scoreByBarber.forEach((value) => {
    if (!winner || value.score > winner.score) {
      winner = value;
    }
  });

  return winner;
}

export function getFeedVideos() {
  return feedVideos;
}

export function getSortedFeed(viewerId: string) {
  const resolvedViewerId = viewerId || DEFAULT_VIEWER_ID;
  if (lastSortedVersion === version && lastSortedViewerId === resolvedViewerId) {
    return lastSortedFeed;
  }

  const scored = feedVideos.map((video) => ({
    ...video,
    score: getVideoScore(video, resolvedViewerId),
  }));

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aTime = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : a.createdAt.getTime();
    const bTime = typeof b.createdAt === 'string' ? Date.parse(b.createdAt) : b.createdAt.getTime();
    return bTime - aTime;
  });

  lastSortedFeed = scored;
  lastSortedVersion = version;
  lastSortedViewerId = resolvedViewerId;
  return scored;
}

export function getFollowingVideos(viewerId: string) {
  const resolvedViewerId = viewerId || DEFAULT_VIEWER_ID;
  return feedVideos.filter((video) => {
    const barberId = video.barberId ?? toBarberId(video.barber);
    return isFollowing(resolvedViewerId, barberId);
  });
}

export function subscribeFeed(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Initialize the listener when the store is imported.
initFeedListener();
