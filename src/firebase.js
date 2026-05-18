import { useEffect, useState } from 'react'
import {
  onAuthStateChanged, signInWithPopup, signInWithRedirect,
  getRedirectResult, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth'
import { auth, provider } from './firebase.js'
import KitFinanzas from './KitFinanzas.jsx'

const C = {
  bg: '#F5F0E8', card: '#EDE8DF', border: '#D4CCBE',
  text: '#2C2416', muted: '#8A7D6B', accent: '#B5651D', red: '#A0412A',
}

const inp = {
  background: '#F5F0E8', border: '1px solid #D4CCBE', borderRadius: '8px',
  padding: '11px 14px', color: '#2C2416', fontSize: '14px', width: '100%',
  fontFamily: 'Georgia,serif', outline: 'none', boxSizing: 'border-box',
}

export default function App() {
  const [user,    setUser]    = useState(undefined)
  const [mode,    setMode]    = useState('login')
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [msg,     setMsg]     = useState('')
