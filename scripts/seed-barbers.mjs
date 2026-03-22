import { initializeApp } from 'firebase/app';
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDtPATZOjLN1-qDE0OI2OmsDzm7urEBh3Q',
  authDomain: 'jbookme-b6fba.firebaseapp.com',
  projectId: 'jbookme-b6fba',
  storageBucket: 'jbookme-b6fba.appspot.com',
  messagingSenderId: '551239079223',
  appId: '1:551239079223:web:e3a303cec9a4aecb8cb6b2',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const barbers = [
  {
    id: 'adolfo_torres',
    name: 'Adolfo Torres',
    role: 'barber',
    experience: 8,
    specialties: ['Fade', 'Beard'],
    shop: "JB's Barbershop",
    rating: 5,
  },
  {
    id: 'gean_carlos',
    name: 'Gean Carlos',
    role: 'barber',
    experience: 6,
    specialties: ['Fade', 'Taper'],
    shop: "JB's Barbershop",
    rating: 5,
  },
  {
    id: 'martin_sanches',
    name: 'Martin Sanches',
    role: 'barber',
    experience: 10,
    specialties: ['Fade', 'Beard', 'Eyebrows'],
    shop: "JB's Barbershop",
    rating: 5,
  },
  {
    id: 'sandra_paez',
    name: 'Sandra Paez',
    role: 'stylist',
    experience: 12,
    specialties: ['Color', 'Hair treatment'],
    shop: "JB's Barbershop",
    rating: 5,
  },
  {
    id: 'celeste_paulino',
    name: 'Celeste Paulino',
    role: 'stylist',
    experience: 9,
    specialties: ['Hair color', 'Styling'],
    shop: "JB's Barbershop",
    rating: 5,
  },
];

const seed = async () => {
  try {
    for (const barber of barbers) {
      await setDoc(doc(db, 'barbers', barber.id), {
        name: barber.name,
        role: barber.role,
        experience: barber.experience,
        specialties: barber.specialties,
        shop: barber.shop,
        rating: barber.rating,
        createdAt: serverTimestamp(),
      });
      console.log(`Created barbers/${barber.id}`);
    }
  } catch (error) {
    console.error('Seed error:', error);
    process.exitCode = 1;
  }
};

await seed();
