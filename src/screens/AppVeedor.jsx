import React, { useState, useEffect } from "react";
import { ref, set, remove, update, onValue, query, orderByKey, startAt, endAt } from "firebase/database";
import { signOut } from "firebase/auth";
import { Unlock, Lock, ClipboardList, CheckCircle, ListChecks, Clock } from "lucide-react";
import { generarLlave, generarLlaveMesa } from "../lib/llaves";
import { padronDeMesa } from "../lib/padronSupabase";

export default function AppVeedor({ mesasCerradas, asignacionesVeedores, escrutinioGlobal, configApp, auth, db }) {
    const [vs, setVs] = useState(null);
    const [ciIn, setCiIn] = useState("");
    const [fMesa, setFMesa] = useState("");
    const [vista, setVista] = useState("pintar"); // pintar | votaron | acta
    const [online, setOnline] = useState(true);   // conexión real a Firebase

    useEffect(() => {
        const un = onValue(ref(db, ".info/connected"), snap => setOnline(snap.val() === true));
        return () => un();
    }, [db]);

    // Pintado robusto: marca optimista local (instantánea) + votos reales de la mesa (RTDB, tiempo real)
    const [votosMesa, setVotosMesa] = useState({});     // llave -> data (solo esta mesa)
    const [marcadosLocal, setMarcadosLocal] = useState({}); // orden -> bool (optimista)
    const [padronMesa, setPadronMesa] = useState([]);   // SOLO esta mesa (Supabase) + cache local
    const [cargandoMesa, setCargandoMesa] = useState(false);

    // Descarga SOLO los electores de esta mesa desde Supabase (no todo el distrito).
    // Cache local primero (arranque instantáneo / offline), luego refresca.
    useEffect(() => {
        if (!vs) return;
        const cacheKey = `padronmesa_${vs.distrito}_${vs.cod_local}_${vs.mesa}`;
        try { const c = localStorage.getItem(cacheKey); if (c) setPadronMesa(JSON.parse(c)); } catch {}
        setCargandoMesa(true);
        padronDeMesa(vs.distrito, vs.cod_local, vs.mesa).then(rows => {
            const items = rows.map(r => ({ ci: String(r.cedula), cedula: String(r.cedula), nombre: r.nombre, apellido: r.apellido, orden: r.orden, distrito: vs.distrito, cod_local: vs.cod_local, mesa: vs.mesa }));
            if (items.length) { setPadronMesa(items); try { localStorage.setItem(cacheKey, JSON.stringify(items)); } catch {} }
        }).finally(() => setCargandoMesa(false));
    }, [vs]);

    const [fEsc, setFEsc] = useState({ intendente: "", concejales: {}, rivalesIntendente: [], rivalesConcejales: [], blancos: "", nulos: "" });
    const [mEdEsc, setMEdEsc] = useState(false);

    useEffect(() => { const g = localStorage.getItem('veedor_bemo_sesion'); if (g) { const p = JSON.parse(g); setVs(p); set(ref(db, `dia_d/veedores_online/${p.ci}`), true); } }, [db]);

    const llMA = vs ? generarLlaveMesa(vs.distrito, vs.cod_local, vs.mesa) : null;
    const isC = llMA && mesasCerradas[llMA];
    const miEsc = llMA ? escrutinioGlobal[llMA] : null;

    // Escucha SOLO los votos de esta mesa (filtrado por prefijo de llave) → no baja todo el nodo
    useEffect(() => {
        if (!vs) return;
        const prefijo = generarLlaveMesa(vs.distrito, vs.cod_local, vs.mesa) + "_";
        const q = query(ref(db, "dia_d/votos_efectuados"), orderByKey(), startAt(prefijo), endAt(prefijo + String.fromCharCode(0xffff)));
        const un = onValue(q, snap => setVotosMesa(snap.val() || {}));
        return () => un();
    }, [vs, db]);

    useEffect(() => {
        if(miEsc && !mEdEsc) {
            setFEsc({ intendente: miEsc.intendente || "", concejales: miEsc.concejales || {}, rivalesIntendente: miEsc.rivalesIntendente || [], rivalesConcejales: miEsc.rivalesConcejales || [], blancos: miEsc.blancos || "", nulos: miEsc.nulos || "" });
        } else if(!miEsc && isC) {
            const ic={}; (configApp.concejales||[]).forEach(c=>ic[c]="");
            setFEsc({ intendente: "", concejales: ic, rivalesIntendente: [], rivalesConcejales: [], blancos: "", nulos: "" });
            setMEdEsc(true);
        }
    }, [miEsc, isC, configApp, mEdEsc]);

    // ROBUSTO: guarda el acta con respaldo local + envío en 2do plano.
    // Firebase encola y reintenta solo hasta confirmar (no se traba, no se pierde).
    const guardarActa = () => {
        const inten = parseInt(fEsc.intendente) || 0;
        const sumaConc = Object.values(fEsc.concejales || {}).reduce((s, n) => s + (parseInt(n) || 0), 0);
        const bl = parseInt(fEsc.blancos) || 0, nu = parseInt(fEsc.nulos) || 0;
        const resumen = `RESUMEN DEL ACTA · MESA ${vs.mesa}\n\n` +
            `Intendente (${configApp.intendente || 'S/D'}): ${inten}\n` +
            `Concejales (suma): ${sumaConc}\n` +
            `Blancos: ${bl}\nNulos: ${nu}\n\n¿Enviar estos datos al sistema?`;
        if (!window.confirm(resumen)) return;
        const data = { ...fEsc, timestamp: Date.now(), cargadoPor: vs.nombre };
        try { localStorage.setItem(`acta_pend_${llMA}`, JSON.stringify(data)); } catch {}
        set(ref(db, `dia_d/escrutinio/${llMA}`), data)
            .then(() => { try { localStorage.removeItem(`acta_pend_${llMA}`); } catch {} })
            .catch(() => {});
        alert("✅ Acta guardada. Se envía al sistema automáticamente (aunque haya poca señal).");
        setMEdEsc(false);
    };

    // Reenvía automáticamente un acta que quedó pendiente (si la app se cerró antes de confirmar).
    useEffect(() => {
        if (!llMA) return;
        try {
            const pend = localStorage.getItem(`acta_pend_${llMA}`);
            if (pend) set(ref(db, `dia_d/escrutinio/${llMA}`), JSON.parse(pend))
                .then(() => { try { localStorage.removeItem(`acta_pend_${llMA}`); } catch {} })
                .catch(() => {});
        } catch {}
    }, [llMA, db]);

    // ¿votó? — la marca local optimista manda; si no, lo que dice RTDB
    const estaMarcado = (orden) => {
        if (marcadosLocal[orden] !== undefined) return marcadosLocal[orden];
        return !!votosMesa[generarLlave(vs.distrito, vs.cod_local, vs.mesa, orden)];
    };

    // Pintado: marca instantánea (no se traba) + guarda en RTDB en segundo plano
    const pintar = (v) => {
        try { if (navigator.vibrate) navigator.vibrate(40); } catch {}
        const yaVoto = estaMarcado(v.orden);
        const llV = generarLlave(vs.distrito, vs.cod_local, vs.mesa, v.orden);
        setMarcadosLocal(prev => ({ ...prev, [v.orden]: !yaVoto }));   // 1) instantáneo
        const data = yaVoto ? null : { hora: new Date().toLocaleTimeString(), timestamp: Date.now(), veedor: vs.nombre, ci: v.ci }; // 2) RTDB en background
        update(ref(db, "dia_d/votos_efectuados"), { [llV]: data }).catch(() => {
            setMarcadosLocal(prev => ({ ...prev, [v.orden]: yaVoto }));  // revierte si falla
            alert("⚠️ No se pudo guardar. Reintentá.");
        });
    };

    // Estado de envío por orden: 'ok' (confirmado en el servidor), 'pend' (esperando envío)
    const estadoEnvio = (orden) => {
        if (votosMesa[generarLlave(vs.distrito, vs.cod_local, vs.mesa, orden)]) return 'ok';
        if (marcadosLocal[orden] === true) return 'pend';
        return 'no';
    };

    const totalVotaron = padronMesa.filter(v => estaMarcado(v.orden)).length;
    const totalMesa = padronMesa.length;
    const pct = totalMesa > 0 ? Math.round((totalVotaron / totalMesa) * 100) : 0;
    const marcados = padronMesa.filter(v => estaMarcado(v.orden)).sort((a, b) => (parseInt(a.orden) || 0) - (parseInt(b.orden) || 0));
    const pendientesEnvio = marcados.filter(v => estadoEnvio(v.orden) === 'pend').length;

    return (
        <div className="min-h-screen pb-20 bg-slate-50">
          <header style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }} className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-xl border-b-4 border-red-600 sticky top-0 z-50"><div className="flex items-center gap-3"><span className="bg-red-700 px-2 rounded font-black">BEMO</span><div><h1 className="text-sm font-bold uppercase truncate">{vs?.local || configApp.intendente || "S/D"}</h1><p className="text-[10px] text-gray-400 font-bold uppercase">MESA: {vs?.mesa||'-'}</p></div></div><div className="flex items-center gap-2">{vs && <span className={`text-[9px] font-black px-2 py-1 rounded-full flex items-center gap-1 ${online?'bg-green-500/20 text-green-300':'bg-red-500/30 text-red-200 animate-pulse'}`}><span className={`w-2 h-2 rounded-full ${online?'bg-green-400':'bg-red-400'}`}></span>{online?'EN LÍNEA':'SIN SEÑAL'}</span>}<button onClick={()=>{localStorage.removeItem('veedor_bemo_sesion'); signOut(auth);}} className="text-[10px] bg-red-600 px-3 py-1.5 rounded-full font-black">SALIR</button></div></header>

          {!vs ? (
            <div className="p-6 max-w-md mx-auto mt-10 bg-white rounded-3xl shadow-xl"><h2 className="text-xl font-black mb-4 text-center">CÉDULA VEEDOR</h2><input type="number" className="w-full p-4 border-2 rounded-xl text-center text-xl font-black mb-4" value={ciIn} onChange={e=>setCiIn(e.target.value)} /><button onClick={()=>{const a=Object.values(asignacionesVeedores||{}).find(x=>String(x.ci)===String(ciIn)); if(a){setVs(a); localStorage.setItem('veedor_bemo_sesion',JSON.stringify(a)); set(ref(db,`dia_d/veedores_online/${a.ci}`),true);} else alert("No asignado.");}} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black">ENTRAR</button></div>
          ) : (
            <>
            <main className="p-2 max-w-4xl mx-auto mt-2">
              <div className="bg-white p-4 rounded-2xl shadow mb-3 border-l-8 border-green-500 flex justify-between items-center"><div><h2 className="font-black text-xl leading-none uppercase">MESA {vs.mesa}</h2><p className="text-[10px] font-black text-gray-500 mt-1 uppercase truncate max-w-[200px]">{vs.local || vs.nombre}</p></div>{isC ? <button onClick={()=>{if(window.confirm("¿Reabrir la mesa para seguir marcando?")) {remove(ref(db, `dia_d/mesas_cerradas/${llMA}`));}}} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-black"><Unlock size={12} className="inline mr-1"/>REABRIR</button> : <span className="bg-green-100 text-green-700 px-3 py-1 rounded text-[10px] font-black">ABIERTA</span>}</div>

              {vista === "pintar" && (<>
                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow mb-3 flex items-center justify-around">
                      <div className="text-center"><div className="text-4xl font-black text-green-400 leading-none">{totalVotaron}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Ya votaron</div></div>
                      <div className="text-2xl font-black text-slate-600">/</div>
                      <div className="text-center"><div className="text-4xl font-black leading-none">{totalMesa}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Habilitados</div></div>
                      <div className="text-center bg-green-600 rounded-xl px-4 py-2"><div className="text-2xl font-black leading-none">{pct}%</div><div className="text-[8px] font-black uppercase mt-0.5">Participación</div></div>
                  </div>
                  {isC && <div className="bg-orange-50 border border-orange-200 text-orange-700 text-center text-xs font-black py-2 rounded-xl mb-2">🔒 Mesa cerrada. Reabrí arriba si te faltó marcar.</div>}
                  <div className="bg-white p-3 rounded-xl shadow mb-2"><input type="number" placeholder="BUSCAR ORDEN / C.I..." className="w-full p-2 font-black outline-none text-center" value={fMesa} onChange={e=>setFMesa(e.target.value)} /></div>
                  <div className="bg-white rounded-xl shadow overflow-hidden mb-4"><table className="w-full text-left"><thead className="bg-slate-800 text-white text-[10px] uppercase"><tr><th className="p-3 text-center">Ord</th><th className="p-3">Votante</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y">
                      {padronMesa.filter(v => v.ci.includes(fMesa) || v.orden.toString().includes(fMesa)).map(v => {
                          const voto = estaMarcado(v.orden); const env = estadoEnvio(v.orden);
                          return (
                          <tr key={v.ci} className={voto ? 'bg-green-50' : ''}>
                              <td className="p-3 text-center font-black text-slate-400">{v.orden}</td>
                              <td className="p-3 leading-tight"><div className="font-black text-sm">{v.nombre} {v.apellido}</div><div className="text-[9px] text-gray-500 font-bold">C.I: {v.ci}{voto && env==='pend' && <span className="ml-1 text-amber-600">· ⏳ enviando</span>}{voto && env==='ok' && <span className="ml-1 text-green-600">· ✓ enviado</span>}</div></td>
                              <td className="p-3"><button onClick={() => pintar(v)} className={`w-full py-2 rounded font-black text-[10px] border-2 flex items-center justify-center gap-1 transition-colors ${voto ? 'bg-green-500 border-green-600 text-white' : 'border-slate-300 text-slate-500'}`}>{voto ? <><CheckCircle size={12}/> VOTÓ</> : 'PINTAR'}</button></td>
                          </tr>);
                      })}
                      {padronMesa.length === 0 && <tr><td colSpan="3" className="text-center py-8 text-gray-400 font-bold">{cargandoMesa ? "Cargando electores de la mesa…" : "No hay electores en esta mesa."}</td></tr>}
                  </tbody></table></div>
                  {!isC && <button onClick={()=>{if(window.confirm("¿Cerrar la mesa? Después podés reabrir si falta algo.")){set(ref(db, `dia_d/mesas_cerradas/${llMA}`),{hora:new Date().toLocaleTimeString(), cerradoPor:vs.nombre});}}} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-2xl flex justify-center gap-2"><Lock/> CERRAR MESA</button>}
              </>)}

              {vista === "votaron" && (<>
                  <div className="bg-slate-900 text-white p-4 rounded-2xl shadow mb-3 flex items-center justify-around">
                      <div className="text-center"><div className="text-4xl font-black text-green-400 leading-none">{totalVotaron}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Ya votaron</div></div>
                      <div className="text-2xl font-black text-slate-600">/</div>
                      <div className="text-center"><div className="text-4xl font-black leading-none">{totalMesa}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Habilitados</div></div>
                      <div className={`text-center rounded-xl px-4 py-2 ${pendientesEnvio>0?'bg-amber-500':'bg-green-600'}`}><div className="text-2xl font-black leading-none">{pendientesEnvio}</div><div className="text-[8px] font-black uppercase mt-0.5">Sin enviar</div></div>
                  </div>
                  <div className="flex gap-3 mb-2 text-[10px] font-bold text-slate-500 px-1"><span className="flex items-center gap-1"><CheckCircle size={12} className="text-green-600"/> Enviado y confirmado</span><span className="flex items-center gap-1"><Clock size={12} className="text-amber-500"/> Esperando enviar</span></div>
                  <div className="bg-white rounded-xl shadow overflow-hidden mb-4"><table className="w-full text-left"><thead className="bg-slate-800 text-white text-[10px] uppercase"><tr><th className="p-3 text-center">Ord</th><th className="p-3">Votante</th><th className="p-3 text-center">Envío</th></tr></thead><tbody className="divide-y">
                      {marcados.map(v => { const env = estadoEnvio(v.orden); return (
                          <tr key={v.ci} className={env==='pend'?'bg-amber-50':'bg-green-50/40'}>
                              <td className="p-3 text-center font-black text-slate-500">{v.orden}</td>
                              <td className="p-3 leading-tight"><div className="font-black text-sm">{v.nombre} {v.apellido}</div><div className="text-[9px] text-gray-500 font-bold">C.I: {v.ci}</div></td>
                              <td className="p-3 text-center">{env==='ok' ? <span className="inline-flex items-center gap-1 text-green-700 font-black text-[10px]"><CheckCircle size={14}/> ENVIADO</span> : <span className="inline-flex items-center gap-1 text-amber-600 font-black text-[10px]"><Clock size={14}/> ENVIANDO…</span>}</td>
                          </tr>);
                      })}
                      {marcados.length === 0 && <tr><td colSpan="3" className="text-center py-10 text-gray-400 font-bold">Todavía no marcaste a nadie.</td></tr>}
                  </tbody></table></div>
              </>)}

              {vista === "acta" && (
                  <div className="bg-white rounded-3xl shadow-xl p-4 md:p-6 border-t-8 border-slate-900">
                      <div className="text-center mb-4"><ClipboardList size={32} className="mx-auto text-blue-600 mb-2"/><h2 className="text-xl font-black uppercase">ACTA FINAL MESA {vs.mesa}</h2><p className="text-[11px] font-bold text-slate-400 mt-1">Cargá los votos del acta oficial de tu mesa</p></div>
                      <div className={`text-center text-xs font-black py-2 rounded-xl mb-4 ${miEsc ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{miEsc ? <><CheckCircle size={13} className="inline mr-1"/> ACTA ENVIADA Y CONFIRMADA{miEsc.cargadoPor?` · ${miEsc.cargadoPor}`:''}</> : <><Clock size={13} className="inline mr-1"/> ACTA SIN ENVIAR</>}</div>
                      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 mb-4">
                          <label className="text-xs font-black text-red-700 uppercase">Intendente: {configApp.intendente || "S/D"}</label>
                          <input type="number" inputMode="numeric" placeholder="0" className="w-full mt-1 p-3 text-3xl font-black text-center border-2 border-red-300 rounded-xl outline-none focus:border-red-600" value={fEsc.intendente} onChange={e=>setFEsc({...fEsc, intendente: e.target.value})} />
                      </div>
                      <div className="space-y-2 mb-4">
                          <h3 className="text-xs font-black text-slate-500 uppercase mb-2">Concejales</h3>
                          {(configApp.concejales||[]).filter(c=>c!=="SIN ASIGNAR").map(c => (
                              <div key={c} className="flex items-center gap-3 bg-slate-50 border rounded-xl p-2">
                                  <span className="flex-1 font-bold text-sm uppercase leading-tight">{c.includes(' - ') ? c.split(' - ')[1] : c}</span>
                                  <input type="number" inputMode="numeric" placeholder="0" className="w-24 p-2 text-xl font-black text-center border-2 border-blue-200 rounded-lg outline-none focus:border-blue-500" value={fEsc.concejales?.[c] || ""} onChange={e=>setFEsc({...fEsc, concejales: {...fEsc.concejales, [c]: e.target.value}})} />
                              </div>
                          ))}
                          {(configApp.concejales||[]).length===0 && <p className="text-xs text-gray-400 font-bold text-center p-2">No hay concejales configurados en este distrito.</p>}
                      </div>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                          <div><label className="text-[10px] font-black text-slate-500 uppercase">Blancos</label><input type="number" inputMode="numeric" placeholder="0" className="w-full p-2 font-black text-center border-2 rounded-lg outline-none" value={fEsc.blancos} onChange={e=>setFEsc({...fEsc, blancos: e.target.value})} /></div>
                          <div><label className="text-[10px] font-black text-slate-500 uppercase">Nulos</label><input type="number" inputMode="numeric" placeholder="0" className="w-full p-2 font-black text-center border-2 rounded-lg outline-none" value={fEsc.nulos} onChange={e=>setFEsc({...fEsc, nulos: e.target.value})} /></div>
                      </div>
                      <button onClick={guardarActa} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-5 rounded-xl font-black shadow-lg text-lg mt-4">GUARDAR Y ENVIAR ACTA</button>
                  </div>
              )}
            </main>

            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] flex z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {[["pintar","PINTAR",CheckCircle],["votaron","YA VOTARON",ListChecks],["acta","ACTA",ClipboardList]].map(([id,label,Icon])=>(
                    <button key={id} onClick={()=>setVista(id)} className={`flex-1 py-3 flex flex-col items-center gap-0.5 font-black text-[10px] transition-colors ${vista===id?'text-red-600 bg-red-50':'text-slate-400'}`}>
                        <Icon size={20}/> {label}{id==="votaron" && pendientesEnvio>0 ? ` (${pendientesEnvio})` : ""}
                    </button>
                ))}
            </nav>
            </>
          )}
        </div>
    );
}
