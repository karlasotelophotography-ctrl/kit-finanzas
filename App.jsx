import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, provider } from './firebase.js'
import KitFinanzas from './KitFinanzas.jsx'

const C = {
  bg: '#F5F0E8', card: '#EDE8DF', border: '#D4CCBE',
  text: '#2C2416', muted: '#8A7D6B', accent: '#B5651D',
}

export default function App() {
  const [user,    setUser]    = useState(undefined) // undefined = cargando
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return unsub
  }, [])

  const login = async () => {
    setLoading(true); setError('')
    try { await signInWithPopup(auth, provider) }
    catch (e) { setError('No se pudo iniciar sesión. Intenta de nuevo.') }
    finally   { setLoading(false) }
  }

  // Cargando estado de auth
  if (user === undefined) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'monospace', color: C.muted, fontSize: '12px',
        letterSpacing: '3px' }}>CARGANDO…</div>
    </div>
  )

  // Sin sesión → pantalla de login
  if (!user) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '16px', padding: '40px 32px', maxWidth: '360px',
        width: '100%', textAlign: 'center' }}>

        <div style={{ fontSize: '10px', letterSpacing: '4px', color: C.accent,
          fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '8px' }}>
          KARLA SOTELO PHOTOGRAPHY
        </div>
        <div style={{ fontSize: '26px', fontWeight: 'bold', color: C.text,
          marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Kit de Finanzas
        </div>
        <div style={{ fontSize: '13px', color: C.muted, marginBottom: '32px',
          fontStyle: 'italic' }}>
          Tus números, en orden.
        </div>

        <button onClick={login} disabled={loading} style={{
          width: '100%', background: C.accent, color: '#FFF',
          border: 'none', borderRadius: '10px', padding: '14px',
          fontSize: '14px', fontWeight: 'bold', cursor: loading ? 'wait' : 'pointer',
          fontFamily: 'monospace', letterSpacing: '1px',
          opacity: loading ? 0.7 : 1, transition: 'opacity .15s',
        }}>
          {loading ? 'Entrando…' : '🔐 Entrar con Google'}
        </button>

        {error && (
          <div style={{ marginTop: '14px', fontSize: '12px', color: '#A0412A',
            fontFamily: 'monospace' }}>{error}</div>
        )}

        <div style={{ marginTop: '24px', fontSize: '10px', color: C.border,
          fontFamily: 'monospace', lineHeight: '1.6' }}>
          Tus datos se guardan en la nube de forma privada.<br />
          Solo tú puedes verlos.
        </div>
      </div>
    </div>
  )

  // Con sesión → app completa
  return <KitFinanzas user={user} onLogout={() => signOut(auth)} />
}
