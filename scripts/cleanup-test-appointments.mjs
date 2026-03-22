import { initializeApp } from 'firebase/app';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAqzY_31ND8pUeBB7QmN0VR54J9gJHzSSY',
  authDomain: 'bookme-65bd5.firebaseapp.com',
  projectId: 'bookme-65bd5',
  storageBucket: 'bookme-65bd5.appspot.com',
  messagingSenderId: '645266773025',
  appId: '1:645266773025:web:28c1a25181ef9444d77f60',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const userId = 'XCIHV3a5iDPYlHGoNzh49uf0NE72';
const barberIds = ['cmjzxa0bo0000jx04ruc69ya8', 'cmka47pus0002h032idrk5tt3'];

const appointmentsRef = collection(db, 'appointments');

async function fetchTargets() {
  // Firestore does not support OR in a single query for these fields, so we merge results.
  const byUserQuery = query(appointmentsRef, where('userId', '==', userId));
  const byBarberQuery = query(appointmentsRef, where('barberId', 'in', barberIds));

  const [byUserSnap, byBarberSnap] = await Promise.all([
    getDocs(byUserQuery),
    getDocs(byBarberQuery),
  ]);

  const docsById = new Map();

  for (const snap of [byUserSnap, byBarberSnap]) {
    for (const docSnap of snap.docs) {
      docsById.set(docSnap.id, docSnap);
    }
  }

  return Array.from(docsById.values());
}

async function run() {
  try {
    const targets = await fetchTargets();

    if (targets.length === 0) {
      console.log('No matching appointments found.');
      return;
    }

    console.log('Matching appointments (will delete):');
    for (const docSnap of targets) {
      console.log(`- ${docSnap.id}`, docSnap.data());
    }

    for (const docSnap of targets) {
      await deleteDoc(doc(appointmentsRef, docSnap.id));
      console.log(`Deleted appointments/${docSnap.id}`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
    process.exitCode = 1;
  }
}

await run();
