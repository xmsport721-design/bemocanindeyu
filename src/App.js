import React, { useState, useEffect, Suspense, lazy } from "react";
import './index.generated.css';
import { ref, onValue, get, set, onDisconnect, query, orderByChild, equalTo } from "firebase/database";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { ShieldAlert } from "lucide-react";
import { db, auth } from "./firebase";
import { DISTRITOS_CONCEPCION } from "./constants";
import LoginScreen from "./screens/LoginScreen";
// Code splitting: cada pantalla se descarga solo cuando el rol la necesita (bundle inicial chico)
const AppVeedor = lazy(() => import("./screens/AppVeedor"));
const AppDirigente = lazy(() => import("./screens/AppDirigente"));
const AppConcejal = lazy(() => import("./screens/AppConcejal"));
const AppSuperAdmin = lazy(() => import("./screens/superadmin/AppSuperAdmin"));

const CargandoPantalla = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div></div>
);

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

            // El padrón se consulta en Supabase (point queries), no se baja entero.
            // Solo el veedor carga su distrito desde RTDB para la lista de su mesa (Día D).
            if (rolUsuario === "veedor" && distritoDelUsuario) {
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

  if (cargando || (usuarioActivo && !perfil)) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
              <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-6"></div>
              <div className="font-black text-xl tracking-widest animate-pulse text-red-500">VERIFICANDO CREDENCIALES...</div>
          </div>
      );
  }

  if (!usuarioActivo) return <LoginScreen auth={auth} db={db} />;

  const distritoUsuario = perfil?.distrito || DISTRITOS_CONCEPCION[0];
  const configApp = configuracionDepartamental[distritoUsuario] || { intendente: `NO CONFIGURADO`, lista: "0", meta_intendente: 5000, meta_concejales: 500, concejales: [] };
  const rol = perfil?.rol;
  
  if (rol === 'pendiente') return (<div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 text-center"><ShieldAlert size={64} className="text-yellow-500 mb-4" /><h1 className="text-2xl font-black mb-2">CUENTA EN REVISIÓN</h1><p className="text-gray-400 mb-8 max-w-sm">Avisa a tu Administrador Local para que active tu acceso.</p><button onClick={()=>signOut(auth)} className="bg-red-600 px-6 py-3 rounded-xl font-bold">CERRAR SESIÓN</button></div>);
  if (rol === 'veedor') return <Suspense fallback={<CargandoPantalla/>}><AppVeedor padronGlobal={padronGlobal} yaVotaronGlobal={yaVotaronGlobal} mesasCerradas={mesasCerradas} asignacionesVeedores={asignacionesVeedores} escrutinioGlobal={escrutinioGlobal} configApp={configApp} auth={auth} db={db} /></Suspense>;
  if (rol === 'concejal') return <Suspense fallback={<CargandoPantalla/>}><AppConcejal perfil={perfil} padronGlobal={padronGlobal} votosSeguros={votosSeguros} yaVotaronGlobal={yaVotaronGlobal} pasoPCGlobal={pasoPCGlobal} escrutinioGlobal={escrutinioGlobal} fotosConcejales={fotosConcejales} configApp={configApp} auth={auth} db={db} usuarioActivo={usuarioActivo} /></Suspense>;
  if (rol === 'dirigente') return <Suspense fallback={<CargandoPantalla/>}><AppDirigente padronGlobal={padronGlobal} yaVotaronGlobal={yaVotaronGlobal} pasoPCGlobal={pasoPCGlobal} configApp={configApp} auth={auth} db={db} /></Suspense>;
  if (rol === 'super_admin' || rol === 'master_departamental') return <Suspense fallback={<CargandoPantalla/>}><AppSuperAdmin perfil={perfil} padronGlobal={padronGlobal} votosSeguros={votosSeguros} yaVotaronGlobal={yaVotaronGlobal} mesasCerradas={mesasCerradas} asignacionesVeedores={asignacionesVeedores} veedoresOnline={veedoresOnline} escrutinioGlobal={escrutinioGlobal} fotosConcejales={fotosConcejales} pasoPCGlobal={pasoPCGlobal} configuracionDepartamental={configuracionDepartamental} usuariosRegistrados={usuariosRegistrados} usuariosOnline={usuariosOnline} auth={auth} db={db} usuarioActivo={usuarioActivo} /></Suspense>;

  return <div className="min-h-screen flex items-center justify-center"><button onClick={()=>signOut(auth)} className="bg-red-500 text-white p-4 rounded font-bold">ROL NO RECONOCIDO - CERRAR SESIÓN</button></div>;
}

// ==============================================================================================
// 2. COMPONENTES: LOGIN Y PANELES SECUNDARIOS
// ==============================================================================================


// ==============================================================================================
// 3. APPS POR ROL (VEEDOR, CONCEJAL, DIRIGENTE)
// ==============================================================================================


