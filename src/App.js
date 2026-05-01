import React, { useState, useEffect, useMemo } from "react";
import './index.css';
import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, push, onValue, get, set, remove, onDisconnect, query, orderByChild, equalTo } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { Search, Save, Users, CheckCircle, LogOut, BarChart3, MapPin, UserSquare2, Bell, AlertTriangle, Trash2, Eye, Camera, Printer, Lock, Send, IdCard, Target, Settings, Download, Wifi, WifiOff, FileSearch, RefreshCw, X, Calculator, TrendingUp, TrendingDown, ClipboardList, Globe, Edit2, UserPlus, ShieldAlert, Unlock, ChevronDown } from "lucide-react";

// ============================================================================
// CONFIGURACIÓN DE FIREBASE (CANINDEYÚ)
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBAVDbctl18PoPggpL8Zd0SA-pbYQyr7aE",
  authDomain: "canindeyu-bd.firebaseapp.com",
  databaseURL: "https://canindeyu-bd-default-rtdb.firebaseio.com",
  projectId: "canindeyu-bd",
  storageBucket: "canindeyu-bd.firebasestorage.app",
  messagingSenderId: "662885054967",
  appId: "1:662885054967:web:abd19f28ae503e55fa96f2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

const DISTRITOS_CANINDEYU = [
    "CORPUS CHRISTI", "FRANCISCO CABALLERO ALVAREZ", "ITANARA", "KATUETE", "LA PALOMA", 
    "LAUREL", "MARACANA", "NUEVA ESPERANZA", "PUERTO ADELA", "SALTO DEL GUAIRA", 
    "VILLA SAN ISIDRO CURUGUATY", "VILLA YGATIMI", "YASY CAÑY", "YBY PYTA", "YBYRAROVANA", "YPE JHU"
];
const NOMBRE_DEPARTAMENTO = "CANINDEYÚ";

// --- DICCIONARIO DE FOTOS LOCALES ---
const FOTOS_LOCALES_CONCEJALES = {
  "1-FABIO PORTILLO": "/fotos/1-fabio_portillo.jpg",
  "2- JULIO CABRERA": "/fotos/2- julio_cabrera.jpg",
  "3- JOEL VILLASANTI": "/fotos/3-joel_villasanti.jpg",
  "4-ELENO VERON": "/fotos/4-eleno_verón.jpg",
  "5- GLADYS SANTANDER": "/fotos/5-gladys_santander.jpg",
  "6- EDGAR MONZON": "/fotos/6-edgar_verón.jpg",
  "7- MARCELINO GONZALEZ": "/fotos/7-marcelino_gonzález.jpg",
  "8- ISMAEL FERNANDEZ": "/fotos/8-ismael_fernández.jpg",
  "9- LUZ MABEL R.": "/fotos/9-luz_mabel_r.jpg" 
};

// --- HERRAMIENTAS GLOBALES ---
const generarLlave = (distrito, mesa, orden) => `${distrito}_${mesa}_${orden}`.toUpperCase().replace(/[.$#[\]/]/g, '').trim();
const generarLlaveMesa = (distrito, mesa) => `${distrito}_${mesa}`.toUpperCase().replace(/[.$#[\]/]/g, '').trim();

const enviarWhatsAppCarnet = (v) => {
    if (!v.telefono) return alert("Este votante no tiene número de teléfono registrado.");
    let tel = v.telefono.replace(/\s+/g, '');
    if (tel.startsWith('0')) tel = '595' + tel.substring(1);
    const msj = `*🗳️ CARNET ELECTORAL*\n\nHola *${v.nombre} ${v.apellido}*,\nEstos son tus datos para el Día D:\n\n*C.I:* ${v.cedula}\n*DISTRITO:* ${v.distrito}\n*LOCAL:* ${v.local}\n*MESA:* ${v.mesa} | *ORDEN:* ${v.orden}\n\n¡Contamos con tu apoyo!`;
    window.open(`https://api.whatsapp.com/send?phone=${tel}&text=${encodeURIComponent(msj)}`, '_blank');
};

const imprimirCarnetFisico = (v, fotoBaseConcejal) => {
    const vent = window.open('', '_blank');
    vent.document.write(`<html><head><title>Carnet Electoral</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#eee}@media print{body{background:white}.carnet{box-shadow:none;border:2px solid #991e1e}}.carnet{width:6cm;height:9cm;background:white;border:2px solid #991e1e;border-radius:12px;padding:12px;box-shadow:0 5px 10px rgba(0,0,0,0.2);display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;position:relative}.img-base{position:absolute;top:0;left:0;width:100%;height:3.5cm;object-fit:cover;z-index:1;opacity:0.15}.header{background:#991e1e;color:white;text-align:center;padding:8px;font-weight:bold;font-size:16px;border-radius:6px;z-index:10;position:relative}.concej-nombre{font-size:10px;text-transform:uppercase;color:#ffcccc;margin-top:2px}.datos{font-size:12px;line-height:1.5;margin-top:15px;z-index:10;position:relative}.dato-tit{color:#888;font-size:10px;margin-bottom:-5px;font-weight:bold;text-transform:uppercase}.dato-val{font-weight:900;font-size:15px;color:#111;margin-bottom:8px;border-bottom:1px solid #eee;padding-bottom:2px}.footer{text-align:center;font-size:11px;color:white;background:#1e293b;padding:6px;border-radius:6px;font-weight:bold;z-index:10;position:relative}</style></head><body><div class="carnet">${fotoBaseConcejal?`<img src="${fotoBaseConcejal}" class="img-base"/>`:''}<div class="header">CARNET OFICIAL<div class="concej-nombre">Candidato: ${v.concejal}</div></div><div class="datos"><div class="dato-tit">CÉDULA</div><div class="dato-val">${v.cedula}</div><div class="dato-tit">ELECTOR</div><div class="dato-val">${v.nombre} ${v.apellido}</div><div class="dato-tit">LOCAL</div><div class="dato-val" style="font-size:13px;line-height:1.2">${v.local}</div><div style="display:flex;justify-content:space-between;margin-top:15px;border-top:2px solid #eee;padding-top:10px"><div><div class="dato-tit">MESA</div><div class="dato-val" style="font-size:28px;color:#991e1e;border:none;padding:0">${v.mesa}</div></div><div style="text-align:right"><div class="dato-tit">ORDEN</div><div class="dato-val" style="font-size:28px;color:#991e1e;border:none;padding:0">${v.orden}</div></div></div></div><div class="footer">Válido para Día D</div></div><script>window.print();setTimeout(()=>window.close(),500);</script></body></html>`);
    vent.document.close();
};

// ==============================================================================================
// 1. COMPONENTE PRINCIPAL
// ==============================================================================================
export default function BemoSystem() {
  const [usuarioActivo, setUsuarioActivo] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [padronGlobal, setPadronGlobal] = useState({});
  const [votosSeguros, setVotosSeguros] = useState([]);
  const [yaVotaronGlobal, setYaVotaronGlobal] = useState({});
  const [mesasCerradas, setMesasCerradas] = useState({});
  const [fotosConcejales, setFotosConcejales] = useState({});
  const [pasoPCGlobal, setPasoPCGlobal] = useState({});
  const [asignacionesVeedores, setAsignacionesVeedores] = useState({});
  const [veedoresOnline, setVeedoresOnline] = useState({});
  const [escrutinioGlobal, setEscrutinioGlobal] = useState({});
  const [usuariosRegistrados, setUsuariosRegistrados] = useState({});
  const [configuracionDepartamental, setConfiguracionDepartamental] = useState({});
  const [usuariosOnline, setUsuariosOnline] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUsuarioActivo(user);
        const perfilSnap = await get(ref(db, `usuarios/${user.uid}`));
        if (perfilSnap.exists()) {
            const pData = perfilSnap.val();
            const rolUsuario = String(pData.rol).toLowerCase().trim();
            const distritoDelUsuario = pData.distrito;
            setPerfil({ ...pData, rol: rolUsuario });

            if (rolUsuario === "master_departamental" || rolUsuario === "master_global") {
                get(ref(db, 'padron')).then(s => s.exists() && setPadronGlobal(s.val() || {}));
            } else if (distritoDelUsuario) {
                const padronQuery = query(ref(db, 'padron'), orderByChild('distrito'), equalTo(distritoDelUsuario));
                get(padronQuery).then(s => s.exists() && setPadronGlobal(s.val() || {}));
            }
        } else { setPerfil({ rol: 'pendiente' }); }

        onValue(ref(db, 'configuracion'), (snap) => setConfiguracionDepartamental(snap.val() || {}));
        onValue(ref(db, 'usuarios'), (snap) => setUsuariosRegistrados(snap.val() || {}));
        onValue(ref(db, 'votos_seguros'), (snap) => { const data = snap.val(); setVotosSeguros(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []); });
        onValue(ref(db, 'dia_d/votos_efectuados'), (snap) => setYaVotaronGlobal(snap.val() || {}));
        onValue(ref(db, 'dia_d/mesas_cerradas'), (snap) => setMesasCerradas(snap.val() || {}));
        onValue(ref(db, 'concejales_fotos'), (snap) => setFotosConcejales(snap.val() || {}));
        onValue(ref(db, 'dia_d/paso_pc_checkins'), (snap) => setPasoPCGlobal(snap.val() || {}));
        onValue(ref(db, 'dia_d/asignaciones_veedores'), (snap) => setAsignacionesVeedores(snap.val() || {}));
        onValue(ref(db, 'dia_d/veedores_online'), (snap) => setVeedoresOnline(snap.val() || {}));
        onValue(ref(db, 'dia_d/escrutinio'), (snap) => setEscrutinioGlobal(snap.val() || {}));
      } else { 
          setUsuarioActivo(null); setPerfil(null);
      }
      setCargando(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
      if (usuarioActivo && perfil && perfil.rol && perfil.rol !== 'pendiente') {
          const myStatusRef = ref(db, `estado_online/${usuarioActivo.uid}`);
          onValue(ref(db, '.info/connected'), (snap) => {
              if (snap.val() === true) {
                  onDisconnect(myStatusRef).remove().then(() => { set(myStatusRef, { rol: perfil.rol, distrito: perfil.distrito, timestamp: Date.now() }); });
              }
          });
      }
      const unsubOnline = onValue(ref(db, 'estado_online'), (snap) => setUsuariosOnline(snap.val() || {}));
      return () => unsubOnline();
  }, [usuarioActivo, perfil]);

  useEffect(() => {
      let timeout; const rolesTimeout = ['veedor', 'dirigente', 'concejal'];
      const resetTimer = () => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
              if (auth.currentUser && perfil && rolesTimeout.includes(perfil.rol)) {
                  alert("⏱️ Sesión cerrada por inactividad (3 minutos)."); signOut(auth); window.location.reload();
              }
          }, 3 * 60 * 1000); 
      };
      if (perfil && rolesTimeout.includes(perfil.rol)) {
          window.addEventListener('mousemove', resetTimer); window.addEventListener('keydown', resetTimer); window.addEventListener('touchstart', resetTimer); window.addEventListener('click', resetTimer); resetTimer();
      }
      return () => {
          clearTimeout(timeout); window.removeEventListener('mousemove', resetTimer); window.removeEventListener('keydown', resetTimer); window.removeEventListener('touchstart', resetTimer); window.removeEventListener('click', resetTimer);
      }; 
  }, [perfil]);

  if (cargando || (usuarioActivo && !perfil)) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <div className="font-black text-xl tracking-widest animate-pulse text-red-500">VERIFICANDO CREDENCIALES...</div>
          </div>
      );
  }

  if (!usuarioActivo) return <LoginScreen auth={auth} db={db} />;

  const distritoUsuario = perfil?.distrito || DISTRITOS_CANINDEYU[0];
  const configApp = configuracionDepartamental[distritoUsuario] || { intendente: `NO CONFIGURADO`, lista: "0", meta_intendente: 5000, meta_concejales: 500, concejales: [] };
  const rol = perfil?.rol;
  
  if (rol === 'pendiente') return (<div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center"><ShieldAlert size={64} className="text-yellow-500 mb-4" /><h1 className="text-2xl font-black mb-2">CUENTA EN REVISIÓN</h1><p className="text-gray-400 mb-8 max-w-sm">Avisa a tu Administrador Local para que active tu acceso.</p><button onClick={()=>signOut(auth)} className="bg-red-600 px-6 py-3 rounded-xl font-bold">CERRAR SESIÓN</button></div>);
  if (rol === 'veedor') return <AppVeedor padronGlobal={padronGlobal} yaVotaronGlobal={yaVotaronGlobal} mesasCerradas={mesasCerradas} asignacionesVeedores={asignacionesVeedores} escrutinioGlobal={escrutinioGlobal} configApp={configApp} auth={auth} db={db} />;
  if (rol === 'concejal') return <AppConcejal perfil={perfil} padronGlobal={padronGlobal} votosSeguros={votosSeguros} yaVotaronGlobal={yaVotaronGlobal} pasoPCGlobal={pasoPCGlobal} escrutinioGlobal={escrutinioGlobal} fotosConcejales={fotosConcejales} configApp={configApp} auth={auth} db={db} usuarioActivo={usuarioActivo} />;
  if (rol === 'dirigente') return <AppDirigente padronGlobal={padronGlobal} yaVotaronGlobal={yaVotaronGlobal} pasoPCGlobal={pasoPCGlobal} configApp={configApp} auth={auth} db={db} />;
  if (rol === 'super_admin' || rol === 'master_departamental') return <AppSuperAdmin perfil={perfil} padronGlobal={padronGlobal} votosSeguros={votosSeguros} yaVotaronGlobal={yaVotaronGlobal} mesasCerradas={mesasCerradas} asignacionesVeedores={asignacionesVeedores} veedoresOnline={veedoresOnline} escrutinioGlobal={escrutinioGlobal} fotosConcejales={fotosConcejales} pasoPCGlobal={pasoPCGlobal} configuracionDepartamental={configuracionDepartamental} usuariosRegistrados={usuariosRegistrados} usuariosOnline={usuariosOnline} auth={auth} db={db} usuarioActivo={usuarioActivo}  />;

  return <div className="min-h-screen flex items-center justify-center"><button onClick={()=>signOut(auth)} className="bg-red-500 text-white p-4 rounded font-bold">ROL NO RECONOCIDO - CERRAR SESIÓN</button></div>;
}

// ==============================================================================================
// 2. COMPONENTES: LOGIN Y PANELES SECUNDARIOS
// ==============================================================================================
function LoginScreen({ auth, db }) {
    const [isRegister, setIsRegister] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault(); const em = e.target.em.value; const ps = e.target.ps.value;
        try {
            if (isRegister) {
                const res = await createUserWithEmailAndPassword(auth, em, ps);
                await set(ref(db, `usuarios/${res.user.uid}`), { email: em, password_plain: ps, rol: 'master_departamental', distrito: DISTRITOS_CANINDEYU[0], nombre_oficial: 'COMANDO' });
                alert("¡Cuenta creada exitosamente!");
            } else await signInWithEmailAndPassword(auth, em, ps);
        } catch (err) { alert("Error: " + err.message); }
    };
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4 relative overflow-hidden">
            <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border-t-8 border-red-700 relative z-10">
                <h1 className="text-3xl font-black text-center mb-2 uppercase">BEMO <span className="text-red-700">2026</span></h1>
                <p className="text-center text-[10px] font-bold text-gray-400 mb-6 uppercase tracking-widest">DPTO. DE {NOMBRE_DEPARTAMENTO}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input name="em" type="email" placeholder="Correo" autoComplete="username" className="w-full p-4 border rounded-xl font-bold outline-none focus:ring-2 ring-red-500" required />
                    <input name="ps" type="password" placeholder="Contraseña" autoComplete="current-password" className="w-full p-4 border rounded-xl font-bold outline-none focus:ring-2 ring-red-500" required />
                    <button type="submit" className="bg-red-700 hover:bg-red-800 text-white w-full py-4 rounded-xl font-black shadow-lg">{isRegister ? "CREAR CUENTA" : "INGRESAR AL SISTEMA"}</button>
                </form>
                <div className="mt-6 text-center border-t pt-4"><button onClick={()=>setIsRegister(!isRegister)} className="text-sm font-bold text-slate-500 hover:text-red-600">{isRegister ? "Ya tengo cuenta. Iniciar sesión." : "¿Eres nuevo? Regístrate aquí."}</button></div>
            </div>
            <div className="mt-12 text-center relative z-10 animate-fade-in"><p className="text-[10px] font-bold text-slate-500 uppercase mb-4 tracking-widest">Contacta con soporte técnico</p>
                <div className="flex justify-center gap-4 mb-6">
                    <a href="#" target="_blank" rel="noreferrer" className="hover:scale-110 transition-all flex flex-col items-center gap-2 group"><div className="w-12 h-12 flex items-center justify-center bg-slate-800 rounded-full group-hover:bg-[#25D366]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></div><span className="text-[9px] font-black uppercase text-slate-600">WhatsApp</span></a>
                    <a href="#" target="_blank" rel="noreferrer" className="hover:scale-110 transition-all flex flex-col items-center gap-2 group"><div className="w-12 h-12 flex items-center justify-center bg-slate-800 rounded-full group-hover:bg-[#E1306C]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></div><span className="text-[9px] font-black uppercase text-slate-600">Instagram</span></a>
                    <a href="#" target="_blank" rel="noreferrer" className="hover:scale-110 transition-all flex flex-col items-center gap-2 group"><div className="w-12 h-12 flex items-center justify-center bg-slate-800 rounded-full group-hover:bg-[#1877F2]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></div><span className="text-[9px] font-black uppercase text-slate-600">Facebook</span></a>
                </div>
                <div className="border-t border-slate-800 pt-4 px-10"><p className="text-xs font-black tracking-widest text-slate-500">PROPIEDAD DE BEMO SYSTEM S.A © 2026</p></div>
            </div>
        </div>
    );
}

