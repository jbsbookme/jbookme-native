import { getApp, getApps, initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyAqzY_31ND8pUeBB7QmN0VR54J9gJHzSSY",
  authDomain: "bookme-65bd5.firebaseapp.com",
  projectId: "bookme-65bd5",
  storageBucket: "bookme-65bd5.appspot.com",
  messagingSenderId: "645266773025",
  appId: "1:645266773025:web:28c1a25181ef9444d77f60",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = (() => {
  try {
    return getAuth(app);
  } catch (error) {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  }
})();

export default app;