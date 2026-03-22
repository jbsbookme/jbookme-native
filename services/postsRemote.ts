import { collection, getDocs, orderBy, query, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../src/config/firebase";

export type FirestorePost = {
  id: string;
  uri: string;
  createdAt: any;
  userId?: string;
  type?: "video" | "image";
  clientCreatedAt?: number;
};

export async function fetchPosts(): Promise<FirestorePost[]> {
  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<FirestorePost, "id">),
  }));
}

export async function addRemotePost(post: {
  uri: string;
  type: "video" | "image";
  createdAt: number;
  userId?: string;
}): Promise<void> {

  await addDoc(collection(db, "posts"), {
    uri: post.uri,
    type: post.type,
    userId: post.userId ?? null,
    createdAt: serverTimestamp(),
    clientCreatedAt: post.createdAt,
  });

}