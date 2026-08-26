import React, { useState, useEffect, useMemo } from "react";
import { ref, push, onValue, set, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { Search, Save, Users, CheckCircle, LogOut, BarChart3, MapPin, UserSquare2, Bell, AlertTriangle, Trash2, Eye, Printer, Lock, Send, IdCard, Target, Settings, Download, Wifi, WifiOff, FileSearch, RefreshCw, X, Calculator, TrendingUp, TrendingDown, ClipboardList, Globe, Edit2, UserPlus, Unlock, ChevronDown } from "lucide-react";
import { auth } from "../../firebase";
import { DISTRITOS_CONCEPCION, NOMBRE_DEPARTAMENTO, FOTOS_LOCALES_CONCEJALES } from "../../constants";
import { generarLlave, generarLlaveMesa } from "../../lib/llaves";
import { buscarPadronPorCedula, buscarPadronPorNombre, contarPadronDistrito, padronPorLocalMesa, padronDeMesa } from "../../lib/padronSupabase";
import { normalizarNombre, concejalCoincide, enviarWhatsAppCarnet, imprimirCarnetFisico } from "../../lib/helpers";
import PanelUsuarios from "../PanelUsuarios";
import PanelConfiguracionDepartamental from "../PanelConfiguracionDepartamental";
export default function AppSuperAdmin({ perfil, padronGlobal, votosSeguros, yaVotaronGlobal, mesasCerradas, asignacionesVeedores, veedoresOnline, escrutinioGlobal, fotosConcejales, pasoPCGlobal, configuracionDepartamental, usuariosRegistrados, usuariosOnline, db, usuarioActivo }) {
    
    const esMaster = perfil.rol === "master_departamental" || perfil.rol === "master_global";
    const [distritoFiltroMaster, setDistritoFiltroMaster] = useState(esMaster ? "TODOS" : perfil.distrito);
    const [activeTab, setActiveTab] = useState(esMaster ? "lista" : "registro");
    const [menuAbierto, setMenuAbierto] = useState(false);
    const [concejalEnDetalle, setConcejalEnDetalle] = useState(null);
    const [mesaEnDetalle, setMesaEnDetalle] = useState(null);
    const [filtroTexto, setFiltroTexto] = useState(""); 
    
    // NUEVO: Estado para el Lápiz de Edición de Voto
    const [editandoVotoId, setEditandoVotoId] = useState(null);
    const [formEdicion, setFormEdicion] = useState({ concejal: "", coordinador: "", semaforo: "" });
    const [soloDuplicados, setSoloDuplicados] = useState(false);

    const dataConfigBruta = distritoFiltroMaster === "TODOS" ? {} : (configuracionDepartamental[distritoFiltroMaster] || {});
    const configApp = { 
        intendente: typeof dataConfigBruta.intendente === 'string' ? dataConfigBruta.intendente : "NO CONFIGURADO", 
        lista: dataConfigBruta.lista || "0", 
        meta_intendente: dataConfigBruta.meta_intendente || 5000, 
        meta_concejales: dataConfigBruta.meta_concejales || 500, 
        concejales: Array.isArray(dataConfigBruta.concejales) ? dataConfigBruta.concejales : [] 
    };

    const votosFiltrados = useMemo(() => {
        // super_admin (búsqueda global) ve todos sus registros de cualquier distrito
        return (distritoFiltroMaster === "TODOS" || perfil.rol === 'super_admin')
            ? (votosSeguros || [])
            : (votosSeguros || []).filter(v => v.distrito === distritoFiltroMaster);
    }, [votosSeguros, distritoFiltroMaster, perfil.rol]);

    // MAPA DE DUPLICADOS PARA EL PANEL ADMIN (Pasa a Rojo Automático)
    const cedulasDuplicadas = useMemo(() => {
        if (distritoFiltroMaster === "TODOS") return new Set();
        const counts = {};
        votosFiltrados.forEach(v => { counts[v.cedula] = (counts[v.cedula] || 0) + 1; });
        const dups = new Set();
        Object.keys(counts).forEach(ci => { if(counts[ci] > 1) dups.add(ci); });
        return dups;
    }, [votosFiltrados, distritoFiltroMaster]);

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
    
    // Conteo de calidad de votos global aplicando penalización por duplicado
    const verde = votosFiltrados.filter(v => !cedulasDuplicadas.has(v.cedula) && v.semaforo === 'VERDE').length;
    const amarillo = votosFiltrados.filter(v => !cedulasDuplicadas.has(v.cedula) && v.semaforo === 'AMARILLO').length;
    const rojo = votosFiltrados.filter(v => cedulasDuplicadas.has(v.cedula) || v.semaforo === 'ROJO').length;

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
    const [coordFijado, setCoordFijado] = useState(false);
    const [coordinadores, setCoordinadores] = useState({});
    const [nuevoCoord, setNuevoCoord] = useState({ nombre: "", localidad: "", telefono: "", tipo: "URBANA" });
    useEffect(() => { const un = onValue(ref(db, 'coordinadores'), s => setCoordinadores(s.val() || {})); return () => un(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [limiteListaAdmin, setLimiteListaAdmin] = useState(100);
    const [limiteDetalleConcejal, setLimiteDetalleConcejal] = useState(100);

    const [busquedaNombre, setBusquedaNombre] = useState("");
    const [resultadosNombre, setResultadosNombre] = useState([]);

    const [filtroConcejal, setFiltroConcejal] = useState("TODOS");
    const [filtroCoordinadorAdmin, setFiltroCoordinadorAdmin] = useState("TODOS");
    const [filtroSemaforoAdmin, setFiltroSemaforoAdmin] = useState("TODOS");
    const [verListaPC, setVerListaPC] = useState(false);
    
    const coordinadoresUnicos = [...new Set(votosFiltrados.map(v => v.coordinador).filter(c => c && c.trim() !== ""))];
    // Para el selector de registro: coordinadores creados (con localidad/tel/tipo) + los que ya tienen votos
    const listaCoordinadores = [...new Set([...Object.values(coordinadores).map(c => c.nombre).filter(Boolean), ...coordinadoresUnicos])].sort();
    
    const choquesDetectados = useMemo(() => { 
        if (distritoFiltroMaster === "TODOS") return [];
        const agrupados = {}; 
        votosFiltrados.forEach(v => { if (!agrupados[v.cedula]) agrupados[v.cedula] = []; agrupados[v.cedula].push(v); }); 
        return Object.values(agrupados).filter(arr => arr.length > 1); 
    }, [votosFiltrados, distritoFiltroMaster]);

    // Rendimiento: un solo escaneo del padrón (171k) por distrito, reutilizado
    const padronDistrito = useMemo(() => Object.values(padronGlobal || {}).filter(p => p.distrito === distritoFiltroMaster), [padronGlobal, distritoFiltroMaster]);
    const padronPorMesa = useMemo(() => { const counts = {}; padronDistrito.forEach(p => { counts[p.mesa] = (counts[p.mesa] || 0) + 1; }); return counts; }, [padronDistrito]);
    const [totalPadronDistrito, setTotalPadronDistrito] = useState(0);
    const [localMesaData, setLocalMesaData] = useState({ locales: [], totalDistrito: 0 });
    useEffect(() => {
        if (distritoFiltroMaster === "TODOS") { setTotalPadronDistrito(0); setLocalMesaData({ locales: [], totalDistrito: 0 }); return; }
        contarPadronDistrito(distritoFiltroMaster).then(setTotalPadronDistrito);
        padronPorLocalMesa(distritoFiltroMaster).then(setLocalMesaData);
    }, [distritoFiltroMaster]);

    // --- Mesa por local: ver padrón (habilitados) + asignar encargado ---
    const [mesaSel, setMesaSel] = useState(null); // { cod_local, local, mesa }
    const [mesaSelPadron, setMesaSelPadron] = useState([]);
    const [cargandoMesa, setCargandoMesa] = useState(false);
    const [encargadoForm, setEncargadoForm] = useState({ ci: "", nombre: "", telefono: "" });
    const claveMesaLocal = (cl, m) => `${distritoFiltroMaster}_${cl}_${m}`.toUpperCase().replace(/[.$#[\]/]/g, "").trim();

    const abrirMesaLocal = async (loc, m) => {
        setMesaSel({ cod_local: loc.cod_local, local: loc.local, mesa: m.mesa });
        setEncargadoForm({ ci: "", nombre: "", telefono: "" });
        setMesaSelPadron([]); setCargandoMesa(true);
        const p = await padronDeMesa(distritoFiltroMaster, loc.cod_local, m.mesa);
        setMesaSelPadron(p); setCargandoMesa(false);
    };
    const buscarEncargado = async () => {
        const p = await buscarPadronPorCedula(encargadoForm.ci);
        if (p) setEncargadoForm(f => ({ ...f, nombre: `${p.nombre} ${p.apellido}` }));
        else alert("Cédula no encontrada en el padrón.");
    };
    const asignarEncargado = () => {
        if (!encargadoForm.ci || !encargadoForm.nombre) return alert("Ingresá la cédula del encargado y buscá su nombre.");
        set(ref(db, `dia_d/asignaciones_veedores/${claveMesaLocal(mesaSel.cod_local, mesaSel.mesa)}`), {
            ci: encargadoForm.ci, nombre: encargadoForm.nombre, telefono: encargadoForm.telefono,
            distrito: distritoFiltroMaster, cod_local: mesaSel.cod_local, local: mesaSel.local, mesa: mesaSel.mesa,
        });
        alert(`✅ ${encargadoForm.nombre} asignado a Mesa ${mesaSel.mesa} de ${mesaSel.local}.`);
        setEncargadoForm({ ci: "", nombre: "", telefono: "" });
    };
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

    const [mesaEscrutinioSelect, setMesaEscrutinioSelect] = useState("");
    const [formEscrutinioAdmin, setFormEscrutinioAdmin] = useState({ intendente: "", concejales: {} });

    const [fDetCoord, setFDetCoord] = useState("TODOS");
    const [fDetVoto, setFDetVoto] = useState("TODOS");
    const [fDetPC, setFDetPC] = useState("TODOS");

    useEffect(() => {
        setConcejalEnDetalle(null);
        setForm(f => ({...f, distrito: distritoFiltroMaster === "TODOS" ? "" : distritoFiltroMaster, concejal: "SIN ASIGNAR", coordinador: coordFijado ? f.coordinador : ""}));
        setResultadosNombre([]);
        setBusquedaNombre("");
    }, [distritoFiltroMaster]); // eslint-disable-line react-hooks/exhaustive-deps

    // FUNCIONES DEL LÁPIZ DE EDICIÓN
    const guardarEdicionVoto = () => {
        if (!editandoVotoId) return;
        import('firebase/database').then(({ update, ref }) => {
            update(ref(db, `votos_seguros/${editandoVotoId}`), {
                concejal: formEdicion.concejal,
                coordinador: formEdicion.coordinador.toUpperCase(),
                semaforo: formEdicion.semaforo
            }).then(() => {
                alert("✅ Voto actualizado correctamente.");
                setEditandoVotoId(null);
            }).catch(e => alert("Error: " + e.message));
        });
    };

    // BOTÓN MÁGICO: AUTO-CORREGIR HUÉRFANOS
    const autoCorregirVotos = () => {
        if(!window.confirm("¿Estás seguro de Auto-Asignar los votos 'SIN ASIGNAR' revisando qué correo los registró?")) return;
        
        const updates = {};
        let corregidos = 0;
        const usuariosArr = Object.values(usuariosRegistrados);

        votosFiltrados.forEach(v => {
            if (!v.concejal || v.concejal === "SIN ASIGNAR") {
                const usuarioCreador = usuariosArr.find(u => u.email === v.registradoPor);
                if (usuarioCreador && usuarioCreador.rol === 'concejal' && usuarioCreador.nombre_oficial) {
                    updates[`votos_seguros/${v.id}/concejal`] = usuarioCreador.nombre_oficial;
                    corregidos++;
                }
            }
        });

        if (corregidos > 0) {
            import('firebase/database').then(({ update, ref }) => {
                update(ref(db), updates).then(() => {
                    alert(`✅ ¡Éxito! Se detectaron y asignaron correctamente ${corregidos} votos huérfanos a sus respectivos concejales.`);
                }).catch(e => alert("Error al guardar: " + e.message));
            });
        } else {
            alert("No se encontraron votos huérfanos que coincidan con el correo de un concejal configurado.");
        }
    };

    const buscarCedulaAdmin = async () => { const p = await buscarPadronPorCedula(form.cedula); if (p) setForm(prev => ({...prev, nombre: p.nombre, apellido: p.apellido, local: p.local, mesa: p.mesa, orden: p.orden, distrito: p.distrito})); else alert("No encontrada."); };
    
    const buscarPorNombre = async () => {
        if(busquedaNombre.trim().length < 3) return alert("Escribe al menos 3 letras.");
        const distritoFiltro = (distritoFiltroMaster === "TODOS" || perfil.rol === 'super_admin') ? null : distritoFiltroMaster;
        const res = (await buscarPadronPorNombre(busquedaNombre, distritoFiltro)).map(r => ({ ...r, ci: r.cedula }));
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
        setForm({...form, cedula:"", nombre:"", apellido:"", local:"", mesa:"", orden:"", coordinador: coordFijado ? form.coordinador : ""});
        if (!coordFijado) setModoNuevoCoord(false);
        alert("✅ Voto Registrado.");
    };

    const crearCoordinador = () => {
        const nombre = nuevoCoord.nombre.trim().toUpperCase();
        if (!nombre) return alert("Falta el nombre del coordinador.");
        push(ref(db, 'coordinadores'), { nombre, localidad: nuevoCoord.localidad.trim().toUpperCase(), telefono: nuevoCoord.telefono.trim(), tipo: nuevoCoord.tipo, distrito: form.distrito || perfil.distrito, creadoPor: usuarioActivo.email, fecha: new Date().toLocaleString() });
        setForm(f => ({...f, coordinador: nombre}));
        setModoNuevoCoord(false);
        setNuevoCoord({ nombre: "", localidad: "", telefono: "", tipo: "URBANA" });
        alert("✅ Coordinador creado: " + nombre);
    };
    
    const eliminarVoto = (id) => { if(window.confirm("⚠️ ¿Eliminar registro?")) remove(ref(db, `votos_seguros/${id}`)); };

    const abrirModalMesa = (mesa) => { setMesaEnDetalle(mesa); setFormVeedor({ ci: "", nombre: "", telefono: "", mesa: String(mesa), distrito: distritoFiltroMaster }); };
    const buscarVeedorModal = () => { const p = (padronGlobal||{})[formVeedor.ci]; if (p) setFormVeedor(prev => ({...prev, nombre: `${p.nombre} ${p.apellido}`, distrito: p.distrito})); else alert("Cédula no encontrada."); };
    const asignarVeedorMesaModal = () => { if (!formVeedor.ci || !formVeedor.nombre) return alert("Faltan datos."); set(ref(db, `dia_d/asignaciones_veedores/${generarLlaveMesa(formVeedor.distrito, formVeedor.mesa)}`), formVeedor); alert(`✅ Mesa reasignada a ${formVeedor.nombre}.`); };
    const seleccionarMesaEscrutinio = (m) => { setMesaEscrutinioSelect(String(m)); const dataGuardada = (escrutinioGlobal || {})[generarLlaveMesa(distritoFiltroMaster, m)]; if (dataGuardada) { setFormEscrutinioAdmin(dataGuardada); } else { const initConc = {}; configApp.concejales.forEach(c => initConc[c] = ""); setFormEscrutinioAdmin({ intendente: "", concejales: initConc, rivalesIntendente: [], rivalesConcejales: [], blancos: "", nulos: "" }); } };
    const guardarEscrutinioAdmin = () => { if(!mesaEscrutinioSelect) return; set(ref(db, `dia_d/escrutinio/${generarLlaveMesa(distritoFiltroMaster, mesaEscrutinioSelect)}`), { ...formEscrutinioAdmin, timestamp: Date.now() }); alert("✅ Acta actualizada."); };
    const reabrirMesaAdmin = (m) => { if(window.confirm(`⚠️ ¿DESBLOQUEAR MESA ${m}?\nEl veedor podrá volver a marcar votos.`)) { remove(ref(db, `dia_d/mesas_cerradas/${generarLlaveMesa(distritoFiltroMaster, m)}`)); } };

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
        const misVotosDetalle = votosFiltrados.filter(v => concejalCoincide(v.concejal, concejalEnDetalle));
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
                        </div>
                    </div>
                    <table className="w-full text-left min-w-[800px]"><thead className="bg-slate-100 text-[10px] uppercase"><tr><th className="p-3">Elector</th><th className="p-3">Mesa/Ord</th><th className="p-3">Coordinador</th><th className="p-3">Día D</th></tr></thead>
                        <tbody className="divide-y text-sm">
                            {votosFiltradosDetalle.slice(0, limiteDetalleConcejal).map(v => {
                                const llave = generarLlave(v.distrito, v.mesa, v.orden);
                                const esDuplicado = cedulasDuplicadas.has(v.cedula);
                                const semaforoReal = esDuplicado ? 'ROJO' : v.semaforo;
                                return (
                                    <tr key={v.id} className={esDuplicado ? 'bg-red-50' : ''}>
                                        <td className="p-3 font-bold">{v.nombre} {v.apellido} {esDuplicado && <span className="ml-2 text-[10px] text-red-600 bg-red-100 px-2 rounded uppercase font-black">⚠️ Choque</span>}<br/><span className="text-[10px] text-gray-500">C.I: {v.cedula} | <span className={`text-${semaforoReal === 'VERDE' ? 'green' : semaforoReal === 'AMARILLO' ? 'yellow' : 'red'}-500`}>●</span></span></td>
                                        <td className="p-3 font-bold text-xs">M:{v.mesa} | O:{v.orden}</td>
                                        <td className="p-3 text-xs font-bold text-slate-500">{v.coordinador || '-'}</td>
                                        <td className="p-3">
                                            {yaVotaronFiltrados[llave] ? <span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {yaVotaronFiltrados[llave].hora}</span> : <span className="text-gray-300 font-bold text-[10px]">PENDIENTE</span>}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderDashboardGlobal = () => {
        const totalPadron = Object.keys(padronGlobal || {}).length;
        const totalSeguros = (votosSeguros || []).length;
        const totalVotaron = Object.keys(yaVotaronGlobal || {}).length;

        const statsPorDistrito = DISTRITOS_CONCEPCION.map(d => {
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
                                        <td className="p-3 flex items-center gap-2"><span className="text-gray-400 w-4 font-black">{i+1}.</span> <span className="text-slate-700 group-hover:text-blue-700">{s.distrito}</span></td>
                                        <td className="p-3 text-center text-slate-400">{s.meta > 0 ? s.meta : 'No config.'}</td>
                                        <td className="p-3 text-center text-blue-600 text-lg font-black">{s.seguros}</td>
                                        <td className="p-3 text-center"><div className="w-full bg-slate-200 rounded-full h-4 relative overflow-hidden flex items-center justify-center"><div className={`absolute top-0 left-0 h-full ${s.pct >= 100 ? 'bg-green-500' : s.pct > 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{width: `${Math.min(s.pct, 100)}%`}}></div><span className="relative z-10 text-[10px] text-black drop-shadow-md">{s.pct}%</span></div></td>
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
                                    {DISTRITOS_CONCEPCION.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
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
                        {DISTRITOS_CONCEPCION.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            )}

            <div className="bg-white flex border-b shadow-sm sticky top-[68px] z-50 print:hidden px-2 items-center justify-center w-full">
                
                <div className="flex items-center max-w-full pt-2 pb-2">
                    
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pr-2">
                        {!esMaster && <button onClick={() => {setActiveTab("registro"); setMenuAbierto(false);}} className={`p-2 px-3 font-black text-[11px] flex gap-2 items-center rounded-lg transition-colors shrink-0 ${activeTab === 'registro' ? 'text-red-600 bg-red-50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><CheckCircle size={16}/> REGISTRO</button>}
                        
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

                                {esMaster && (
                                <button onClick={() => {setActiveTab("limpiar"); setMenuAbierto(false);}} className={`px-4 py-3 text-left font-black text-xs transition-colors flex items-center gap-3 border-t border-slate-100 ${activeTab === 'limpiar' ? 'bg-orange-50 text-orange-600' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-700'}`}>
                                    <Trash2 size={16} className={activeTab === 'limpiar' ? "text-orange-500" : "text-red-400"}/> LIMPIAR DÍA D
                                </button>
                                )}

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
                        <PanelUsuarios perfil={perfil} usuariosRegistrados={usuariosRegistrados} configuracionDepartamental={configuracionDepartamental} db={db} distritoFiltro={distritoFiltroMaster} usuariosOnline={usuariosOnline} />
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
                            <input type="text" placeholder="Escribe Nombre o Apellido..." className="flex-1 min-w-0 p-3 border-2 rounded-xl font-bold uppercase outline-none focus:border-red-500" value={busquedaNombre} onChange={e => setBusquedaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarPorNombre()} />
                            <button onClick={buscarPorNombre} title="Buscar" className="bg-slate-300 hover:bg-slate-400 text-slate-800 px-5 rounded-xl font-bold transition-colors shrink-0"><Search size={18}/></button>
                            <button onClick={()=>{setBusquedaNombre(""); setResultadosNombre([]);}} title="Nueva búsqueda" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-4 rounded-xl font-bold transition-colors shrink-0"><RefreshCw size={18}/></button>
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
                    <div className="flex gap-2 mb-6"><input type="number" placeholder="N° DE CÉDULA" className="flex-1 min-w-0 p-4 border-2 rounded-xl text-xl font-bold outline-none focus:border-red-500" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} onKeyDown={e => e.key === 'Enter' && buscarCedulaAdmin()} /><button onClick={buscarCedulaAdmin} title="Buscar" className="bg-slate-800 text-white px-5 rounded-xl font-bold shrink-0"><Search /></button><button onClick={()=>setForm(f=>({...f, cedula:"", nombre:"", apellido:"", telefono:"", local:"", mesa:"", orden:"", distrito: distritoFiltroMaster}))} title="Nueva búsqueda" className="bg-slate-100 hover:bg-slate-200 text-slate-500 px-4 rounded-xl font-bold shrink-0"><RefreshCw size={22}/></button></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" readOnly placeholder="NOMBRES" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.nombre} /><input type="text" readOnly placeholder="APELLIDOS" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.apellido} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" placeholder="TELÉFONO" className="p-3 border-2 border-blue-200 rounded-lg font-bold outline-none" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
                        <div className="flex flex-col">
                            <input type="text" readOnly placeholder="DISTRITO" className={`p-3 border rounded-lg font-bold ${perfil.rol === 'super_admin' && form.distrito && form.distrito !== perfil.distrito ? 'bg-red-50 border-red-400 text-red-700' : 'bg-gray-50'}`} value={form.distrito} />
                            {perfil.rol === 'super_admin' && form.distrito && form.distrito !== perfil.distrito && (
                                <span className="text-[10px] font-black text-red-600 mt-1 flex items-center gap-1"><AlertTriangle size={12}/> ESTE ELECTOR NO ES DE {perfil.distrito}</span>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4"><input type="text" readOnly className="p-3 border bg-gray-50 text-xs col-span-3 md:col-span-1" value={form.local} placeholder="LOCAL" /><input type="text" readOnly className="p-3 border bg-gray-50 font-bold" value={form.mesa ? `MESA ${form.mesa}` : "MESA"} /><input type="text" readOnly className="p-3 border-2 border-red-100 font-black text-red-600 bg-red-50" value={form.orden ? `ORDEN ${form.orden}` : "ORDEN"} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">CONCEJAL</label><select className="p-4 border-2 rounded-xl font-bold outline-none" value={form.concejal} onChange={e=>setForm({...form, concejal: e.target.value})}><option value="SIN ASIGNAR">SIN ASIGNAR</option>{configApp.concejales.map(c => <option key={c} value={c}>{c.includes(' - ') ? c.split(' - ')[1] : c}</option>)}</select></div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COORDINADOR</label>
                            <div className="flex gap-2">
                                <select className="flex-1 p-4 border-2 rounded-xl font-bold outline-none" value={form.coordinador} onChange={e=>setForm({...form, coordinador: e.target.value})}><option value="">SELECCIONE...</option>{listaCoordinadores.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                <button type="button" onClick={()=>setModoNuevoCoord(m=>!m)} className={`px-4 rounded-xl font-black text-xl ${modoNuevoCoord?'bg-red-100 text-red-700':'bg-slate-200'}`}>{modoNuevoCoord?'×':'+'}</button>
                            </div>
                            <label className="flex items-center gap-1 mt-1 text-[10px] font-bold text-slate-500 cursor-pointer"><input type="checkbox" checked={coordFijado} onChange={e=>setCoordFijado(e.target.checked)} /> FIJAR (carga rápida)</label>
                            {coordFijado && form.coordinador && <span className="text-[10px] font-black text-green-600">📌 {form.coordinador}</span>}
                        </div>
                        <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COLOR</label><select className={`w-full p-4 rounded-xl font-black text-white outline-none ${form.semaforo==='VERDE'?'bg-green-500':form.semaforo==='AMARILLO'?'bg-yellow-500':'bg-red-500'}`} value={form.semaforo} onChange={e=>setForm({...form, semaforo: e.target.value})}><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select></div>
                    </div>
                    {modoNuevoCoord && (
                        <div className="mt-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                            <p className="text-xs font-black text-amber-800 mb-2 flex items-center gap-1"><UserPlus size={14}/> NUEVO COORDINADOR</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input type="text" placeholder="NOMBRE" className="p-3 border-2 rounded-lg font-bold uppercase outline-none" value={nuevoCoord.nombre} onChange={e=>setNuevoCoord({...nuevoCoord, nombre: e.target.value.toUpperCase()})} />
                                <input type="text" placeholder="LOCALIDAD" className="p-3 border-2 rounded-lg font-bold uppercase outline-none" value={nuevoCoord.localidad} onChange={e=>setNuevoCoord({...nuevoCoord, localidad: e.target.value.toUpperCase()})} />
                                <input type="text" placeholder="TELÉFONO" className="p-3 border-2 rounded-lg font-bold outline-none" value={nuevoCoord.telefono} onChange={e=>setNuevoCoord({...nuevoCoord, telefono: e.target.value})} />
                                <select className="p-3 border-2 rounded-lg font-bold outline-none" value={nuevoCoord.tipo} onChange={e=>setNuevoCoord({...nuevoCoord, tipo: e.target.value})}><option value="URBANA">🏙️ URBANA</option><option value="RURAL">🌾 RURAL</option></select>
                            </div>
                            <button type="button" onClick={crearCoordinador} className="w-full mt-3 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-black">CREAR COORDINADOR</button>
                        </div>
                    )}
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

                        const cumpleConcejal = filtroConcejal === "TODOS" || concejalCoincide(v.concejal, filtroConcejal);
                        const cumpleCoord = filtroCoordinadorAdmin === "TODOS" || v.coordinador === filtroCoordinadorAdmin;
                        const cumpleColor = filtroSemaforoAdmin === "TODOS" || v.semaforo === filtroSemaforoAdmin;
                        const cumpleDuplicado = !soloDuplicados || cedulasDuplicadas.has(v.cedula);

                        return cumpleTexto && cumpleConcejal && cumpleCoord && cumpleColor && cumpleDuplicado;
                    });

                    // Contador por LOCAL DE VOTACIÓN (respeta los filtros activos)
                    const conteoPorLocal = {};
                    listaMostrar.forEach(v => { const loc = v.local || "SIN LOCAL"; conteoPorLocal[loc] = (conteoPorLocal[loc] || 0) + 1; });
                    const localesOrdenados = Object.entries(conteoPorLocal).sort((a, b) => b[1] - a[1]);

                    // VISIÓN GLOBAL: solo panorama por distrito (no se mezclan datos individuales)
                    if (distritoFiltroMaster === "TODOS") {
                        const porDistrito = {};
                        votosFiltrados.forEach(v => { const d = v.distrito || "SIN DISTRITO"; porDistrito[d] = (porDistrito[d] || 0) + 1; });
                        const totalDepto = votosFiltrados.length;
                        return (
                            <div className="bg-white p-6 rounded-2xl shadow border animate-fade-in">
                                <h2 className="font-black text-xl mb-1 text-slate-800 flex items-center gap-2"><Globe className="text-blue-500"/> PANORAMA POR DISTRITO</h2>
                                <p className="text-xs font-bold text-gray-400 mb-4">Registros cargados por cada distrito ({totalDepto} en total). Tocá un distrito para ver su detalle.</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {DISTRITOS_CONCEPCION.map(d => {
                                        const n = porDistrito[d] || 0;
                                        return (
                                            <button key={d} onClick={() => setDistritoFiltroMaster(d)} className={`text-left border rounded-xl p-4 transition-colors ${n > 0 ? 'bg-slate-50 hover:bg-blue-50' : 'bg-white hover:bg-slate-50 opacity-70'}`}>
                                                <div className={`text-3xl font-black ${n > 0 ? 'text-slate-800' : 'text-slate-300'}`}>{n}</div>
                                                <div className="text-[10px] font-black text-slate-500 uppercase mt-1 leading-tight">{d}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    }

                    return (
                    <div className="bg-white p-4 rounded-2xl shadow border overflow-x-auto print:hidden animate-fade-in relative">
                        {localesOrdenados.length > 0 && (
                            <div className="mb-4">
                                <p className="text-[11px] font-black text-slate-500 uppercase mb-2 flex items-center gap-1"><MapPin size={12}/> Clasificación por Local de Votación ({localesOrdenados.length} locales · {listaMostrar.length} cargas)</p>
                                <div className="flex gap-2 overflow-x-auto pb-2">
                                    {localesOrdenados.map(([loc, n]) => (
                                        <div key={loc} className="flex-shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 min-w-[140px]">
                                            <div className="text-2xl font-black text-red-700">{n}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase leading-tight line-clamp-2">{loc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="flex flex-col md:flex-row gap-4 mb-4 items-center">
                            <input type="text" placeholder="BUSCAR CÉDULA/NOMBRE" className="p-2 border rounded font-bold uppercase flex-1 w-full" value={filtroTexto} onChange={e=>{setFiltroTexto(e.target.value); setLimiteListaAdmin(100);}}/>
                            <select className="p-2 border rounded font-bold text-sm w-full md:w-auto" value={filtroConcejal} onChange={e=>{setFiltroConcejal(e.target.value); setLimiteListaAdmin(100);}}>
                                <option value="TODOS">CONCEJAL: TODOS</option>
                                {configApp.concejales.map(c=><option key={c} value={c}>{c.includes(' - ') ? c.split(' - ')[1] : c}</option>)}
                                <option value="SIN ASIGNAR">SIN ASIGNAR</option>
                            </select>
                            <select className="p-2 border rounded font-bold text-sm w-full md:w-auto" value={filtroCoordinadorAdmin} onChange={e=>{setFiltroCoordinadorAdmin(e.target.value); setLimiteListaAdmin(100);}}><option value="TODOS">COORD: TODOS</option>{coordinadoresUnicos.map(c=><option key={c} value={c}>{c}</option>)}</select>
                            <select className="p-2 border rounded font-bold text-sm w-full md:w-auto" value={filtroSemaforoAdmin} onChange={e=>{setFiltroSemaforoAdmin(e.target.value); setLimiteListaAdmin(100);}}><option value="TODOS">COLOR: TODOS</option><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select>
                            
                            {/* BOTÓN AUTO-CORREGIR HUÉRFANOS */}
                            {esMaster && <button onClick={autoCorregirVotos} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-black flex items-center justify-center gap-2 transition-colors shrink-0 shadow-md" title="Asigna los votos SIN ASIGNAR al concejal que los creó"><RefreshCw size={18}/> AUTO-CORREGIR HUÉRFANOS</button>}
                            
                            {esMaster && <button onClick={exportarExcel} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-black flex items-center justify-center gap-2 transition-colors shrink-0 shadow-md"><Download size={18}/> EXPORTAR EXCEL</button>}
                            
                            {/* FILTRO DE DUPLICADOS - TOGGLE */}
                            {cedulasDuplicadas.size > 0 && (
                                <button onClick={() => { setSoloDuplicados(p => !p); setLimiteListaAdmin(100); }} className={`px-4 py-2 rounded-xl font-black flex items-center justify-center gap-2 shrink-0 shadow-sm border-2 transition-all ${soloDuplicados ? 'bg-red-600 text-white border-red-700 scale-105' : 'bg-red-100 border-red-400 text-red-700 animate-pulse'}`}>
                                    <AlertTriangle size={18}/> {cedulasDuplicadas.size} DUPLICADOS {soloDuplicados ? '← VER TODOS' : '← VER SOLO ESTOS'}
                                </button>
                            )}
                        </div>
                        <table className="w-full text-left min-w-[1000px]"><thead className="bg-slate-800 text-white text-xs uppercase"><tr><th className="p-3">Votante</th><th className="p-3">Mesa/Ord</th><th className="p-3">Cargado Por</th><th className="p-3">Día D</th><th className="p-3 text-center">Acciones</th></tr></thead>
                            <tbody className="divide-y text-sm">
                            {listaMostrar.slice(0, limiteListaAdmin).map(v => {
                                    const llave = generarLlave(v.distrito, v.mesa, v.orden);
                                    
                                    // PINTA DE ROJO SI ESTÁ DUPLICADO AUTOMÁTICAMENTE
                                    const esDuplicado = cedulasDuplicadas.has(v.cedula);
                                    const colorSemaforoReal = esDuplicado ? 'ROJO' : v.semaforo;

                                    return (
                                    <tr key={v.id} className={`hover:bg-slate-50 transition-colors ${esDuplicado ? 'bg-red-50' : ''}`}>
                                    <td className="p-3 font-bold">
                                        {v.nombre} {v.apellido} 
                                        {esDuplicado && <span className="ml-2 text-[9px] bg-red-600 text-white px-2 py-0.5 rounded uppercase font-black tracking-widest shadow-sm">⚠️ CHOQUE DE VOTO</span>}
                                        <br/>
                                        <span className="text-[10px] text-gray-500">C.I: {v.cedula} | <span className={`text-${colorSemaforoReal === 'VERDE' ? 'green' : colorSemaforoReal === 'AMARILLO' ? 'yellow' : 'red'}-500 text-lg leading-none`}>●</span></span>
                                    </td>
                                    <td className="p-3 text-xs font-bold">{v.distrito}<br/>M: {v.mesa} | O: {v.orden}</td>
                                    <td className="p-3 text-xs font-bold text-slate-800 uppercase">
                                        ⭐ {v.concejal && v.concejal !== "SIN ASIGNAR" ? (v.concejal.includes(' - ') ? v.concejal.split(' - ')[1] : v.concejal) : 'SIN ASIGNAR'}
                                        <div className="text-[9px] text-gray-500 mt-1" title="Correo del usuario que subió este voto">👤 USUARIO: {v.registradoPor || '-'}</div>
                                        <div className="text-[9px] text-gray-500 mt-0.5">COORD: {v.coordinador || '-'}</div>
                                    </td>
                                    <td className="p-3">
                                        {yaVotaronFiltrados[llave] ? <span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {yaVotaronFiltrados[llave].hora}</span> : <span className="bg-gray-100 text-gray-400 text-[10px] font-bold px-2 py-1 rounded">PENDIENTE</span>}
                                        {pasoPCFiltrados[llave] && <span className="text-[10px] font-bold text-blue-600 mt-1 block">📍 PC: {pasoPCFiltrados[llave].registradoPorNombre}</span>}
                                    </td>
                                    <td className="p-3">
                                        <div className="flex justify-center items-center gap-3">
                                            <button onClick={()=>enviarWhatsAppCarnet(v)} className="text-green-500 hover:text-green-700"><Send size={16}/></button>
                                            <button onClick={()=>imprimirCarnetFisico(v, FOTOS_LOCALES_CONCEJALES[normalizarNombre(v.concejal)])} className="text-slate-700 hover:text-black"><Printer size={16}/></button>
                                            
                                            {/* BOTÓN LÁPIZ DE EDICIÓN */}
                                            {!esMaster && (<>
                                            <button onClick={()=>{
                                                setEditandoVotoId(v.id);
                                                setFormEdicion({
                                                    concejal: v.concejal || "SIN ASIGNAR",
                                                    coordinador: v.coordinador || "",
                                                    semaforo: v.semaforo || "VERDE"
                                                });
                                            }} className="text-blue-500 hover:text-blue-700 ml-2 border-l pl-2" title="Editar Asignación de Voto">
                                                <Edit2 size={16}/>
                                            </button>

                                            <button onClick={()=>eliminarVoto(v.id)} className="text-red-400 hover:text-red-700 border-l pl-2"><Trash2 size={16}/></button>
                                            </>)}
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

                        {/* MODAL DE EDICIÓN DE VOTO */}
                        {editandoVotoId && (
                            <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                                <div className="bg-white p-6 rounded-3xl shadow-2xl max-w-md w-full border-t-8 border-blue-600 animate-fade-in">
                                    <h3 className="font-black text-xl mb-4 text-slate-800">EDITAR VOTO</h3>
                                    <p className="text-xs text-slate-500 font-bold mb-6">Modifica a qué equipo o color pertenece esta persona.</p>
                                    
                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">ASIGNAR AL CONCEJAL</label>
                                            <select className="w-full p-3 border-2 rounded-xl font-bold outline-none uppercase" value={formEdicion.concejal} onChange={e=>setFormEdicion({...formEdicion, concejal: e.target.value})}>
                                                <option value="SIN ASIGNAR">SIN ASIGNAR</option>
                                                {configApp.concejales.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">COORDINADOR</label>
                                            <input type="text" className="w-full p-3 border-2 rounded-xl font-bold uppercase outline-none" value={formEdicion.coordinador} onChange={e=>setFormEdicion({...formEdicion, coordinador: e.target.value})} placeholder="Ej: JUAN PEREZ"/>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 block mb-1">COLOR (ESTADO)</label>
                                            <select className={`w-full p-3 border-2 rounded-xl font-black text-white outline-none ${formEdicion.semaforo==='VERDE'?'bg-green-500':formEdicion.semaforo==='AMARILLO'?'bg-yellow-500':'bg-red-500'}`} value={formEdicion.semaforo} onChange={e=>setFormEdicion({...formEdicion, semaforo: e.target.value})}>
                                                <option value="VERDE">🟢 VERDE</option>
                                                <option value="AMARILLO">🟡 AMARILLO</option>
                                                <option value="ROJO">🔴 ROJO</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-3">
                                        <button onClick={guardarEdicionVoto} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-black hover:bg-blue-700 shadow-md">GUARDAR</button>
                                        <button onClick={()=>setEditandoVotoId(null)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-black hover:bg-slate-300">CANCELAR</button>
                                    </div>
                                </div>
                            </div>
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
                        <p className="text-sm text-gray-600 mb-6 font-bold">Estas personas fueron registradas por más de un candidato en esta ciudad. El sistema ya las ha marcado automáticamente en ROJO.</p>
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
                                                    <div className="text-[10px] text-gray-400 font-bold uppercase mb-1">Cargado por el Concejal:</div>
                                                    <div className="font-black text-slate-700 uppercase">{v.concejal || "SIN ASIGNAR"}</div>
                                                    <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase bg-slate-100 p-1 rounded inline-block truncate max-w-[90%]" title={v.registradoPor}>👤 USUARIO: {v.registradoPor || "-"}</div>
                                                    <button onClick={()=>eliminarVoto(v.id)} className="absolute top-2 right-2 text-red-300 hover:text-red-600" title="Eliminar este duplicado"><Trash2 size={16}/></button>
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
                                    <h2 className="font-black text-gray-600 mb-2 text-center">CALIDAD DE VOTOS ({totalVotosSeguros})</h2>
                                    <p className="text-[10px] text-gray-400 font-bold text-center mb-4 uppercase">Los votos duplicados se marcan automáticamente como Rojos.</p>
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
                                        <div className="flex justify-between items-center px-4 py-2 bg-slate-50 border-b text-[10px] font-black text-slate-500 uppercase">
                                            <span>Total: {Object.keys(pasoPCFiltrados).length} registros</span>
                                            <span className="text-green-600">✅ Votaron: {Object.entries(pasoPCFiltrados).filter(([k]) => yaVotaronFiltrados[k]).length}</span>
                                            <span className="text-orange-500">⏳ Pendientes: {Object.entries(pasoPCFiltrados).filter(([k]) => !yaVotaronFiltrados[k]).length}</span>
                                        </div>
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase">
                                                <tr>
                                                    <th className="p-3 sticky top-0 bg-slate-100">Nombre Completo</th>
                                                    <th className="p-3 sticky top-0 bg-slate-100 text-center">Mesa</th>
                                                    <th className="p-3 sticky top-0 bg-slate-100">Registró PC</th>
                                                    <th className="p-3 sticky top-0 bg-slate-100">Hora PC</th>
                                                    <th className="p-3 sticky top-0 bg-slate-100 text-center">¿Votó?</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y text-sm">
                                                {Object.entries(pasoPCFiltrados).map(([llave, pcData]) => {
                                                    const elector = padronLlaves[llave];
                                                    const votoData = yaVotaronFiltrados[llave];
                                                    const parts = llave.split('_');
                                                    const mesa = parts.length > 1 ? parts[parts.length - 2] : '-';
                                                    return (
                                                        <tr key={llave} className={`hover:bg-slate-50 ${votoData ? 'bg-green-50/40' : ''}`}>
                                                            <td className="p-3">
                                                                {elector ? (
                                                                    <>
                                                                        <div className="font-black text-sm text-slate-800">{elector.nombre} {elector.apellido}</div>
                                                                        <div className="text-[9px] text-gray-400 font-bold">C.I: {elector.ci}</div>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs font-mono">{llave}</span>
                                                                )}
                                                            </td>
                                                            <td className="p-3 font-black text-center text-blue-700 text-lg">{mesa}</td>
                                                            <td className="p-3 font-bold text-blue-800 text-xs">{pcData.registradoPorNombre}</td>
                                                            <td className="p-3 text-xs text-gray-500">{pcData.hora}</td>
                                                            <td className="p-3 text-center">
                                                                {votoData
                                                                    ? <span className="bg-green-100 text-green-700 font-black text-[9px] px-2 py-1 rounded-full">✅ {votoData.hora}</span>
                                                                    : <span className="bg-orange-100 text-orange-600 font-black text-[9px] px-2 py-1 rounded-full">⏳ PENDIENTE</span>}
                                                            </td>
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
                                                    // USO DE LA FUNCIÓN INTELIGENTE PARA LOS CÁLCULOS
                                                    const votosDeEsteConcejal = votosFiltrados.filter(v => concejalCoincide(v.concejal, c));
                                                    const cant = votosDeEsteConcejal.length;
                                                    const votaron = votosDeEsteConcejal.filter(v => yaVotaronFiltrados[generarLlave(v.distrito, v.mesa, v.orden)]).length;
                                                    
                                                    const verdeC = votosDeEsteConcejal.filter(v => !cedulasDuplicadas.has(v.cedula) && v.semaforo === 'VERDE').length;
                                                    const amarilloC = votosDeEsteConcejal.filter(v => !cedulasDuplicadas.has(v.cedula) && v.semaforo === 'AMARILLO').length;
                                                    const rojoC = votosDeEsteConcejal.filter(v => cedulasDuplicadas.has(v.cedula) || v.semaforo === 'ROJO').length;

                                                    // EXTRACCIÓN DE FOTOS (Mapeo inteligente)
                                                    const nombreNormalizado = normalizarNombre(c);
                                                    const fotoFirebase = fotosConcejales[c] || fotosConcejales[nombreNormalizado];
                                                    const fotoLocal = FOTOS_LOCALES_CONCEJALES[nombreNormalizado];
                                                    const fotoFinal = fotoFirebase || fotoLocal;

                                                    const pctMeta = configApp.meta_concejales > 0 ? Math.min(Math.round((cant/configApp.meta_concejales)*100), 100) : 0;
                                                    
                                                    // Texto Limpio para Mostrar (sin "16 - ")
                                                    const nombreLimpio = c.includes(' - ') ? c.split(' - ')[1].trim() : c.trim();

                                                    return (
                                                        <div key={c} onClick={() => {setConcejalEnDetalle(c); setFDetCoord("TODOS"); setFDetVoto("TODOS"); setFDetPC("TODOS"); setLimiteDetalleConcejal(100);}} className="cursor-pointer hover:scale-105 transition-transform duration-300 bg-gradient-to-br from-slate-900 to-black rounded-2xl p-5 text-white shadow-xl relative overflow-hidden group border border-slate-700">
                                                            <div className="flex items-center gap-4 relative z-10">
                                                                <div className="relative w-16 h-16 rounded-full border-2 border-red-500 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                                    {fotoFinal ? <img src={fotoFinal} alt={c} className="w-full h-full object-cover"/> : <IdCard className="text-red-300" size={32}/>}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="font-black text-sm truncate uppercase tracking-wider text-red-100" title={nombreLimpio}>{nombreLimpio}</div>
                                                                    <div className="flex gap-1 mt-1">
                                                                        <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-[9px] font-black" title="Votos Seguros">{verdeC}</span>
                                                                        <span className="w-4 h-4 bg-yellow-500 text-white rounded-full flex items-center justify-center text-[9px] font-black" title="Votos en Duda">{amarilloC}</span>
                                                                        <span className="w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[9px] font-black" title="Votos Duplicados o Rojos">{rojoC}</span>
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

                {/* PESTAÑAS DE ESCRUTINIO Y LIVE IGUALES... */}
                {activeTab === "dia_d" && (
                    distritoFiltroMaster === "TODOS" ? (
                        <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para ver el monitor de mesas o el Live Feed, selecciona un distrito en el menú de arriba.</p></div>
                    ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-6 rounded-2xl shadow border border-t-4 border-t-red-600">
                            <h2 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><Bell className="text-red-600"/> VOTACIÓN EN VIVO ({distritoFiltroMaster})</h2>
                            <div className="flex items-center justify-center gap-4 md:gap-8 flex-wrap">
                                <div className="text-center">
                                    <div className="text-5xl md:text-6xl font-black text-green-600">{totalVotosEmitidosDiaD}</div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase mt-1">Ya votaron</div>
                                </div>
                                <div className="text-3xl font-black text-slate-300">/</div>
                                <div className="text-center">
                                    <div className="text-5xl md:text-6xl font-black text-slate-700">{totalPadronDistrito}</div>
                                    <div className="text-[10px] font-black text-slate-500 uppercase mt-1">Padrón del distrito</div>
                                </div>
                                <div className="text-center bg-slate-900 text-white rounded-2xl px-5 py-3">
                                    <div className="text-3xl md:text-4xl font-black">{totalPadronDistrito > 0 ? Math.round((totalVotosEmitidosDiaD / totalPadronDistrito) * 100) : 0}%</div>
                                    <div className="text-[9px] font-black uppercase mt-1">Participación</div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow border">
                            <h2 className="font-black text-xl text-slate-800 mb-1 flex items-center gap-2"><MapPin className="text-red-600"/> PADRÓN POR LOCAL DE VOTACIÓN ({distritoFiltroMaster})</h2>
                            <p className="text-xs text-gray-500 font-bold mb-4">{localMesaData.locales.length} locales · {localMesaData.totalDistrito.toLocaleString()} electores. Cada local tiene sus propias mesas (Mesa 1, 2, 3…) — no se mezclan entre instituciones.</p>
                            <div className="space-y-4">
                                {localMesaData.locales.map(loc => (
                                    <div key={loc.cod_local} className="border rounded-xl overflow-hidden">
                                        <div className="bg-slate-800 text-white px-4 py-3 flex justify-between items-center gap-3">
                                            <div className="font-black text-sm uppercase leading-tight">{loc.local}</div>
                                            <div className="text-right shrink-0"><div className="text-2xl font-black leading-none">{loc.total.toLocaleString()}</div><div className="text-[9px] uppercase text-slate-300 mt-0.5">electores · {loc.mesas.length} mesas</div></div>
                                        </div>
                                        <div className="p-3 flex flex-wrap gap-2">
                                            {loc.mesas.map(m => {
                                                const asig = (asignacionesVeedores || {})[claveMesaLocal(loc.cod_local, m.mesa)];
                                                return (
                                                <button key={m.mesa} onClick={() => abrirMesaLocal(loc, m)} title="Ver padrón / asignar encargado" className={`border rounded-lg px-3 py-1.5 text-center min-w-[68px] transition-colors ${asig ? 'bg-green-50 border-green-300 hover:bg-green-100' : 'bg-slate-50 hover:bg-red-50'}`}>
                                                    <div className="text-[9px] font-black text-slate-400 uppercase">Mesa {m.mesa}</div>
                                                    <div className="text-lg font-black text-slate-800 leading-none">{m.cantidad}</div>
                                                    {asig && <div className="text-[8px] font-black text-green-600 mt-0.5 truncate max-w-[60px]">✓ {String(asig.nombre || '').split(' ')[0]}</div>}
                                                </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                                {localMesaData.locales.length === 0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Cargando padrón por local de {distritoFiltroMaster}… (si no aparece, corré el SQL de la función en Supabase)</div>}
                            </div>
                        </div>

                        {mesaSel && (
                            <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setMesaSel(null)}>
                                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border-t-8 border-red-600" onClick={e=>e.stopPropagation()}>
                                    <div className="p-5 border-b flex justify-between items-start gap-3">
                                        <div>
                                            <div className="text-[10px] font-black text-red-600 uppercase">Mesa {mesaSel.mesa}</div>
                                            <div className="font-black text-slate-800 leading-tight uppercase">{mesaSel.local}</div>
                                            <div className="text-xs font-bold text-slate-400">{mesaSelPadron.length} habilitados</div>
                                        </div>
                                        <button onClick={()=>setMesaSel(null)} className="text-2xl font-black text-slate-400 hover:text-red-600 leading-none">✕</button>
                                    </div>
                                    <div className="p-4 bg-slate-50 border-b">
                                        <p className="text-[11px] font-black text-slate-500 uppercase mb-2">Encargado de esta mesa</p>
                                        {(() => { const asig = (asignacionesVeedores||{})[claveMesaLocal(mesaSel.cod_local, mesaSel.mesa)]; return asig ? (
                                            <div className="bg-green-50 border border-green-200 rounded-xl p-2 text-xs font-bold text-green-800 mb-2">✓ Asignado: {asig.nombre} (C.I {asig.ci}{asig.telefono ? ` · ${asig.telefono}` : ''})</div>
                                        ) : null; })()}
                                        <div className="flex gap-2">
                                            <input type="number" placeholder="C.I del encargado" className="flex-1 p-2 border-2 rounded-lg font-bold text-sm outline-none" value={encargadoForm.ci} onChange={e=>setEncargadoForm({...encargadoForm, ci:e.target.value})} onKeyDown={e=>e.key==='Enter'&&buscarEncargado()} />
                                            <button onClick={buscarEncargado} className="bg-slate-700 text-white px-3 rounded-lg text-sm font-bold">Buscar</button>
                                        </div>
                                        {encargadoForm.nombre && <div className="text-xs font-black text-slate-700 mt-2">{encargadoForm.nombre}</div>}
                                        <div className="flex gap-2 mt-2">
                                            <input type="number" placeholder="Teléfono (opcional)" className="flex-1 p-2 border-2 rounded-lg font-bold text-sm outline-none" value={encargadoForm.telefono} onChange={e=>setEncargadoForm({...encargadoForm, telefono:e.target.value})} />
                                            <button onClick={asignarEncargado} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg text-sm font-black">ASIGNAR</button>
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto p-4">
                                        {cargandoMesa ? <div className="text-center text-gray-400 font-bold p-6">Cargando padrón de la mesa…</div> : (
                                            <table className="w-full text-left text-sm"><thead className="text-[10px] uppercase text-slate-400 sticky top-0 bg-white"><tr><th className="p-1">Ord</th><th className="p-1">Nombre y Apellido</th><th className="p-1">C.I</th></tr></thead>
                                            <tbody className="divide-y">
                                                {mesaSelPadron.map(el => (<tr key={el.cedula}><td className="p-1 font-black text-slate-400">{el.orden}</td><td className="p-1 font-bold">{el.nombre} {el.apellido}</td><td className="p-1 text-xs text-slate-500">{el.cedula}</td></tr>))}
                                            </tbody></table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

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
                                                    // USO DE LA FUNCIÓN INTELIGENTE TAMBIÉN AQUÍ
                                                    const segurosEsperados = votosFiltrados.filter(v => concejalCoincide(v.concejal, c) && String(v.mesa) === String(mesaEscrutinioSelect)).length;
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
                    distritoFiltroMaster === "TODOS" ? <div className="text-center p-10 bg-white rounded-2xl shadow border border-blue-200"><Globe size={64} className="mx-auto text-blue-400 mb-4"/><h2 className="text-2xl font-black text-slate-800">VISIÓN GLOBAL ACTIVA</h2><p className="font-bold text-gray-500 mt-2">Para configurar los datos de los intendentes o metas, selecciona el distrito que deseas ajustar en el menú.</p></div>
                    : <PanelConfiguracionDepartamental perfil={perfil} configuracionDepartamental={configuracionDepartamental} db={db} distritoGlobal={distritoFiltroMaster} setDistritoGlobal={setDistritoFiltroMaster} />
                )}

                {activeTab === "limpiar" && esMaster && (
                    <div className="bg-white p-6 rounded-3xl shadow-xl border-t-8 border-orange-500 max-w-2xl mx-auto space-y-6 animate-fade-in">
                        <h2 className="text-2xl font-black text-orange-700 flex items-center gap-2"><Trash2 size={28}/> RESET COMPLETO DEL SISTEMA</h2>

                        {/* ── BLOQUE 1: DÍA D ── */}
                        <div>
                            <h3 className="font-black text-sm text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-orange-400"></span> DATOS DEL DÍA D
                            </h3>
                            <div className="space-y-2">
                                {[
                                    { label: "PASO POR PC (Check-ins)",         path: "dia_d/paso_pc_checkins" },
                                    { label: "REGISTRO DE QUIÉN YA VOTÓ",        path: "dia_d/votos_efectuados" },
                                    { label: "MESAS CERRADAS",                   path: "dia_d/mesas_cerradas" },
                                    { label: "ESCRUTINIO FINAL",                 path: "dia_d/escrutinio" },
                                    { label: "ASIGNACIONES DE VEEDORES",         path: "dia_d/asignaciones_veedores" },
                                    { label: "ESTADO ONLINE VEEDORES",           path: "dia_d/veedores_online" },
                                    { label: "ESTADO ONLINE TODOS LOS USUARIOS", path: "estado_online" },
                                ].map(item => (
                                    <div key={item.path} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div>
                                            <div className="font-black text-xs text-slate-800">{item.label}</div>
                                            <div className="text-[9px] text-gray-400 font-bold font-mono">{item.path}</div>
                                        </div>
                                        <button onClick={() => {
                                            if(window.confirm(`¿Limpiar "${item.label}"?`))
                                                remove(ref(db, item.path))
                                                    .then(() => alert(`✅ "${item.label}" limpiado.`))
                                                    .catch(e => alert("Error: " + e.message));
                                        }} className="bg-red-100 text-red-700 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-lg font-black text-xs transition-colors shrink-0 ml-3">BORRAR</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ── BLOQUE 2: VOTOS REGISTRADOS (peligro) ── */}
                        <div className="border-2 border-red-300 rounded-2xl p-4 bg-red-50/50">
                            <h3 className="font-black text-sm text-red-700 uppercase tracking-widest mb-1 flex items-center gap-2">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> VOTOS REGISTRADOS POR CONCEJALES
                            </h3>
                            <p className="text-[10px] font-bold text-red-500 mb-3">⚠️ Esto borra TODOS los padrones cargados por los concejales (votos_seguros). Úsalo solo para limpiar pruebas.</p>
                            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-200">
                                <div>
                                    <div className="font-black text-xs text-red-800">TODOS LOS VOTOS REGISTRADOS</div>
                                    <div className="text-[9px] text-red-400 font-bold font-mono">votos_seguros</div>
                                </div>
                                <button onClick={() => {
                                    if(!window.confirm("🚨 ¿BORRAR TODOS LOS VOTOS REGISTRADOS?\n\nEsto eliminará TODA la lista de votantes cargada por los concejales.\n\nEscribe 'CONFIRMAR' en el siguiente paso.")) return;
                                    const conf = window.prompt("Escribe CONFIRMAR para proceder:");
                                    if(conf !== "CONFIRMAR") return alert("Operación cancelada.");
                                    remove(ref(db, "votos_seguros"))
                                        .then(() => alert("✅ votos_seguros eliminado completamente."))
                                        .catch(e => alert("Error: " + e.message));
                                }} className="bg-red-600 hover:bg-red-800 text-white px-3 py-1.5 rounded-lg font-black text-xs transition-colors shrink-0 ml-3">BORRAR TODO</button>
                            </div>
                        </div>

                        {/* ── BOTÓN LIMPIAR TODO DÍA D ── */}
                        <div className="border-t-2 border-orange-200 pt-4 space-y-3">
                            <button onClick={() => {
                                if(!window.confirm("⚠️ ¿LIMPIAR TODOS LOS DATOS DEL DÍA D?\n\nSe borrarán:\n• Paso PC\n• Quién ya votó\n• Mesas cerradas\n• Escrutinio\n• Asignaciones veedores\n• Estado online\n\n(Los votos registrados NO se borran con este botón)")) return;
                                Promise.all([
                                    remove(ref(db, "dia_d/paso_pc_checkins")),
                                    remove(ref(db, "dia_d/votos_efectuados")),
                                    remove(ref(db, "dia_d/mesas_cerradas")),
                                    remove(ref(db, "dia_d/escrutinio")),
                                    remove(ref(db, "dia_d/asignaciones_veedores")),
                                    remove(ref(db, "dia_d/veedores_online")),
                                    remove(ref(db, "estado_online")),
                                ]).then(() => alert("✅ Día D limpio. Sistema listo para las elecciones.")).catch(e => alert("Error: " + e.message));
                            }} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 rounded-2xl font-black shadow-xl flex justify-center items-center gap-2 transition-colors">
                                <Trash2 size={20}/> LIMPIAR TODO EL DÍA D
                            </button>

                            {/* ── RESET TOTAL INCLUYENDO VOTOS ── */}
                            <button onClick={() => {
                                if(!window.confirm("🚨 RESET TOTAL\n\nSe borrarán ABSOLUTAMENTE TODOS los datos:\n• Paso PC\n• Quién ya votó\n• Mesas cerradas\n• Escrutinio\n• Asignaciones veedores\n• Estado online\n• ⚠️ TODOS LOS VOTOS REGISTRADOS\n\n¿Estás seguro?")) return;
                                const conf = window.prompt("Escribe RESET para confirmar el borrado total:");
                                if(conf !== "RESET") return alert("Cancelado.");
                                Promise.all([
                                    remove(ref(db, "dia_d")),
                                    remove(ref(db, "votos_seguros")),
                                    remove(ref(db, "estado_online")),
                                ]).then(() => alert("✅ RESET TOTAL completado. Base de datos limpia.")).catch(e => alert("Error: " + e.message));
                            }} className="w-full bg-slate-800 hover:bg-red-900 text-white py-4 rounded-2xl font-black shadow-xl flex justify-center items-center gap-2 transition-colors border-2 border-red-700">
                                <Trash2 size={20}/> RESET TOTAL (INCLUYE VOTOS REGISTRADOS)
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