function PanelUsuarios({ perfil, usuariosRegistrados, configuracionDepartamental, db, distritoFiltro }) {
    const esMaster = perfil.rol === "master_departamental" || perfil.rol === "master_global";
    const [verClaves, setVerClaves] = useState({}); const [mostrarForm, setMostrarForm] = useState(false);
    const [nEmail, setNEmail] = useState(""); const [nClave, setNClave] = useState(""); const [nRol, setNRol] = useState("veedor"); const [nDistrito, setNDistrito] = useState(distritoFiltro === "TODOS" ? DISTRITOS_CANINDEYU[0] : distritoFiltro);
    const [creando, setCreando] = useState(false);

    const usuarios = Object.entries(usuariosRegistrados).filter(([_, d]) => d?.email && (distritoFiltro === "TODOS" || d.distrito === distritoFiltro || d.rol === 'pendiente'));
    const actualizar = (uid, c, v) => { if(!esMaster && v==='master_departamental') return alert("Sin permisos."); set(ref(db, `usuarios/${uid}/${c}`), v); };
    const eliminar = (uid, e) => { if(window.confirm(`⚠️ ¿Eliminar a ${e}?`)) remove(ref(db, `usuarios/${uid}`)); };

    const crearUsr = async (e) => {
        e.preventDefault(); if(nClave.length<6) return alert("Mín. 6 letras"); setCreando(true);
        try {
            const apps = getApps(); let sApp = apps.find(a => a.name === "SecApp"); if (!sApp) sApp = initializeApp(firebaseConfig, "SecApp"); 
            const sAuth = getAuth(sApp); const res = await createUserWithEmailAndPassword(sAuth, nEmail, nClave);
            await set(ref(db, `usuarios/${res.user.uid}`), { email: nEmail, password_plain: nClave, rol: nRol, distrito: esMaster ? nDistrito : perfil.distrito, nombre_oficial: "" });
            await signOut(sAuth); alert("✅ Creado"); setMostrarForm(false); setNEmail(""); setNClave("");
        } catch(err) { alert(err.message); } setCreando(false);
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-xl border-t-8 border-blue-600">
            <div className="flex justify-between border-b pb-4 mb-6"><h2 className="text-2xl font-black uppercase text-slate-800">ACCESOS</h2><button onClick={()=>setMostrarForm(!mostrarForm)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold">{mostrarForm ? "CERRAR" : "+ CREAR"}</button></div>
            {mostrarForm && (
                <form onSubmit={crearUsr} className="bg-blue-50 p-6 rounded-2xl mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"><input type="email" required className="p-3 border rounded-lg" value={nEmail} onChange={e=>setNEmail(e.target.value)} placeholder="Email..." /><input type="text" required className="p-3 border rounded-lg" value={nClave} onChange={e=>setNClave(e.target.value)} placeholder="Clave..." /><select className="p-3 border rounded-lg" value={nRol} onChange={e=>setNRol(e.target.value)}><option value="veedor">VEEDOR</option><option value="dirigente">DIRIGENTE</option><option value="concejal">CONCEJAL</option><option value="super_admin">ADMIN</option></select>{esMaster && <select className="p-3 border rounded-lg uppercase" value={nDistrito} onChange={e=>setNDistrito(e.target.value)}>{DISTRITOS_CANINDEYU.map(d=><option key={d}>{d}</option>)}</select>}</div>
                    <button type="submit" disabled={creando} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black">{creando ? "CREANDO..." : "GUARDAR"}</button>
                </form>
            )}
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-100 uppercase text-[10px]"><tr><th className="p-3">Email</th><th className="p-3">Clave</th><th className="p-3">Distrito</th><th className="p-3">Rol</th><th className="p-3">Nombre</th><th className="p-3 text-center">X</th></tr></thead><tbody className="divide-y">
                {usuarios.map(([id, d]) => (
                    <tr key={id} className="hover:bg-slate-50"><td className="p-3 font-bold">{d.email}</td><td className="p-3 font-mono text-xs flex items-center gap-2"><span>{verClaves[id]?d.password_plain:'••••'}</span><button onClick={()=>setVerClaves(p=>({...p, [id]:!p[id]}))}><Eye size={14}/></button></td><td className="p-3 font-bold text-[10px]">{d.distrito}</td><td className="p-3 text-[10px] uppercase">{d.rol}</td><td className="p-3 text-[10px]">{d.rol==='concejal' ? <select className="p-2 border rounded" value={d.nombre_oficial||""} onChange={e=>actualizar(id,'nombre_oficial',e.target.value)}><option value="">Asignar...</option>{(configuracionDepartamental[d.distrito]?.concejales||[]).map(c=><option key={c}>{c}</option>)}</select> : '-'}</td><td className="p-3 text-center"><button onClick={()=>eliminar(id,d.email)} className="text-red-500"><Trash2 size={16}/></button></td></tr>
                ))}
            </tbody></table></div>
        </div>
    );
}

function PanelConfiguracionDepartamental({ perfil, configuracionDepartamental, db, distritoGlobal, setDistritoGlobal }) {
    const esMaster = perfil.rol === "master_departamental" || perfil.rol === "master_global";
    const dataBruta = configuracionDepartamental[distritoGlobal] || {};
    const configActual = { intendente: typeof dataBruta.intendente === 'string' ? dataBruta.intendente : "", lista: dataBruta.lista || "0", meta_intendente: dataBruta.meta_intendente || 5000, meta_concejales: dataBruta.meta_concejales || 500, concejales: Array.isArray(dataBruta.concejales) ? dataBruta.concejales : [] };

    const [tInt, setTInt] = useState(""); const [tLis, setTList] = useState(""); const [tMetInt, setTMetInt] = useState(""); const [tMet, setTMeta] = useState(""); const [nConc, setNConc] = useState("");
    const [idxEd, setIdxEd] = useState(null); const [valEd, setValEd] = useState(""); const [subiendo, setSubiendo] = useState(null);

    useEffect(() => { setTInt(configActual.intendente); setTList(configActual.lista); setTMetInt(configActual.meta_intendente); setTMeta(configActual.meta_concejales); setIdxEd(null); }, [distritoGlobal, configuracionDepartamental]); // eslint-disable-line react-hooks/exhaustive-deps

    const guardarDistrito = () => { set(ref(db, `configuracion/${distritoGlobal}`), { ...dataBruta, intendente: tInt.toUpperCase() || "NO CONFIGURADO", lista: tLis, meta_intendente: parseInt(tMetInt) || 5000, meta_concejales: parseInt(tMet) || 500, concejales: configActual.concejales }); alert(`✅ Guardado.`); };
    const subirFoto = async (e, n) => { const f = e.target.files[0]; if(!f) return; setSubiendo(n); try { const r = storageRef(storage, `fotos/${n.replace(/[^a-zA-Z0-9]/g, '_')}`); await uploadBytes(r, f); await set(ref(db, `concejales_fotos/${n}`), await getDownloadURL(r)); alert("✅ Foto lista."); } catch(err) { alert(err.message); } setSubiendo(null); };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-xl border-t-8 border-red-700 space-y-6">
            <h2 className="text-2xl font-black border-b pb-4"><Settings className="inline mr-2 text-red-600"/>AJUSTES: {distritoGlobal}</h2>
            {esMaster && <select className="w-full p-4 border-2 rounded-xl font-black text-lg" value={distritoGlobal} onChange={e=>setDistritoGlobal(e.target.value)}>{DISTRITOS_CANINDEYU.map(d=><option key={d}>{d}</option>)}</select>}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-red-50 p-6 rounded-2xl">
                <div className="col-span-full md:col-span-2"><label className="text-xs font-bold text-red-700">INTENDENTE</label><input className="w-full p-3 border rounded font-black uppercase" value={tInt} onChange={e=>setTInt(e.target.value)}/></div>
                <div className="col-span-1"><label className="text-xs font-bold text-red-700">LISTA</label><input className="w-full p-3 border rounded font-black" value={tLis} onChange={e=>setTList(e.target.value)}/></div>
                <div className="col-span-1"><label className="text-xs font-bold text-red-700">META INTENDENTE</label><input type="number" className="w-full p-3 border rounded font-black border-red-400" value={tMetInt} onChange={e=>setTMetInt(e.target.value)}/></div>
                <div className="col-span-full md:col-span-2"><label className="text-xs font-bold text-red-700">META INDIVIDUAL CONCEJAL</label><input type="number" className="w-full p-3 border rounded font-black" value={tMet} onChange={e=>setTMeta(e.target.value)}/></div>
                <button onClick={guardarDistrito} className="col-span-full md:col-span-2 bg-red-700 text-white py-3 rounded-xl font-black mt-4 md:mt-0">GUARDAR DATOS</button>
            </div>
            <div className="bg-slate-50 p-6 rounded-2xl border"><h3 className="font-black mb-4">CONCEJALES (EQUIPOS)</h3><div className="flex gap-2 mb-6"><input type="text" placeholder="LETRA (Ej: 2F)" id="inSub" className="w-1/4 p-3 border rounded uppercase font-bold"/><input type="text" placeholder="NOMBRE..." value={nConc} onChange={e=>setNConc(e.target.value)} className="flex-1 p-3 border rounded uppercase font-bold"/><button onClick={()=>{const s=document.getElementById('inSub').value.trim().toUpperCase(); if(!nConc)return; const f=s?`${s} - ${nConc.toUpperCase()}`:nConc.toUpperCase(); set(ref(db, `configuracion/${distritoGlobal}/concejales`), [...configActual.concejales, f]); setNConc(""); document.getElementById('inSub').value="";}} className="bg-slate-800 text-white px-6 rounded font-bold">AÑADIR</button></div>
                <div className="space-y-6">{Object.entries(configActual.concejales.reduce((acc,c,idx)=>{const p=c.split(' - ');const g=p.length>1?`LISTA ${p[0]}`:'SIN EQUIPO';if(!acc[g])acc[g]=[];acc[g].push({n:c,idx});return acc;},{})).map(([g,m])=>(<div key={g} className="bg-white p-4 rounded-xl border"><h4 className="font-black text-red-600 mb-3 border-b">{g}</h4><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{m.map(i=>(<div key={i.idx} className="bg-slate-50 p-2 rounded border flex justify-between items-center">{idxEd===i.idx?(<div className="flex gap-2 w-full"><input className="flex-1 border p-1 text-xs uppercase" value={valEd} onChange={e=>setValEd(e.target.value)} autoFocus/><button onClick={()=>{const l=[...configActual.concejales];l[i.idx]=valEd.toUpperCase();set(ref(db,`configuracion/${distritoGlobal}/concejales`),l);setIdxEd(null);}} className="bg-green-500 text-white p-1 rounded"><Save size={14}/></button></div>):(<><span className="font-black text-xs uppercase truncate mr-2">{i.n.includes(' - ')?i.n.split(' - ')[1]:i.n}</span><div className="flex gap-2 shrink-0 items-center"><label className="cursor-pointer text-emerald-600">{subiendo===i.n?<RefreshCw size={14} className="animate-spin"/>:<Camera size={14}/>}<input type="file" accept="image/*" className="hidden" onChange={e=>subirFoto(e,i.n)}/></label><button onClick={()=>{setIdxEd(i.idx);setValEd(i.n);}} className="text-blue-500"><Edit2 size={14}/></button><button onClick={()=>{if(window.confirm("¿Borrar?")){const l=[...configActual.concejales];l.splice(i.idx,1);set(ref(db,`configuracion/${distritoGlobal}/concejales`),l);}}} className="text-red-500"><Trash2 size={14}/></button></div></>)}</div>))}</div></div>))}</div>
            </div>
            {esMaster && <button onClick={()=>{if(window.confirm("¿Restablecer todo a cero?")) { const nc={}; DISTRITOS_CANINDEYU.forEach(d=>{nc[d]={intendente:"",lista:"",meta_intendente:5000,meta_concejales:500,concejales:[]}}); set(ref(db,'configuracion'),nc); alert("Restablecido");}}} className="w-full bg-red-100 text-red-800 py-3 rounded-xl font-black mt-8">⚠️ RESTABLECER DEPARTAMENTO A FÁBRICA</button>}
        </div>
    );
}

