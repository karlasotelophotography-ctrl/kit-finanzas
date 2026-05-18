import { useState, useEffect, useCallback } from 'react'
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore'
import { db } from './firebase.js'

// ─── DATOS ────────────────────────────────────────────────────
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]

const RESICO_TABLA = [
  { hasta: 25000,    tasa: 0.0100 },
  { hasta: 50000,    tasa: 0.0110 },
  { hasta: 83333,    tasa: 0.0135 },
  { hasta: 208333,   tasa: 0.0160 },
  { hasta: 458333,   tasa: 0.0200 },
  { hasta: Infinity, tasa: 0.0225 },
]

function calcularImpuestos(base) {
  const row = RESICO_TABLA.find(r => base <= r.hasta) || RESICO_TABLA.at(-1)
  return base * row.tasa + base * 0.16
}

const SOBRES = [
  { id: 'salario',  label: 'Salario',           pct: 0.50, color: '#B5651D', emoji: '💰' },
  { id: 'retiro',   label: 'Retiro',             pct: 0.10, color: '#6B8E6B', emoji: '🌱' },
  { id: 'flojos',   label: 'Meses Flojos',       pct: 0.10, color: '#7A9BB5', emoji: '🌊' },
  { id: 'negocio',  label: 'Gastos del Negocio', pct: 0.20, color: '#A0748A', emoji: '🗂️' },
]

const CATS_INGRESO  = ["Familia","Retratos","Gastronómico","Ejecutivo","Mentorías","Productos Digitales","Otro"]
const CATS_NEGOCIO  = ["Equipo","Software / Suscripciones","Marketing","Transporte","Educación","Servicios","Renta estudio","Otro"]
const CATS_PERSONAL = ["Despensa","Restaurantes","Salud","Educación hijos","Ropa","Entretenimiento","Casa","Transporte","Otro"]
const CATS_EXTRA    = ["Venta de artículos","Regalo / apoyo familiar","Trabajo extra","Otro"]
const FORMAS        = ["Transferencia","Tarjeta","Efectivo"]
const MSI_OPCIONES  = [3, 6, 9, 12, 18, 24]

function fmt(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0
  }).format(n || 0)
}
const ICON = { Transferencia: '🏦', Tarjeta: '💳', Efectivo: '💵' }
const mesActual = new Date().getMonth()

const C = {
  bg: '#F5F0E8', card: '#EDE8DF', deep: '#E4DDD2', border: '#D4CCBE',
  text: '#2C2416', muted: '#8A7D6B', accent: '#B5651D',
  red: '#A0412A', green: '#4A7A5A', blue: '#4A6A8A',
}

const inp = {
  background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px',
  padding: '11px 14px', color: C.text, fontSize: '14px', width: '100%',
  fontFamily: 'Georgia,serif', outline: 'none', boxSizing: 'border-box',
}

