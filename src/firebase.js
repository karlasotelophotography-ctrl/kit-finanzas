import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            "AIzaSyAlb1b5fcF_BoP9IDhEm-1C6AidcpZRp4s",
  authDomain:        "kit-finanzas-karla.firebaseapp.com",
  projectId:         "kit-finanzas-karla",
  storageBucket:     "kit-finanzas-karla.firebasestorage.app",
  messagingSenderId: "171814775539",
  appId:             "1:171814775539:web:0b78ddea1ac59cef1e2586"
}

const app  = initializeApp(firebaseConfig)
const auth = getAuth(app)

setPersistence(auth, browserLocalPersistence).catch(() => {})

export { auth }
export const db       = getFirestore(app)
export const provider = new GoogleAuthProvider()
