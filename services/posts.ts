import AsyncStorage from '@react-native-async-storage/async-storage';
import { addRemotePost, fetchPosts } from './postsRemote';

export type Post = {
  id: string;
  uri: string;
  createdAt: number;
  type: 'video' | 'image';
};

const POSTS_KEY = 'jbookme_posts_v1';

export async function loadPosts(): Promise<Post[]> {
  try {
    const remote = await fetchPosts();
    if (remote.length > 0) {
      const mapped = remote.map((post) => ({
        id: post.id,
        uri: post.uri,
        type: 'video',
        createdAt: typeof post.createdAt === 'number'
          ? post.createdAt
          : Date.now(),
      }));
      await savePosts(mapped);
      return mapped;
    }
  } catch (error) {
    console.error(error);
  }

  const raw = await AsyncStorage.getItem(POSTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePosts(posts: Post[]): Promise<void> {
  await AsyncStorage.setItem(POSTS_KEY, JSON.stringify(posts));
}

export async function addPost(
  uri: string,
  type: 'video' | 'image'
): Promise<Post> {
  const posts = await loadPosts();
  const post: Post = {
    id: Date.now().toString(),
    uri,
    type,
    createdAt: Date.now(),
  };
  const next = [post, ...posts];
  await savePosts(next);
  try {
    await addRemotePost(post);
  } catch (error) {
    console.error(error);
  }
  return post;
}

export async function clearPosts(): Promise<void> {
  await AsyncStorage.removeItem(POSTS_KEY);
}