// ==============================================================================================
// 3. APPS POR ROL (VEEDOR, CONCEJAL, DIRIGENTE)
// ==============================================================================================
function AppVeedor({ padronGlobal, yaVotaronGlobal, mesasCerradas, asignacionesVeedores, escrutinioGlobal, configApp, auth, db }) {
    const [vs, setVs] = useState(null); 
    const [ciIn, setCiIn] = useState(""); 
    const [fMesa, setFMesa] = useState(""); 
    
    const [fEsc, setFEsc] = useState({ 
        intendente: "", 
        concejales: {}, 
        rivalesIntendente: [], 
        rivalesConcejales: [], 
        blancos: "", 
        nulos: "" 
    }); 
    const [mEdEsc, setMEdEsc] = useState(false);
    
    useEffect(() => { const g = localStorage.getItem('veedor_bemo_sesion'); if (g) { const p = JSON.parse(g); setVs(p); set(ref(db, `dia_d/veedores_online/${p.ci}`), true); } }, [db]);
    
    const llMA = vs ? generarLlaveMesa(vs.distrito, vs.mesa) : null; 
    const isC = llMA && mesasCerradas[llMA]; 
    const miEsc = llMA ? escrutinioGlobal[llMA] : null;
    
    useEffect(() => { 
        if(miEsc && !mEdEsc) {
            setFEsc({
                intendente: miEsc.intendente || "",
                concejales: miEsc.concejales || {},
                rivalesIntendente: miEsc.rivalesIntendente || [],
                rivalesConcejales: miEsc.rivalesConcejales || [],
                blancos: miEsc.blancos || "",
                nulos: miEsc.nulos || ""
            });
        } else if(!miEsc && isC) { 
            const ic={}; 
            (configApp.concejales||[]).forEach(c=>ic[c]=""); 
            setFEsc({ intendente: "", concejales: ic, rivalesIntendente: [], rivalesConcejales: [], blancos: "", nulos: "" }); 
            setMEdEsc(true); 
        } 
    }, [miEsc, isC, configApp, mEdEsc]);

    const padronMesa = useMemo(()=>Object.entries(padronGlobal||{}).map(([ci,d])=>({ci,...d})).filter(p=>vs && String(p.mesa)===String(vs.mesa) && p.distrito===vs.distrito).sort((a,b)=>a.orden-b.orden), [padronGlobal, vs]);

    return (
        <div className="min-h-screen pb-20 bg-slate-50">
          <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-xl border-b-4 border-red-600"><div className="flex items-center gap-3"><span className="bg-red-700 px-2 rounded font-black">BEMO</span><div><h1 className="text-sm font-bold uppercase truncate">{configApp.intendente||"S/D"}</h1><p className="text-[10px] text-gray-400 font-bold uppercase">MESA: {vs?.mesa||'-'}</p></div></div><button onClick={()=>{localStorage.removeItem('veedor_bemo_sesion'); signOut(auth);}} className="text-[10px] bg-red-600 px-3 py-1.5 rounded-full font-black">SALIR</button></header>
          
          {!vs ? (
            <div className="p-6 max-w-md mx-auto mt-10 bg-white rounded-3xl shadow-xl"><h2 className="text-xl font-black mb-4 text-center">CÉDULA VEEDOR</h2><input type="number" className="w-full p-4 border-2 rounded-xl text-center text-xl font-black mb-4" value={ciIn} onChange={e=>setCiIn(e.target.value)} /><button onClick={()=>{const a=Object.values(asignacionesVeedores||{}).find(x=>String(x.ci)===String(ciIn)); if(a){setVs(a); localStorage.setItem('veedor_bemo_sesion',JSON.stringify(a)); set(ref(db,`dia_d/veedores_online/${a.ci}`),true);} else alert("No asignado.");}} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black">ENTRAR</button></div>
          ) : (
            <main className="p-2 max-w-4xl mx-auto mt-2">
              <div className="bg-white p-4 rounded-2xl shadow mb-4 border-l-8 border-green-500 flex justify-between items-center"><div><h2 className="font-black text-xl leading-none uppercase">MESA {vs.mesa}</h2><p className="text-[10px] font-black text-gray-500 mt-1 uppercase">{vs.nombre}</p></div>{isC && <button onClick={()=>{if(window.confirm("¿Reabrir?")) {remove(ref(db, `dia_d/mesas_cerradas/${llMA}`)); setMEdEsc(false);}}} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-black"><Unlock size={12} className="inline mr-1"/>REABRIR</button>}</div>
              
              {!isC ? (
                  <>
                      <div className="bg-white p-3 rounded-xl shadow mb-2"><input type="number" placeholder="BUSCAR ORDEN/C.I..." className="w-full p-2 font-black outline-none text-center" value={fMesa} onChange={e=>setFMesa(e.target.value)} /></div>
                      <div className="bg-white rounded-xl shadow overflow-hidden mb-6"><table className="w-full text-left"><thead className="bg-slate-800 text-white text-[10px] uppercase"><tr><th className="p-3 text-center">Ord</th><th className="p-3">Votante</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y">{padronMesa.filter(v=>v.ci.includes(fMesa)||v.orden.toString().includes(fMesa)).map(v => { const llV = generarLlave(vs.distrito, vs.mesa, v.orden); const vot = yaVotaronGlobal[llV]; return (<tr key={v.ci} className={vot?'bg-green-50':''}><td className="p-3 text-center font-black text-slate-400">{v.orden}</td><td className="p-3 leading-tight"><div className="font-black text-sm">{v.nombre} {v.apellido}</div><div className="text-[9px] text-gray-500 font-bold">C.I: {v.ci}</div></td><td className="p-3"><button onClick={()=>{set(ref(db, `dia_d/votos_efectuados/${llV}`), vot?null:{hora:new Date().toLocaleTimeString(), timestamp:Date.now(), veedor:vs.nombre});}} className={`w-full py-2 rounded font-black text-[10px] border-2 ${vot?'bg-green-500 border-green-600 text-white':'border-slate-300 text-slate-500'}`}>{vot?'VOTÓ':'PINTAR'}</button></td></tr>); })}</tbody></table></div>
                      <button onClick={()=>{if(window.confirm("¿Cerrar Escrutinio?")){set(ref(db, `dia_d/mesas_cerradas/${llMA}`),{hora:new Date().toLocaleTimeString(), cerradoPor:vs.nombre}); setMEdEsc(true);}}} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-2xl flex justify-center gap-2"><Lock/> CERRAR MESA</button>
                  </>
              ) : (
                  <div className="bg-white rounded-3xl shadow-xl p-4 md:p-6 border-t-8 border-slate-900">
                      <div className="text-center mb-6"><ClipboardList size={32} className="mx-auto text-blue-600 mb-2"/><h2 className="text-xl font-black uppercase">ACTA FINAL MESA {vs.mesa}</h2></div>
                      
                      <h3 className="font-black text-slate-800 border-b-2 border-slate-200 pb-2 mb-4">NUESTRO EQUIPO</h3>
                      <div className="bg-red-50 p-4 rounded-xl mb-4">
                          <h4 className="font-black text-xs text-red-900 mb-2 uppercase">INTENDENTE: {configApp.intendente}</h4>
                          <input type="number" placeholder="0" className="w-full p-3 text-2xl font-black text-center rounded border outline-none focus:border-red-500" value={fEsc.intendente||""} onChange={e=>setFEsc({...fEsc, intendente:e.target.value})} />
                      </div>
                      <div className="space-y-2 mb-8">
                          <h4 className="font-black text-xs text-slate-500 mb-2">NUESTROS CONCEJALES</h4>
                          {(configApp.concejales||[]).filter(c=>c!=="SIN ASIGNAR").map(c=>(
                              <div key={c} className="flex justify-between items-center bg-slate-50 p-3 rounded border">
                                  <span className="font-black text-[10px] uppercase truncate w-2/3">{c.includes('-')?c.split('-')[1]:c}</span>
                                  <input type="number" placeholder="Votos" className="w-1/3 p-2 font-black text-center rounded border outline-none" value={fEsc.concejales?.[c]||""} onChange={e=>setFEsc({...fEsc, concejales:{...fEsc.concejales, [c]:e.target.value}})} />
                              </div>
                          ))}
                      </div>

                      <h3 className="font-black text-slate-800 border-b-2 border-slate-200 pb-2 mb-4">OTROS CANDIDATOS (RIVALES)</h3>
                      
                      <div className="mb-6 bg-slate-50 p-4 rounded-xl border">
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="font-black text-xs text-slate-500">INTENDENTES RIVALES</h4>
                              <button onClick={() => setFEsc({...fEsc, rivalesIntendente: [...(fEsc.rivalesIntendente||[]), {nombre:"", votos:""}]})} className="text-[10px] bg-slate-800 text-white px-3 py-1 rounded font-bold">+ AÑADIR</button>
                          </div>
                          {(fEsc.rivalesIntendente||[]).map((r, i) => (
                              <div key={i} className="flex gap-2 mb-2 animate-fade-in">
                                  <input type="text" placeholder="Nombre/Lista..." className="flex-1 p-2 border rounded text-xs font-bold uppercase outline-none" value={r.nombre} onChange={e => { const n = [...fEsc.rivalesIntendente]; n[i].nombre = e.target.value; setFEsc({...fEsc, rivalesIntendente: n}); }} />
                                  <input type="number" placeholder="Votos" className="w-20 p-2 border rounded text-xs font-black text-center outline-none" value={r.votos} onChange={e => { const n = [...fEsc.rivalesIntendente]; n[i].votos = e.target.value; setFEsc({...fEsc, rivalesIntendente: n}); }} />
                                  <button onClick={() => { const n = [...fEsc.rivalesIntendente]; n.splice(i, 1); setFEsc({...fEsc, rivalesIntendente: n}); }} className="bg-red-100 text-red-600 px-3 rounded font-black hover:bg-red-200">X</button>
                              </div>
                          ))}
                          {(fEsc.rivalesIntendente||[]).length === 0 && <p className="text-[10px] text-gray-400 font-bold">Haz clic en + AÑADIR si hay votos para otros intendentes.</p>}
                      </div>

                      <div className="mb-8 bg-slate-50 p-4 rounded-xl border">
                          <div className="flex justify-between items-center mb-3">
                              <h4 className="font-black text-xs text-slate-500">CONCEJALES RIVALES</h4>
                              <button onClick={() => setFEsc({...fEsc, rivalesConcejales: [...(fEsc.rivalesConcejales||[]), {nombre:"", votos:""}]})} className="text-[10px] bg-slate-800 text-white px-3 py-1 rounded font-bold">+ AÑADIR</button>
                          </div>
                          {(fEsc.rivalesConcejales||[]).map((r, i) => (
                              <div key={i} className="flex gap-2 mb-2 animate-fade-in">
                                  <input type="text" placeholder="Nombre/Lista..." className="flex-1 p-2 border rounded text-xs font-bold uppercase outline-none" value={r.nombre} onChange={e => { const n = [...fEsc.rivalesConcejales]; n[i].nombre = e.target.value; setFEsc({...fEsc, rivalesConcejales: n}); }} />
                                  <input type="number" placeholder="Votos" className="w-20 p-2 border rounded text-xs font-black text-center outline-none" value={r.votos} onChange={e => { const n = [...fEsc.rivalesConcejales]; n[i].votos = e.target.value; setFEsc({...fEsc, rivalesConcejales: n}); }} />
                                  <button onClick={() => { const n = [...fEsc.rivalesConcejales]; n.splice(i, 1); setFEsc({...fEsc, rivalesConcejales: n}); }} className="bg-red-100 text-red-600 px-3 rounded font-black hover:bg-red-200">X</button>
                              </div>
                          ))}
                          {(fEsc.rivalesConcejales||[]).length === 0 && <p className="text-[10px] text-gray-400 font-bold">Haz clic en + AÑADIR si hay votos para otras listas de concejales.</p>}
                      </div>

                      <h3 className="font-black text-slate-800 border-b-2 border-slate-200 pb-2 mb-4">VOTOS NULOS Y BLANCOS</h3>
                      <div className="grid grid-cols-2 gap-4 mb-8">
                          <div className="bg-gray-100 p-3 rounded-xl border">
                              <label className="text-[10px] font-bold text-gray-500 block mb-1">VOTOS BLANCOS</label>
                              <input type="number" placeholder="0" className="w-full p-2 border rounded-lg text-center font-black outline-none focus:border-gray-400" value={fEsc.blancos||""} onChange={e=>setFEsc({...fEsc, blancos: e.target.value})} />
                          </div>
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                              <label className="text-[10px] font-bold text-red-400 block mb-1">VOTOS NULOS</label>
                              <input type="number" placeholder="0" className="w-full p-2 border border-red-200 rounded-lg text-center font-black outline-none focus:border-red-400 text-red-600" value={fEsc.nulos||""} onChange={e=>setFEsc({...fEsc, nulos: e.target.value})} />
                          </div>
                      </div>

                      <button onClick={()=>{set(ref(db, `dia_d/escrutinio/${llMA}`), fEsc); alert("Acta Final Guardada en el Sistema."); setMEdEsc(false);}} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-5 rounded-xl font-black shadow-lg text-lg">GUARDAR ACTA COMPLETA</button>
                  </div>
              )}
            </main>
          )}
        </div>
    );
}

function AppDirigente({ padronGlobal, yaVotaronGlobal, pasoPCGlobal, configApp, auth, db }) {
    const [b, setB] = useState(""); 
    const [res, setRes] = useState(null);

    const marcarPasoPC = (llave, pcData) => {
        if (pcData) {
            remove(ref(db, `dia_d/paso_pc_checkins/${llave}`));
            setRes({...res, pc: null});
        } else {
            const newData = { 
                hora: new Date().toLocaleTimeString(), 
                timestamp: Date.now(),
                registradoPorNombre: auth.currentUser?.email || "DIRIGENTE" 
            };
            set(ref(db, `dia_d/paso_pc_checkins/${llave}`), newData);
            setRes({...res, pc: newData});
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <header className="bg-green-800 text-white p-4 flex justify-between items-center shadow-xl border-b-4 border-green-500"><div className="flex items-center gap-3"><span className="bg-green-600 px-2 rounded font-black">BEMO</span><div><h1 className="text-sm font-bold uppercase">DIRIGENTE BASE</h1></div></div><button onClick={()=>signOut(auth)} className="bg-green-900 p-2 rounded-full"><LogOut size={16}/></button></header>
            <main className="max-w-2xl mx-auto p-4 mt-10"><div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-green-500"><h2 className="font-black text-xl mb-4 text-slate-800"><Search className="inline text-green-600 mr-2"/>CONSULTA DÍA D</h2><div className="flex gap-2 mb-6"><input type="number" placeholder="N° Cédula..." className="flex-1 p-4 border-2 rounded-xl font-bold outline-none" value={b} onChange={e=>setB(e.target.value)} /><button onClick={()=>{const p=padronGlobal[b]; if(p)setRes({...p, v:yaVotaronGlobal[generarLlave(p.distrito,p.mesa,p.orden)], pc:pasoPCGlobal[generarLlave(p.distrito,p.mesa,p.orden)]}); else setRes("NO");}} className="bg-green-600 text-white px-6 rounded-xl font-bold"><Search/></button></div>{res==="NO" && <div className="p-4 bg-red-50 text-red-600 font-bold text-center rounded-xl">No encontrada.</div>}{res && res!=="NO" && (<div className="border-2 border-slate-200 rounded-xl p-6"><div className="text-2xl font-black">{res.nombre} {res.apellido}</div><div className="text-sm font-bold text-gray-500 mb-6">C.I: {b} | {res.distrito}</div><div className="grid grid-cols-2 gap-4 mb-6"><div className="bg-slate-50 border p-3 rounded-lg text-center"><div className="text-[10px] font-bold text-gray-500">MESA</div><div className="text-2xl font-black">{res.mesa}</div></div><div className="bg-slate-50 border p-3 rounded-lg text-center"><div className="text-[10px] font-bold text-gray-500">ORDEN</div><div className="text-2xl font-black">{res.orden}</div></div></div><div className="mt-4 border-t pt-4">
                <button onClick={() => marcarPasoPC(generarLlave(res.distrito, res.mesa, res.orden), res.pc)} className={`w-full py-4 rounded-xl font-black text-sm transition-all duration-300 border-2 flex items-center justify-center gap-2 shadow-sm ${res.pc ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
                    {res.pc ? <>📍 YA PASÓ POR PC ({res.pc.hora})</> : <>⏳ MARCAR "PASÓ POR PC"</>}
                </button>
            </div>{res.v ? <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-black text-xl mt-4">✅ YA VOTÓ ({res.v.hora})</div> : <div className="bg-gray-100 text-gray-500 p-4 rounded-xl text-center font-black text-xl mt-4">⏳ AÚN NO VOTÓ</div>}</div>)}</div></main>
        </div>
    );
}

function AppConcejal({ perfil, padronGlobal, votosSeguros, yaVotaronGlobal, pasoPCGlobal, escrutinioGlobal, fotosConcejales, configApp, auth, db, usuarioActivo }) {
    const [tab, setTab] = useState("registro"); 
    const [menuAbierto, setMenuAbierto] = useState(false);
    
    const [bNom, setBNom] = useState(""); 
    const [resNom, setResNom] = useState([]); 
    const [form, setForm] = useState({ cedula:"", nombre:"", apellido:"", telefono:"", distrito:perfil.distrito, local:"", mesa:"", orden:"", concejal:perfil.nombre_oficial||"", coordinador:"", semaforo:"VERDE" });
    const [formDirigente, setFormDirigente] = useState({ cedula: "", nombre: "" });

    const [bDiaD, setBDiaD] = useState(""); 
    const [resDiaD, setResDiaD] = useState(null);

    const miNom = perfil.nombre_oficial||""; 
    const misV = votosSeguros.filter(v=>v.concejal===miNom && v.distrito===perfil.distrito); 
    const [lim, setLim] = useState(50);
    const mCoor = [...new Set(misV.map(v=>v.coordinador).filter(c=>c))]; 
    const [fC, setFC] = useState("TODOS"); 
    const [fS, setFS] = useState("TODOS"); 
    const [mNC, setMNC] = useState(false);

    const padronLlaves = useMemo(() => { const map = {}; Object.entries(padronGlobal || {}).forEach(([ci, p]) => { map[generarLlave(p.distrito, p.mesa, p.orden)] = { ci, ...p }; }); return map; }, [padronGlobal]);
    const yaVotaronFiltrados = useMemo(() => {
        const o = {}; Object.keys(yaVotaronGlobal||{}).forEach(k => { if(k.startsWith(perfil.distrito)) o[k] = yaVotaronGlobal[k]; }); return o;
    }, [yaVotaronGlobal, perfil.distrito]);
    const ultimosVotosFeed = useMemo(() => { return Object.entries(yaVotaronFiltrados || {}).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).slice(0, 12).map(([llave, data]) => ({ llave, data, elector: padronLlaves[llave] })); }, [yaVotaronFiltrados, padronLlaves]);
    
    const marcarPasoPCConcejal = (llave, pcData) => {
        if (pcData) {
            remove(ref(db, `dia_d/paso_pc_checkins/${llave}`));
            setResDiaD({...resDiaD, pc: null});
        } else {
            const nombreConcejalCorto = miNom.includes('-') ? miNom.split('-')[1].trim() : miNom;
            const newData = { 
                hora: new Date().toLocaleTimeString(), 
                timestamp: Date.now(),
                registradoPorNombre: `CONCEJAL ${nombreConcejalCorto}` 
            };
            set(ref(db, `dia_d/paso_pc_checkins/${llave}`), newData);
            setResDiaD({...resDiaD, pc: newData});
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            <header className="bg-gradient-to-r from-red-700 to-red-900 text-white p-4 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <span className="bg-white text-red-800 px-2 rounded font-black">BEMO</span>
                    <div>
                        <h1 className="text-sm font-bold uppercase">{configApp.intendente||"S/D"}</h1>
                        <p className="text-[10px] text-red-200 font-bold uppercase">CANDIDATO: {miNom.includes('-')?miNom.split('-')[1]:miNom} ({perfil.distrito})</p>
                    </div>
                </div>
                <button onClick={()=>signOut(auth)} className="bg-red-950 p-2 rounded-full"><LogOut size={16}/></button>
            </header>
            
            <div className="bg-white px-4 py-2 flex justify-center gap-4 text-xs font-black border-b shadow-sm relative z-40">
                <span className="text-slate-700 bg-slate-100 px-3 py-1 rounded-full">TOT: {misV.length}</span>
                <span className="text-green-700 bg-green-50 px-3 py-1 rounded-full">🟢 {misV.filter(v=>v.semaforo==='VERDE').length}</span>
            </div>

            <div className="bg-white flex border-b shadow-sm sticky top-[68px] z-50 print:hidden px-2 items-center justify-center w-full">
                <div className="flex items-center max-w-full pt-2 pb-2">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pr-2">
                        <button onClick={() => {setTab("registro"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${tab === 'registro' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}><CheckCircle size={16}/> REGISTRO</button>
                        <button onClick={() => {setTab("lista"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${tab === 'lista' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}><Users size={16}/> LISTA</button>
                        <button onClick={() => {setTab("dia_d_buscador"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${tab === 'dia_d_buscador' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100'}`}><Search size={16}/> DÍA D BUSCADOR</button>
                    </div>

                    <div className="relative shrink-0 border-l border-slate-200 pl-2">
                        <button onClick={() => setMenuAbierto(!menuAbierto)} className={`p-2 px-3 font-black text-[11px] flex gap-1 items-center rounded-lg transition-colors ${menuAbierto ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}>
                            MÁS OPCIONES <ChevronDown size={14} className={`transition-transform duration-200 ${menuAbierto ? 'rotate-180' : ''}`}/>
                        </button>
                        {menuAbierto && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-xl z-[100] overflow-hidden flex flex-col border border-slate-200 animate-fade-in py-1">
                                <button onClick={() => {setTab("proyecciones"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 ${tab === 'proyecciones' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <BarChart3 size={16} className={tab === 'proyecciones' ? "text-red-500" : "text-slate-400"}/> PROYECCIONES
                                </button>
                                <button onClick={() => {setTab("live"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 ${tab === 'live' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Bell size={16} className={tab === 'live' ? "text-red-500" : "text-slate-400"}/> LIVE
                                </button>
                                <button onClick={() => {setTab("dirigentes"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 border-t border-slate-100 ${tab === 'dirigentes' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <UserPlus size={16} className={tab === 'dirigentes' ? "text-red-500" : "text-slate-400"}/> MIS DIRIGENTES
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <main className="max-w-5xl mx-auto p-4 md:p-6">
                {tab === "registro" && (
                    <div className="bg-white p-6 rounded-2xl shadow border-t-4 border-t-red-600 animate-fade-in">
                        <div className="bg-slate-50 p-4 rounded-xl mb-6"><label className="text-xs font-bold text-gray-500 mb-2 block">BUSCAR NOMBRE</label><div className="flex gap-2"><input type="text" className="flex-1 p-3 border rounded-xl font-bold uppercase" value={bNom} onChange={e=>setBNom(e.target.value)} onKeyDown={e=>e.key==='Enter'&&setResNom(Object.values(padronGlobal).filter(p=>p.distrito===perfil.distrito&&(p.nombre+" "+p.apellido).toLowerCase().includes(bNom.toLowerCase())).slice(0,20))} /><button onClick={()=>setResNom(Object.values(padronGlobal).filter(p=>p.distrito===perfil.distrito&&(p.nombre+" "+p.apellido).toLowerCase().includes(bNom.toLowerCase())).slice(0,20))} className="bg-slate-300 px-6 rounded-xl font-bold"><Search size={18}/></button></div>{resNom.length>0 && <div className="mt-2 bg-white border rounded-xl max-h-48 overflow-y-auto">{resNom.map(r=><div key={r.ci} onClick={()=>{setForm({...form, cedula:r.ci, nombre:r.nombre, apellido:r.apellido, local:r.local, mesa:r.mesa, orden:r.orden}); setResNom([]); setBNom("");}} className="p-3 border-b hover:bg-red-50 cursor-pointer text-sm font-black">{r.nombre} {r.apellido} <span className="text-xs text-gray-400 font-bold ml-2">C.I: {r.ci}</span></div>)}</div>}</div>
                        <div className="flex gap-2 mb-4"><input type="number" placeholder="CÉDULA" className="flex-1 p-4 border-2 rounded-xl font-bold text-xl" value={form.cedula} onChange={e=>setForm({...form, cedula:e.target.value})} /><button onClick={()=>{const p=padronGlobal[form.cedula]; if(p)setForm(f=>({...f, nombre:p.nombre, apellido:p.apellido, local:p.local, mesa:p.mesa, orden:p.orden})); else alert("No encontrada");}} className="bg-red-700 text-white px-6 rounded-xl font-bold"><Search/></button></div>
                        <div className="grid grid-cols-2 gap-4 mb-4"><input readOnly className="p-3 border rounded bg-gray-50 font-bold" value={form.nombre} placeholder="Nombres"/><input readOnly className="p-3 border rounded bg-gray-50 font-bold" value={form.apellido} placeholder="Apellidos"/></div>
                        <input placeholder="TELÉFONO" className="w-full p-3 border-2 rounded-lg font-bold mb-4" value={form.telefono} onChange={e=>setForm({...form, telefono:e.target.value})}/>
                        <div className="grid grid-cols-3 gap-2 mb-4"><input readOnly className="p-3 border bg-gray-50 text-xs" value={form.local} placeholder="Local"/><input readOnly className="p-3 border bg-gray-50 font-bold" value={form.mesa?`Mesa ${form.mesa}`:'Mesa'}/><input readOnly className="p-3 border-2 border-red-100 bg-red-50 text-red-600 font-black" value={form.orden?`Ord ${form.orden}`:'Orden'}/></div>
                        <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-gray-400 block mb-1">COORDINADOR</label><div className="flex gap-2">{mNC ? <><input className="flex-1 p-3 border-2 rounded font-bold uppercase" placeholder="NUEVO..." value={form.coordinador} onChange={e=>setForm({...form, coordinador:e.target.value.toUpperCase()})}/><button onClick={()=>setMNC(false)} className="bg-red-100 text-red-700 px-3 rounded font-black">X</button></> : <><select className="flex-1 p-3 border-2 rounded font-bold" value={form.coordinador} onChange={e=>setForm({...form, coordinador:e.target.value})}><option value="">Selec...</option>{mCoor.map(c=><option key={c}>{c}</option>)}</select><button onClick={()=>setMNC(true)} className="bg-slate-200 px-3 rounded font-black">+</button></>}</div></div><div><label className="text-[10px] font-bold text-gray-400 block mb-1">COLOR</label><select className="w-full p-3 rounded font-black text-white bg-slate-800" style={{backgroundColor: form.semaforo==='VERDE'?'#22c55e':form.semaforo==='AMARILLO'?'#eab308':'#ef4444'}} value={form.semaforo} onChange={e=>setForm({...form, semaforo:e.target.value})}><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select></div></div>
                        <button onClick={()=>{ import('firebase/database').then(({ push, ref }) => { if(!form.cedula||!form.nombre)return alert("Datos incompletos"); if(misV.find(v=>v.cedula===form.cedula))return alert("Ya registrado"); const d={...form, registradoPor:usuarioActivo.email, fecha:new Date().toLocaleString()}; push(ref(db,'votos_seguros'), d); alert("Guardado correctamente"); setForm(f=>({...f, cedula:"", nombre:"", apellido:"", local:"", mesa:"", orden:""})); setMNC(false); }); }} className="w-full mt-6 bg-red-700 text-white py-4 rounded-xl font-black shadow-lg">GUARDAR REGISTRO</button>
                    </div>
                )}

                {tab === "lista" && (
                    <div className="bg-white p-4 rounded-2xl shadow border overflow-x-auto animate-fade-in">
                        <div className="flex gap-4 mb-4"><select className="p-2 border rounded font-bold text-xs flex-1" value={fC} onChange={e=>{setFC(e.target.value);setLim(50);}}><option value="TODOS">COORD: TODOS</option>{mCoor.map(c=><option key={c}>{c}</option>)}</select><select className="p-2 border rounded font-bold text-xs flex-1" value={fS} onChange={e=>{setFS(e.target.value);setLim(50);}}><option value="TODOS">COLOR: TODOS</option><option value="VERDE">VERDE</option><option value="AMARILLO">AMARILLO</option><option value="ROJO">ROJO</option></select></div>
                        <table className="w-full text-left min-w-[600px]"><thead className="bg-red-50 text-red-900 text-[10px] uppercase"><tr><th className="p-3">Elector</th><th className="p-3">Día D</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y text-sm">
                            {misV.filter(v=>(fC==="TODOS"||v.coordinador===fC)&&(fS==="TODOS"||v.semaforo===fS)).slice(0,lim).map(v=>{ const vot=yaVotaronGlobal[generarLlave(v.distrito,v.mesa,v.orden)]; return <tr key={v.id}><td className="p-3 font-bold">{v.nombre} {v.apellido}<br/><span className="text-xs text-gray-500">M:{v.mesa} | C.I:{v.cedula}</span></td><td className="p-3">{vot?<span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {vot.hora}</span>:'-'}</td><td className="p-3 text-center"><button onClick={()=>imprimirCarnetFisico(v, FOTOS_LOCALES_CONCEJALES[v.concejal])} className="bg-slate-800 text-white p-2 rounded-full"><Printer size={14}/></button></td></tr>})}
                        </tbody></table>{misV.length>lim && <button onClick={()=>setLim(l=>l+50)} className="w-full p-4 bg-slate-100 font-bold text-slate-600 mt-4 rounded-xl">Cargar más...</button>}
                    </div>
                )}

                {tab === "dia_d_buscador" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-red-600">
                            <h2 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><Search className="text-red-600"/> BUSCADOR RÁPIDO DÍA D</h2>
                            <p className="text-xs text-slate-500 font-bold mb-4">Ingresa el número de cédula de cualquier elector para consultar su estado o marcar su paso por PC.</p>
                            <div className="flex gap-2 mb-6">
                                <input type="number" placeholder="N° Cédula..." className="flex-1 p-4 border-2 rounded-xl font-bold outline-none focus:border-red-500" value={bDiaD} onChange={e=>setBDiaD(e.target.value)} />
                                <button onClick={()=>{
                                    const p = padronGlobal[bDiaD]; 
                                    if(p) setResDiaD({...p, v:yaVotaronGlobal[generarLlave(p.distrito,p.mesa,p.orden)], pc:pasoPCGlobal[generarLlave(p.distrito,p.mesa,p.orden)]}); 
                                    else setResDiaD("NO");
                                }} className="bg-red-700 hover:bg-red-800 text-white px-6 rounded-xl font-bold transition-colors"><Search/></button>
                            </div>
                            
                            {resDiaD === "NO" && <div className="p-4 bg-red-50 text-red-600 font-bold text-center rounded-xl border border-red-200">❌ Cédula no encontrada en el padrón.</div>}
                            
                            {resDiaD && resDiaD !== "NO" && (
                                <div className="border-2 border-slate-200 rounded-xl p-6 bg-slate-50">
                                    <div className="text-2xl font-black text-slate-800">{resDiaD.nombre} {resDiaD.apellido}</div>
                                    <div className="text-sm font-bold text-gray-500 mb-6">C.I: {bDiaD} | {resDiaD.distrito}</div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-white border shadow-sm p-3 rounded-xl text-center">
                                            <div className="text-[10px] font-bold text-gray-400">MESA</div>
                                            <div className="text-2xl font-black text-slate-700">{resDiaD.mesa}</div>
                                        </div>
                                        <div className="bg-white border shadow-sm p-3 rounded-xl text-center">
                                            <div className="text-[10px] font-bold text-gray-400">ORDEN</div>
                                            <div className="text-2xl font-black text-slate-700">{resDiaD.orden}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 border-t pt-4">
                                        <button onClick={() => marcarPasoPCConcejal(generarLlave(resDiaD.distrito, resDiaD.mesa, resDiaD.orden), resDiaD.pc)} className={`w-full py-4 rounded-xl font-black text-sm transition-all duration-300 border-2 flex items-center justify-center gap-2 shadow-sm ${resDiaD.pc ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
                                            {resDiaD.pc ? <>📍 YA PASÓ POR PC ({resDiaD.pc.hora})</> : <>⏳ MARCAR "PASÓ POR PC"</>}
                                        </button>
                                    </div>
                                    
                                    {resDiaD.v ? 
                                        <div className="bg-green-100 border border-green-300 text-green-800 p-4 rounded-xl text-center font-black text-xl mt-4">✅ YA VOTÓ ({resDiaD.v.hora})</div> 
                                    : 
                                        <div className="bg-white border-2 text-gray-400 p-4 rounded-xl text-center font-black text-xl mt-4">⏳ AÚN NO VOTÓ</div>
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === "proyecciones" && (
                    <div className="bg-white p-10 rounded-2xl shadow border-t-4 border-t-red-600 animate-fade-in text-center max-w-2xl mx-auto">
                        <BarChart3 size={64} className="mx-auto text-slate-300 mb-4"/>
                        <h2 className="text-2xl font-black text-slate-700">TUS PROYECCIONES</h2>
                        <p className="text-slate-500 mt-2 font-medium">Próximamente verás aquí tus métricas detalladas.</p>
                    </div>
                )}

                {tab === "live" && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl shadow border border-t-4 border-t-red-600">
                            <h2 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><Bell className="text-red-600"/> FEED EN VIVO ({perfil.distrito})</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {ultimosVotosFeed.map((item, idx) => {
                                    if (!item.elector) return null;
                                    return (
                                        <div key={idx} className="p-4 rounded-xl border bg-slate-50 flex flex-col justify-between shadow-sm">
                                            <div>
                                                <div className="font-black text-sm text-slate-800 uppercase truncate">{item.elector.nombre} {item.elector.apellido}</div>
                                                <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase">MESA: {item.elector.mesa} | VEEDOR: {item.data.veedor}</div>
                                            </div>
                                            <div className="text-right mt-3 pt-2 border-t"><div className="text-xs font-black text-green-600">✅ {item.data.hora}</div></div>
                                        </div>
                                    )
                                })}
                                {ultimosVotosFeed.length === 0 && <div className="col-span-full text-center text-gray-400 font-bold py-10 border-2 border-dashed rounded-xl">Aún no hay votos registrados en {perfil.distrito}.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "dirigentes" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                            <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><UserPlus className="text-red-600" /> AGREGAR DIRIGENTE</h2>
                            <div className="flex flex-col md:flex-row gap-3">
                                <input type="number" placeholder="N° de Cédula" className="w-full md:w-1/3 p-3 border-2 border-slate-200 rounded-xl font-bold outline-none" value={formDirigente.cedula} onChange={e=>setFormDirigente({...formDirigente, cedula: e.target.value})} />
                                <input type="text" placeholder="Nombre completo" className="w-full md:w-full p-3 border-2 border-slate-200 rounded-xl font-bold outline-none uppercase" value={formDirigente.nombre} onChange={e=>setFormDirigente({...formDirigente, nombre: e.target.value})} />
                                <button onClick={() => { 
                                    import('firebase/database').then(({ set, ref }) => {
                                        if(!formDirigente.cedula || !formDirigente.nombre) return alert("Faltan datos"); 
                                        const nodoDirigente = miNom.replace(/[^a-zA-Z0-9]/g, '_'); 
                                        set(ref(db, `dia_d/dirigentes_concejal/${nodoDirigente}/${formDirigente.cedula}`), { 
                                            nombre: formDirigente.nombre.toUpperCase(), 
                                            fechaAsignacion: new Date().toLocaleDateString() 
                                        }); 
                                        alert("Dirigente asignado"); 
                                        setFormDirigente({cedula: "", nombre: ""}); 
                                    });
                                }} className="bg-slate-900 text-white font-black px-6 py-3 rounded-xl hover:bg-slate-800 shrink-0">AÑADIR</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

// ==============================================================================================
// 4. APP SUPER ADMIN Y MASTER DEPARTAMENTAL
// ==============================================================================================
function AppSuperAdmin({ perfil, padronGlobal, votosSeguros, yaVotaronGlobal, mesasCerradas, asignacionesVeedores, veedoresOnline, escrutinioGlobal, fotosConcejales, pasoPCGlobal, configuracionDepartamental, usuariosRegistrados, usuariosOnline, db, usuarioActivo }) {
    
    const esMaster = perfil.rol === "master_departamental" || perfil.rol === "master_global";
    const [distritoFiltroMaster, setDistritoFiltroMaster] = useState(esMaster ? "TODOS" : perfil.distrito);
    const [activeTab, setActiveTab] = useState("registro");
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [concejalEnDetalle, setConcejalEnDetalle] = useState(null);
    const [mesaEnDetalle, setMesaEnDetalle] = useState(null);
    const [filtroTexto, setFiltroTexto] = useState(""); 
    
    const dataConfigBruta = distritoFiltroMaster === "TODOS" ? {} : (configuracionDepartamental[distritoFiltroMaster] || {});
    const configApp = { 
        intendente: typeof dataConfigBruta.intendente === 'string' ? dataConfigBruta.intendente : "NO CONFIGURADO", 
        lista: dataConfigBruta.lista || "0", 
        meta_intendente: dataConfigBruta.meta_intendente || 5000, 
        meta_concejales: dataConfigBruta.meta_concejales || 500, 
        concejales: Array.isArray(dataConfigBruta.concejales) ? dataConfigBruta.concejales : [] 
    };

    const votosFiltrados = useMemo(() => {
        return distritoFiltroMaster === "TODOS" 
            ? (votosSeguros || []) 
            : (votosSeguros || []).filter(v => v.distrito === distritoFiltroMaster);
    }, [votosSeguros, distritoFiltroMaster]);

    const yaVotaronFiltrados = useMemo(() => {
        if (distritoFiltroMaster === "TODOS") return yaVotaronGlobal || {};
        const o = {}; Object.keys(yaVotaronGlobal||{}).forEach(k => { if(k.startsWith(distritoFiltroMaster)) o[k] = yaVotaronGlobal[k]; }); return o;
    }, [yaVotaronGlobal, distritoFiltroMaster]);
    
    const pasoPCFiltrados = useMemo(() => {
        if (distritoFiltroMaster === "TODOS") return pasoPCGlobal || {};
        const o = {}; Object.keys(pasoPCGlobal||{}).forEach(k => { if(k.startsWith(distritoFiltroMaster)) o[k] = pasoPCGlobal[k]; }); return o;
    }, [pasoPCGlobal, distritoFiltroMaster]);

    const totalVotosSeguros = votosFiltrados.length;
    const yaVotaronSeguros = votosFiltrados.filter(v => yaVotaronFiltrados[generarLlave(v.distrito, v.mesa, v.orden)]).length;
    const verde = votosFiltrados.filter(v => v.semaforo === 'VERDE').length;
    const amarillo = votosFiltrados.filter(v => v.semaforo === 'AMARILLO').length;
    const rojo = votosFiltrados.filter(v => v.semaforo === 'ROJO').length;
    const totalVotosEmitidosDiaD = Object.keys(yaVotaronFiltrados || {}).length;
    const participacionIndependiente = totalVotosEmitidosDiaD - yaVotaronSeguros;

    const escrutinioDistrito = Object.entries(escrutinioGlobal || {}).filter(([k]) => k.startsWith(`${distritoFiltroMaster}_`));
    let totalIntendenteEscrutinio = 0;
    let totalConcejalesEscrutinio = 0;

    escrutinioDistrito.forEach(([_, acta]) => {
        totalIntendenteEscrutinio += parseInt(acta.intendente) || 0;
        Object.values(acta.concejales || {}).forEach(votos => {
            totalConcejalesEscrutinio += parseInt(votos) || 0;
        });
    });
    
    const diferenciaCruzado = totalIntendenteEscrutinio - totalConcejalesEscrutinio;
    const porcentajeSegurosIntendente = configApp.meta_intendente > 0 ? Math.round((totalVotosSeguros / configApp.meta_intendente) * 100) : 0;
    const porcentajeEfectividadEquipo = totalVotosSeguros > 0 ? Math.round((yaVotaronSeguros / totalVotosSeguros) * 100) : 0;

    const rankingPasoPC = {};
    Object.values(pasoPCFiltrados || {}).forEach(check => {
        const nom = check.registradoPorNombre || "DESCONOCIDO";
        rankingPasoPC[nom] = (rankingPasoPC[nom] || 0) + 1;
    });
    const topPasoPC = Object.entries(rankingPasoPC).sort((a,b) => b[1] - a[1]);
    const maxPC = topPasoPC.length > 0 ? topPasoPC[0][1] : 1;

    const [form, setForm] = useState({ cedula: "", nombre: "", apellido: "", telefono: "", distrito: distritoFiltroMaster, local: "", mesa: "", orden: "", concejal: "SIN ASIGNAR", coordinador: "", semaforo: "VERDE" });
    const [modoNuevoCoord, setModoNuevoCoord] = useState(false);
    
    const [limiteListaAdmin, setLimiteListaAdmin] = useState(100);
    const [limiteDetalleConcejal, setLimiteDetalleConcejal] = useState(100);

    const [busquedaNombre, setBusquedaNombre] = useState("");
    const [resultadosNombre, setResultadosNombre] = useState([]);

    const [filtroConcejal, setFiltroConcejal] = useState("TODOS");
    const [filtroCoordinadorAdmin, setFiltroCoordinadorAdmin] = useState("TODOS");
    const [filtroSemaforoAdmin, setFiltroSemaforoAdmin] = useState("TODOS");
    const [verListaPC, setVerListaPC] = useState(false);
    
    const coordinadoresUnicos = [...new Set(votosFiltrados.map(v => v.coordinador).filter(c => c && c.trim() !== ""))];
    
    const choquesDetectados = useMemo(() => { 
        if (distritoFiltroMaster === "TODOS") return [];
        const agrupados = {}; 
        votosFiltrados.forEach(v => { if (!agrupados[v.cedula]) agrupados[v.cedula] = []; agrupados[v.cedula].push(v); }); 
        return Object.values(agrupados).filter(arr => arr.length > 1); 
    }, [votosFiltrados, distritoFiltroMaster]);

    const padronPorMesa = useMemo(() => { const counts = {}; Object.values(padronGlobal || {}).forEach(p => { if (p.distrito === distritoFiltroMaster) counts[p.mesa] = (counts[p.mesa] || 0) + 1; }); return counts; }, [padronGlobal, distritoFiltroMaster]);
    const mesasDelDistrito = Object.keys(padronPorMesa).sort((a,b)=>parseInt(a)-parseInt(b));

    const [formVeedor, setFormVeedor] = useState({ ci: "", nombre: "", telefono: "", mesa: "", distrito: distritoFiltroMaster });
    
    const padronModalMesa = useMemo(() => {
        if(!mesaEnDetalle) return [];
        return Object.entries(padronGlobal || {})
            .map(([ci, data]) => ({ ci, ...data }))
            .filter(p => String(p.mesa) === String(mesaEnDetalle) && p.distrito === distritoFiltroMaster)
            .sort((a, b) => parseInt(a.orden) - parseInt(b.orden));
    }, [padronGlobal, mesaEnDetalle, distritoFiltroMaster]);

    const padronLlaves = useMemo(() => { const map = {}; Object.entries(padronGlobal || {}).forEach(([ci, p]) => { map[generarLlave(p.distrito, p.mesa, p.orden)] = { ci, ...p }; }); return map; }, [padronGlobal]);
    const ultimosVotosFeed = useMemo(() => { return Object.entries(yaVotaronFiltrados || {}).sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0)).slice(0, 8).map(([llave, data]) => ({ llave, data, elector: padronLlaves[llave] })); }, [yaVotaronFiltrados, padronLlaves]);

    const [mesaEscrutinioSelect, setMesaEscrutinioSelect] = useState("");
    const [formEscrutinioAdmin, setFormEscrutinioAdmin] = useState({ intendente: "", concejales: {} });

    const [fDetCoord, setFDetCoord] = useState("TODOS");
    const [fDetVoto, setFDetVoto] = useState("TODOS");
    const [fDetPC, setFDetPC] = useState("TODOS");

    useEffect(() => {
        setConcejalEnDetalle(null);
        setForm(f => ({...f, distrito: distritoFiltroMaster === "TODOS" ? "" : distritoFiltroMaster, concejal: "SIN ASIGNAR", coordinador: ""}));
        setResultadosNombre([]);
        setBusquedaNombre("");
    }, [distritoFiltroMaster]);

    const buscarCedulaAdmin = () => { const p = (padronGlobal||{})[form.cedula]; if (p) setForm(prev => ({...prev, nombre: p.nombre, apellido: p.apellido, local: p.local, mesa: p.mesa, orden: p.orden, distrito: p.distrito})); else alert("No encontrada."); };
    
    const buscarPorNombre = () => {
        if(busquedaNombre.trim().length < 3) return alert("Escribe al menos 3 letras.");
        const res = Object.entries(padronGlobal || {}).map(([ci, d]) => ({ci, ...d}))
            .filter(p => 
                (p.nombre + " " + p.apellido).toLowerCase().includes(busquedaNombre.toLowerCase()) && 
                (distritoFiltroMaster === "TODOS" || p.distrito === distritoFiltroMaster)
            ).slice(0, 20);
        
        if (res.length === 0) alert("No se encontraron coincidencias.");
        setResultadosNombre(res);
    };

    const seleccionarDeBuscador = (p) => {
        setForm({...form, cedula: p.ci, nombre: p.nombre, apellido: p.apellido, local: p.local, mesa: p.mesa, orden: p.orden, distrito: p.distrito});
        setResultadosNombre([]);
        setBusquedaNombre("");
    };

    const handleRegistrarAdmin = () => {
        if (!form.cedula || !form.nombre || !form.distrito) return alert("Faltan datos o distrito.");
        if (votosFiltrados.find(v => String(v.cedula) === String(form.cedula) && v.concejal === form.concejal)) return alert(`⚠️ ALERTA: Ya está en la lista de ${form.concejal}.`);
        push(ref(db, 'votos_seguros'), { ...form, registradoPor: usuarioActivo.email, fecha_registro: new Date().toLocaleString() });
        setForm({...form, cedula:"", nombre:"", apellido:"", local:"", mesa:"", orden:"", coordinador:""}); setModoNuevoCoord(false); alert("✅ Voto Registrado.");
    };
    
    const eliminarVoto = (id) => { if(window.confirm("⚠️ ¿Eliminar registro?")) remove(ref(db, `votos_seguros/${id}`)); };

    const abrirModalMesa = (mesa) => {
        setMesaEnDetalle(mesa);
        setFormVeedor({ ci: "", nombre: "", telefono: "", mesa: String(mesa), distrito: distritoFiltroMaster });
    };

    const buscarVeedorModal = () => { const p = (padronGlobal||{})[formVeedor.ci]; if (p) setFormVeedor(prev => ({...prev, nombre: `${p.nombre} ${p.apellido}`, distrito: p.distrito})); else alert("Cédula no encontrada."); };
    const asignarVeedorMesaModal = () => {
        if (!formVeedor.ci || !formVeedor.nombre) return alert("Faltan datos.");
        set(ref(db, `dia_d/asignaciones_veedores/${generarLlaveMesa(formVeedor.distrito, formVeedor.mesa)}`), formVeedor);
        alert(`✅ Mesa reasignada a ${formVeedor.nombre}.`);
    };

    const seleccionarMesaEscrutinio = (m) => {
        setMesaEscrutinioSelect(String(m));
        const dataGuardada = (escrutinioGlobal || {})[generarLlaveMesa(distritoFiltroMaster, m)];
        if (dataGuardada) {
            setFormEscrutinioAdmin(dataGuardada);
        } else {
            const initConc = {}; configApp.concejales.forEach(c => initConc[c] = "");
            setFormEscrutinioAdmin({ intendente: "", concejales: initConc, rivalesIntendente: [], rivalesConcejales: [], blancos: "", nulos: "" });
        }
    };

    const guardarEscrutinioAdmin = () => {
        if(!mesaEscrutinioSelect) return;
        set(ref(db, `dia_d/escrutinio/${generarLlaveMesa(distritoFiltroMaster, mesaEscrutinioSelect)}`), { ...formEscrutinioAdmin, timestamp: Date.now() });
        alert("✅ Acta actualizada.");
    };

    const reabrirMesaAdmin = (m) => {
        if(window.confirm(`⚠️ ¿DESBLOQUEAR MESA ${m}?\nEl veedor podrá volver a marcar votos.`)) {
            remove(ref(db, `dia_d/mesas_cerradas/${generarLlaveMesa(distritoFiltroMaster, m)}`));
        }
    };

    const exportarExcel = () => {
        let csvContent = "CÉDULA;NOMBRES;APELLIDOS;TELÉFONO;DISTRITO;LOCAL;MESA;ORDEN;CONCEJAL;COORDINADOR;COLOR;VOTÓ (DÍA D);PASÓ PC\n";
        votosFiltrados.forEach(v => {
            const llave = generarLlave(v.distrito, v.mesa, v.orden);
            const votoHecho = yaVotaronFiltrados[llave] ? `SÍ (${yaVotaronFiltrados[llave].hora})` : "NO";
            const pasoPC = pasoPCFiltrados[llave] ? `SÍ (${pasoPCFiltrados[llave].registradoPorNombre})` : "NO";
            const row = [v.cedula, `"${v.nombre}"`, `"${v.apellido}"`, `"${v.telefono || ""}"`, `"${v.distrito}"`, `"${v.local}"`, v.mesa, v.orden, `"${v.concejal}"`, `"${v.coordinador || ""}"`, v.semaforo, `"${votoHecho}"`, `"${pasoPC}"`].join(";");
            csvContent += row + "\n";
        });
        const bom = "\uFEFF";
        const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a"); link.setAttribute("href", URL.createObjectURL(blob)); link.setAttribute("download", `REPORTE_VOTOS_${distritoFiltroMaster}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const renderDetalleConcejal = () => {
        const misVotosDetalle = votosFiltrados.filter(v => v.concejal === concejalEnDetalle);
        const delegados = {};
        misVotosDetalle.forEach(v => {
            const c = v.coordinador || "SIN ASIGNAR";
            const llave = generarLlave(v.distrito, v.mesa, v.orden);
            if(!delegados[c]) delegados[c] = { total: 0, votaron: 0, pasoPC: 0 };
            delegados[c].total++;
            if (yaVotaronFiltrados[llave]) delegados[c].votaron++;
            if (pasoPCFiltrados[llave]) delegados[c].pasoPC++;
        });

        const votosFiltradosDetalle = misVotosDetalle.filter(v => {
            const llave = generarLlave(v.distrito, v.mesa, v.orden);
            const votado = !!yaVotaronFiltrados[llave];
            const pasoPC = !!pasoPCFiltrados[llave];
            return (fDetCoord === "TODOS" || v.coordinador === fDetCoord) && (fDetVoto === "TODOS" || (fDetVoto === "VOTÓ" ? votado : !votado)) && (fDetPC === "TODOS" || (fDetPC === "PASÓ" ? pasoPC : !pasoPC));
        });

        return (
            <div className="space-y-6 animate-fade-in print:hidden">
                <div className="flex items-center justify-between bg-slate-900 text-white p-6 rounded-2xl shadow-xl">
                    <div>
                        <button onClick={() => setConcejalEnDetalle(null)} className="bg-red-600 hover:bg-red-500 px-4 py-1 rounded font-bold text-xs mb-2">← VOLVER</button>
                        <h2 className="text-3xl font-black uppercase flex items-center gap-2"><Target className="text-red-500"/> {concejalEnDetalle}</h2>
                    </div>
                    <div className="text-right">
                        <div className="text-xs font-bold text-gray-400">PROGRESO META</div>
                        <div className="text-2xl font-black text-green-400">{misVotosDetalle.length} / {configApp.meta_concejales}</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl border">
                    <h3 className="font-black text-lg mb-4">RENDIMIENTO COORDINADORES</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(delegados).sort((a,b)=>b[1].total - a[1].total).map(([nom, stats]) => (
                            <div key={nom} className="bg-slate-50 p-4 rounded-xl border relative overflow-hidden">
                                <div className="font-bold text-sm truncate uppercase mb-2">{nom}</div>
                                <div className="flex justify-between items-end mb-1">
                                    <div><span className="text-2xl font-black">{stats.total}</span><span className="text-[10px] font-bold ml-1 text-gray-500">VOTOS</span></div>
                                    <div className="text-right"><span className="text-lg font-black text-green-600">{stats.votaron}</span><span className="text-[10px] text-green-600 font-bold ml-1">VOTARON</span></div>
                                </div>
                                <div className="flex justify-between text-[10px] font-bold border-t pt-1 mt-1"><span className="text-blue-600">PASO PC: {stats.pasoPC}</span><span className="text-slate-400">FALTAN: {stats.total - stats.votaron}</span></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-xl border overflow-x-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 border-b pb-4 gap-4">
                        <h3 className="font-black text-lg">LISTA ({votosFiltradosDetalle.length})</h3>
                        <div className="flex gap-2">
                            <select className="p-2 border rounded font-bold text-xs" value={fDetCoord} onChange={e=>{setFDetCoord(e.target.value); setLimiteDetalleConcejal(100);}}><option value="TODOS">COORD: TODOS</option>{Object.keys(delegados).map(c=><option key={c} value={c}>{c}</option>)}</select>
                            <select className="p-2 border rounded font-bold text-xs" value={fDetVoto} onChange={e=>{setFDetVoto(e.target.value); setLimiteDetalleConcejal(100);}}><option value="TODOS">VOTO: TODOS</option><option value="VOTÓ">VOTO: SÍ</option><option value="PENDIENTE">VOTO: NO</option></select>
                            <select className="p-2 border rounded font-bold text-xs" value={fDetPC} onChange={e=>{setFDetPC(e.target.value); setLimiteDetalleConcejal(100);}}><option value="TODOS">PASO PC: TODOS</option><option value="PASÓ">PASO PC: SÍ</option><option value="NO PASÓ">PASO PC: NO</option></select>
                        </div>
                    </div>
                    <table className="w-full text-left min-w-[800px]"><thead className="bg-slate-100 text-[10px] uppercase"><tr><th className="p-3">Elector</th><th className="p-3">Mesa/Ord</th><th className="p-3">Coordinador</th><th className="p-3">Día D</th></tr></thead>
                        <tbody className="divide-y text-sm">
                            {votosFiltradosDetalle.slice(0, limiteDetalleConcejal).map(v => {
                                const llave = generarLlave(v.distrito, v.mesa, v.orden);
                                return (
                                    <tr key={v.id}>
                                        <td className="p-3 font-bold">{v.nombre} {v.apellido} <br/><span className="text-[10px] text-gray-500">C.I: {v.cedula} | <span className={`text-${v.semaforo === 'VERDE' ? 'green' : v.semaforo === 'AMARILLO' ? 'yellow' : 'red'}-500`}>●</span></span></td>
                                        <td className="p-3 font-bold text-xs">M:{v.mesa} | O:{v.orden}</td>
                                        <td className="p-3 text-xs font-bold text-slate-500">{v.coordinador || '-'}</td>
                                        <td className="p-3">
                                            {yaVotaronFiltrados[llave] ? <span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {yaVotaronFiltrados[llave].hora}</span> : <span className="text-gray-300 font-bold text-[10px]">PENDIENTE</span>}
                                            {pasoPCFiltrados[llave] && <span className="text-[10px] font-bold text-blue-600 mt-1 block">📍 PC SÍ</span>}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    {votosFiltradosDetalle.length > limiteDetalleConcejal && (
                        <button onClick={() => setLimiteDetalleConcejal(prev => prev + 100)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-4 font-bold mt-4 rounded-xl transition-colors">
                            Cargar más registros... ({votosFiltradosDetalle.length - limiteDetalleConcejal} restantes)
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const renderDashboardGlobal = () => {
        const totalPadron = Object.keys(padronGlobal || {}).length;
        const totalSeguros = (votosSeguros || []).length;
        const totalVotaron = Object.keys(yaVotaronGlobal || {}).length;

        const statsPorDistrito = DISTRITOS_CANINDEYU.map(d => {
            const config = configuracionDepartamental[d] || {};
            const seguros = (votosSeguros || []).filter(v => v.distrito === d).length;
            const votaron = Object.keys(yaVotaronGlobal || {}).filter(k => k.startsWith(`${d}_`)).length;
            const meta = config.meta_intendente || 0;
            const pct = meta > 0 ? Math.round((seguros/meta)*100) : 0;
            return { distrito: d, seguros, votaron, meta, pct };
        }).sort((a,b) => b.seguros - a.seguros);

        return (
            <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-700 text-center relative overflow-hidden">
                    <Globe size={150} className="absolute -right-10 -top-10 text-slate-800 opacity-50"/>
                    <h2 className="text-3xl font-black text-white mb-2 relative z-10">VISIÓN GLOBAL - {NOMBRE_DEPARTAMENTO}</h2>
                    <p className="text-slate-400 font-bold mb-6 relative z-10">Haz clic en cualquier distrito de la lista para gestionar sus datos locales.</p>
                    
                    <div className="flex flex-wrap justify-center gap-6 relative z-10">
                         <div className="bg-slate-800 p-4 rounded-2xl w-48 border border-slate-600"><div className="text-4xl font-black text-blue-400">{totalSeguros}</div><div className="text-xs font-bold text-slate-400 mt-1 uppercase">Votos Cargados</div></div>
                         <div className="bg-slate-800 p-4 rounded-2xl w-48 border border-slate-600"><div className="text-4xl font-black text-green-400">{totalVotaron}</div><div className="text-xs font-bold text-slate-400 mt-1 uppercase">Votaron (Día D)</div></div>
                         <div className="bg-slate-800 p-4 rounded-2xl w-48 border border-slate-600"><div className="text-4xl font-black text-white">{totalPadron}</div><div className="text-xs font-bold text-slate-400 mt-1 uppercase">Padrón Total</div></div>
                    </div>
                </div>
                
                <div className="bg-white p-6 rounded-3xl shadow border">
                    <h3 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><TrendingUp className="text-red-500"/> RANKING POR DISTRITO</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-100 text-[10px] uppercase text-slate-500 border-b-2 border-slate-200">
                                <tr><th className="p-3">Pos. Distrito</th><th className="p-3 text-center">Meta Local</th><th className="p-3 text-center">Votos Seguros</th><th className="p-3 text-center">Avance de Meta</th><th className="p-3 text-center">Día D (Efectivos)</th></tr>
                            </thead>
                            <tbody className="divide-y text-sm font-bold">
                                {statsPorDistrito.map((s, i) => (
                                    <tr key={s.distrito} className="hover:bg-blue-50 cursor-pointer transition-colors group" onClick={() => setDistritoFiltroMaster(s.distrito)} title={`Administrar ${s.distrito}`}>
                                        <td className="p-3 flex items-center gap-2">
                                            <span className="text-gray-400 w-4 font-black">{i+1}.</span> 
                                            <span className="text-slate-700 group-hover:text-blue-700">{s.distrito}</span>
                                        </td>
                                        <td className="p-3 text-center text-slate-400">{s.meta > 0 ? s.meta : 'No config.'}</td>
                                        <td className="p-3 text-center text-blue-600 text-lg font-black">{s.seguros}</td>
                                        <td className="p-3 text-center">
                                            <div className="w-full bg-slate-200 rounded-full h-4 relative overflow-hidden flex items-center justify-center">
                                                <div className={`absolute top-0 left-0 h-full ${s.pct >= 100 ? 'bg-green-500' : s.pct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${Math.min(s.pct, 100)}%`}}></div>
                                                <span className="relative z-10 text-[10px] text-black drop-shadow-md">{s.pct}%</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-center text-green-600 text-lg font-black">{s.votaron}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <header className="bg-slate-900 text-white p-4 shadow-xl border-b-4 border-red-600 sticky top-0 z-50 print:hidden">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-red-700 p-2 rounded-lg font-black text-white">BEMO</div>
                        <div>
                            {distritoFiltroMaster === "TODOS" ? (
                                <h1 className="text-lg font-bold leading-none text-blue-300">COMANDO DEPARTAMENTAL</h1>
                            ) : (
                                <h1 className="text-lg font-bold leading-none">{configApp.intendente} (Lista {configApp.lista})</h1>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                                <MapPin size={10} className={distritoFiltroMaster === "TODOS" ? "text-blue-400" : "text-red-400"} />
                                <span className="text-[10px] font-black uppercase text-gray-400">{distritoFiltroMaster === "TODOS" ? "VISIÓN DEPARTAMENTAL" : distritoFiltroMaster}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {esMaster && (
                            <div className="hidden md:flex items-center bg-slate-800 rounded-xl px-3 border border-slate-700">
                                <Globe size={14} className="text-slate-500 mr-2" />
                                <select 
                                    className="bg-transparent py-2 font-black text-xs outline-none cursor-pointer uppercase text-blue-300" 
                                    value={distritoFiltroMaster} 
                                    onChange={e => setDistritoFiltroMaster(e.target.value)}
                                >
                                    <option value="TODOS" className="bg-slate-900 font-black">🌍 VISIÓN GLOBAL ({NOMBRE_DEPARTAMENTO})</option>
                                    {DISTRITOS_CANINDEYU.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                                </select>
                            </div>
                        )}
                        <button onClick={() => signOut(auth)} className="bg-slate-800 p-2 rounded-full hover:bg-red-600 transition-colors"><LogOut size={18}/></button>
                    </div>
                </div>
            </header>

            {esMaster && (
                <div className="md:hidden bg-slate-800 p-3 flex flex-col gap-2 text-white border-b border-slate-700">
                    <span className="text-[10px] font-black text-blue-300">SELECCIONA VISTA O DISTRITO:</span>
                    <select className="bg-slate-700 p-2 rounded font-black text-xs cursor-pointer uppercase w-full" value={distritoFiltroMaster} onChange={e => setDistritoFiltroMaster(e.target.value)}>
                        <option value="TODOS">🌍 VISIÓN GLOBAL DEPARTAMENTAL</option>
                        {DISTRITOS_CANINDEYU.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            )}

            <div className="bg-white flex border-b shadow-sm sticky top-[68px] z-50 print:hidden px-2 items-center justify-center w-full">
                
                <div className="flex items-center max-w-full pt-2 pb-2">
                    
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pr-2">
                        <button onClick={() => {setActiveTab("registro"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${activeTab === 'registro' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><CheckCircle size={16}/> REGISTRO</button>
                        
                        <button onClick={() => {setActiveTab("lista"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${activeTab === 'lista' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Users size={16}/> LISTA</button>
                        
                        <button onClick={() => {setActiveTab("dashboard"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${activeTab === 'dashboard' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><BarChart3 size={16}/> PROYECCIONES</button>
                        
                        <button onClick={() => {setActiveTab("dia_d"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${activeTab === 'dia_d' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Bell size={16}/> LIVE / MESAS</button>
                    </div>

                    <div className="relative shrink-0 border-l border-slate-200 pl-2">
                        
                        <button 
                            onClick={() => setMenuAbierto(!menuAbierto)} 
                            className={`p-2 px-3 font-black text-[11px] flex gap-1 items-center rounded-lg transition-colors ${menuAbierto ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                        >
                            MÁS OPCIONES <ChevronDown size={14} className={`transition-transform duration-200 ${menuAbierto ? 'rotate-180' : ''}`}/>
                        </button>

                        {menuAbierto && (
                            <div className="absolute right-0 top-full mt-2 w-52 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.2)] rounded-xl z-[100] overflow-hidden flex flex-col border border-slate-200 animate-fade-in py-1">
                                
                                <button onClick={() => {setActiveTab("escrutinio"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 ${activeTab === 'escrutinio' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                    <Calculator size={16} className={activeTab === 'escrutinio' ? "text-red-500" : "text-slate-400"}/> ESCRUTINIO FINAL
                                </button>
                                
                                <button onClick={() => {setActiveTab("auditoria"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 ${activeTab === 'auditoria' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                    <AlertTriangle size={16} className={activeTab === 'auditoria' ? "text-red-500" : "text-slate-400"}/> AUDITORÍA
                                </button>
                                
                                <button onClick={() => {setActiveTab("usuarios"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 border-t border-slate-100 ${activeTab === 'usuarios' ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                    <UserPlus size={16} className={activeTab === 'usuarios' ? "text-blue-500" : "text-slate-400"}/> USUARIOS
                                </button>
                                
                                <button onClick={() => {setActiveTab("config"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 border-t border-slate-100 ${activeTab === 'config' ? 'bg-red-50 text-red-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
                                    <Settings size={16} className="text-slate-400"/> AJUSTES
                                </button>

                            </div>
                        )}
                    </div>

                </div>
            </div>

            <main className="max-w-7xl mx-auto p-4 md:p-6 mt-4 print:p-0">
                
                {activeTab === "usuarios" && (
                    distritoFiltroMaster === "TODOS" ? (
                        <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para administrar usuarios, selecciona un distrito específico en el menú superior.</p></div>
                    ) : (
                        <PanelUsuarios perfil={perfil} usuariosRegistrados={usuariosRegistrados} configuracionDepartamental={configuracionDepartamental} db={db} distritoFiltro={distritoFiltroMaster} />
                    )
                )}

                {activeTab === "registro" && (
                distritoFiltroMaster === "TODOS" ? (
                    <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para registrar nuevos electores, debes elegir el distrito correspondiente en el menú superior.</p></div>
                ) : (
                <div className="bg-white p-6 rounded-2xl shadow-sm border max-w-4xl mx-auto print:hidden animate-fade-in">
                    <h2 className="font-black text-xl mb-6 text-slate-800 flex items-center gap-2"><UserSquare2/> REGISTRO DE VOTOS ({distritoFiltroMaster})</h2>
                    
                    <div className="bg-slate-50 border p-4 rounded-xl mb-6">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">1. BUSCAR POR NOMBRE / APELLIDO (Opcional si no tienes C.I)</label>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Escribe Nombre o Apellido..." className="flex-1 p-3 border-2 rounded-xl font-bold uppercase outline-none focus:border-red-500" value={busquedaNombre} onChange={e => setBusquedaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarPorNombre()} />
                            <button onClick={buscarPorNombre} className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-6 rounded-xl font-bold transition-colors"><Search size={18}/></button>
                        </div>
                        {resultadosNombre.length > 0 && (
                            <div className="mt-2 bg-white border border-slate-200 shadow-lg rounded-xl max-h-48 overflow-y-auto">
                                {resultadosNombre.map(r => (
                                    <div key={r.ci} onClick={() => seleccionarDeBuscador(r)} className="p-3 hover:bg-red-50 cursor-pointer border-b last:border-b-0 text-sm flex justify-between items-center transition-colors">
                                        <div><span className="font-black">{r.nombre} {r.apellido}</span><br/><span className="text-xs text-gray-500 font-bold">C.I: {r.ci}</span></div>
                                        <div className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Mesa {r.mesa}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">2. CARGA CON CÉDULA DE IDENTIDAD</label>
                    <div className="flex gap-2 mb-6"><input type="number" placeholder="N° DE CÉDULA" className="flex-1 p-4 border-2 rounded-xl text-xl font-bold outline-none focus:border-red-500" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} /><button onClick={buscarCedulaAdmin} className="bg-slate-800 text-white px-6 rounded-xl font-bold"><Search /></button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" readOnly placeholder="NOMBRES" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.nombre} /><input type="text" readOnly placeholder="APELLIDOS" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.apellido} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" placeholder="TELÉFONO" className="p-3 border-2 border-blue-200 rounded-lg font-bold outline-none" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /><input type="text" readOnly placeholder="DISTRITO" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.distrito} /></div>
                    <div className="grid grid-cols-3 gap-2 mb-4"><input type="text" readOnly className="p-3 border bg-gray-50 text-xs col-span-3 md:col-span-1" value={form.local} placeholder="LOCAL" /><input type="text" readOnly className="p-3 border bg-gray-50 font-bold" value={form.mesa ? `MESA ${form.mesa}` : "MESA"} /><input type="text" readOnly className="p-3 border-2 border-red-100 font-black text-red-600 bg-red-50" value={form.orden ? `ORDEN ${form.orden}` : "ORDEN"} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">CONCEJAL</label><select className="p-4 border-2 rounded-xl font-bold outline-none" value={form.concejal} onChange={e=>setForm({...form, concejal: e.target.value})}><option>SIN ASIGNAR</option>{configApp.concejales.map(c => <option key={c} value={c}>{c.includes(' - ') ? c.split(' - ')[1] : c}</option>)}</select></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COORDINADOR</label>
                            <div className="flex gap-2">
                                {!modoNuevoCoord ? (
                                    <><select className="flex-1 p-4 border-2 rounded-xl font-bold outline-none" value={form.coordinador} onChange={e=>setForm({...form, coordinador: e.target.value})}><option value="">SELECCIONE...</option>{coordinadoresUnicos.map(c => <option key={c} value={c}>{c}</option>)}</select><button onClick={()=>{setModoNuevoCoord(true); setForm({...form, coordinador:""})}} className="bg-slate-200 px-4 rounded-xl font-black text-xl">+</button></>
                                ) : (
                                    <><input type="text" className="flex-1 p-4 border-2 rounded-xl font-bold uppercase outline-none" placeholder="NUEVO..." value={form.coordinador} onChange={e=>setForm({...form, coordinador: e.target.value.toUpperCase()})}/><button onClick={()=>{setModoNuevoCoord(false); setForm({...form, coordinador:""})}} className="bg-red-100 text-red-700 px-4 rounded-xl font-black text-xl">×</button></>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COLOR</label><select className={`w-full p-4 rounded-xl font-black text-white outline-none ${form.semaforo==='VERDE'?'bg-green-500':form.semaforo==='AMARILLO'?'bg-yellow-500':'bg-red-500'}`} value={form.semaforo} onChange={e=>setForm({...form, semaforo: e.target.value})}><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select></div>
                    </div>
                    <button onClick={handleRegistrarAdmin} className="w-full mt-6 bg-[#2ecc71] hover:bg-green-600 text-white py-4 rounded-xl font-black shadow-lg transition-colors">GUARDAR REGISTRO</button>
                </div>
                )
                )}

                {activeTab === "lista" && (() => {
                    const listaMostrar = votosFiltrados.filter(v => {
                        const texto = filtroTexto ? String(filtroTexto).toLowerCase() : "";
                        const cumpleTexto = texto === "" || 
                            String(v.cedula || "").toLowerCase().includes(texto) || 
                            String(v.nombre || "").toLowerCase().includes(texto) || 
                            String(v.apellido || "").toLowerCase().includes(texto);
                        
                        const cumpleConcejal = filtroConcejal === "TODOS" || v.concejal === filtroConcejal;
                        const cumpleCoord = filtroCoordinadorAdmin === "TODOS" || v.coordinador === filtroCoordinadorAdmin;
                        const cumpleColor = filtroSemaforoAdmin === "TODOS" || v.semaforo === filtroSemaforoAdmin;

                        return cumpleTexto && cumpleConcejal && cumpleCoord && cumpleColor;
                    });

                    return (
                    <div className="bg-white p-4 rounded-2xl shadow border overflow-x-auto print:hidden animate-fade-in">
                        <div className="flex flex-col md:flex-row gap-4 mb-4">
                            <input type="text" placeholder="BUSCAR CÉDULA/NOMBRE" className="p-2 border rounded font-bold uppercase flex-1" value={filtroTexto} onChange={e=>{setFiltroTexto(e.target.value); setLimiteListaAdmin(100);}}/>
                            <select className="p-2 border rounded font-bold text-sm" value={filtroConcejal} onChange={e=>{setFiltroConcejal(e.target.value); setLimiteListaAdmin(100);}}><option value="TODOS">CONCEJAL: TODOS</option>{configApp.concejales.map(c=><option key={c} value={c}>{c.includes(' - ') ? c.split(' - ')[1] : c}</option>)}<option value="SIN ASIGNAR">SIN ASIGNAR</option></select>
                            <select className="p-2 border rounded font-bold text-sm" value={filtroCoordinadorAdmin} onChange={e=>{setFiltroCoordinadorAdmin(e.target.value); setLimiteListaAdmin(100);}}><option value="TODOS">COORD: TODOS</option>{coordinadoresUnicos.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            <select className="p-2 border rounded font-bold text-sm" value={filtroSemaforoAdmin} onChange={e=>{setFiltroSemaforoAdmin(e.target.value); setLimiteListaAdmin(100);}}><option value="TODOS">COLOR: TODOS</option><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select>
                            {esMaster && <button onClick={exportarExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-black flex items-center justify-center gap-2 transition-colors shrink-0 shadow-md"><Download size={18}/> EXPORTAR EXCEL</button>}
                        </div>
                        <table className="w-full text-left min-w-[1000px]"><thead className="bg-slate-800 text-white text-xs uppercase"><tr><th className="p-3">Votante</th><th className="p-3">Mesa/Ord</th><th className="p-3">Coordinador</th><th className="p-3">Día D</th><th className="p-3 text-center">Acciones</th></tr></thead>
                            <tbody className="divide-y text-sm">
                            {listaMostrar.slice(0, limiteListaAdmin).map(v => {
                                    const llave = generarLlave(v.distrito, v.mesa, v.orden);
                                    return (
                                    <tr key={v.id} className="hover:bg-slate-50">
                                    <td className="p-3 font-bold">{v.nombre} {v.apellido} <br/><span className="text-[10px] text-gray-500">C.I: {v.cedula} | Conc: {v.concejal?.includes(' - ') ? v.concejal.split(' - ')[1] : v.concejal} | <span className={`text-${v.semaforo === 'VERDE' ? 'green' : v.semaforo === 'AMARILLO' ? 'yellow' : 'red'}-500`}>●</span></span></td>
                                    <td className="p-3 text-xs font-bold">{v.distrito}<br/>M: {v.mesa} | O: {v.orden}</td>
                                    <td className="p-3 text-xs font-bold text-slate-500">{v.coordinador || '-'}</td>
                                    <td className="p-3">
                                        {yaVotaronFiltrados[llave] ? <span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {yaVotaronFiltrados[llave].hora}</span> : <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-1 rounded">PENDIENTE</span>}
                                        {pasoPCFiltrados[llave] && <span className="text-[10px] font-bold text-blue-600 mt-1 block">📍 PC: {pasoPCFiltrados[llave].registradoPorNombre}</span>}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex justify-center items-center gap-3">
                                            <button onClick={()=>enviarWhatsAppCarnet(v)} className="text-green-500 hover:text-green-700"><Send size={16}/></button>
                                            <button onClick={()=>imprimirCarnetFisico(v, FOTOS_LOCALES_CONCEJALES[v.concejal])} className="text-slate-700 hover:text-black"><Printer size={16}/></button>
                                            <button onClick={()=>eliminarVoto(v.id)} className="text-red-300 hover:text-red-600 ml-2 border-l pl-2"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                                );
                            })}
                            {listaMostrar.length === 0 && <tr><td colSpan="5" className="text-center py-10 text-gray-400 font-bold border-2 border-dashed rounded-xl">No hay votantes registrados o no coinciden con los filtros.</td></tr>}
                            </tbody>
                        </table>
                        {listaMostrar.length > limiteListaAdmin && (
                            <button onClick={() => setLimiteListaAdmin(prev => prev + 100)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-4 font-bold mt-4 rounded-xl transition-colors">
                                Cargar más registros... ({listaMostrar.length - limiteListaAdmin} restantes)
                            </button>
                        )}
                    </div>
                    )
                })()}

                {activeTab === "auditoria" && (
                    distritoFiltroMaster === "TODOS" ? (
                        <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para detectar choques de carga, debes seleccionar un distrito en el menú superior.</p></div>
                    ) : (
                    <div className="bg-white p-6 rounded-2xl shadow border animate-fade-in">
                        <h2 className="font-black text-xl mb-4 text-red-600 flex items-center gap-2"><AlertTriangle/> AUDITORÍA DE CHOQUES ({distritoFiltroMaster})</h2>
                        <p className="text-sm text-gray-600 mb-6 font-bold">Estas personas fueron registradas por más de un candidato en esta ciudad.</p>
                        {choquesDetectados.length === 0 ? (
                            <div className="bg-green-50 text-green-700 p-4 rounded-xl font-black text-center">✅ Sistema limpio en {distritoFiltroMaster}. No hay choques detectados.</div>
                        ) : (
                            <div className="space-y-4">
                                {choquesDetectados.map((grupo, idx) => (
                                    <div key={idx} className="border-2 border-red-200 rounded-xl p-4 bg-red-50/50">
                                        <div className="flex justify-between items-center mb-3 border-b border-red-100 pb-2">
                                            <div className="font-black text-lg text-slate-800">{grupo[0].nombre} {grupo[0].apellido}</div>
                                            <div className="font-bold text-red-600 bg-red-100 px-3 py-1 rounded">C.I: {grupo[0].cedula}</div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {grupo.map(v => (
                                                <div key={v.id} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm relative">
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Cargado por:</div>
                                                    <div className="font-black text-slate-700">{v.concejal}</div>
                                                    <div className="text-xs text-gray-500 font-bold mt-1">Coord: {v.coordinador || '-'}</div>
                                                    <button onClick={()=>eliminarVoto(v.id)} className="absolute top-2 right-2 text-red-300 hover:text-red-600" title="Eliminar"><Trash2 size={16}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    )
                )}

                {activeTab === "dashboard" && (
                    distritoFiltroMaster === "TODOS" ? renderDashboardGlobal() : (
                        concejalEnDetalle ? renderDetalleConcejal() : (
                        <div className="space-y-6 print:hidden animate-fade-in">
                            <div className="bg-white p-4 rounded-2xl shadow-sm border flex flex-wrap gap-4 justify-between items-center mb-6">
                                <div className="border-l-4 border-blue-500 pl-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Veedores Online</div><div className="text-2xl font-black text-blue-600">{Object.values(usuariosOnline||{}).filter(u => u.rol === 'veedor' && u.distrito === distritoFiltroMaster).length}</div></div>
                                <div className="border-l-4 border-purple-500 pl-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Concejales Online</div><div className="text-2xl font-black text-purple-600">{Object.values(usuariosOnline||{}).filter(u => u.rol === 'concejal' && u.distrito === distritoFiltroMaster).length}</div></div>
                                <div className="border-l-4 border-orange-500 pl-4"><div className="text-[10px] font-bold text-gray-400 uppercase">Dirigentes Online</div><div className="text-2xl font-black text-orange-600">{Object.values(usuariosOnline||{}).filter(u => u.rol === 'dirigente' && u.distrito === distritoFiltroMaster).length}</div></div>
                                <div className="border-l-4 border-green-500 pl-4 bg-green-50 pr-4 py-1 rounded-r-lg"><div className="text-[10px] font-bold text-green-700 uppercase">Total Dispositivos</div><div className="text-2xl font-black text-green-600">{Object.values(usuariosOnline||{}).filter(u => u.distrito === distritoFiltroMaster).length}</div></div>
                            </div>

                            <div className="bg-gradient-to-r from-red-900 to-red-700 p-6 rounded-3xl shadow-xl border border-red-600 text-white relative overflow-hidden">
                                <Target size={150} className="absolute -right-10 -top-10 opacity-10"/>
                                <h2 className="text-2xl font-black mb-1 flex items-center gap-2">INTENDENTE: {configApp.intendente}</h2>
                                <div className="text-[10px] font-bold text-red-300 uppercase tracking-widest mb-6">Proyección, Trabajo de Equipo y Análisis de Voto Cruzado</div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                                    <div className="bg-black/20 p-4 rounded-2xl border border-red-500/30 text-center flex flex-col justify-center">
                                        <div className="text-[10px] text-red-200 font-bold uppercase mb-1">Meta Intendente</div>
                                        <div className="text-3xl font-black">{configApp.meta_intendente || 0}</div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-2xl border border-red-500/30 text-center flex flex-col justify-center">
                                        <div className="text-[10px] text-red-200 font-bold uppercase mb-1">Intención (Total Equipo)</div>
                                        <div className="text-3xl font-black text-blue-300">{totalVotosSeguros}</div>
                                        <div className="text-[10px] mt-1 font-bold">{porcentajeSegurosIntendente}% de la meta</div>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-2xl border border-red-500/30 text-center flex flex-col justify-center">
                                        <div className="text-[10px] text-red-200 font-bold uppercase mb-1">Votaron (Efectividad)</div>
                                        <div className="text-3xl font-black text-green-400">{yaVotaronSeguros}</div>
                                        <div className="text-[10px] mt-1 font-bold">{porcentajeEfectividadEquipo}% del equipo ya votó</div>
                                    </div>
                                    <div className={`p-4 rounded-2xl border text-center flex flex-col justify-center ${diferenciaCruzado >= 0 ? 'bg-green-900/40 border-green-500/50' : 'bg-red-950/80 border-red-400/50 shadow-inner'}`}>
                                        <div className="text-[10px] text-gray-300 font-bold uppercase mb-1">Voto Cruzado (Escrutinio)</div>
                                        <div className={`text-3xl font-black ${diferenciaCruzado > 0 ? 'text-green-400' : diferenciaCruzado < 0 ? 'text-red-400' : 'text-white'}`}>
                                            {diferenciaCruzado > 0 ? `+${diferenciaCruzado}` : diferenciaCruzado}
                                        </div>
                                        <div className="text-[10px] mt-1 font-bold text-gray-400">
                                            {diferenciaCruzado > 0 ? "Atrajo votos externos" : diferenciaCruzado < 0 ? "Fuga de votos del equipo" : "Empate exacto"}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-slate-900 p-6 rounded-3xl shadow-xl border border-slate-700 flex flex-col justify-center h-full">
                                    <h2 className="font-black text-xl text-white text-center mb-2">URNAS {distritoFiltroMaster}</h2>
                                    <p className="text-slate-400 font-bold text-xs text-center mb-6">Seguros vs Voto Independiente</p>
                                    <div className="flex gap-4 w-full justify-center">
                                        <div className="bg-slate-800 p-3 rounded-2xl text-center border border-slate-600 flex-1"><div className="text-3xl font-black text-white">{totalVotosEmitidosDiaD}</div><div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Total Urnas</div></div>
                                        <div className="bg-green-900/50 p-3 rounded-2xl text-center border border-green-700 flex-1"><div className="text-3xl font-black text-green-400">{yaVotaronSeguros}</div><div className="text-[10px] font-bold text-green-500 uppercase mt-1">Votos Seguros</div></div>
                                        <div className="bg-blue-900/50 p-3 rounded-2xl text-center border border-blue-700 flex-1"><div className="text-3xl font-black text-blue-400">{participacionIndependiente > 0 ? participacionIndependiente : 0}</div><div className="text-[10px] font-bold text-blue-500 uppercase mt-1">Voto Libre</div></div>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-3xl shadow-xl border flex flex-col items-center justify-center">
                                    <h2 className="font-black text-gray-600 mb-4 text-center">CALIDAD DE VOTOS ({totalVotosSeguros})</h2>
                                    <div className="flex gap-4 w-full justify-center">
                                        <div className="flex flex-col items-center flex-1"><div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-green-500 flex items-center justify-center font-black text-xl md:text-2xl text-green-600">{Math.round((verde/totalVotosSeguros)*100)||0}%</div><span className="text-[10px] font-bold mt-2 text-gray-500">{verde} VERDES</span></div>
                                        <div className="flex flex-col items-center flex-1"><div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-yellow-500 flex items-center justify-center font-black text-xl md:text-2xl text-yellow-600">{Math.round((amarillo/totalVotosSeguros)*100)||0}%</div><span className="text-[10px] font-bold mt-2 text-gray-500">{amarillo} AMARILLOS</span></div>
                                        <div className="flex flex-col items-center flex-1"><div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-red-500 flex items-center justify-center font-black text-xl md:text-2xl text-red-600">{Math.round((rojo/totalVotosSeguros)*100)||0}%</div><span className="text-[10px] font-bold mt-2 text-gray-500">{rojo} ROJOS</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-6 rounded-3xl shadow-xl border border-blue-800">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="font-black text-xl text-white flex items-center gap-2"><MapPin className="text-blue-400"/> RENDIMIENTO PASO PC ({distritoFiltroMaster})</h2>
                                    <div className="flex gap-2">
                                        <div className="bg-white/10 px-4 py-2 rounded-xl text-blue-200 font-black">TOTAL PC: <span className="text-white text-xl">{Object.keys(pasoPCFiltrados).length}</span></div>
                                        <button onClick={()=>setVerListaPC(!verListaPC)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors"><FileSearch size={16}/> {verListaPC ? "OCULTAR LISTA" : "VER LISTA"}</button>
                                    </div>
                                </div>
                                
                                <div className="space-y-3 mb-6 bg-black/20 p-4 rounded-xl">
                                    {topPasoPC.map(([nom, cant]) => (
                                        <div key={nom} className="flex items-center gap-3">
                                            <div className="w-24 md:w-32 text-right text-xs font-bold text-blue-100 uppercase truncate">{nom}</div>
                                            <div className="flex-1 bg-blue-950/50 h-6 rounded-full overflow-hidden">
                                                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full flex items-center px-2 text-[10px] font-black text-white" style={{width: `${(cant/maxPC)*100}%`}}>{cant}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {topPasoPC.length === 0 && <div className="text-center text-blue-300/50 font-bold py-4">Aún no hay registros de Paso PC.</div>}
                                </div>

                                {verListaPC && (
                                    <div className="bg-white rounded-xl shadow overflow-hidden max-h-96 overflow-y-auto">
                                        <table className="w-full text-left"><thead className="bg-slate-100 text-slate-700 text-[10px] uppercase"><tr><th className="p-3 sticky top-0 bg-slate-100">PC Registró</th><th className="p-3 sticky top-0 bg-slate-100">Votante (Llave)</th><th className="p-3 sticky top-0 bg-slate-100">Hora PC</th></tr></thead>
                                            <tbody className="divide-y text-sm">
                                                {Object.entries(pasoPCFiltrados).map(([llave, pcData]) => {
                                                    const parts = llave.split('_');
                                                    return (
                                                        <tr key={llave} className="hover:bg-slate-50">
                                                            <td className="p-3 font-bold text-blue-800">{pcData.registradoPorNombre}</td>
                                                            <td className="p-3 text-xs font-bold text-slate-600">D:{parts[0]} | M:{parts[1]} | Ord:{parts[2]}</td>
                                                            <td className="p-3 text-xs text-gray-500">{pcData.hora}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-3xl shadow-xl border">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="font-black text-2xl">ESTADO POR CONCEJAL ({distritoFiltroMaster})</h2>
                                    <div className="text-xs font-bold bg-slate-100 px-3 py-1 rounded border">META INDIVIDUAL: {configApp.meta_concejales}</div>
                                </div>
                                
                                <div className="space-y-8">
                                    {Object.entries(configApp.concejales.reduce((acc, c) => {
                                        if(!c || c === "SIN ASIGNAR") return acc;
                                        const parts = c.split(' - ');
                                        const group = parts.length > 1 ? `LISTA ${parts[0]}` : 'SIN SUB-LISTA';
                                        if(!acc[group]) acc[group] = [];
                                        acc[group].push(c);
                                        return acc;
                                    }, {})).map(([grupoName, miembros]) => (
                                        <div key={grupoName} className="border-2 border-slate-100 rounded-2xl p-5 bg-slate-50">
                                            <h3 className="font-black text-red-700 mb-4 uppercase border-b-2 border-red-100 pb-2">{grupoName}</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {miembros.map(c => {
const cant = votosFiltrados.filter(v => v.concejal === c).length;
const votaron = votosFiltrados.filter(v => v.concejal === c && yaVotaronFiltrados[generarLlave(v.distrito, v.mesa, v.orden)]).length;
const verdeC = votosFiltrados.filter(v => v.concejal === c && v.semaforo === 'VERDE').length;
const amarilloC = votosFiltrados.filter(v => v.concejal === c && v.semaforo === 'AMARILLO').length;
const rojoC = votosFiltrados.filter(v => v.concejal === c && v.semaforo === 'ROJO').length;

// FOTOS LOCALES
const fotoLocal = FOTOS_LOCALES_CONCEJALES[c]; 
const pctMeta = configApp.meta_concejales > 0 ? Math.min(Math.round((cant/configApp.meta_concejales)*100), 100) : 0;

return (
    <div key={c} onClick={() => {setConcejalEnDetalle(c); setFDetCoord("TODOS"); setFDetVoto("TODOS"); setFDetPC("TODOS"); setLimiteDetalleConcejal(100);}} className="cursor-pointer hover:scale-105 transition-transform duration-300 bg-gradient-to-br from-slate-900 to-black rounded-2xl p-5 text-white shadow-xl relative overflow-hidden group border border-slate-700">
        <div className="flex items-center gap-4 relative z-10">
            <div className="relative w-16 h-16 rounded-full border-2 border-red-500 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {fotoLocal ? <img src={fotoLocal} alt={c} className="w-full h-full object-cover"/> : <IdCard className="text-red-300" size={32}/>}
            </div>
            <div className="flex-1">
                <div className="font-black text-sm truncate uppercase tracking-wider text-red-100">{c.includes(' - ') ? c.split(' - ')[1] : c}</div>
                <div className="flex gap-1 mt-1">
                    <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">{verdeC}</span>
                    <span className="w-4 h-4 bg-yellow-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">{amarilloC}</span>
                    <span className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">{rojoC}</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-3xl font-black text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">{cant}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">SEG. DE {configApp.meta_concejales}</div>
            </div>
        </div>
        <div className="flex justify-between items-center mt-3 relative z-10">
            <div className="bg-slate-800 px-2 py-1 rounded text-[10px] font-bold text-green-400">DÍA D: {votaron} VOTARON</div>
            <div className="text-[10px] font-black text-white">{pctMeta}%</div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 relative z-10 overflow-hidden"><div className="bg-gradient-to-r from-red-700 to-red-400 h-full rounded-full transition-all" style={{width: `${pctMeta}%`}}></div></div>
    </div>
);
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    {configApp.concejales.length === 0 && <div className="text-center text-gray-400 font-bold p-4 border-2 border-dashed rounded-xl">No hay concejales configurados en este distrito.</div>}
                                </div>
                            </div>
                        </div>
                        )
                    )
                )}

                {activeTab === "dia_d" && (
                    distritoFiltroMaster === "TODOS" ? (
                        <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para ver el monitor de mesas o el Live Feed, selecciona un distrito en el menú de arriba.</p></div>
                    ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl shadow border border-t-4 border-t-red-600">
                            <h2 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><Bell className="text-red-600"/> FEED EN VIVO ({distritoFiltroMaster})</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                {ultimosVotosFeed.map((item, idx) => {
                                    if (!item.elector) return null;
                                    return (
                                        <div key={idx} className="p-3 rounded-xl border bg-slate-50 flex flex-col justify-between">
                                            <div>
                                                <div className="font-black text-xs text-slate-800 uppercase truncate">{item.elector.nombre} {item.elector.apellido}</div>
                                                <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase">MESA: {item.elector.mesa} | VEEDOR: {item.data.veedor}</div>
                                            </div>
                                            <div className="text-right mt-2"><div className="text-xs font-black text-slate-600">{item.data.hora}</div></div>
                                        </div>
                                    )
                                })}
                                {ultimosVotosFeed.length === 0 && <div className="col-span-full text-center text-gray-400 font-bold py-4">Aún no hay votos registrados en {distritoFiltroMaster}.</div>}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow border">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b pb-4 gap-4">
                                <div>
                                    <h2 className="font-black text-xl text-slate-800">MONITOR DE MESAS ({distritoFiltroMaster})</h2>
                                    <p className="text-xs text-gray-500 font-bold">Haz clic en una mesa para ver su padrón completo o sustituir al Veedor.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                {mesasDelDistrito.map(mesa => {
                                    const llaveMesa = generarLlaveMesa(distritoFiltroMaster, mesa);
                                    const asignado = (asignacionesVeedores||{})[llaveMesa];
                                    const cerrada = (mesasCerradas||{})[llaveMesa];
                                    const isOnline = asignado && (veedoresOnline||{})[asignado.ci];
                                    
                                    const totalHab = padronPorMesa[mesa] || 0;
                                    const votosDeEstaMesa = Object.keys(yaVotaronFiltrados).filter(k => k.startsWith(`${distritoFiltroMaster}_${mesa}_`)).length;
                                    const porcentaje = totalHab > 0 ? Math.round((votosDeEstaMesa / totalHab) * 100) : 0;

                                    let statusBg = "bg-gray-100 border-gray-300"; 
                                    let icon = <WifiOff size={14} className="text-gray-400"/>;
                                    let statusText = "SIN ASIGNAR";

                                    if (asignado) {
                                        statusBg = isOnline ? "bg-green-100 border-green-500 shadow-md scale-105 z-10 relative" : "bg-blue-50 border-blue-300";
                                        icon = isOnline ? <Wifi size={14} className="text-green-600 animate-pulse"/> : <WifiOff size={14} className="text-blue-400"/>;
                                        statusText = isOnline ? "ONLINE" : "OFFLINE";
                                    }
                                    if (cerrada) {
                                        statusBg = "bg-slate-800 border-black text-white";
                                        icon = <Lock size={14} className="text-red-500"/>;
                                        statusText = "CERRADA";
                                    }

                                    return (
                                        <div key={mesa} onClick={() => abrirModalMesa(mesa)} className={`p-4 rounded-xl border-2 flex flex-col justify-between cursor-pointer transition-all hover:border-red-500 group relative ${statusBg}`}>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-600 text-white text-[8px] px-1 py-0.5 rounded flex items-center gap-1 font-black shadow"><Eye size={8}/> VER</div>
                                            
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="text-3xl font-black leading-none">{mesa}</div>
                                                <div className="text-right">{icon}<div className={`text-[10px] font-black mt-1 ${cerrada ? 'text-red-400' : 'text-blue-600'}`}>{porcentaje}%</div></div>
                                            </div>
                                            
                                            <div className="w-full bg-black/10 h-1.5 mb-2 rounded-full overflow-hidden">
                                                <div className={`${cerrada ? 'bg-red-500' : 'bg-blue-500'} h-full`} style={{width: `${porcentaje}%`}}></div>
                                            </div>

                                            <div className="flex justify-between text-[10px] font-black text-gray-500 border-b border-black/10 pb-1 mb-2">
                                                <span>HAB: {totalHab}</span><span className={cerrada?"text-red-400":"text-green-600"}>VOT: {votosDeEstaMesa}</span>
                                            </div>
                                            <div className="text-[10px] font-bold uppercase truncate flex items-center justify-between">
                                                <span className="truncate mr-1">{asignado ? asignado.nombre.split(" ")[0] : '-'}</span>
                                                <span className={isOnline && !cerrada ? "text-green-600" : ""}>{statusText}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* LISTA DE VEEDORES (RESPONSABLES) */}
                        <div className="bg-white p-6 rounded-2xl shadow border">
                            <h3 className="font-black text-lg mb-4 flex items-center gap-2"><Users className="text-blue-600"/> RESPONSABLES DE MESA</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-100 uppercase"><tr><th className="p-2">Mesa</th><th className="p-2">Nombre Responsable</th><th className="p-2">Cédula</th><th className="p-2">Teléfono</th><th className="p-2">Estado</th></tr></thead>
                                    <tbody className="divide-y font-bold">
                                        {Object.entries(asignacionesVeedores).filter(([k]) => k.startsWith(distritoFiltroMaster)).map(([k, v]) => (
                                            <tr key={k} className="hover:bg-slate-50"><td className="p-2 text-red-600">{v.mesa}</td><td className="p-2">{v.nombre}</td><td className="p-2">{v.ci}</td><td className="p-2">{v.telefono || '-'}</td><td className="p-2">{veedoresOnline[v.ci] ? <span className="text-green-600">● ONLINE</span> : <span className="text-gray-300">OFFLINE</span>}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {mesaEnDetalle && (() => {
                            const llaveMesaAct = generarLlaveMesa(distritoFiltroMaster, mesaEnDetalle);
                            const veedorAsignado = asignacionesVeedores[llaveMesaAct];
                            const isCerrada = mesasCerradas[llaveMesaAct];

                            return (
                                <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex justify-center p-4 md:p-8 overflow-y-auto animate-fade-in">
                                    <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl relative flex flex-col h-max min-h-[80vh] border-t-8 border-red-600">
                                        <button onClick={()=>setMesaEnDetalle(null)} className="absolute top-4 right-4 bg-slate-100 hover:bg-red-100 hover:text-red-600 p-2 rounded-full transition-colors"><X size={24}/></button>
                                        
                                        <div className="p-6 border-b">
                                            <h2 className="text-3xl font-black text-slate-800">RADIOGRAFÍA MESA {mesaEnDetalle}</h2>
                                            <p className="text-sm font-bold text-gray-500 uppercase">{distritoFiltroMaster}</p>
                                        </div>

                                        <div className="flex flex-col lg:flex-row gap-6 p-6">
                                            <div className="w-full lg:w-1/3 space-y-4">
                                                
                                                <div className="bg-slate-100 p-5 rounded-2xl border border-slate-300 shadow-inner">
                                                    <h3 className="font-black text-xs text-slate-500 mb-2 uppercase flex items-center gap-1"><Users size={14}/> Responsable Actual</h3>
                                                    {veedorAsignado ? (
                                                        <div>
                                                            <div className="font-black text-lg text-slate-800 uppercase">{veedorAsignado.nombre}</div>
                                                            <div className="text-xs font-bold text-slate-600 mt-1">C.I: {veedorAsignado.ci} | Tel: {veedorAsignado.telefono || '-'}</div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-sm font-black text-red-500 bg-red-100 px-3 py-2 rounded-lg inline-block">MESA SIN VEEDOR</div>
                                                    )}
                                                </div>

                                                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200">
                                                    <h3 className="font-black text-lg mb-4 text-blue-900 flex items-center gap-2"><RefreshCw size={18}/> ASIGNAR / SUSTITUIR</h3>
                                                    <p className="text-xs text-blue-700 font-bold mb-4">La mesa actual se asignará a este número de cédula.</p>
                                                    <div className="flex gap-2 mb-4"><input type="number" placeholder="Cédula..." className="flex-1 p-3 border-2 border-blue-300 rounded-xl font-bold outline-none" value={formVeedor.ci} onChange={e=>setFormVeedor({...formVeedor, ci: e.target.value})} /><button onClick={buscarVeedorModal} className="bg-blue-800 text-white px-4 rounded-xl font-bold"><Search size={18}/></button></div>
                                                    <input type="text" readOnly placeholder="NOMBRES" className="w-full p-3 border rounded-xl bg-white font-bold text-blue-900 mb-4" value={formVeedor.nombre} />
                                                    <input type="number" placeholder="TELÉFONO" className="w-full p-3 border-2 border-blue-300 rounded-xl font-bold outline-none mb-4" value={formVeedor.telefono} onChange={e=>setFormVeedor({...formVeedor, telefono: e.target.value})} />
                                                    <button onClick={asignarVeedorMesaModal} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black shadow-lg">GUARDAR ASIGNACIÓN</button>
                                                </div>
                                                
                                                {isCerrada && (
                                                    <div className="bg-red-50 p-6 rounded-2xl border border-red-200 text-center">
                                                        <div className="text-red-700 font-black text-sm mb-4 uppercase">Esta mesa está BLOQUEADA (Escrutinio cerrado)</div>
                                                        <button onClick={()=>reabrirMesaAdmin(mesaEnDetalle)} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl font-black shadow flex justify-center items-center gap-2"><Unlock size={18}/> DESBLOQUEAR MESA</button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="w-full lg:w-2/3 bg-slate-50 border rounded-2xl p-4 overflow-hidden flex flex-col h-[60vh]">
                                                <h3 className="font-black text-lg mb-2 flex items-center gap-2"><ClipboardList/> PADRÓN DE MESA ({padronModalMesa.length})</h3>
                                                <div className="overflow-y-auto flex-1 rounded-xl border border-slate-200 bg-white">
                                                    <table className="w-full text-left">
                                                        <thead className="bg-slate-800 text-white text-[10px] uppercase sticky top-0 z-10"><tr><th className="p-3 text-center">Ord</th><th className="p-3">Elector</th><th className="p-3">Estado</th><th className="p-3">Voto Seguro de</th></tr></thead>
                                                        <tbody className="divide-y text-sm">
                                                            {padronModalMesa.map(v => {
                                                                const llaveVoto = generarLlave(distritoFiltroMaster, mesaEnDetalle, v.orden);
                                                                const votado = yaVotaronFiltrados[llaveVoto];
                                                                const esSeguroDe = votosFiltrados.find(vs => String(vs.cedula) === String(v.ci));

                                                                return (
                                                                    <tr key={v.ci} className={votado ? 'bg-green-50/50' : 'hover:bg-slate-50'}>
                                                                        <td className="p-3 text-center font-black text-gray-400">{v.orden}</td>
                                                                        <td className="p-3 leading-tight"><div className={`font-black text-xs ${votado ? 'text-green-800' : 'text-slate-800'}`}>{v.nombre} {v.apellido}</div><div className="text-[9px] text-gray-500 font-bold mt-1">C.I: {v.ci}</div></td>
                                                                        <td className="p-3">{votado ? <span className="bg-green-100 text-green-700 font-black text-[9px] px-2 py-1 rounded">✅ VOTÓ ({votado.hora})</span> : <span className="bg-gray-100 text-gray-400 font-bold text-[9px] px-2 py-1 rounded">PENDIENTE</span>}</td>
                                                                        <td className="p-3 font-bold text-[10px] uppercase">{esSeguroDe ? <span className="text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">⭐ {esSeguroDe.concejal}</span> : <span className="text-gray-300">-</span>}</td>
                                                                    </tr>
                                                                )
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    )
                )}

                {activeTab === "escrutinio" && (
                    distritoFiltroMaster === "TODOS" ? (
                        <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para ver y editar el escrutinio, selecciona primero un distrito en el menú superior.</p></div>
                    ) : (
                    <div className="space-y-6 animate-fade-in print:space-y-0 print:block">
                        <div className="bg-slate-900 p-8 rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden print:hidden">
                            <div className="absolute right-[-20px] top-[-20px] opacity-10"><Calculator size={200}/></div>
                            <h2 className="text-3xl font-black text-white relative z-10">PANEL DE ESCRUTINIO FINAL - {distritoFiltroMaster}</h2>
                            <p className="text-slate-400 font-bold mt-2 relative z-10 text-center max-w-lg">Revisa, edita o carga manualmente las actas finales de urnas y analiza la eficiencia de la estructura vs realidad de votos.</p>
                            
                            <button onClick={() => window.print()} className="mt-6 relative z-10 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-black shadow-lg flex items-center gap-2 transition-transform hover:scale-105">
                                <Printer size={20}/> DESCARGAR INFORME DISTRITAL
                            </button>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-6 print:block print:w-full">
                            <div className="w-full lg:w-1/4 bg-white rounded-2xl shadow border overflow-hidden flex flex-col h-[70vh] print:hidden">
                                <div className="p-4 border-b bg-slate-50">
                                    <h3 className="font-black text-slate-800 mb-2">SELECCIONAR MESA</h3>
                                </div>
                                <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                    {mesasDelDistrito.map(m => {
                                        const completado = (escrutinioGlobal||{})[generarLlaveMesa(distritoFiltroMaster, m)];
                                        return (
                                            <button key={m} onClick={()=>seleccionarMesaEscrutinio(m)} className={`w-full text-left p-3 rounded-xl font-black text-sm flex justify-between items-center transition-colors ${mesaEscrutinioSelect === String(m) ? 'bg-red-600 text-white' : completado ? 'bg-green-50 text-green-800 border border-green-200' : 'hover:bg-slate-100 text-slate-700'}`}>
                                                MESA {m}
                                                {completado && <CheckCircle size={14} className={mesaEscrutinioSelect === String(m) ? "text-white" : "text-green-500"}/>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="w-full lg:w-3/4 print:w-full">
                                {!mesaEscrutinioSelect ? (
                                    <div className="bg-white rounded-2xl shadow border h-full flex flex-col items-center justify-center p-10 text-center text-slate-400 print:hidden">
                                        <Calculator size={64} className="mb-4 opacity-50"/>
                                        <h3 className="text-2xl font-black">SELECCIONA UNA MESA</h3>
                                        <p className="font-bold">Elige una mesa del panel izquierdo para ver o corregir sus resultados finales.</p>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-2xl shadow border p-6 lg:p-8 animate-fade-in relative print:border-none print:shadow-none print:p-0">
                                        <div className="flex justify-between items-end border-b-4 border-slate-900 pb-4 mb-6">
                                            <div><h3 className="text-3xl font-black">ACTA MESA {mesaEscrutinioSelect}</h3><p className="font-bold text-gray-500 uppercase">{distritoFiltroMaster}</p></div>
                                            {(escrutinioGlobal||{})[generarLlaveMesa(distritoFiltroMaster, mesaEscrutinioSelect)] ? (
                                                <span className="bg-green-100 text-green-800 font-black px-4 py-2 rounded-xl border border-green-300 print:hidden">✅ ACTA GUARDADA</span>
                                            ) : (
                                                <span className="bg-yellow-100 text-yellow-800 font-black px-4 py-2 rounded-xl border border-yellow-300 print:hidden">⏳ ESPERANDO CARGA</span>
                                            )}
                                        </div>
                                        
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-6 print:border-none print:bg-white print:p-0">
                                            <h4 className="font-black text-slate-500 mb-4 flex items-center gap-2 print:hidden"><RefreshCw size={16}/> MODO CORRECCIÓN ADMIN</h4>
                                            
                                            <div className="bg-red-50 p-6 rounded-2xl border border-red-200 mb-6 flex justify-between items-center gap-4 print:border-red-900 print:bg-white print:border-2">
                                                <h4 className="font-black text-xl text-red-900 uppercase">INTENDENTE: {typeof configApp?.intendente === 'string' ? configApp.intendente : "S/D"}</h4>
                                                <div className="w-40 relative print:w-auto">
                                                    <div className="absolute -top-5 left-0 text-[10px] font-bold text-red-700 print:relative print:top-0 print:mb-1">VOTOS EN ACTA</div>
                                                    <input type="number" className="w-full p-3 text-2xl font-black border-2 border-red-300 rounded-xl outline-none focus:border-red-600 bg-white text-center print:border-none print:text-left print:p-0" value={formEscrutinioAdmin.intendente || ""} onChange={e => setFormEscrutinioAdmin({...formEscrutinioAdmin, intendente: e.target.value})} />
                                                </div>
                                            </div>

                                            <h4 className="font-black text-xl text-slate-800 mb-4">RENDIMIENTO DE CONCEJALES</h4>
                                            <div className="space-y-4 mb-6">
                                                {configApp.concejales.filter(c=>c!=="SIN ASIGNAR").map(c => {
                                                    const segurosEsperados = votosFiltrados.filter(v => v.concejal === c && String(v.mesa) === String(mesaEscrutinioSelect)).length;
                                                    const reales = parseInt(formEscrutinioAdmin.concejales?.[c]) || 0;
                                                    const dif = reales - segurosEsperados;
                                                    const proj = segurosEsperados > 0 ? Math.round((reales / segurosEsperados) * 100) : (reales > 0 ? 100 : 0);
                                                    
                                                    return (
                                                        <div key={c} className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl border shadow-sm gap-4 print:border-slate-300 print:shadow-none print:break-inside-avoid">
                                                            <div className="w-full md:w-1/3 font-black text-sm uppercase text-slate-700">{c.includes(' - ') ? c.split(' - ')[1] : c}</div>
                                                            <div className="flex w-full md:w-2/3 items-center gap-4">
                                                                <div className="text-center w-24">
                                                                    <div className="text-[10px] font-bold text-gray-500 leading-tight mb-1">SEGUROS</div>
                                                                    <div className="text-xl font-black text-slate-400">{segurosEsperados}</div>
                                                                </div>
                                                                <div className="flex-1 relative print:w-auto print:flex-none">
                                                                    <div className="absolute -top-5 left-0 text-[10px] font-bold text-blue-600 print:relative print:top-0 print:mb-1">VOTOS EN ACTA</div>
                                                                    <input type="number" placeholder="0" className="w-full p-3 text-xl font-black border-2 border-blue-300 rounded-xl text-center outline-none focus:border-blue-500 print:border-none print:p-0" value={formEscrutinioAdmin.concejales?.[c] || ""} onChange={e => setFormEscrutinioAdmin({...formEscrutinioAdmin, concejales: {...formEscrutinioAdmin.concejales, [c]: e.target.value}})} />
                                                                </div>
                                                                <div className="text-center w-20">
                                                                    <div className="text-[10px] font-bold text-gray-500 leading-tight mb-1">DIFERENCIA</div>
                                                                    <div className={`text-xl font-black ${dif > 0 ? 'text-green-500' : dif < 0 ? 'text-red-500' : 'text-slate-400'} print:text-black`}>{dif > 0 ? `+${dif}` : dif}</div>
                                                                </div>
                                                                <div className="text-center w-20 bg-slate-50 border p-2 rounded-lg print:border-none print:bg-white">
                                                                    <div className="text-[10px] font-bold text-gray-500 leading-tight mb-1">PROYECCIÓN</div>
                                                                    <div className={`text-lg font-black flex items-center justify-center gap-1 ${proj >= 100 ? 'text-green-600' : 'text-red-600'} print:text-black`}>{proj}% {proj >= 100 ? <TrendingUp size={14} className="print:hidden"/> : <TrendingDown size={14} className="print:hidden"/>}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            
                                            {/* RIVALES EN EL ADMIN */}
                                            {formEscrutinioAdmin.rivalesIntendente && formEscrutinioAdmin.rivalesIntendente.length > 0 && (
                                                <>
                                                    <h4 className="font-black text-xl text-slate-800 mb-4 mt-8 border-t pt-4">INTENDENTES RIVALES</h4>
                                                    <div className="space-y-2 mb-6">
                                                        {formEscrutinioAdmin.rivalesIntendente.map((r, i) => (
                                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm print:shadow-none print:border-b">
                                                                <span className="font-black text-sm uppercase">{r.nombre}</span>
                                                                <span className="font-black text-xl text-slate-600">{r.votos} votos</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}

                                            {formEscrutinioAdmin.rivalesConcejales && formEscrutinioAdmin.rivalesConcejales.length > 0 && (
                                                <>
                                                    <h4 className="font-black text-xl text-slate-800 mb-4 mt-8 border-t pt-4">CONCEJALES RIVALES</h4>
                                                    <div className="space-y-2 mb-6">
                                                        {formEscrutinioAdmin.rivalesConcejales.map((r, i) => (
                                                            <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border shadow-sm print:shadow-none print:border-b">
                                                                <span className="font-black text-sm uppercase">{r.nombre}</span>
                                                                <span className="font-black text-xl text-slate-600">{r.votos} votos</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}

                                            {/* BLANCOS Y NULOS EN ADMIN */}
                                            <div className="grid grid-cols-2 gap-4 mt-8 border-t pt-6">
                                                <div className="bg-gray-100 p-4 rounded-xl border text-center">
                                                    <div className="text-[10px] font-bold text-gray-500 mb-1">VOTOS BLANCOS</div>
                                                    <div className="text-2xl font-black text-gray-700">{formEscrutinioAdmin.blancos || 0}</div>
                                                </div>
                                                <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-center">
                                                    <div className="text-[10px] font-bold text-red-500 mb-1">VOTOS NULOS</div>
                                                    <div className="text-2xl font-black text-red-700">{formEscrutinioAdmin.nulos || 0}</div>
                                                </div>
                                            </div>

                                            <button onClick={guardarEscrutinioAdmin} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-black shadow transition-colors text-lg flex items-center justify-center gap-2 print:hidden mt-6"><Save/> GUARDAR / CORREGIR ACTA DE MESA</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    )
                )}
                
                {activeTab === "config" && (
                    distritoFiltroMaster === "TODOS" ? (
                        <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para configurar los datos de los intendentes o metas, selecciona el distrito que deseas ajustar en el menú.</p></div>
                    ) : (
                        <PanelConfiguracionDepartamental perfil={perfil} configuracionDepartamental={configuracionDepartamental} db={db} distritoGlobal={distritoFiltroMaster} setDistritoGlobal={setDistritoFiltroMaster} />
                    )
                )}
            </main>
        </div>
    );
}