// ─── COMPONENTES UI ───────────────────────────────────────────
function Lbl({ children }) {
  return <div style={{ fontSize: '10px', letterSpacing: '3px', color: C.muted,
    fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: '13px' }}>{children}</div>
}
function Card({ children, style = {} }) {
  return <div style={{ background: C.card, border: `1px solid ${C.border}`,
    borderRadius: '12px', padding: '18px 22px', ...style }}>{children}</div>
}
function BalBar({ disp, gast }) {
  const pct = disp > 0 ? Math.min((gast/disp)*100,100) : (gast>0?100:0)
  const over = gast > disp
  const color = over ? C.red : pct > 80 ? '#D4844A' : C.green
  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ height: '5px', background: C.deep, borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '99px', transition: 'width .3s' }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
        <span style={{ fontSize: '10px', color: C.muted, fontFamily: 'monospace' }}>Gastado {fmt(gast)}</span>
        <span style={{ fontSize: '10px', color, fontFamily: 'monospace', fontWeight: 'bold' }}>
          {over ? `⚠ Excedido ${fmt(gast-disp)}` : `Disponible ${fmt(disp-gast)}`}
        </span>
      </div>
    </div>
  )
}
function PagoSelector({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {FORMAS.map(f => (
        <button key={f} onClick={() => onChange(f)} style={{
          flex: 1, background: value===f?C.accent:C.bg, color: value===f?'#FFF':C.muted,
          border: `1px solid ${value===f?C.accent:C.border}`,
          borderRadius: '8px', padding: '9px 6px', cursor: 'pointer',
          fontFamily: 'monospace', fontSize: '11px', textAlign: 'center', transition: 'all .15s',
        }}>
          <div style={{ fontSize: '16px', marginBottom: '2px' }}>{ICON[f]}</div>
          {f}
          {f==='Efectivo' && <div style={{ fontSize: '8px', opacity: .7, marginTop: '1px' }}>sin IVA</div>}
        </button>
      ))}
    </div>
  )
}
function ListaMovimientos({ items, onDelete, colorMonto=C.accent, signo='' }) {
  if (!items.length) return (
    <div style={{ color: C.muted, fontStyle: 'italic', fontSize: '13px', padding: '14px 0', textAlign: 'center' }}>
      Sin registros este mes.
    </div>
  )
  return items.map(r => (
    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <div>
        <div style={{ fontSize: '13px', color: C.text }}>{r.desc}</div>
        <div style={{ fontSize: '10px', color: C.muted, fontFamily: 'monospace', marginTop: '2px' }}>
          {r.categoria} · {ICON[r.formaPago]} {r.formaPago}
          {r.formaPago==='Efectivo' && <span style={{ marginLeft:'5px', background:C.deep, borderRadius:'3px', padding:'1px 5px' }}>sin impuestos</span>}
          {' · '}{r.fecha}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '15px', color: colorMonto, fontWeight: 'bold' }}>{signo}{fmt(r.monto)}</span>
        <button onClick={() => onDelete(r.id)} style={{ background:'none', border:'none', color:C.border, cursor:'pointer', fontSize:'18px', lineHeight:1 }}>×</button>
      </div>
    </div>
  ))
}
function FormRegistro({ label, categorias, onAdd, montoColor=C.red, placeholder='ej. 1500' }) {
  const [monto, setMonto] = useState('')
  const [cat,   setCat]   = useState(categorias[0])
  const [desc,  setDesc]  = useState('')
  const [forma, setForma] = useState('Tarjeta')
  const submit = () => {
    const m = parseFloat(monto)
    if (!m || m<=0) return
    onAdd({ id: Date.now().toString(), monto:m, categoria:cat, desc:desc||cat, formaPago:forma, fecha:new Date().toLocaleDateString('es-MX') })
    setMonto(''); setDesc('')
  }
  return (
    <Card style={{ marginBottom: '16px' }}>
      <Lbl>{label}</Lbl>
      <div style={{ display: 'grid', gap: '12px' }}>
        <div>
          <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>MONTO (MXN)</label>
          <input type="number" value={monto} placeholder={placeholder} onChange={e=>setMonto(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={{...inp, fontSize:'20px', color:montoColor, fontWeight:'bold'}}/>
        </div>
        <div>
          <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>FORMA DE PAGO</label>
          <PagoSelector value={forma} onChange={setForma}/>
        </div>
        <div>
          <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>CATEGORÍA</label>
          <select value={cat} onChange={e=>setCat(e.target.value)} style={inp}>{categorias.map(c=><option key={c}>{c}</option>)}</select>
        </div>
        <div>
          <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>DESCRIPCIÓN (opcional)</label>
          <input type="text" value={desc} placeholder="ej. Sesión familia Martínez" onChange={e=>setDesc(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} style={inp}/>
        </div>
        <button onClick={submit} style={{ background:C.accent, color:'#FFF', border:'none', borderRadius:'8px', padding:'13px', fontSize:'13px', fontWeight:'bold', cursor:'pointer', fontFamily:'monospace', letterSpacing:'2px', textTransform:'uppercase' }}>+ Agregar</button>
      </div>
    </Card>
  )
}

// ─── HOOK FIRESTORE ───────────────────────────────────────────
function useCollection(uid, colName) {
  const [data, setData] = useState({})
  useEffect(() => {
    if (!uid) return
    const ref = collection(db, 'usuarios', uid, colName)
    const unsub = onSnapshot(query(ref), snap => {
      const grouped = {}
      snap.forEach(d => {
        const item = { id: d.id, ...d.data() }
        const mes = item.mes ?? 0
        if (!grouped[mes]) grouped[mes] = []
        grouped[mes].push(item)
      })
      setData(grouped)
    })
    return unsub
  }, [uid, colName])
  const addItem = useCallback(async (mes, item) => {
    const ref = doc(collection(db, 'usuarios', uid, colName))
    await setDoc(ref, { ...item, mes, id: ref.id })
  }, [uid, colName])
  const removeItem = useCallback(async (id) => {
    await deleteDoc(doc(db, 'usuarios', uid, colName, id))
  }, [uid, colName])
  return { data, addItem, removeItem }
}

function useSimpleCollection(uid, colName) {
  const [items, setItems] = useState([])
  useEffect(() => {
    if (!uid) return
    const ref = collection(db, 'usuarios', uid, colName)
    const unsub = onSnapshot(query(ref), snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [uid, colName])
  const addItem = useCallback(async (item) => {
    const ref = doc(collection(db, 'usuarios', uid, colName))
    await setDoc(ref, { ...item, id: ref.id })
  }, [uid, colName])
  const removeItem = useCallback(async (id) => {
    await deleteDoc(doc(db, 'usuarios', uid, colName, id))
  }, [uid, colName])
  return { items, addItem, removeItem }
}

// ─── TAB CALCULADORA DE PRECIOS ───────────────────────────────
function TabPrecios() {
  const [gastosFijos,     setGastosFijos]     = useState('')
  const [costoMateriales, setCostoMateriales] = useState('')
  const [horasSesion,     setHorasSesion]     = useState('')
  const [horasSemanales,  setHorasSemanales]  = useState('')
  const [gananciaDeseada, setGananciaDeseada] = useState('')

  const fijos   = parseFloat(gastosFijos)     || 0
  const mat     = parseFloat(costoMateriales) || 0
  const hrsSes  = parseFloat(horasSesion)     || 0
  const hrsSem  = parseFloat(horasSemanales)  || 0
  const ganancia= parseFloat(gananciaDeseada) || 0

  // Sesiones posibles al mes: horas disponibles / horas por sesión
  const horasMes      = hrsSem * 4
  const sesionesPosibles = hrsSes > 0 ? Math.floor(horasMes / hrsSes) : 0

  // Costo por sesión
  const ses = sesionesPosibles || 1
  const costoFijosPorSesion   = fijos / ses
  const costoMaterialesSesion = mat
  const costoTotal            = costoFijosPorSesion + costoMaterialesSesion

  // Ganancia por sesión para llegar a la meta mensual
  const gananciaPorSesion = sesionesPosibles > 0 ? ganancia / sesionesPosibles : 0

  // Precios
  const precioMinimo   = costoTotal
  const precioSugerido = costoTotal + gananciaPorSesion

  const hayDatos = fijos > 0 || mat > 0 || hrsSes > 0

  return (
    <div>
      <Card style={{ marginBottom: '16px' }}>
        <Lbl>🧮 Calculadora de precio de sesión</Lbl>
        <div style={{ display: 'grid', gap: '12px' }}>
          {[
            { label: 'GASTOS FIJOS DEL MES (renta, equipo, software…)', val: gastosFijos, set: setGastosFijos, ph: 'ej. 5000' },
            { label: 'COSTO DE MATERIALES / EDICIÓN POR SESIÓN (MXN)', val: costoMateriales, set: setCostoMateriales, ph: 'ej. 300' },
            { label: 'HORAS QUE LE DEDICAS A UNA SESIÓN (incluyendo edición)', val: horasSesion, set: setHorasSesion, ph: 'ej. 6' },
            { label: 'HORAS QUE PUEDES TRABAJAR A LA SEMANA', val: horasSemanales, set: setHorasSemanales, ph: 'ej. 20' },
            { label: 'CUÁNTO QUIERES GANAR AL MES (MXN)', val: gananciaDeseada, set: setGananciaDeseada, ph: 'ej. 15000' },
          ].map(({ label, val, set, ph }) => (
            <div key={label}>
              <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>{label}</label>
              <input type="number" value={val} placeholder={ph} onChange={e=>set(e.target.value)} style={inp}/>
            </div>
          ))}
        </div>
      </Card>

      {hayDatos && (
        <Card>
          <Lbl>Resultado</Lbl>

          {/* Sesiones posibles */}
          {hrsSes > 0 && hrsSem > 0 && (
            <div style={{ background:C.bg, borderRadius:'8px', padding:'12px 14px', border:`1px solid ${C.border}`, marginBottom:'14px' }}>
              <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>
                Con {hrsSem}h/semana y {hrsSes}h por sesión puedes hacer
              </div>
              <div style={{ fontSize:'24px', fontWeight:'bold', color:C.accent }}>
                {sesionesPosibles} sesiones al mes
              </div>
              <div style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', marginTop:'2px' }}>
                {horasMes}h disponibles al mes ÷ {hrsSes}h por sesión
              </div>
            </div>
          )}

          {/* Desglose costos */}
          {[
            { l: 'Gastos fijos por sesión', v: costoFijosPorSesion },
            { l: 'Materiales / edición', v: costoMaterialesSesion },
          ].map(({ l, v }) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:'13px', color:C.muted }}>{l}</span>
              <span style={{ fontSize:'13px', color:C.text, fontWeight:'bold' }}>{fmt(v)}</span>
            </div>
          ))}

          {/* Precios */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginTop:'16px' }}>
            {[
              { l:'Precio mínimo', v:precioMinimo, c:C.blue, sub:'Solo cubres costos' },
              { l:'Precio sugerido', v:precioSugerido, c:C.accent, sub:`Incluye tu meta de ${fmt(ganancia)}/mes` },
            ].map(({ l, v, c, sub }) => (
              <div key={l} style={{ background:C.bg, borderRadius:'10px', padding:'14px', border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{l}</div>
                <div style={{ fontSize:'22px', fontWeight:'bold', color:c }}>{fmt(v)}</div>
                <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', marginTop:'3px' }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Ganancia por sesión */}
          {ganancia > 0 && sesionesPosibles > 0 && (
            <div style={{ marginTop:'12px', background:C.bg, borderRadius:'8px', padding:'12px 14px', border:`1px solid ${C.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px' }}>Ganancia por sesión</div>
                  <div style={{ fontSize:'18px', color:C.green, fontWeight:'bold' }}>{fmt(gananciaPorSesion)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px' }}>Meta mensual</div>
                  <div style={{ fontSize:'18px', color:C.green, fontWeight:'bold' }}>{fmt(ganancia)}</div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ─── TAB TARJETAS DE CRÉDITO ──────────────────────────────────
function TabTarjetas({ uid }) {
  const gastos = useSimpleCollection(uid, 'gastosTC')
  const msi    = useSimpleCollection(uid, 'comprasMSI')

  const [tab2,        setTab2]        = useState('gastos')
  const [monto,       setMonto]       = useState('')
  const [desc,        setDesc]        = useState('')
  const [tarjeta,     setTarjeta]     = useState('Tarjeta 1')
  const [fecha,       setFecha]       = useState('')
  const [corte,       setCorte]       = useState('')
  // MSI
  const [montoMSI,    setMontoMSI]    = useState('')
  const [descMSI,     setDescMSI]     = useState('')
  const [tarjetaMSI,  setTarjetaMSI]  = useState('Tarjeta 1')
  const [msiMeses,    setMsiMeses]    = useState(12)
  const [fechaMSI,    setFechaMSI]    = useState('')

  const TARJETAS = ['Tarjeta 1', 'Tarjeta 2', 'Tarjeta 3']

  const totalGastos = gastos.items.reduce((s, r) => s + r.monto, 0)
  const totalMSI    = msi.items.reduce((s, r) => s + r.monto, 0)
  const totalDeuda  = totalGastos + totalMSI

  const agregarGasto = () => {
    const m = parseFloat(monto)
    if (!m || m <= 0) return
    gastos.addItem({ monto:m, desc:desc||tarjeta, tarjeta, fecha: fecha || new Date().toLocaleDateString('es-MX'), corte })
    setMonto(''); setDesc(''); setFecha(''); setCorte('')
  }

  const agregarMSI = () => {
    const m = parseFloat(montoMSI)
    if (!m || m <= 0) return
    msi.addItem({ monto:m, desc:descMSI||tarjetaMSI, tarjeta:tarjetaMSI, meses:msiMeses, pagoMensual: m/msiMeses, fecha: fechaMSI || new Date().toLocaleDateString('es-MX') })
    setMontoMSI(''); setDescMSI(''); setFechaMSI('')
  }

  return (
    <div>
      {/* Resumen */}
      <Card style={{ marginBottom:'16px' }}>
        <Lbl>Resumen de Tarjetas</Lbl>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
          {[
            { l:'Gastos directos', v:totalGastos, c:C.red },
            { l:'Compras MSI', v:totalMSI, c:C.blue },
            { l:'Total deuda', v:totalDeuda, c:C.accent },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ background:C.bg, borderRadius:'10px', padding:'12px', border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{l}</div>
              <div style={{ fontSize:'17px', fontWeight:'bold', color:c }}>{fmt(v)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Sub-tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {[['gastos','💳 Gastos'],['msi','📅 MSI']].map(([t,label]) => (
          <button key={t} onClick={() => setTab2(t)} style={{
            flex:1, background:tab2===t?C.accent:'transparent', color:tab2===t?'#FFF':C.muted,
            border:`1px solid ${tab2===t?C.accent:C.border}`, borderRadius:'6px', padding:'8px',
            fontSize:'12px', cursor:'pointer', fontFamily:'monospace',
          }}>{label}</button>
        ))}
      </div>

      {tab2 === 'gastos' && (
        <div>
          <Card style={{ marginBottom:'16px' }}>
            <Lbl>Registrar gasto en tarjeta</Lbl>
            <div style={{ display:'grid', gap:'12px' }}>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>MONTO (MXN)</label>
                <input type="number" value={monto} placeholder="ej. 1500" onChange={e=>setMonto(e.target.value)} style={{...inp, fontSize:'20px', color:C.red, fontWeight:'bold'}}/>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>TARJETA</label>
                <select value={tarjeta} onChange={e=>setTarjeta(e.target.value)} style={inp}>
                  {TARJETAS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>DESCRIPCIÓN</label>
                <input type="text" value={desc} placeholder="ej. Gasolina" onChange={e=>setDesc(e.target.value)} style={inp}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>FECHA</label>
                  <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>FECHA DE CORTE</label>
                  <input type="date" value={corte} onChange={e=>setCorte(e.target.value)} style={inp}/>
                </div>
              </div>
              <button onClick={agregarGasto} style={{ background:C.accent, color:'#FFF', border:'none', borderRadius:'8px', padding:'13px', fontSize:'13px', fontWeight:'bold', cursor:'pointer', fontFamily:'monospace', letterSpacing:'2px', textTransform:'uppercase' }}>+ Agregar</button>
            </div>
          </Card>
          <Card>
            <Lbl>Gastos registrados</Lbl>
            {gastos.items.length === 0 && <div style={{ color:C.muted, fontStyle:'italic', fontSize:'13px', padding:'14px 0', textAlign:'center' }}>Sin gastos registrados.</div>}
            {gastos.items.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:'13px', color:C.text }}>{r.desc}</div>
                  <div style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', marginTop:'2px' }}>
                    {r.tarjeta} · {r.fecha} {r.corte && `· Corte ${r.corte}`}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ fontSize:'15px', color:C.red, fontWeight:'bold' }}>{fmt(r.monto)}</span>
                  <button onClick={() => gastos.removeItem(r.id)} style={{ background:'none', border:'none', color:C.border, cursor:'pointer', fontSize:'18px', lineHeight:1 }}>×</button>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab2 === 'msi' && (
        <div>
          <Card style={{ marginBottom:'16px' }}>
            <Lbl>Registrar compra a MSI</Lbl>
            <div style={{ display:'grid', gap:'12px' }}>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>MONTO TOTAL (MXN)</label>
                <input type="number" value={montoMSI} placeholder="ej. 12000" onChange={e=>setMontoMSI(e.target.value)} style={{...inp, fontSize:'20px', color:C.blue, fontWeight:'bold'}}/>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>MESES SIN INTERESES</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {MSI_OPCIONES.map(m => (
                    <button key={m} onClick={() => setMsiMeses(m)} style={{
                      background: msiMeses===m ? C.accent : C.bg,
                      color: msiMeses===m ? '#FFF' : C.muted,
                      border: `1px solid ${msiMeses===m ? C.accent : C.border}`,
                      borderRadius:'6px', padding:'7px 14px', cursor:'pointer',
                      fontFamily:'monospace', fontSize:'12px',
                    }}>{m} MSI</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>TARJETA</label>
                <select value={tarjetaMSI} onChange={e=>setTarjetaMSI(e.target.value)} style={inp}>
                  {TARJETAS.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>DESCRIPCIÓN</label>
                <input type="text" value={descMSI} placeholder="ej. Lente 50mm" onChange={e=>setDescMSI(e.target.value)} style={inp}/>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', letterSpacing:'1px', display:'block', marginBottom:'4px' }}>FECHA DE COMPRA</label>
                <input type="date" value={fechaMSI} onChange={e=>setFechaMSI(e.target.value)} style={inp}/>
              </div>
              {montoMSI > 0 && (
                <div style={{ background:C.bg, borderRadius:'8px', padding:'12px 14px', border:`1px solid ${C.border}` }}>
                  <span style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace' }}>PAGO MENSUAL </span>
                  <span style={{ fontSize:'18px', color:C.blue, fontWeight:'bold', marginLeft:'8px' }}>{fmt(parseFloat(montoMSI)/msiMeses)}</span>
                  <span style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', marginLeft:'6px' }}>× {msiMeses} meses</span>
                </div>
              )}
              <button onClick={agregarMSI} style={{ background:C.accent, color:'#FFF', border:'none', borderRadius:'8px', padding:'13px', fontSize:'13px', fontWeight:'bold', cursor:'pointer', fontFamily:'monospace', letterSpacing:'2px', textTransform:'uppercase' }}>+ Agregar</button>
            </div>
          </Card>
          <Card>
            <Lbl>Compras a MSI</Lbl>
            {msi.items.length === 0 && <div style={{ color:C.muted, fontStyle:'italic', fontSize:'13px', padding:'14px 0', textAlign:'center' }}>Sin compras MSI registradas.</div>}
            {msi.items.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.border}` }}>
                <div>
                  <div style={{ fontSize:'13px', color:C.text }}>{r.desc}</div>
                  <div style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', marginTop:'2px' }}>
                    {r.tarjeta} · {r.meses} MSI · {r.fecha}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'15px', color:C.blue, fontWeight:'bold' }}>{fmt(r.monto)}</div>
                    <div style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace' }}>{fmt(r.pagoMensual)}/mes</div>
                  </div>
                  <button onClick={() => msi.removeItem(r.id)} style={{ background:'none', border:'none', color:C.border, cursor:'pointer', fontSize:'18px', lineHeight:1 }}>×</button>
                </div>
              </div>
            ))}
            {msi.items.length > 0 && (
              <div style={{ marginTop:'12px', background:C.bg, borderRadius:'8px', padding:'12px 14px', border:`1px solid ${C.border}` }}>
                <span style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace' }}>PAGO MENSUAL TOTAL MSI </span>
                <span style={{ fontSize:'16px', color:C.blue, fontWeight:'bold', marginLeft:'8px' }}>
                  {fmt(msi.items.reduce((s,r) => s + r.pagoMensual, 0))}
                </span>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── APP PRINCIPAL ────────────────────────────────────────────
export default function KitFinanzas({ user, onLogout }) {
  const [mesIdx, setMesIdx] = useState(mesActual)
  const [tab,    setTab]    = useState('ingresos')
  const uid = user.uid

  const ing = useCollection(uid, 'ingresos')
  const gn  = useCollection(uid, 'gastosNegocio')
  const gp  = useCollection(uid, 'gastosPersonal')
  const xp  = useCollection(uid, 'extrasPersonal')

  const mk = mesIdx
  const regIng     = ing.data[mk]  || []
  const totalBruto = regIng.reduce((s,r) => s+r.monto, 0)
  const totalFact  = regIng.filter(r=>r.formaPago!=='Efectivo').reduce((s,r) => s+r.monto, 0)
  const totalEfec  = regIng.filter(r=>r.formaPago==='Efectivo').reduce((s,r) => s+r.monto, 0)
  const impuestos  = calcularImpuestos(totalFact)
  const neto       = totalBruto - impuestos
  const salario    = neto * 0.50

  const regGN  = gn.data[mk] || []
  const regGP  = gp.data[mk] || []
  const regXP  = xp.data[mk] || []
  const totalGN = regGN.reduce((s,r) => s+r.monto, 0)
  const totalGP = regGP.reduce((s,r) => s+r.monto, 0)
  const totalXP = regXP.reduce((s,r) => s+r.monto, 0)
  const persDisp = salario + totalXP

  const datosAnuales = MESES.map((_,i) => (ing.data[i]||[]).reduce((s,r) => s+r.monto, 0))
  const totalAnual   = datosAnuales.reduce((s,v) => s+v, 0)
  const maxAnual     = Math.max(...datosAnuales, 1)

  const TABS = [
    { id:'ingresos', label:'💼 Ingresos'  },
    { id:'negocio',  label:'🗂️ Negocio'   },
    { id:'personal', label:'🏠 Personal'  },
    { id:'precios',  label:'🧮 Precios'   },
    { id:'tarjetas', label:'💳 Tarjetas'  },
    { id:'resumen',  label:'📅 Resumen'   },
  ]

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'Georgia,serif', color:C.text }}>
      <header style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:'14px 20px', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:'760px', margin:'0 auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
            <div>
              <div style={{ fontSize:'9px', letterSpacing:'4px', color:C.accent, textTransform:'uppercase', fontFamily:'monospace' }}>KARLA SOTELO PHOTOGRAPHY</div>
              <div style={{ fontSize:'19px', fontWeight:'bold', letterSpacing:'-0.5px' }}>Kit de Finanzas</div>
            </div>
            <button onClick={onLogout} style={{ background:'none', border:`1px solid ${C.border}`, borderRadius:'6px', padding:'5px 10px', cursor:'pointer', fontFamily:'monospace', fontSize:'10px', color:C.muted }}>Salir</button>
          </div>
          <div style={{ display:'flex', gap:'6px', overflowX:'auto' }}>
            {TABS.map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)} style={{
                background: tab===id ? C.accent : 'transparent',
                color: tab===id ? '#FFF' : C.muted,
                border: `1px solid ${tab===id ? C.accent : C.border}`,
                borderRadius:'6px', padding:'6px 12px', fontSize:'11px',
                cursor:'pointer', fontFamily:'monospace', whiteSpace:'nowrap', flexShrink:0, transition:'all .15s',
              }}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth:'760px', margin:'0 auto', padding:'20px 16px' }}>

        {/* Selector mes — solo para tabs financieros */}
        {['ingresos','negocio','personal','resumen'].includes(tab) && (
          <div style={{ display:'flex', gap:'5px', marginBottom:'22px', overflowX:'auto', paddingBottom:'4px' }}>
            {MESES.map((m,i) => {
              const tiene = (ing.data[i]||[]).length>0||(gn.data[i]||[]).length>0||(gp.data[i]||[]).length>0
              return (
                <button key={i} onClick={() => setMesIdx(i)} style={{
                  background: mesIdx===i ? C.accent : tiene ? C.deep : 'transparent',
                  color: mesIdx===i ? '#FFF' : tiene ? C.text : C.muted,
                  border: `1px solid ${mesIdx===i ? C.accent : C.border}`,
                  borderRadius:'6px', padding:'6px 10px', fontSize:'10px',
                  cursor:'pointer', whiteSpace:'nowrap', fontFamily:'monospace',
                  fontWeight: mesIdx===i ? 'bold' : 'normal', flexShrink:0,
                }}>
                  {m.slice(0,3).toUpperCase()}
                  {tiene && mesIdx!==i && <span style={{ color:C.accent, marginLeft:'2px' }}>·</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* ── INGRESOS ── */}
        {tab==='ingresos' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'16px' }}>
              {[
                { l:'Ingresos Totales', v:totalBruto, c:C.accent },
                { l:'Impuestos', v:impuestos, c:C.red, sub: totalEfec>0 ? `Efectivo ${fmt(totalEfec)} sin IVA` : null },
                { l:'Neto', v:neto, c:C.green },
              ].map(({ l, v, c, sub }) => (
                <Card key={l} style={{ padding:'14px 16px' }}>
                  <div style={{ fontSize:'9px', color:C.muted, letterSpacing:'2px', fontFamily:'monospace', textTransform:'uppercase', marginBottom:'5px' }}>{l}</div>
                  <div style={{ fontSize:'18px', fontWeight:'bold', color:c }}>{fmt(v)}</div>
                  {sub && <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', marginTop:'3px' }}>{sub}</div>}
                </Card>
              ))}
            </div>
            <Card style={{ marginBottom:'16px' }}>
              <Lbl>Distribución del Neto</Lbl>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {SOBRES.map(({ id, label, pct, color, emoji }) => (
                  <div key={id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'10px', padding:'13px 15px', position:'relative', overflow:'hidden' }}>
                    <div style={{ position:'absolute', top:0, left:0, height:'3px', width:`${pct*100}%`, background:color }}/>
                    <div style={{ fontSize:'15px', marginBottom:'3px' }}>{emoji}</div>
                    <div style={{ fontSize:'10px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px' }}>{label}</div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:'3px' }}>
                      <span style={{ fontSize:'17px', color, fontWeight:'bold' }}>{fmt(neto*pct)}</span>
                      <span style={{ fontSize:'10px', color, fontFamily:'monospace', fontWeight:'bold' }}>{(pct*100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <FormRegistro label="Registrar ingreso" categorias={CATS_INGRESO} montoColor={C.accent} placeholder="ej. 8500" onAdd={item=>ing.addItem(mk,item)}/>
            <Card><Lbl>Ingresos — {MESES[mesIdx]}</Lbl><ListaMovimientos items={regIng} colorMonto={C.accent} onDelete={id=>ing.removeItem(id)}/></Card>
          </div>
        )}

        {/* ── NEGOCIO ── */}
        {tab==='negocio' && (
          <div>
            <Card style={{ marginBottom:'16px' }}>
              <Lbl>Balance del Negocio — {MESES[mesIdx]}</Lbl>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'8px' }}>
                {[
                  { l:'Ingresos del mes', v:totalBruto, c:C.accent },
                  { l:'Gastos registrados', v:totalGN, c:C.red },
                  { l:'Balance', v:totalBruto-totalGN, c:(totalBruto-totalGN)>=0?C.green:C.red },
                ].map(({ l, v, c }) => (
                  <div key={l}>
                    <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>{l}</div>
                    <div style={{ fontSize:'18px', fontWeight:'bold', color:c }}>{fmt(v)}</div>
                  </div>
                ))}
              </div>
              <BalBar disp={totalBruto} gast={totalGN}/>
            </Card>
            <FormRegistro label="Registrar gasto del negocio" categorias={CATS_NEGOCIO} montoColor={C.red} placeholder="ej. 1200" onAdd={item=>gn.addItem(mk,item)}/>
            <Card><Lbl>Gastos — {MESES[mesIdx]}</Lbl><ListaMovimientos items={regGN} colorMonto={C.red} signo="- " onDelete={id=>gn.removeItem(id)}/></Card>
          </div>
        )}

        {/* ── PERSONAL ── */}
        {tab==='personal' && (
          <div>
            <Card style={{ marginBottom:'16px' }}>
              <Lbl>Balance Personal — {MESES[mesIdx]}</Lbl>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'4px' }}>
                <div>
                  <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Disponible</div>
                  <div style={{ fontSize:'20px', fontWeight:'bold', color:C.accent }}>{fmt(persDisp)}</div>
                  <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', marginTop:'2px' }}>Salario {fmt(salario)}{totalXP>0 && ` + Extra ${fmt(totalXP)}`}</div>
                </div>
                <div>
                  <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'4px' }}>Balance</div>
                  <div style={{ fontSize:'20px', fontWeight:'bold', color:(persDisp-totalGP)>=0?C.green:C.red }}>{fmt(persDisp-totalGP)}</div>
                  <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', marginTop:'2px' }}>Gastado {fmt(totalGP)}</div>
                </div>
              </div>
              <BalBar disp={persDisp} gast={totalGP}/>
            </Card>
            <FormRegistro label="➕ Ingreso extra personal" categorias={CATS_EXTRA} montoColor={C.green} placeholder="ej. 500" onAdd={item=>xp.addItem(mk,item)}/>
            {regXP.length>0 && <Card style={{ marginBottom:'16px' }}><Lbl>Ingresos Extra — {MESES[mesIdx]}</Lbl><ListaMovimientos items={regXP} colorMonto={C.green} signo="+ " onDelete={id=>xp.removeItem(id)}/></Card>}
            <FormRegistro label="➖ Gasto personal" categorias={CATS_PERSONAL} montoColor={C.red} placeholder="ej. 900" onAdd={item=>gp.addItem(mk,item)}/>
            <Card><Lbl>Gastos Personales — {MESES[mesIdx]}</Lbl><ListaMovimientos items={regGP} colorMonto={C.red} signo="- " onDelete={id=>gp.removeItem(id)}/></Card>
          </div>
        )}

        {/* ── PRECIOS ── */}
        {tab==='precios' && <TabPrecios/>}

        {/* ── TARJETAS ── */}
        {tab==='tarjetas' && <TabTarjetas uid={uid}/>}

        {/* ── RESUMEN ── */}
        {tab==='resumen' && (
          <div>
            <Card style={{ marginBottom:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace', letterSpacing:'2px', textTransform:'uppercase' }}>Total Anual 2026</div>
                <div style={{ fontSize:'30px', fontWeight:'bold', color:C.accent, letterSpacing:'-1px' }}>{fmt(totalAnual)}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'9px', color:C.muted, fontFamily:'monospace' }}>Meses activos</div>
                <div style={{ fontSize:'26px', fontWeight:'bold' }}>{Object.values(ing.data).filter(m=>m.length>0).length}</div>
              </div>
            </Card>
            <Card style={{ marginBottom:'16px' }}>
              <Lbl>Ingresos por Mes</Lbl>
              <div style={{ display:'flex', alignItems:'flex-end', gap:'4px', height:'100px' }}>
                {datosAnuales.map((val,i) => (
                  <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%' }}>
                    <div onClick={() => { setMesIdx(i); setTab('ingresos') }} style={{ width:'100%', marginTop:'auto', cursor:'pointer', borderRadius:'4px 4px 0 0', height:val>0?`${(val/maxAnual)*88}%`:'3px', background:i===mesIdx?C.accent:val>0?C.deep:C.border, minHeight:'3px', border:`1px solid ${C.border}`, transition:'background .15s' }}/>
                    <div style={{ fontSize:'6px', color:i===mesIdx?C.accent:C.muted, fontFamily:'monospace', marginTop:'3px' }}>{MESES[i].slice(0,3).toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <Lbl>Desglose Mensual</Lbl>
              {MESES.map((mes,i) => {
                const regs = ing.data[i]||[]
                const t  = regs.reduce((s,r) => s+r.monto, 0)
                const tf = regs.filter(r=>r.formaPago!=='Efectivo').reduce((s,r) => s+r.monto, 0)
                const imp = calcularImpuestos(tf)
                const n  = t - imp
                const gnT = (gn.data[i]||[]).reduce((s,r) => s+r.monto, 0)
                const gpT = (gp.data[i]||[]).reduce((s,r) => s+r.monto, 0)
                const xpT = (xp.data[i]||[]).reduce((s,r) => s+r.monto, 0)
                if (t===0 && gnT===0 && gpT===0) return null
                return (
                  <div key={i} onClick={() => setMesIdx(i)} style={{ padding:'12px 0', borderBottom:`1px solid ${C.border}`, cursor:'pointer' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                      <span style={{ fontFamily:'monospace', fontSize:'13px', color:i===mesIdx?C.accent:C.muted, fontWeight:i===mesIdx?'bold':'normal' }}>{mes}</span>
                      <span style={{ fontSize:'14px', fontWeight:'bold', color:C.accent }}>{fmt(t)}</span>
                    </div>
                    <div style={{ display:'flex', gap:'14px', flexWrap:'wrap' }}>
                      {[
                        { l:'Impuestos', v:imp, c:C.red },
                        { l:'Neto', v:n, c:C.green },
                        { l:'G. Negocio', v:gnT, c:C.blue },
                        { l:'G. Personal', v:gpT, c:'#A0748A' },
                        ...(xpT>0?[{ l:'Extra pers.', v:xpT, c:C.green }]:[]),
                      ].map(({ l, v, c }) => (
                        <div key={l}>
                          <div style={{ fontSize:'8px', color:C.muted, fontFamily:'monospace' }}>{l}</div>
                          <div style={{ fontSize:'12px', color:c, fontWeight:'bold' }}>{fmt(v)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              {totalAnual===0 && <div style={{ color:C.muted, textAlign:'center', padding:'24px 0', fontStyle:'italic' }}>Aún no hay registros.</div>}
            </Card>
          </div>
        )}
      </main>

      <footer style={{ borderTop:`1px solid ${C.border}`, padding:'12px 20px', marginTop:'32px', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontSize:'9px', color:C.border, fontFamily:'monospace', letterSpacing:'2px' }}>KIT DE FINANZAS PARA FOTÓGRAFAS © 2026</span>
        <span style={{ fontSize:'9px', color:C.border, fontFamily:'monospace' }}>RESICO + IVA · Régimen simplificado</span>
      </footer>
    </div>
  )
}
