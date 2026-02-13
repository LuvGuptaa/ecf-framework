// Firebase configuration and initialization
import { initializeApp } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firestore
export const db = getFirestore(app)

// Initialize Storage for video recordings
export const storage = getStorage(app)

// Connect to emulator in development when explicitly enabled
const shouldUseEmulator =
  typeof window !== "undefined" && process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "true"

if (shouldUseEmulator) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080)
  } catch (error) {
    console.log("Firestore emulator already connected")
  }
}

export default app
