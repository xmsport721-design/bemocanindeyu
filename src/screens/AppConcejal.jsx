import React, { useState, useMemo, useEffect } from "react";
import { ref, set, remove, onValue, push, update } from "firebase/database";
import { signOut } from "firebase/auth";
import { LogOut, CheckCircle, Users, Search, BarChart3, Bell, UserPlus, UserSquare2, Printer, Trash2, LayoutDashboard, Trophy, MapPin, Target, Pin, Upload, Monitor, Menu, X, RefreshCw, ChevronRight, AlertTriangle, Send, Edit2 } from "lucide-react";
import { concejalCoincide, normalizarNombre, imprimirCarnetFisico, enviarWhatsAppCarnet } from "../lib/helpers";
import { FOTOS_LOCALES_CONCEJALES, enModoDiaD } from "../constants";
import { generarLlave } from "../lib/llaves";
import { buscarPadronPorCedula, buscarPadronPorNombre, buscarPadronPorCedulasLote } from "../lib/padronSupabase";
import { cargaCrear, cargaListar, cargaFilasGet, cargaMarcarImportada, cargaEliminar } from "../lib/cargaCoordinador";

export default function AppConcejal({ perfil, votosSeguros, yaVotaronGlobal, pasoPCGlobal, escrutinioGlobal, fotosConcejales, configApp, auth, db, usuarioActivo, asignacionesDirigentes }) {
    const modoDiaD = enModoDiaD(); // desde el 03-oct: carga cerrada, solo consulta
    const [tab, setTab] = useState(modoDiaD ? "dashboard" : "registro");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Si estamos en Día D y quedó una pestaña de carga, redirige a PANEL
    useEffect(() => { if (modoDiaD && (tab === "registro" || tab === "carga_link")) setTab("dashboard"); }, [modoDiaD, tab]);
    // Modales del dashboard
    const [coordSel, setCoordSel] = useState(null);   // coordinador seleccionado (detalle)
    const [localSel, setLocalSel] = useState(null);    // local seleccionado (quiénes votan ahí)
    const [verPasoPCTodo, setVerPasoPCTodo] = useState(false);
    // Meta de votos del concejal: se define por distrito en Ajustes del panel adm local
    const META_URNAS = Number(configApp?.meta_concejales) || 1200;

    const [bNom, setBNom] = useState("");
    const [resNom, setResNom] = useState([]);
    const miNom = perfil.nombre_oficial||"";
    // Foto de perfil del concejal: subida (Firebase) o hardcodeada; si no hay, avatar por defecto
    const miFoto = (fotosConcejales && (fotosConcejales[miNom] || fotosConcejales[normalizarNombre(miNom)])) || FOTOS_LOCALES_CONCEJALES[normalizarNombre(miNom)] || null;

    const [form, setForm] = useState({ cedula:"", nombre:"", apellido:"", telefono:"", distrito:perfil.distrito, cod_local:"", local:"", mesa:"", orden:"", concejal: miNom, coordinador:"", semaforo:"VERDE" });

    const [bDiaD, setBDiaD] = useState("");
    const [resDiaD, setResDiaD] = useState(null);

    // MIS DIRIGENTES (máx 10 por concejal): entran por su cédula a consultar/marcar paso PC
    const MAX_DIRIGENTES = 10;
    const [dirForm, setDirForm] = useState({ cedula: "", nombre: "" });
    const [dirBuscando, setDirBuscando] = useState(false);
    const misDirigentes = useMemo(
        () => Object.values(asignacionesDirigentes || {}).filter(d => d.concejalUid === usuarioActivo.uid),
        [asignacionesDirigentes, usuarioActivo.uid]
    );

    // FILTRADO INTELIGENTE: El concejal verá sus votos sin importar si le cambiaron el nombre o número de lista.
    const misV = useMemo(() => {
        return votosSeguros.filter(v => v.distrito === perfil.distrito && (concejalCoincide(v.concejal, miNom) || v.registradoPor === usuarioActivo.email));
    }, [votosSeguros, perfil.distrito, miNom, usuarioActivo.email]);

    // DETECCIÓN DE DUPLICADOS PARA EL CONCEJAL
    const cedulasDuplicadas = useMemo(() => {
        const counts = {};
        votosSeguros.filter(v => v.distrito === perfil.distrito).forEach(v => { counts[v.cedula] = (counts[v.cedula] || 0) + 1; });
        const dups = new Set();
        Object.keys(counts).forEach(ci => { if(counts[ci] > 1) dups.add(ci); });
        return dups;
    }, [votosSeguros, perfil.distrito]);

    const [lim, setLim] = useState(50);
    const [fC, setFC] = useState("TODOS");
    const [fS, setFS] = useState("TODOS");
    // Edición/eliminación de un registro en la LISTA
    const [editVoto, setEditVoto] = useState(null);
    const [editForm, setEditForm] = useState({ telefono: "", localidad: "", coordinador: "", semaforo: "VERDE" });

    // Carga masiva por coordinador (pegar/CSV de cédulas + cruzamiento con padrón)
    const [masivoTexto, setMasivoTexto] = useState("");
    const [masivoCoord, setMasivoCoord] = useState("");
    const [masivoCargando, setMasivoCargando] = useState(false);
    const [masivoResult, setMasivoResult] = useState(null); // { encontrados:[], noEncontrados:[], telMap:{} }
    const [masivoGuardando, setMasivoGuardando] = useState(false);

    // Coordinador fijado (carga rápida de su lista)
    const [coordFijo, setCoordFijo] = useState("");
    const [coordMeta, setCoordMeta] = useState({}); // { normalizado: {nombre, cedula, telefono, localidad, zona} }

    // Coordinadores se crean en LINK COORDINADOR (con cédula + localidad + zona)
    const [coordForm, setCoordForm] = useState({ cedula: "", nombre: "", telefono: "", localidad: "", zona: "URBANA" });
    const [coordBuscando, setCoordBuscando] = useState(false);
    const [linksGenerados, setLinksGenerados] = useState({}); // { nombre: url }
    const [cargasList, setCargasList] = useState([]);
    const [importando, setImportando] = useState("");

    // Coordinadores PROPIOS de este concejal (anidados bajo su nombre)
    const miCoordPath = `coordinadores/${perfil.distrito}/${normalizarNombre(miNom)}`;
    useEffect(() => {
        const un = onValue(ref(db, miCoordPath), snap => setCoordMeta(snap.val() || {}));
        return () => un();
    }, [db, miCoordPath]);

    // Solo mis links (los que generé como este concejal)
    useEffect(() => { if (tab === "carga_link") cargaListar(perfil.distrito).then(list => setCargasList(list.filter(c => c.concejal_fijo === miNom))); }, [tab, perfil.distrito, miNom]);

    // Coordinadores creados (en LINK COORDINADOR) + nombres para el select de REGISTRO
    const coordinadoresLista = useMemo(() => Object.values(coordMeta || {}).filter(c => c && c.nombre).sort((a, b) => a.nombre.localeCompare(b.nombre)), [coordMeta]);
    const coordNombres = useMemo(() => {
        const s = new Set(coordinadoresLista.map(c => c.nombre));
        misV.forEach(v => { if (v.coordinador) s.add(v.coordinador); });
        return [...s].filter(Boolean).sort();
    }, [coordinadoresLista, misV]);

    // DEDUP: una cédula vale UNO para la meta (aunque esté cargada 2+ veces)
    const misVUnicos = useMemo(() => {
        const seen = new Set(); const out = [];
        misV.forEach(v => { const c = String(v.cedula); if (!seen.has(c)) { seen.add(c); out.push(v); } });
        return out;
    }, [misV]);

    // AUDITORÍA: electores que aparecen 2+ veces en TU lista (con qué coordinadores)
    const misDuplicados = useMemo(() => {
        const byCedula = {};
        misV.forEach(v => { const c = String(v.cedula); (byCedula[c] = byCedula[c] || []).push(v); });
        return Object.values(byCedula).filter(arr => arr.length > 1).sort((a, b) => b.length - a.length);
    }, [misV]);

    // Estado de urnas (meta del concejal): cuántos de sus cargados ÚNICOS ya votaron
    const urnas = useMemo(() => {
        const votaron = misVUnicos.filter(v => yaVotaronGlobal[generarLlave(v.distrito, v.cod_local, v.mesa, v.orden)]).length;
        const falta = Math.max(0, META_URNAS - votaron);
        const pct = META_URNAS > 0 ? Math.min(100, Math.round((votaron / META_URNAS) * 100)) : 0;
        return { votaron, falta, pct, cargados: misVUnicos.length, duplicados: misV.length - misVUnicos.length };
    }, [misV, misVUnicos, yaVotaronGlobal, META_URNAS]);

    // Paso por PC: los de MI lista + cualquier consulta que YO marqué (aunque no esté en mi lista)
    const pasoPC = useMemo(() => {
        const lista = []; const vistos = new Set();
        misV.forEach(v => {
            const ll = generarLlave(v.distrito, v.cod_local, v.mesa, v.orden);
            const pc = pasoPCGlobal[ll];
            if (pc) { lista.push({ id: v.id, cedula: v.cedula, nombre: `${v.nombre} ${v.apellido}`.trim(), mesa: v.mesa, local: v.local, pc, voto: yaVotaronGlobal[ll], enLista: true }); vistos.add(ll); }
        });
        const miMarca = `CONCEJAL ${miNom.includes('-') ? miNom.split('-')[1].trim() : miNom}`;
        Object.entries(pasoPCGlobal).forEach(([ll, pc]) => {
            if (vistos.has(ll) || pc.registradoPorNombre !== miMarca) return;
            lista.push({ id: ll, cedula: pc.cedula || "", nombre: pc.nombre || "(consulta suelta)", mesa: pc.mesa || "", local: pc.local || "", pc, voto: yaVotaronGlobal[ll], enLista: false });
        });
        lista.sort((a, b) => (b.pc.timestamp || 0) - (a.pc.timestamp || 0));
        const total = misVUnicos.length;
        const pct = total > 0 ? Math.round((lista.filter(x => x.enLista).length / total) * 100) : 0;
        return { lista, count: lista.length, pct };
    }, [misV, misVUnicos, pasoPCGlobal, yaVotaronGlobal, miNom]);

    // Ranking de coordinadores: total de cargas, cuántos votaron y en qué locales votan
    const rankingCoord = useMemo(() => {
        const m = {};
        misV.forEach(v => {
            const c = v.coordinador || "SIN COORDINADOR";
            if (!m[c]) m[c] = { coordinador: c, total: 0, votaron: 0, locales: {} };
            m[c].total++;
            if (yaVotaronGlobal[generarLlave(v.distrito, v.cod_local, v.mesa, v.orden)]) m[c].votaron++;
            const loc = v.local || "SIN LOCAL";
            m[c].locales[loc] = (m[c].locales[loc] || 0) + 1;
        });
        return Object.values(m)
            .map(c => ({ ...c, localesTop: Object.entries(c.locales).map(([local, n]) => ({ local, n })).sort((a, b) => b.n - a.n) }))
            .sort((a, b) => b.total - a.total);
    }, [misV, yaVotaronGlobal]);

    // Cuántas cargas hay por local de votación
    const porLocal = useMemo(() => {
        const m = {};
        misV.forEach(v => { const loc = v.local || "SIN LOCAL"; m[loc] = (m[loc] || 0) + 1; });
        return Object.entries(m).map(([local, total]) => ({ local, total })).sort((a, b) => b.total - a.total);
    }, [misV]);

    // Reenvía check-ins de paso PC que quedaron pendientes (app cerrada antes de confirmar)
    useEffect(() => {
        try {
            Object.keys(localStorage).filter(k => k.startsWith('pcpend_')).forEach(k => {
                const llave = k.slice(7);
                set(ref(db, `dia_d/paso_pc_checkins/${llave}`), JSON.parse(localStorage.getItem(k)))
                    .then(() => { try { localStorage.removeItem(k); } catch {} }).catch(() => {});
            });
        } catch {}
    }, [db]);

    // Robusto: marca instantánea (no se traba/desmarca) + respaldo local + envío en 2do plano.
    // Guarda también los datos del elector (nombre/cédula) para verlos aunque no esté en la lista.
    const marcarPasoPCConcejal = (llave, pcData, persona) => {
        if (pcData) {
            setResDiaD(r => ({ ...r, pc: null }));
            try { localStorage.removeItem(`pcpend_${llave}`); } catch {}
            remove(ref(db, `dia_d/paso_pc_checkins/${llave}`)).catch(() => {});
        } else {
            const nombreConcejalCorto = miNom.includes('-') ? miNom.split('-')[1].trim() : miNom;
            const newData = { hora: new Date().toLocaleTimeString(), timestamp: Date.now(), registradoPorNombre: `CONCEJAL ${nombreConcejalCorto}`,
                cedula: persona?.cedula || "", nombre: persona ? `${persona.nombre} ${persona.apellido}`.trim() : "", distrito: persona?.distrito || "", cod_local: persona?.cod_local || "", mesa: persona?.mesa || "", local: persona?.local || "", orden: persona?.orden || "" };
            setResDiaD(r => ({ ...r, pc: newData }));                               // 1) instantáneo
            try { localStorage.setItem(`pcpend_${llave}`, JSON.stringify(newData)); } catch {} // respaldo
            set(ref(db, `dia_d/paso_pc_checkins/${llave}`), newData)               // 2) 2do plano
                .then(() => { try { localStorage.removeItem(`pcpend_${llave}`); } catch {} })
                .catch(() => {});
        }
    };

    const buscarPorNombreConcejal = async () => {
        if(bNom.trim().length < 3) return alert("Escribe al menos 3 letras.");
        const res = (await buscarPadronPorNombre(bNom, perfil.distrito)).map(r => ({ ...r, ci: r.cedula }));
        if (res.length === 0) alert("No se encontraron coincidencias.");
        setResNom(res);
    };

    const buscarCedulaConcejal = async () => {
        const p = await buscarPadronPorCedula(form.cedula);
        if (p && p.distrito === perfil.distrito) { setForm(prev => ({...prev, nombre: p.nombre, apellido: p.apellido, cod_local: p.cod_local, local: p.local, mesa: p.mesa, orden: p.orden, distrito: p.distrito})); }
        else if (p && p.distrito !== perfil.distrito) { alert("Esta persona pertenece a otro distrito."); }
        else { alert("Cédula no encontrada."); }
    };

    // Refrescar: limpia el formulario para una nueva búsqueda (mantiene coordinador fijo)
    const refrescarBusqueda = () => {
        setForm(f => ({ ...f, cedula:"", nombre:"", apellido:"", local:"", mesa:"", orden:"", coordinador: coordFijo || "" }));
        setResNom([]); setBNom("");
    };

    const buscarDiaD = async () => {
        const p = await buscarPadronPorCedula(bDiaD);
        if (p) setResDiaD({ ...p, v: yaVotaronGlobal[generarLlave(p.distrito, p.cod_local, p.mesa, p.orden)], pc: pasoPCGlobal[generarLlave(p.distrito, p.cod_local, p.mesa, p.orden)] });
        else setResDiaD("NO");
    };

    // Autocompleta el nombre del dirigente buscando su cédula en el padrón
    const buscarCedulaDirigente = async () => {
        const ci = String(dirForm.cedula || "").trim();
        if (!ci) return;
        setDirBuscando(true);
        const p = await buscarPadronPorCedula(ci);
        if (p) setDirForm({ cedula: ci, nombre: `${p.nombre} ${p.apellido}`.trim() });
        else alert("Cédula no encontrada en el padrón (podés cargar el nombre a mano).");
        setDirBuscando(false);
    };

    const agregarDirigente = () => {
        const ci = String(dirForm.cedula || "").trim();
        const nom = String(dirForm.nombre || "").trim().toUpperCase();
        if (!ci || !nom) return alert("Completá cédula y nombre del dirigente.");
        const yaEstaMio = misDirigentes.some(d => String(d.cedula) === ci);
        if (!yaEstaMio && misDirigentes.length >= MAX_DIRIGENTES) return alert(`Máximo ${MAX_DIRIGENTES} dirigentes.`);
        const dueno = (asignacionesDirigentes || {})[ci];
        if (dueno && dueno.concejalUid !== usuarioActivo.uid) return alert(`Esa cédula ya está cargada como dirigente de ${dueno.concejal || "otro concejal"}.`);
        set(ref(db, `dia_d/asignaciones_dirigentes/${ci}`), {
            cedula: ci, nombre: nom, concejal: miNom, concejalUid: usuarioActivo.uid,
            distrito: perfil.distrito, ts: Date.now(),
        }).then(() => { setDirForm({ cedula: "", nombre: "" }); }).catch(() => alert("No se pudo guardar, reintentá."));
    };

    const quitarDirigente = (ci) => {
        if (window.confirm("¿Quitar este dirigente?")) remove(ref(db, `dia_d/asignaciones_dirigentes/${ci}`));
    };

    // Parsea el texto pegado (o CSV): por línea, 1er número = cédula, 2do (si hay) = teléfono
    const parsearMasivo = () => {
        const telMap = {}; const cedulas = [];
        masivoTexto.split(/\r?\n/).forEach(linea => {
            const nums = (linea.match(/\d+/g) || []);
            if (nums.length === 0) return;
            const ci = nums[0]; cedulas.push(ci);
            if (nums[1] && nums[1].length >= 6) telMap[ci] = nums[1];
        });
        return { cedulas: Array.from(new Set(cedulas)), telMap };
    };

    const cruzarMasivo = async () => {
        const { cedulas, telMap } = parsearMasivo();
        if (cedulas.length === 0) return alert("Pegá al menos una cédula (una por línea).");
        setMasivoCargando(true);
        const filas = await buscarPadronPorCedulasLote(cedulas, perfil.distrito);
        const encMap = {}; filas.forEach(f => { encMap[String(f.cedula)] = f; });
        const encontrados = cedulas.filter(ci => encMap[ci]).map(ci => encMap[ci]);
        const noEncontrados = cedulas.filter(ci => !encMap[ci]);
        setMasivoResult({ encontrados, noEncontrados, telMap });
        setMasivoCargando(false);
    };

    const cargarMasivo = () => {
        if (!masivoResult || masivoResult.encontrados.length === 0) return;
        const coord = coordFijo || masivoCoord.trim().toUpperCase();
        if (!coord) return alert("Indicá el coordinador de esta lista.");
        setMasivoGuardando(true);
        const yaMios = new Set(misV.map(v => String(v.cedula)));
        const updates = {}; let cargados = 0, saltados = 0;
        masivoResult.encontrados.forEach(p => {
            if (yaMios.has(String(p.cedula))) { saltados++; return; }
            const key = push(ref(db, 'votos_seguros')).key;
            updates[key] = { cedula: String(p.cedula), nombre: p.nombre, apellido: p.apellido, telefono: masivoResult.telMap[String(p.cedula)] || "", distrito: p.distrito, cod_local: p.cod_local, local: p.local, mesa: p.mesa, orden: p.orden, concejal: miNom, coordinador: coord, semaforo: "VERDE", registradoPor: usuarioActivo.email, fecha: new Date().toLocaleString(), origen: "carga_masiva" };
            cargados++;
        });
        if (cargados === 0) { setMasivoGuardando(false); return alert("Todos ya estaban cargados."); }
        update(ref(db, 'votos_seguros'), updates)
            .then(() => { setMasivoResult(null); setMasivoTexto(""); alert(`✅ Cargados ${cargados}. Ya estaban: ${saltados}.`); })
            .catch(() => alert("No se pudo guardar, reintentá."))
            .finally(() => setMasivoGuardando(false));
    };

    const leerArchivoMasivo = (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => setMasivoTexto(String(r.result || ""));
        r.readAsText(f);
    };

    // Fase 3: generar link público, listar cargas recibidas e importar
    const refrescarCargas = async () => { const list = await cargaListar(perfil.distrito); setCargasList(list.filter(c => c.concejal_fijo === miNom)); };

    const eliminarCargaLista = async (token) => {
        if (!window.confirm("¿Eliminar esta lista/link?")) return;
        try { await cargaEliminar(token); refrescarCargas(); }
        catch (e) { alert("No se pudo eliminar. ¿Corriste el SQL nuevo (carga_eliminar)?\n" + (e.message || "")); }
    };

    const buscarCoordCedula = async () => {
        const ci = String(coordForm.cedula).trim();
        if (!ci) return;
        setCoordBuscando(true);
        const p = await buscarPadronPorCedula(ci);
        if (p) setCoordForm(f => ({ ...f, nombre: `${p.nombre} ${p.apellido}`.trim() }));
        else alert("Cédula no encontrada en el padrón. Podés escribir el nombre a mano.");
        setCoordBuscando(false);
    };

    const guardarCoordinador = () => {
        const nombre = String(coordForm.nombre).trim().toUpperCase();
        if (!nombre) return alert("Buscá la cédula o escribí el nombre del coordinador.");
        set(ref(db, `${miCoordPath}/${normalizarNombre(nombre)}`), {
            nombre, cedula: coordForm.cedula, telefono: coordForm.telefono, localidad: coordForm.localidad, zona: coordForm.zona, concejal: miNom, ts: Date.now(),
        }).then(() => { setCoordForm({ cedula: "", nombre: "", telefono: "", localidad: "", zona: "URBANA" }); })
          .catch(() => alert("No se pudo guardar."));
    };

    const abrirEditar = (v) => { setEditVoto(v); setEditForm({ telefono: v.telefono || "", localidad: v.localidad || "", coordinador: v.coordinador || "", semaforo: v.semaforo || "VERDE" }); };
    const guardarEditar = () => {
        if (!editVoto) return;
        update(ref(db, `votos_seguros/${editVoto.id}`), { telefono: editForm.telefono, localidad: editForm.localidad, coordinador: editForm.coordinador, semaforo: editForm.semaforo })
            .then(() => setEditVoto(null)).catch(() => alert("No se pudo guardar."));
    };
    const eliminarVotoConcejal = (id) => { if (window.confirm("¿Eliminar este registro de tu lista?")) remove(ref(db, `votos_seguros/${id}`)); };

    const quitarCoordinador = (c) => {
        if (window.confirm(`¿Eliminar al coordinador ${c.nombre}? (No borra los votos ya cargados)`)) {
            remove(ref(db, `${miCoordPath}/${normalizarNombre(c.nombre)}`));
            setLinksGenerados(prev => { const n = { ...prev }; delete n[c.nombre]; return n; });
        }
    };

    const generarLinkPara = async (c) => {
        try {
            const token = await cargaCrear({ distrito: perfil.distrito, zona: c.zona, coordinador: c.nombre, telefono: c.telefono, concejalFijo: miNom, concejales: configApp.concejales || [] });
            setLinksGenerados(prev => ({ ...prev, [c.nombre]: `${window.location.origin}/?carga=${token}` }));
            refrescarCargas();
        } catch (e) { alert("No se pudo crear el link. ¿Corriste el SQL de la Fase 3?\n" + (e.message || "")); }
    };

    const importarCarga = async (c) => {
        setImportando(c.token);
        try {
            const filas = await cargaFilasGet(c.token);
            const encontrados = await buscarPadronPorCedulasLote(filas.map(f => f.cedula), perfil.distrito);
            const encMap = {}; encontrados.forEach(p => { encMap[String(p.cedula)] = p; });
            const telMap = {}; filas.forEach(f => { if (f.telefono) telMap[String(f.cedula)] = f.telefono; });
            const yaMios = new Set(misV.map(v => String(v.cedula)));
            const updates = {}; let n = 0;
            filas.forEach(f => {
                const p = encMap[String(f.cedula)];
                if (!p || yaMios.has(String(f.cedula))) return;
                const key = push(ref(db, 'votos_seguros')).key;
                updates[key] = { cedula: String(p.cedula), nombre: p.nombre, apellido: p.apellido, telefono: telMap[String(f.cedula)] || "", distrito: p.distrito, cod_local: p.cod_local, local: p.local, mesa: p.mesa, orden: p.orden, concejal: (f.concejal && f.concejal !== "") ? f.concejal : miNom, coordinador: c.coordinador_nombre, semaforo: "VERDE", registradoPor: usuarioActivo.email, fecha: new Date().toLocaleString(), origen: "link_coordinador" };
                n++;
            });
            if (n > 0) await update(ref(db, 'votos_seguros'), updates);
            await cargaMarcarImportada(c.token);
            await refrescarCargas();
            alert(`✅ Importados ${n} de ${filas.length}. (${filas.length - n} no figuran en el padrón o ya estaban cargados)`);
        } catch (e) { alert("Error al importar: " + (e.message || "")); }
        setImportando("");
    };

    const handleRegistrarConcejal = () => {
        import('firebase/database').then(({ push, ref }) => {
            if(!form.cedula||!form.nombre)return alert("Datos incompletos");
            if(misV.find(v=>v.cedula===form.cedula))return alert("Ya registrado por ti.");
            const coordFinal = coordFijo || form.coordinador; // coordinador seleccionado/fijado
            const coordCed = coordMeta[normalizarNombre(coordFinal)]?.cedula || "";
            const d={...form, coordinador: coordFinal, coordinadorCedula: coordCed, concejal: miNom, registradoPor:usuarioActivo.email, fecha:new Date().toLocaleString()};
            push(ref(db,'votos_seguros'), d);
            // Limpia el elector; si hay coordinador fijo, lo mantiene para seguir cargando su lista
            setForm(f=>({...f, cedula:"", nombre:"", apellido:"", local:"", mesa:"", orden:"", coordinador: coordFijo || ""}));
        });
    };

    const navItems = [
        { id: "registro", label: "REGISTRO", icon: CheckCircle },
        { id: "dashboard", label: "PANEL", icon: LayoutDashboard },
        { id: "lista", label: "LISTA", icon: Users },
        { id: "auditoria", label: "AUDITORÍA", icon: AlertTriangle },
        { id: "dia_d_buscador", label: "DÍA D BUSCADOR", icon: Search },
        { id: "proyecciones", label: "PROYECCIONES", icon: BarChart3 },
        { id: "live", label: "LIVE", icon: Bell },
        { id: "dirigentes", label: "MIS DIRIGENTES", icon: UserPlus },
        { id: "carga_link", label: "LINK COORDINADOR", icon: Send },
    ].filter(n => !modoDiaD || (n.id !== "registro" && n.id !== "carga_link"));
    const irA = (id) => { setTab(id); setSidebarOpen(false); };

    return (
        <div className="bg-slate-50 min-h-screen">
            <header style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }} className="bg-gradient-to-r from-red-700 to-red-900 text-white p-3 flex justify-between items-center shadow-lg sticky top-0 z-50">
                <div className="flex items-center gap-2 min-w-0">
                    <button onClick={()=>setSidebarOpen(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-white/10"><Menu size={22}/></button>
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-white/20 border-2 border-white/40 shrink-0 flex items-center justify-center">
                        {miFoto ? <img src={miFoto} alt={miNom} onError={e=>{e.currentTarget.style.display='none';}} className="w-full h-full object-cover"/> : <UserSquare2 size={20} className="text-white/70"/>}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-xs font-bold uppercase leading-tight truncate">{miNom.includes('-')?miNom.split('-')[1]:miNom}</h1>
                        <p className="text-[9px] text-red-200 font-bold uppercase truncate">{configApp.intendente||"S/D"} · {perfil.distrito}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[10px] font-black bg-white/15 px-2 py-1 rounded-full">TOT {misV.length} · 🟢 {misV.filter(v=>v.semaforo==='VERDE' && !cedulasDuplicadas.has(v.cedula)).length}</span>
                    <button onClick={()=>signOut(auth)} className="bg-red-950 p-2 rounded-full"><LogOut size={16}/></button>
                </div>
            </header>

            <div className="flex">
                {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}
                <aside style={{ paddingTop: 'env(safe-area-inset-top)' }} className={`fixed lg:sticky top-0 lg:top-[56px] left-0 h-screen lg:h-[calc(100vh-56px)] w-64 bg-white border-r border-slate-200 shadow-xl lg:shadow-none z-50 lg:z-30 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} flex flex-col shrink-0 print:hidden`}>
                    <div className="p-4 border-b flex justify-between items-center lg:hidden"><span className="font-black text-slate-800">MENÚ</span><button onClick={()=>setSidebarOpen(false)} className="p-1 text-slate-400"><X size={20}/></button></div>
                    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                        {navItems.map(n => {
                            const Icon = n.icon; const activo = tab === n.id;
                            return (
                                <button key={n.id} onClick={()=>irA(n.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-black text-xs transition-colors ${activo ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>
                                    <Icon size={18} className={activo ? 'text-white' : 'text-slate-400'}/> {n.label}
                                </button>
                            );
                        })}
                    </nav>
                    <div className="p-4 border-t bg-slate-50">
                        <div className="flex justify-between text-[10px] font-black"><span className="text-slate-500">TOTAL</span><span className="text-slate-800">{misV.length}</span></div>
                        <div className="flex justify-between text-[10px] font-black mt-1"><span className="text-green-600">🟢 VERDES</span><span className="text-green-700">{misV.filter(v=>v.semaforo==='VERDE' && !cedulasDuplicadas.has(v.cedula)).length}</span></div>
                    </div>
                </aside>

                <main className="flex-1 min-w-0 p-4 md:p-6 max-w-5xl w-full mx-auto">
                {modoDiaD && <div className="bg-red-600 text-white text-center text-xs font-black py-2 px-3 rounded-xl mb-4">🗳️ MODO DÍA D — La carga de datos está cerrada. Solo consulta: Día D Buscador, Dirigentes y Reportes.</div>}
                {tab === "dashboard" && (
                    <div className="space-y-5 animate-fade-in">
                        {/* ESTADO DE URNAS (META) */}
                        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                            <div className="flex items-center gap-2 mb-4"><Target size={20} className="text-red-500"/><h2 className="font-black text-lg uppercase">Estado de urnas · Meta {META_URNAS.toLocaleString()}</h2></div>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="bg-white/5 rounded-2xl p-4 text-center"><div className="text-4xl font-black text-green-400 leading-none">{urnas.votaron}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Ya votaron</div></div>
                                <div className="bg-white/5 rounded-2xl p-4 text-center"><div className="text-4xl font-black text-amber-400 leading-none">{urnas.falta}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Falta p/ meta</div></div>
                                <div className="bg-white/5 rounded-2xl p-4 text-center"><div className="text-4xl font-black leading-none">{urnas.cargados}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Cargados</div></div>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden"><div className="bg-green-500 h-4 rounded-full transition-all duration-500" style={{width: `${urnas.pct}%`}}></div></div>
                            <div className="text-right text-xs font-black text-green-400 mt-1">{urnas.pct}% de la meta</div>
                        </div>

                        {/* PASO POR PC */}
                        <div className="bg-white p-5 rounded-3xl shadow border">
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2"><Monitor size={20} className="text-blue-500"/><h2 className="font-black text-lg text-slate-800 uppercase">Paso por PC</h2></div>
                                <div className="flex items-center gap-2"><div className="flex items-baseline gap-2"><span className="text-3xl font-black text-blue-600 leading-none">{pasoPC.count}</span><span className="text-xs font-black text-slate-400">de {urnas.cargados} · {pasoPC.pct}%</span></div><button onClick={()=>setVerPasoPCTodo(true)} className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">VER TODOS</button></div>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-4"><div className="bg-blue-500 h-3 rounded-full transition-all duration-500" style={{width: `${pasoPC.pct}%`}}></div></div>
                            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                                {pasoPC.lista.map(v => (
                                    <div key={v.id} className="flex items-center justify-between bg-slate-50 border rounded-xl px-3 py-2 gap-2">
                                        <div className="min-w-0">
                                            <div className="font-black text-sm uppercase truncate">{v.nombre}{!v.enLista && <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded align-middle">FUERA DE LISTA</span>}</div>
                                            <div className="text-[10px] font-bold text-slate-400 truncate">CI {v.cedula || '—'}{v.mesa?` · M${v.mesa}`:''}{v.local?` · ${v.local}`:''}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            {v.voto ? <div className="text-[10px] font-black text-green-700">✅ VOTÓ</div> : <div className="text-[10px] font-black text-slate-400">⏳ no votó</div>}
                                            <div className="text-[10px] font-black text-blue-700">📍 {v.pc.hora}</div>
                                        </div>
                                    </div>
                                ))}
                                {pasoPC.count===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Todavía nadie pasó por PC.</div>}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* RANKING DE COORDINADORES */}
                            <div className="bg-white p-5 rounded-3xl shadow border">
                                <div className="flex items-center gap-2 mb-4"><Trophy size={20} className="text-amber-500"/><h2 className="font-black text-lg text-slate-800 uppercase">Top 10 Coordinadores</h2></div>
                                <div className="space-y-2">
                                    {rankingCoord.slice(0,10).map((c, i) => {
                                        const meta = coordMeta[normalizarNombre(c.coordinador)] || {};
                                        return (
                                        <div key={c.coordinador} onClick={()=>setCoordSel(c)} className="bg-slate-50 border rounded-2xl p-3 cursor-pointer hover:bg-slate-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${i===0?'bg-amber-400 text-white':i===1?'bg-slate-300 text-slate-700':i===2?'bg-orange-300 text-white':'bg-slate-200 text-slate-600'}`}>{i+1}</div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-black text-sm uppercase truncate">{c.coordinador}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 flex gap-2 items-center flex-wrap">{meta.zona && <span className={`px-1.5 rounded ${meta.zona==='RURAL'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{meta.zona==='RURAL'?'🌾 RURAL':'🏙️ URBANA'}</span>}{meta.telefono && <span>📞 {meta.telefono}</span>}<span className="text-green-600">✅ {c.votaron} votaron</span></div>
                                                </div>
                                                <div className="text-right shrink-0"><div className="text-2xl font-black text-red-700 leading-none">{c.total}</div><div className="text-[8px] font-black uppercase text-slate-400">cargas</div></div>
                                                <ChevronRight size={18} className="text-slate-300 shrink-0"/>
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-2 pl-11">
                                                {c.localesTop.slice(0,4).map(l => (
                                                    <span key={l.local} className="text-[9px] font-bold bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-600 flex items-center gap-1"><MapPin size={9} className="text-red-400"/>{l.local.length>22?l.local.slice(0,22)+'…':l.local} <b className="text-slate-900">{l.n}</b></span>
                                                ))}
                                            </div>
                                        </div>
                                        );
                                    })}
                                    {rankingCoord.length===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Todavía no hay cargas.</div>}
                                </div>
                            </div>

                            {/* LOCALES DE VOTACIÓN */}
                            <div className="bg-white p-5 rounded-3xl shadow border">
                                <div className="flex items-center gap-2 mb-4"><MapPin size={20} className="text-red-500"/><h2 className="font-black text-lg text-slate-800 uppercase">Cargas por local ({porLocal.length})</h2></div>
                                <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                                    {porLocal.map(l => {
                                        const max = porLocal[0]?.total || 1;
                                        return (
                                        <div key={l.local} onClick={()=>setLocalSel(l.local)} className="border rounded-xl p-3 cursor-pointer hover:bg-slate-50 transition-colors">
                                            <div className="flex justify-between items-center gap-2 mb-1"><span className="font-black text-xs uppercase text-slate-700 truncate">{l.local}</span><span className="font-black text-red-700 shrink-0">{l.total}</span></div>
                                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden"><div className="bg-red-500 h-2 rounded-full" style={{width: `${Math.round((l.total/max)*100)}%`}}></div></div>
                                        </div>
                                        );
                                    })}
                                    {porLocal.length===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Sin datos.</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === "registro" && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border max-w-4xl mx-auto animate-fade-in">
                        <h2 className="font-black text-xl mb-6 text-slate-800 flex items-center gap-2"><UserSquare2/> REGISTRO DE VOTOS ({perfil.distrito})</h2>

                        <div className="bg-slate-50 border p-4 rounded-xl mb-6">
                            <label className="text-xs font-bold text-gray-500 uppercase mb-2 block text-center">1. BUSCAR POR NOMBRE / APELLIDO (Opcional si no tenés C.I)</label>
                            <div className="flex gap-2 max-w-md mx-auto">
                                <div className="relative flex-1">
                                    <input type="text" placeholder="Nombre o Apellido..." className="w-full p-3 pr-11 border-2 rounded-xl font-bold uppercase outline-none focus:border-red-500 text-center" value={bNom} onChange={e => setBNom(e.target.value)} onKeyDown={e => e.key === 'Enter' && buscarPorNombreConcejal()} />
                                    <button onClick={buscarPorNombreConcejal} className="absolute right-1 top-1/2 -translate-y-1/2 bg-slate-700 hover:bg-slate-800 text-white p-2 rounded-lg transition-colors"><Search size={16}/></button>
                                </div>
                            </div>
                            {resNom.length > 0 && (
                                <div className="mt-2 bg-white border border-slate-200 shadow-lg rounded-xl max-h-48 overflow-y-auto max-w-md mx-auto">
                                    {resNom.map(r => (
                                        <div key={r.ci} onClick={() => {setForm({...form, cedula: r.ci, nombre: r.nombre, apellido: r.apellido, cod_local: r.cod_local, local: r.local, mesa: r.mesa, orden: r.orden, distrito: r.distrito}); setResNom([]); setBNom("");}} className="p-3 hover:bg-red-50 cursor-pointer border-b last:border-b-0 text-sm flex justify-between items-center transition-colors">
                                            <div><span className="font-black">{r.nombre} {r.apellido}</span><br/><span className="text-xs text-gray-500 font-bold">C.I: {r.ci}</span></div>
                                            <div className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">Mesa {r.mesa}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block text-center">2. CARGA CON CÉDULA</label>
                        <div className="flex gap-2 mb-6 max-w-sm mx-auto">
                            <div className="relative flex-1">
                                <input type="number" placeholder="N° DE CÉDULA" className="w-full p-3 pr-11 border-2 rounded-xl text-lg font-bold outline-none focus:border-red-500 text-center" value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} onKeyDown={e=>e.key==='Enter'&&buscarCedulaConcejal()} />
                                <button onClick={buscarCedulaConcejal} className="absolute right-1 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-900 text-white p-2 rounded-lg transition-colors"><Search size={16}/></button>
                            </div>
                            <button onClick={refrescarBusqueda} title="Nueva búsqueda" className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 rounded-xl font-bold transition-colors"><RefreshCw size={18}/></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" readOnly placeholder="NOMBRES" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.nombre} /><input type="text" readOnly placeholder="APELLIDOS" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.apellido} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><input type="text" placeholder="TELÉFONO" className="p-3 border-2 border-blue-200 rounded-lg font-bold outline-none" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} /><input type="text" readOnly placeholder="DISTRITO" className="p-3 border rounded-lg bg-gray-50 font-bold" value={form.distrito} /></div>
                        <div className="grid grid-cols-3 gap-2 mb-4"><input type="text" readOnly className="p-3 border bg-gray-50 text-xs col-span-3 md:col-span-1" value={form.local} placeholder="LOCAL" /><input type="text" readOnly className="p-3 border bg-gray-50 font-bold" value={form.mesa ? `MESA ${form.mesa}` : "MESA"} /><input type="text" readOnly className="p-3 border-2 border-red-100 font-black text-red-600 bg-red-50" value={form.orden ? `ORDEN ${form.orden}` : "ORDEN"} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">CONCEJAL</label><input type="text" readOnly className="p-4 border-2 rounded-xl font-bold bg-gray-50 text-gray-500" value={miNom.includes(' - ') ? miNom.split(' - ')[1] : miNom} /></div>
                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COORDINADOR</label>
                                {coordFijo ? (
                                    <div className="flex gap-2 items-stretch">
                                        <div className="flex-1 p-4 border-2 border-emerald-400 bg-emerald-50 rounded-xl font-black text-emerald-800 flex items-center gap-2 truncate"><Pin size={16}/> {coordFijo}</div>
                                        <button onClick={()=>{setCoordFijo(""); setForm(f=>({...f, coordinador:""}));}} className="bg-red-100 text-red-700 px-4 rounded-xl font-black text-xl" title="Soltar coordinador fijo">×</button>
                                    </div>
                                ) : (
                                    <select className="w-full p-4 border-2 rounded-xl font-bold outline-none" value={form.coordinador} onChange={e=>setForm({...form, coordinador: e.target.value})}><option value="">SELECCIONE...</option>{coordNombres.map(c => <option key={c} value={c}>{c}</option>)}</select>
                                )}
                                <p className="text-[9px] font-bold text-slate-400 mt-1">¿Falta un coordinador? Agregalo en <b>LINK COORDINADOR</b>.</p>
                            </div>
                            <div className="flex flex-col"><label className="text-[10px] font-bold text-gray-400 mb-1">COLOR</label>
                                <select className={`w-full p-3 rounded-xl font-black text-white outline-none text-sm ${form.semaforo==='VERDE'?'bg-green-500':form.semaforo==='AMARILLO'?'bg-yellow-500':'bg-red-500'}`} value={form.semaforo} onChange={e=>setForm({...form, semaforo: e.target.value})}><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select>
                                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                    <input type="checkbox" checked={!!coordFijo} onChange={e=> e.target.checked ? (form.coordinador ? setCoordFijo(form.coordinador) : alert('Elegí primero un coordinador.')) : setCoordFijo("")} className="w-5 h-5 accent-emerald-600 shrink-0"/>
                                    <span className="text-[11px] font-black text-slate-600 leading-tight flex items-center gap-1"><Pin size={12}/> Fijar coordinador (carga rápida)</span>
                                </label>
                            </div>
                        </div>
                        <button onClick={handleRegistrarConcejal} className="w-full mt-6 bg-[#2ecc71] hover:bg-green-600 text-white py-4 rounded-xl font-black shadow-lg transition-colors">GUARDAR REGISTRO</button>

                        <div className="mt-8 border-t-2 border-dashed pt-6">
                            <h3 className="font-black text-lg text-slate-800 flex items-center gap-2 mb-1"><Upload className="text-emerald-600" size={20}/> CARGA MASIVA POR COORDINADOR</h3>
                            <p className="text-xs text-slate-500 font-bold mb-4">Pegá las cédulas de tu Excel (una por línea; opcional "cédula, teléfono"). Cruzamos con el padrón y cargamos solo las que figuran.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                {coordFijo ? (
                                    <div className="p-3 border-2 border-emerald-400 bg-emerald-50 rounded-xl font-black text-emerald-800 flex items-center gap-2"><Pin size={16}/> {coordFijo}</div>
                                ) : (
                                    <input type="text" placeholder="COORDINADOR DE ESTA LISTA" className="p-3 border-2 rounded-xl font-bold uppercase outline-none focus:border-emerald-500" value={masivoCoord} onChange={e=>setMasivoCoord(e.target.value.toUpperCase())} list="coordListMasivo" />
                                )}
                                <label className="p-3 border-2 border-slate-200 rounded-xl font-bold text-slate-500 text-center cursor-pointer hover:bg-slate-50 flex items-center justify-center gap-2"><Upload size={16}/> Subir CSV/TXT<input type="file" accept=".csv,.txt" className="hidden" onChange={leerArchivoMasivo}/></label>
                            </div>
                            <datalist id="coordListMasivo">{coordNombres.map(c=><option key={c} value={c}/>)}</datalist>
                            <textarea rows={5} placeholder={"7684189\n1234567, 0981123456"} className="w-full p-3 border-2 rounded-xl font-mono text-sm outline-none focus:border-emerald-500 mb-3" value={masivoTexto} onChange={e=>setMasivoTexto(e.target.value)} />
                            <button onClick={cruzarMasivo} disabled={masivoCargando} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50">{masivoCargando ? "CRUZANDO CON PADRÓN..." : "CRUZAR CON PADRÓN"}</button>

                            {masivoResult && (
                                <div className="mt-4 bg-slate-50 border rounded-2xl p-4">
                                    <div className="flex gap-3 mb-3 flex-wrap">
                                        <span className="bg-green-100 text-green-800 font-black px-3 py-1 rounded-full text-sm">✅ {masivoResult.encontrados.length} encontrados</span>
                                        {masivoResult.noEncontrados.length>0 && <span className="bg-red-100 text-red-700 font-black px-3 py-1 rounded-full text-sm">❌ {masivoResult.noEncontrados.length} no figuran</span>}
                                    </div>
                                    <div className="max-h-40 overflow-y-auto text-xs space-y-1 mb-3">
                                        {masivoResult.encontrados.map(p=>(<div key={p.cedula} className="flex justify-between items-center bg-white border rounded px-2 py-1 gap-2"><span className="font-bold truncate">{p.nombre} {p.apellido}</span><span className="flex items-center gap-2 shrink-0"><span className="text-slate-400 text-[10px]">CI {p.cedula} · M{p.mesa}</span><button onClick={()=>setMasivoResult(r=>({...r, encontrados: r.encontrados.filter(x=>String(x.cedula)!==String(p.cedula))}))} title="No cargar este elector" className="text-red-400 hover:text-red-700 font-black">✕</button></span></div>))}
                                    </div>
                                    {masivoResult.noEncontrados.length>0 && <div className="text-[11px] text-red-600 font-bold mb-3 break-words">No figuran: {masivoResult.noEncontrados.slice(0,30).join(", ")}{masivoResult.noEncontrados.length>30?"…":""}</div>}
                                    <button onClick={cargarMasivo} disabled={masivoGuardando || masivoResult.encontrados.length===0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50">{masivoGuardando ? "CARGANDO..." : `CARGAR ${masivoResult.encontrados.length} A ${coordFijo || masivoCoord || 'COORDINADOR'}`}</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === "lista" && (
                    <div className="bg-white p-4 rounded-2xl shadow border overflow-x-auto animate-fade-in">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4">
                            <div className="flex items-center gap-2 mb-2"><Trophy size={16} className="text-amber-500"/><h3 className="font-black text-xs uppercase text-amber-800">Ranking de coordinadores (más cargas)</h3></div>
                            <div className="space-y-1 max-h-52 overflow-y-auto">
                                {rankingCoord.slice(0,10).map((c,i)=>(
                                    <button key={c.coordinador} onClick={()=>{setFC(c.coordinador);setLim(50);}} className="w-full flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border hover:bg-amber-100 transition-colors text-left">
                                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${i===0?'bg-amber-400 text-white':i===1?'bg-slate-300 text-slate-700':i===2?'bg-orange-300 text-white':'bg-slate-200 text-slate-600'}`}>{i+1}</span>
                                        <span className="flex-1 font-black text-xs uppercase truncate">{c.coordinador}</span>
                                        <span className="text-[10px] font-bold text-green-600 shrink-0">✅ {c.votaron}</span>
                                        <span className="text-sm font-black text-red-700 shrink-0">{c.total}</span>
                                    </button>
                                ))}
                                {rankingCoord.length===0 && <div className="text-center text-gray-400 font-bold text-xs p-2">Sin cargas aún.</div>}
                            </div>
                        </div>
                        <div className="flex gap-4 mb-4"><select className="p-2 border rounded font-bold text-xs flex-1" value={fC} onChange={e=>{setFC(e.target.value);setLim(50);}}><option value="TODOS">COORD: TODOS</option>{coordNombres.map(c=><option key={c}>{c}</option>)}</select><select className="p-2 border rounded font-bold text-xs flex-1" value={fS} onChange={e=>{setFS(e.target.value);setLim(50);}}><option value="TODOS">COLOR: TODOS</option><option value="VERDE">VERDE</option><option value="AMARILLO">AMARILLO</option><option value="ROJO">ROJO</option></select></div>
                        <table className="w-full text-left min-w-[600px]"><thead className="bg-red-50 text-red-900 text-[10px] uppercase"><tr><th className="p-3">Elector</th><th className="p-3">Día D</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y text-sm">
                            {misV.filter(v=>(fC==="TODOS"||v.coordinador===fC)&&(fS==="TODOS"||v.semaforo===fS)).slice(0,lim).map(v=>{
                                const vot = yaVotaronGlobal[generarLlave(v.distrito,v.cod_local,v.mesa,v.orden)];
                                const esDuplicado = cedulasDuplicadas.has(v.cedula);
                                const semaforoReal = esDuplicado ? 'ROJO' : v.semaforo;
                                return (
                                    <tr key={v.id} className={esDuplicado ? 'bg-red-50' : ''}>
                                        <td className="p-3 font-bold">
                                            {v.nombre} {v.apellido}
                                            {esDuplicado && <span className="ml-2 bg-red-600 text-white text-[9px] px-2 py-0.5 rounded uppercase font-black tracking-widest">⚠️ DUPLICADO EN EL SISTEMA</span>}
                                            <br/>
                                            <span className="text-xs text-gray-500">M:{v.mesa} | C.I:{v.cedula} | <span className={`text-${semaforoReal === 'VERDE' ? 'green' : semaforoReal === 'AMARILLO' ? 'yellow' : 'red'}-500 text-lg leading-none`}>●</span></span>
                                        </td>
                                        <td className="p-3">{vot?<span className="bg-green-100 text-green-800 text-[10px] font-black px-2 py-1 rounded">✅ {vot.hora}</span>:'-'}</td>
                                        <td className="p-3">
                                            <div className="flex justify-center items-center gap-2">
                                                <button onClick={()=>enviarWhatsAppCarnet(v)} title="Enviar por WhatsApp" className="text-green-600 hover:text-green-800"><Send size={15}/></button>
                                                <button onClick={()=>imprimirCarnetFisico(v, FOTOS_LOCALES_CONCEJALES[normalizarNombre(v.concejal)])} title="Imprimir carnet" className="text-slate-700 hover:text-black"><Printer size={15}/></button>
                                                <button onClick={()=>abrirEditar(v)} title="Editar (teléfono/localidad)" className="text-blue-500 hover:text-blue-700"><Edit2 size={15}/></button>
                                                <button onClick={()=>eliminarVotoConcejal(v.id)} title="Eliminar registro" className="text-red-400 hover:text-red-700"><Trash2 size={15}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )})}
                        </tbody></table>{misV.length>lim && <button onClick={()=>setLim(l=>l+50)} className="w-full p-4 bg-slate-100 font-bold text-slate-600 mt-4 rounded-xl">Cargar más...</button>}
                    </div>
                )}

                {/* ... Otras pestañas de Concejal igual ... */}
                {tab === "dia_d_buscador" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-red-600">
                            <h2 className="font-black text-xl mb-4 text-slate-800 flex items-center gap-2"><Search className="text-red-600"/> BUSCADOR RÁPIDO DÍA D</h2>
                            <p className="text-xs text-slate-500 font-bold mb-4">Ingresa el número de cédula de cualquier elector para consultar su estado o marcar su paso por PC.</p>
                            <div className="flex gap-2 mb-6">
                                <input type="number" placeholder="N° Cédula..." className="flex-1 p-4 border-2 rounded-xl font-bold outline-none focus:border-red-500" value={bDiaD} onChange={e=>setBDiaD(e.target.value)} onKeyDown={e=>e.key==='Enter'&&buscarDiaD()} />
                                <button onClick={buscarDiaD} className="bg-red-700 hover:bg-red-800 text-white px-6 rounded-xl font-bold transition-colors"><Search/></button>
                            </div>

                            {resDiaD === "NO" && <div className="p-4 bg-red-50 text-red-600 font-bold text-center rounded-xl border border-red-200">❌ Cédula no encontrada en el padrón.</div>}

                            {resDiaD && resDiaD !== "NO" && (
                                <div className="border-2 border-slate-200 rounded-xl p-6 bg-slate-50">
                                    <div className="text-2xl font-black text-slate-800">{resDiaD.nombre} {resDiaD.apellido}</div>
                                    <div className="text-sm font-bold text-gray-500 mb-3">C.I: {bDiaD} | {resDiaD.distrito}</div>
                                    <div className="bg-red-50 border-2 border-red-100 rounded-xl p-3 mb-4"><div className="text-[10px] font-black text-red-700 uppercase">📍 Local de Votación</div><div className="text-sm font-black text-slate-800 leading-tight">{resDiaD.local || '—'}</div></div>

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
                                        <button onClick={() => marcarPasoPCConcejal(generarLlave(resDiaD.distrito, resDiaD.cod_local, resDiaD.mesa, resDiaD.orden), resDiaD.pc, resDiaD)} className={`w-full py-4 rounded-xl font-black text-sm transition-all duration-300 border-2 flex items-center justify-center gap-2 shadow-sm ${resDiaD.pc ? 'bg-blue-50 text-blue-800 border-blue-300' : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100'}`}>
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

                {tab === "dirigentes" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-white p-6 rounded-2xl shadow-xl border-t-4 border-t-emerald-600">
                            <div className="flex justify-between items-center mb-1">
                                <h2 className="font-black text-xl text-slate-800 flex items-center gap-2"><UserPlus className="text-emerald-600"/> MIS DIRIGENTES</h2>
                                <span className={`text-xs font-black px-3 py-1 rounded-full ${misDirigentes.length >= MAX_DIRIGENTES ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{misDirigentes.length} / {MAX_DIRIGENTES}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-bold mb-4">Cargá hasta {MAX_DIRIGENTES} dirigentes. Ellos entran al sistema con la cuenta de dirigente y se identifican con SU cédula para consultar y marcar "pasó por PC".</p>

                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
                                <div className="flex gap-2 mb-2">
                                    <input type="number" placeholder="N° Cédula del dirigente" className="flex-1 p-3 border-2 rounded-xl font-bold outline-none focus:border-emerald-500" value={dirForm.cedula} onChange={e=>setDirForm({...dirForm, cedula: e.target.value})} onKeyDown={e=>e.key==='Enter'&&buscarCedulaDirigente()} />
                                    <button onClick={buscarCedulaDirigente} disabled={dirBuscando} className="bg-slate-700 hover:bg-slate-800 text-white px-4 rounded-xl font-bold disabled:opacity-50"><Search size={18}/></button>
                                </div>
                                <input type="text" placeholder="Nombre y apellido" className="w-full p-3 border-2 rounded-xl font-bold uppercase outline-none focus:border-emerald-500 mb-2" value={dirForm.nombre} onChange={e=>setDirForm({...dirForm, nombre: e.target.value})} />
                                <button onClick={agregarDirigente} disabled={misDirigentes.length >= MAX_DIRIGENTES} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{misDirigentes.length >= MAX_DIRIGENTES ? `LÍMITE DE ${MAX_DIRIGENTES} ALCANZADO` : "+ AGREGAR DIRIGENTE"}</button>
                            </div>

                            <div className="space-y-2">
                                {misDirigentes.length === 0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Todavía no cargaste dirigentes.</div>}
                                {misDirigentes.sort((a,b)=>(a.ts||0)-(b.ts||0)).map(d => (
                                    <div key={d.cedula} className="flex items-center justify-between bg-slate-50 border rounded-xl p-3">
                                        <div className="min-w-0">
                                            <div className="font-black text-sm uppercase truncate">{d.nombre}</div>
                                            <div className="text-[11px] font-bold text-slate-500">C.I: {d.cedula}</div>
                                        </div>
                                        <button onClick={()=>quitarDirigente(d.cedula)} className="text-red-500 bg-red-100 hover:bg-red-200 p-2 rounded-lg shrink-0"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {tab === "carga_link" && (
                    <div className="animate-fade-in max-w-2xl mx-auto space-y-5">
                        <div className="bg-white p-5 rounded-3xl shadow border">
                            <h2 className="font-black text-lg text-slate-800 flex items-center gap-2 mb-1"><UserPlus className="text-emerald-600" size={20}/> AGREGAR COORDINADOR</h2>
                            <p className="text-xs text-slate-500 font-bold mb-4">Buscá su cédula, agregá localidad y zona. Aparece en REGISTRO para seleccionarlo, y podés enviarle un link para que cargue su lista.</p>
                            <div className="flex gap-2 mb-2">
                                <input type="number" placeholder="CÉDULA DEL COORDINADOR" className="flex-1 p-3 border-2 rounded-xl font-bold text-center outline-none focus:border-emerald-500" value={coordForm.cedula} onChange={e=>setCoordForm({...coordForm, cedula:e.target.value})} onKeyDown={e=>e.key==='Enter'&&buscarCoordCedula()} />
                                <button onClick={buscarCoordCedula} disabled={coordBuscando} className="bg-slate-800 text-white px-5 rounded-xl font-black disabled:opacity-50">{coordBuscando?'...':<Search size={18}/>}</button>
                            </div>
                            <input type="text" placeholder="NOMBRE Y APELLIDO" className="w-full p-3 border-2 rounded-xl font-bold uppercase outline-none mb-2" value={coordForm.nombre} onChange={e=>setCoordForm({...coordForm, nombre:e.target.value.toUpperCase()})} />
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <input type="text" placeholder="TELÉFONO" className="p-3 border-2 border-blue-200 rounded-xl font-bold outline-none" value={coordForm.telefono} onChange={e=>setCoordForm({...coordForm, telefono:e.target.value})} />
                                <input type="text" placeholder="LOCALIDAD" className="p-3 border-2 rounded-xl font-bold uppercase outline-none" value={coordForm.localidad} onChange={e=>setCoordForm({...coordForm, localidad:e.target.value.toUpperCase()})} />
                            </div>
                            <select className="w-full p-3 border-2 rounded-xl font-bold outline-none mb-3" value={coordForm.zona} onChange={e=>setCoordForm({...coordForm, zona:e.target.value})}><option value="URBANA">🏙️ URBANA</option><option value="RURAL">🌾 RURAL</option></select>
                            <button onClick={guardarCoordinador} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black transition-colors">+ GUARDAR COORDINADOR</button>
                        </div>

                        <div className="bg-white p-5 rounded-3xl shadow border">
                            <h3 className="font-black text-sm uppercase text-slate-500 mb-3">Mis coordinadores ({coordinadoresLista.length})</h3>
                            <div className="space-y-2">
                                {coordinadoresLista.map(c => (
                                    <div key={c.nombre} className="border rounded-2xl p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-black text-sm uppercase truncate">{c.nombre}</div>
                                                <div className="text-[10px] font-bold text-slate-400 truncate">{c.cedula?`CI ${c.cedula} · `:''}{c.localidad||''} {c.zona?`· ${c.zona}`:''}{c.telefono?` · 📞 ${c.telefono}`:''}</div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={()=>generarLinkPara(c)} className="bg-slate-800 hover:bg-slate-900 text-white px-3 py-2 rounded-lg font-black text-xs flex items-center gap-1"><Send size={14}/> LINK</button>
                                                <button onClick={()=>quitarCoordinador(c)} title="Eliminar coordinador" className="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded-lg"><Trash2 size={16}/></button>
                                            </div>
                                        </div>
                                        {linksGenerados[c.nombre] && (
                                            <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                                                <div className="text-[10px] font-mono break-all bg-white border rounded p-2 mb-2">{linksGenerados[c.nombre]}</div>
                                                <div className="flex gap-2">
                                                    <button onClick={()=>{navigator.clipboard?.writeText(linksGenerados[c.nombre]); alert('Copiado');}} className="flex-1 bg-slate-800 text-white py-1.5 rounded-lg font-black text-[11px]">COPIAR</button>
                                                    <a href={`https://wa.me/${c.telefono?c.telefono.replace(/\D/g,''):''}?text=${encodeURIComponent('Cargá tu gente acá: '+linksGenerados[c.nombre])}`} target="_blank" rel="noreferrer" className="flex-1 bg-green-600 text-white py-1.5 rounded-lg font-black text-[11px] text-center">WHATSAPP</a>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {coordinadoresLista.length===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Agregá tu primer coordinador arriba.</div>}
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-3xl shadow border">
                            <div className="flex items-center justify-between mb-3"><h3 className="font-black text-sm uppercase text-slate-500">Cargas recibidas</h3><button onClick={refrescarCargas} className="text-slate-400 hover:text-slate-700"><RefreshCw size={16}/></button></div>
                            <div className="space-y-2">
                                {cargasList.map(c => (
                                    <div key={c.token} className="border rounded-2xl p-3 flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-black text-sm uppercase truncate">{c.coordinador_nombre}</div>
                                            <div className="text-[10px] font-bold text-slate-400">{c.filas} personas · {c.estado}{c.zona?` · ${c.zona}`:''}</div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {c.estado === "enviado" ? (
                                                <button onClick={()=>importarCarga(c)} disabled={importando===c.token} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-black text-xs disabled:opacity-50">{importando===c.token ? "IMPORTANDO..." : "IMPORTAR"}</button>
                                            ) : c.estado === "importado" ? (
                                                <span className="text-[11px] font-black text-green-600">✅ IMPORTADO</span>
                                            ) : (
                                                <span className="text-[11px] font-black text-slate-400">⏳ CARGANDO</span>
                                            )}
                                            <button onClick={()=>eliminarCargaLista(c.token)} title="Eliminar esta lista/link" className="bg-red-100 text-red-600 hover:bg-red-200 p-2 rounded-lg"><Trash2 size={15}/></button>
                                        </div>
                                    </div>
                                ))}
                                {cargasList.length===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">No hay cargas todavía.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "auditoria" && (
                    <div className="animate-fade-in max-w-3xl mx-auto">
                        <div className="bg-white p-5 rounded-3xl shadow border">
                            <div className="flex items-center gap-2 mb-1"><AlertTriangle size={20} className="text-red-500"/><h2 className="font-black text-lg text-slate-800 uppercase">Auditoría de duplicados</h2></div>
                            <p className="text-xs text-slate-500 font-bold mb-4">Electores cargados 2+ veces en tu lista. Cada cédula <b>suma solo 1</b> para tu meta. Revisá con qué coordinador quedó cada uno y borrá la carga de más.</p>
                            <div className="flex gap-3 mb-4 flex-wrap">
                                <span className="bg-red-100 text-red-700 font-black px-3 py-1 rounded-full text-sm">{misDuplicados.length} cédulas duplicadas</span>
                                <span className="bg-slate-100 text-slate-600 font-black px-3 py-1 rounded-full text-sm">{urnas.duplicados} cargas de más</span>
                            </div>
                            <div className="space-y-3">
                                {misDuplicados.map(grupo => (
                                    <div key={grupo[0].cedula} className="border-2 border-red-200 rounded-2xl p-3 bg-red-50/40">
                                        <div className="flex justify-between items-center mb-2 gap-2"><div className="font-black text-sm uppercase truncate">{grupo[0].nombre} {grupo[0].apellido}</div><span className="text-[11px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded shrink-0">CI {grupo[0].cedula} · x{grupo.length}</span></div>
                                        <div className="space-y-1">
                                            {grupo.map(v => (
                                                <div key={v.id} className="flex items-center justify-between bg-white border rounded-lg px-2 py-1.5">
                                                    <div className="text-[11px] font-bold text-slate-600 truncate">👤 Coord: <b className="uppercase">{v.coordinador || 'SIN ASIGNAR'}</b></div>
                                                    <button onClick={()=>{ if(window.confirm('¿Borrar esta carga duplicada?')) remove(ref(db, `votos_seguros/${v.id}`)); }} className="text-red-500 bg-red-100 hover:bg-red-200 p-1.5 rounded-lg shrink-0 ml-2"><Trash2 size={14}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {misDuplicados.length===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">✅ Sin duplicados en tu lista.</div>}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "proyecciones" && (() => {
                    const verdes = misV.filter(v=>v.semaforo==='VERDE' && !cedulasDuplicadas.has(v.cedula)).length;
                    const amar = misV.filter(v=>v.semaforo==='AMARILLO' && !cedulasDuplicadas.has(v.cedula)).length;
                    const rojos = misV.length - verdes - amar;
                    const t = misV.length || 1;
                    return (
                        <div className="space-y-5 animate-fade-in">
                            <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl">
                                <div className="flex items-center gap-2 mb-4"><BarChart3 size={20} className="text-red-500"/><h2 className="font-black text-lg uppercase">Proyección hacia la meta</h2></div>
                                <div className="flex items-end gap-3 mb-2"><span className="text-5xl font-black text-green-400 leading-none">{urnas.votaron}</span><span className="text-slate-400 font-black mb-1">/ {META_URNAS} votos</span></div>
                                <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden mb-1"><div className="bg-green-500 h-4 transition-all duration-500" style={{width:`${urnas.pct}%`}}></div></div>
                                <div className="text-right text-xs font-black text-green-400">{urnas.pct}% · faltan {urnas.falta}</div>
                            </div>
                            <div className="bg-white p-5 rounded-3xl shadow border">
                                <h3 className="font-black text-sm uppercase text-slate-500 mb-4">Semáforo de tus cargas ({misV.length})</h3>
                                <div className="space-y-3">
                                    {[['🟢 Verdes',verdes,'bg-green-500'],['🟡 Amarillos',amar,'bg-yellow-500'],['🔴 Rojos / duplicados',rojos,'bg-red-500']].map(([lbl,n,c])=>(
                                        <div key={lbl}>
                                            <div className="flex justify-between text-xs font-black mb-1"><span>{lbl}</span><span>{n} ({Math.round((n/t)*100)}%)</span></div>
                                            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div className={`${c} h-3`} style={{width:`${Math.round((n/t)*100)}%`}}></div></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white p-5 rounded-3xl shadow border text-center"><div className="text-3xl font-black text-green-600">{urnas.votaron}</div><div className="text-[10px] font-black uppercase text-slate-400 mt-1">Ya votaron</div></div>
                                <div className="bg-white p-5 rounded-3xl shadow border text-center"><div className="text-3xl font-black text-slate-700">{Math.max(0, urnas.cargados - urnas.votaron)}</div><div className="text-[10px] font-black uppercase text-slate-400 mt-1">Cargados sin votar</div></div>
                            </div>
                        </div>
                    );
                })()}

                {tab === "live" && (() => {
                    const eventos = [];
                    misV.forEach(v => {
                        const ll = generarLlave(v.distrito,v.cod_local,v.mesa,v.orden);
                        const vd = yaVotaronGlobal[ll]; const pc = pasoPCGlobal[ll];
                        if (vd) eventos.push({ tipo:'voto', v, hora: vd.hora, ts: vd.timestamp||0 });
                        if (pc) eventos.push({ tipo:'pc', v, hora: pc.hora, ts: pc.timestamp||0, por: pc.registradoPorNombre });
                    });
                    eventos.sort((a,b)=>b.ts-a.ts);
                    return (
                        <div className="animate-fade-in max-w-2xl mx-auto">
                            <div className="bg-white p-5 rounded-3xl shadow border">
                                <div className="flex items-center gap-2 mb-4"><Bell size={20} className="text-red-500"/><h2 className="font-black text-lg uppercase text-slate-800">Actividad en vivo</h2><span className="ml-auto w-2 h-2 rounded-full bg-green-500 animate-pulse"></span></div>
                                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                                    {eventos.slice(0,100).map((e,i)=>(
                                        <div key={i} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${e.tipo==='voto'?'bg-green-50 border-green-200':'bg-blue-50 border-blue-200'}`}>
                                            <div className="min-w-0"><div className="font-black text-sm uppercase truncate">{e.v.nombre} {e.v.apellido}</div><div className="text-[10px] font-bold text-slate-400 truncate">M{e.v.mesa} · {e.v.coordinador||'—'}{e.por?` · ${e.por}`:''}</div></div>
                                            <div className="text-right shrink-0 ml-2">{e.tipo==='voto'?<span className="text-[11px] font-black text-green-700">✅ VOTÓ</span>:<span className="text-[11px] font-black text-blue-700">📍 PC</span>}<div className="text-[9px] font-bold text-slate-400">{e.hora}</div></div>
                                        </div>
                                    ))}
                                    {eventos.length===0 && <div className="text-center text-gray-400 font-bold p-6 border-2 border-dashed rounded-xl">Sin actividad todavía.</div>}
                                </div>
                            </div>
                        </div>
                    );
                })()}
                </main>
            </div>

            {coordSel && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={()=>setCoordSel(null)}>
                    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50"><div className="min-w-0"><h3 className="font-black uppercase truncate">{coordSel.coordinador}</h3><p className="text-[11px] font-bold text-slate-500">{coordSel.total} cargas · {coordSel.votaron} votaron</p></div><button onClick={()=>setCoordSel(null)} className="p-1 text-slate-400"><X size={22}/></button></div>
                        <div className="p-4 overflow-y-auto">
                            <h4 className="text-[11px] font-black uppercase text-slate-400 mb-2">Locales donde votan</h4>
                            <div className="flex flex-wrap gap-1 mb-4">{coordSel.localesTop.map(l=><span key={l.local} className="text-[10px] font-bold bg-slate-100 border rounded px-2 py-1 flex items-center gap-1"><MapPin size={10} className="text-red-400"/>{l.local} <b>{l.n}</b></span>)}</div>
                            <h4 className="text-[11px] font-black uppercase text-slate-400 mb-2">Electores</h4>
                            <div className="space-y-1">
                                {misV.filter(v=>(v.coordinador||'SIN COORDINADOR')===coordSel.coordinador).map(v=>{
                                    const ll=generarLlave(v.distrito,v.cod_local,v.mesa,v.orden); const vd=yaVotaronGlobal[ll]; const pc=pasoPCGlobal[ll];
                                    return (<div key={v.id} className="flex items-center justify-between bg-slate-50 border rounded-lg px-2 py-1.5"><div className="min-w-0"><div className="font-black text-xs uppercase truncate">{v.nombre} {v.apellido}</div><div className="text-[9px] font-bold text-slate-400 truncate">CI {v.cedula} · M{v.mesa} · {v.local}</div></div><div className="flex gap-1 shrink-0 items-center">{pc&&<span className="text-[10px]">📍</span>}{vd?<span className="text-[10px]">✅</span>:<span className="text-[10px] opacity-30">⏳</span>}</div></div>);
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {editVoto && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={()=>setEditVoto(null)}>
                    <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden" onClick={e=>e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50"><div className="min-w-0"><h3 className="font-black uppercase">Editar registro</h3><p className="text-[11px] font-bold text-slate-500 truncate">{editVoto.nombre} {editVoto.apellido} · CI {editVoto.cedula}</p></div><button onClick={()=>setEditVoto(null)} className="p-1 text-slate-400"><X size={22}/></button></div>
                        <div className="p-4 space-y-3">
                            <div><label className="text-[10px] font-black text-slate-500 uppercase">📱 Teléfono</label><input type="tel" className="w-full p-3 border-2 border-green-200 rounded-xl font-bold outline-none focus:border-green-500" value={editForm.telefono} onChange={e=>setEditForm({...editForm, telefono:e.target.value})} placeholder="Ej: 0981123456"/></div>
                            <div><label className="text-[10px] font-black text-slate-500 uppercase">Localidad</label><input type="text" className="w-full p-3 border-2 rounded-xl font-bold uppercase outline-none" value={editForm.localidad} onChange={e=>setEditForm({...editForm, localidad:e.target.value.toUpperCase()})} placeholder="Barrio / compañía"/></div>
                            <div><label className="text-[10px] font-black text-slate-500 uppercase">Coordinador</label><select className="w-full p-3 border-2 rounded-xl font-bold outline-none" value={editForm.coordinador} onChange={e=>setEditForm({...editForm, coordinador:e.target.value})}><option value="">SIN COORDINADOR</option>{coordNombres.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                            <div><label className="text-[10px] font-black text-slate-500 uppercase">Color</label><select className={`w-full p-3 rounded-xl font-black text-white outline-none ${editForm.semaforo==='VERDE'?'bg-green-500':editForm.semaforo==='AMARILLO'?'bg-yellow-500':'bg-red-500'}`} value={editForm.semaforo} onChange={e=>setEditForm({...editForm, semaforo:e.target.value})}><option value="VERDE">🟢 VERDE</option><option value="AMARILLO">🟡 AMARILLO</option><option value="ROJO">🔴 ROJO</option></select></div>
                            <div className="flex gap-2 pt-1">
                                <button onClick={guardarEditar} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black">GUARDAR</button>
                                <button onClick={()=>setEditVoto(null)} className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-xl font-black">CANCELAR</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {localSel && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={()=>setLocalSel(null)}>
                    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50"><div className="min-w-0"><h3 className="font-black uppercase truncate text-sm">{localSel}</h3><p className="text-[11px] font-bold text-slate-500">{misV.filter(v=>(v.local||'SIN LOCAL')===localSel).length} de tu lista votan acá</p></div><button onClick={()=>setLocalSel(null)} className="p-1 text-slate-400"><X size={22}/></button></div>
                        <div className="p-4 overflow-y-auto space-y-1">
                            {misV.filter(v=>(v.local||'SIN LOCAL')===localSel).map(v=>{
                                const ll=generarLlave(v.distrito,v.cod_local,v.mesa,v.orden); const vd=yaVotaronGlobal[ll];
                                return (<div key={v.id} className="flex items-center justify-between bg-slate-50 border rounded-lg px-2 py-1.5"><div className="min-w-0"><div className="font-black text-xs uppercase truncate">{v.nombre} {v.apellido}</div><div className="text-[9px] font-bold text-slate-400 truncate">CI {v.cedula} · M{v.mesa} · {v.coordinador||'—'}</div></div>{vd?<span className="text-[9px] font-black text-green-700 shrink-0 ml-2">✅ {vd.hora}</span>:<span className="text-[10px] opacity-30 shrink-0 ml-2">⏳</span>}</div>);
                            })}
                        </div>
                    </div>
                </div>
            )}

            {verPasoPCTodo && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={()=>setVerPasoPCTodo(false)}>
                    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50"><div><h3 className="font-black uppercase flex items-center gap-2"><Monitor size={18} className="text-blue-500"/>Paso por PC</h3><p className="text-[11px] font-bold text-slate-500">{pasoPC.count} de {urnas.cargados} · {pasoPC.pct}%</p></div><button onClick={()=>setVerPasoPCTodo(false)} className="p-1 text-slate-400"><X size={22}/></button></div>
                        <div className="p-4 overflow-y-auto space-y-1">
                            {pasoPC.lista.map(v=>(<div key={v.id} className="flex items-center justify-between bg-slate-50 border rounded-lg px-2 py-1.5"><div className="min-w-0"><div className="font-black text-xs uppercase truncate">{v.nombre}{!v.enLista && <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-1 rounded">FUERA</span>}</div><div className="text-[9px] font-bold text-slate-400 truncate">CI {v.cedula || '—'}{v.mesa?` · M${v.mesa}`:''}{v.local?` · ${v.local}`:''}</div></div><div className="text-right shrink-0 ml-2">{v.voto ? <div className="text-[9px] font-black text-green-700">✅ VOTÓ</div> : <div className="text-[9px] font-black text-slate-400">⏳</div>}<div className="text-[10px] font-black text-blue-700">📍 {v.pc.hora}</div></div></div>))}
                            {pasoPC.count===0 && <div className="text-center text-gray-400 font-bold p-6">Nadie pasó por PC aún.</div>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
