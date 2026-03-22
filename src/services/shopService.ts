import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

type ShopInfo = {
  name?: string;
  address?: string;
  description?: string;
  image?: string;
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
};

export const getShopInfo = async (): Promise<ShopInfo | null> => {
  const ref = doc(db, 'shop', 'main');
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data() as ShopInfo;
};
