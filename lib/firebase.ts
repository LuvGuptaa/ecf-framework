// Firebase configuration and initialization
import { initializeApp } from "firebase/app"
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyAsg-k1KvJV2YQ9qrI0FmMqteSVAt74Ows",
  authDomain: "pulse-b7e7d.firebaseapp.com",
  projectId: "pulse-b7e7d",
  storageBucket: "pulse-b7e7d.firebasestorage.app",
  messagingSenderId: "225260778835",
  appId: "1:225260778835:web:3dbafd3dc5a2f4e0259da6",
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
