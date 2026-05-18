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

  useEffect(() => {
    // Maneja el resultado del redirect de Google en iOS
    getRedirectResult(auth).catch(() => {})
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return unsub
  }, [])

  const reset = () => { setError(''); setMsg('') }

  const loginGoogle = async () => {
    setLoading(true); reset()
    try {
      // En iOS Safari usamos redirect para evitar el error de popup
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
      if (isIOS) {
        await signInWithRedirect(auth, provider)
      } else {
        await signInWithPopup(auth, provider)
      }
    }
    catch { setError('No se pudo iniciar sesión con Google.') }
    finally { setLoading(false) }
  }

  const loginEmail = async () => {
    setLoading(true); reset()
    try { await signInWithEmailAndPassword(auth, email, pass) }
    catch (e) {
      if (['auth/user-not-found','auth/wrong-password','auth/invalid-credential'].includes(e.code))
        setError('Correo o contraseña incorrectos.')
      else setError('No se pudo iniciar sesión. Intenta de nuevo.')
    }
    finally { setLoading(false) }
  }

  const register = async () => {
    if (pass.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    setLoading(true); reset()
    try { await createUserWithEmailAndPassword(auth, email, pass) }
    catch (e) {
      if (e.code === 'auth/email-already-in-use') setError('Ese correo ya tiene una cuenta.')
      else setError('No se pudo crear la cuenta. Intenta de nuevo.')
    }
    finally { setLoading(false) }
  }

  const resetPass = async () => {
    setLoading(true); reset()
    try {
      await sendPasswordResetEmail(auth, email)
      setMsg('Te enviamos un correo para restablecer tu contraseña.')
    }
    catch { setError('No se encontró ese correo.') }
    finally { setLoading(false) }
  }

  if (user === undefined) return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8', display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'monospace', color: '#8A7D6B', fontSize: '12px', letterSpacing: '3px' }}>
        CARGANDO…
      </div>
    </div>
  )

  if (!user) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: C.card, border: `1px solid ${C.border}`,
        borderRadius: '16px', padding: '36px 28px', maxWidth: '360px',
        width: '100%', textAlign: 'center' }}>

        <div style={{ fontSize: '10px', letterSpacing: '4px', color: C.accent,
          fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '6px' }}>
          KARLA SOTELO PHOTOGRAPHY
        </div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: C.text,
          marginBottom: '4px', letterSpacing: '-0.5px' }}>Kit de Finanzas</div>
        <div style={{ fontSize: '13px', color: C.muted, marginBottom: '28px', fontStyle: 'italic' }}>
          Tus números, en orden.
        </div>

        <button onClick={loginGoogle} disabled={loading} style={{
          width: '100%', background: C.accent, color: '#FFF', border: 'none',
          borderRadius: '8px', padding: '13px', fontSize: '13px', fontWeight: 'bold',
          cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '1px',
          opacity: loading ? 0.7 : 1, marginBottom: '16px',
        }}>
          🔐 Entrar con Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ flex: 1, height: '1px', background: C.border }} />
          <span style={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace' }}>O</span>
          <div style={{ flex: 1, height: '1px', background: C.border }} />
        </div>

        {mode !== 'reset' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[['login','Entrar'],['register','Registrarme']].map(([m, label]) => (
              <button key={m} onClick={() => { setMode(m); reset() }} style={{
                flex: 1, background: mode === m ? C.accent : 'transparent',
                color: mode === m ? '#FFF' : C.muted,
                border: `1px solid ${mode === m ? C.accent : C.border}`,
                borderRadius: '6px', padding: '7px', fontSize: '12px',
                cursor: 'pointer', fontFamily: 'monospace',
              }}>{label}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gap: '10px', marginBottom: '14px', textAlign: 'left' }}>
          <div>
            <label style={{ fontSize: '10px', color: C.muted, fontFamily: 'monospace',
              letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>CORREO</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com" style={inp} />
          </div>
          {mode !== 'reset' && (
            <div>
              <label style={{ fontSize: '10px', color: C.muted, fontFamily: 'monospace',
                letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>CONTRASEÑA</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? loginEmail() : register())}
                style={inp} />
            </div>
          )}
        </div>

        <button
          onClick={mode === 'login' ? loginEmail : mode === 'register' ? register : resetPass}
          disabled={loading} style={{
            width: '100%', background: C.accent, color: '#FFF', border: 'none',
            borderRadius: '8px', padding: '13px', fontSize: '13px', fontWeight: 'bold',
            cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '1px',
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? 'Un momento…' :
            mode === 'login' ? 'Entrar' :
            mode === 'register' ? 'Crear cuenta' : 'Enviar correo'}
        </button>

        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'center', gap: '16px' }}>
          {mode === 'login' && (
            <span onClick={() => { setMode('reset'); reset() }}
              style={{ fontSize: '11px', color: C.accent, cursor: 'pointer', fontFamily: 'monospace' }}>
              Olvidé mi contraseña
            </span>
          )}
          {mode !== 'login' && (
            <span onClick={() => { setMode('login'); reset() }}
              style={{ fontSize: '11px', color: C.accent, cursor: 'pointer', fontFamily: 'monospace' }}>
              ← Volver
            </span>
          )}
        </div>

        {error && <div style={{ marginTop: '12px', fontSize: '12px', color: C.red, fontFamily: 'monospace' }}>{error}</div>}
        {msg   && <div style={{ marginTop: '12px', fontSize: '12px', color: C.muted, fontFamily: 'monospace' }}>{msg}</div>}

        <div style={{ marginTop: '20px', fontSize: '10px', color: C.border, fontFamily: 'monospace', lineHeight: '1.6' }}>
          Tus datos se guardan en la nube de forma privada.<br />Solo tú puedes verlos.
        </div>
      </div>
    </div>
  )

  return <KitFinanzas user={user} onLogout={() => signOut(auth)} />
}
