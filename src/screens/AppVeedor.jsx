import React, { useState, useEffect, useMemo } from "react";
import { ref, set, remove, update, onValue, query, orderByKey, startAt, endAt } from "firebase/database";
import { signOut } from "firebase/auth";
import { Unlock, Lock, ClipboardList, CheckCircle } from "lucide-react";
import { generarLlave, generarLlaveMesa } from "../lib/llaves";

export default function AppVeedor({ padronGlobal, mesasCerradas, asignacionesVeedores, escrutinioGlobal, configApp, auth, db }) {
    const [vs, setVs] = useState(null);
    const [ciIn, setCiIn] = useState("");
    const [fMesa, setFMesa] = useState("");

    // Pintado robusto: marca optimista local (instantánea) + votos reales de la mesa (RTDB, tiempo real)
    const [votosMesa, setVotosMesa] = useState({});     // llave -> data (solo esta mesa)
    const [marcadosLocal, setMarcadosLocal] = useState({}); // orden -> bool (optimista)

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

    const padronMesa = useMemo(() =>
        Object.entries(padronGlobal || {}).map(([ci, d]) => ({ ci, ...d }))
            .filter(p => vs && String(p.mesa) === String(vs.mesa) && p.distrito === vs.distrito && String(p.cod_local) === String(vs.cod_local))
            .sort((a, b) => (parseInt(a.orden) || 0) - (parseInt(b.orden) || 0)),
    [padronGlobal, vs]);

    // ¿votó? — la marca local optimista manda; si no, lo que dice RTDB
    const estaMarcado = (orden) => {
        if (marcadosLocal[orden] !== undefined) return marcadosLocal[orden];
        return !!votosMesa[generarLlave(vs.distrito, vs.cod_local, vs.mesa, orden)];
    };

    // Pintado: marca instantánea (no se traba) + guarda en RTDB en segundo plano
    const pintar = (v) => {
        const yaVoto = estaMarcado(v.orden);
        const llV = generarLlave(vs.distrito, vs.cod_local, vs.mesa, v.orden);
        setMarcadosLocal(prev => ({ ...prev, [v.orden]: !yaVoto }));   // 1) instantáneo
        const data = yaVoto ? null : { hora: new Date().toLocaleTimeString(), timestamp: Date.now(), veedor: vs.nombre, ci: v.ci }; // 2) RTDB en background
        update(ref(db, "dia_d/votos_efectuados"), { [llV]: data }).catch(() => {
            setMarcadosLocal(prev => ({ ...prev, [v.orden]: yaVoto }));  // revierte si falla
            alert("⚠️ No se pudo guardar. Reintentá.");
        });
    };

    const totalVotaron = padronMesa.filter(v => estaMarcado(v.orden)).length;
    const totalMesa = padronMesa.length;
    const pct = totalMesa > 0 ? Math.round((totalVotaron / totalMesa) * 100) : 0;

    return (
        <div className="min-h-screen pb-20 bg-slate-50">
          <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-xl border-b-4 border-red-600"><div className="flex items-center gap-3"><span className="bg-red-700 px-2 rounded font-black">BEMO</span><div><h1 className="text-sm font-bold uppercase truncate">{vs?.local || configApp.intendente || "S/D"}</h1><p className="text-[10px] text-gray-400 font-bold uppercase">MESA: {vs?.mesa||'-'}</p></div></div><button onClick={()=>{localStorage.removeItem('veedor_bemo_sesion'); signOut(auth);}} className="text-[10px] bg-red-600 px-3 py-1.5 rounded-full font-black">SALIR</button></header>

          {!vs ? (
            <div className="p-6 max-w-md mx-auto mt-10 bg-white rounded-3xl shadow-xl"><h2 className="text-xl font-black mb-4 text-center">CÉDULA VEEDOR</h2><input type="number" className="w-full p-4 border-2 rounded-xl text-center text-xl font-black mb-4" value={ciIn} onChange={e=>setCiIn(e.target.value)} /><button onClick={()=>{const a=Object.values(asignacionesVeedores||{}).find(x=>String(x.ci)===String(ciIn)); if(a){setVs(a); localStorage.setItem('veedor_bemo_sesion',JSON.stringify(a)); set(ref(db,`dia_d/veedores_online/${a.ci}`),true);} else alert("No asignado.");}} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black">ENTRAR</button></div>
          ) : (
            <main className="p-2 max-w-4xl mx-auto mt-2">
              <div className="bg-white p-4 rounded-2xl shadow mb-3 border-l-8 border-green-500 flex justify-between items-center"><div><h2 className="font-black text-xl leading-none uppercase">MESA {vs.mesa}</h2><p className="text-[10px] font-black text-gray-500 mt-1 uppercase truncate max-w-[200px]">{vs.local || vs.nombre}</p></div>{isC && <button onClick={()=>{if(window.confirm("¿Reabrir?")) {remove(ref(db, `dia_d/mesas_cerradas/${llMA}`)); setMEdEsc(false);}}} className="bg-orange-100 text-orange-700 px-3 py-1 rounded text-[10px] font-black"><Unlock size={12} className="inline mr-1"/>REABRIR</button>}</div>

              {!isC ? (
                  <>
                      {/* Contador en vivo de pintado */}
                      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow mb-3 flex items-center justify-around">
                          <div className="text-center"><div className="text-4xl font-black text-green-400 leading-none">{totalVotaron}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Ya votaron</div></div>
                          <div className="text-2xl font-black text-slate-600">/</div>
                          <div className="text-center"><div className="text-4xl font-black leading-none">{totalMesa}</div><div className="text-[9px] font-black uppercase text-slate-400 mt-1">Habilitados</div></div>
                          <div className="text-center bg-green-600 rounded-xl px-4 py-2"><div className="text-2xl font-black leading-none">{pct}%</div><div className="text-[8px] font-black uppercase mt-0.5">Participación</div></div>
                      </div>

                      <div className="bg-white p-3 rounded-xl shadow mb-2"><input type="number" placeholder="BUSCAR ORDEN / C.I..." className="w-full p-2 font-black outline-none text-center" value={fMesa} onChange={e=>setFMesa(e.target.value)} /></div>
                      <div className="bg-white rounded-xl shadow overflow-hidden mb-6"><table className="w-full text-left"><thead className="bg-slate-800 text-white text-[10px] uppercase"><tr><th className="p-3 text-center">Ord</th><th className="p-3">Votante</th><th className="p-3 text-center">Acción</th></tr></thead><tbody className="divide-y">
                          {padronMesa.filter(v => v.ci.includes(fMesa) || v.orden.toString().includes(fMesa)).map(v => {
                              const voto = estaMarcado(v.orden);
                              return (
                              <tr key={v.ci} className={voto ? 'bg-green-50' : ''}>
                                  <td className="p-3 text-center font-black text-slate-400">{v.orden}</td>
                                  <td className="p-3 leading-tight"><div className="font-black text-sm">{v.nombre} {v.apellido}</div><div className="text-[9px] text-gray-500 font-bold">C.I: {v.ci}</div></td>
                                  <td className="p-3"><button onClick={() => pintar(v)} className={`w-full py-2 rounded font-black text-[10px] border-2 flex items-center justify-center gap-1 transition-colors ${voto ? 'bg-green-500 border-green-600 text-white' : 'border-slate-300 text-slate-500'}`}>{voto ? <><CheckCircle size={12}/> VOTÓ</> : 'PINTAR'}</button></td>
                              </tr>);
                          })}
                          {padronMesa.length === 0 && <tr><td colSpan="3" className="text-center py-8 text-gray-400 font-bold">No hay padrón cargado para esta mesa.</td></tr>}
                      </tbody></table></div>
                      <button onClick={()=>{if(window.confirm("¿Cerrar Escrutinio?")){set(ref(db, `dia_d/mesas_cerradas/${llMA}`),{hora:new Date().toLocaleTimeString(), cerradoPor:vs.nombre}); setMEdEsc(true);}}} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-2xl flex justify-center gap-2"><Lock/> CERRAR MESA</button>
                  </>
              ) : (
                  <div className="bg-white rounded-3xl shadow-xl p-4 md:p-6 border-t-8 border-slate-900">
                      <div className="text-center mb-6"><ClipboardList size={32} className="mx-auto text-blue-600 mb-2"/><h2 className="text-xl font-black uppercase">ACTA FINAL MESA {vs.mesa}</h2><p className="text-[11px] font-bold text-slate-400 mt-1">Cargá los votos del acta oficial de tu mesa</p></div>

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

                      <button onClick={()=>{set(ref(db, `dia_d/escrutinio/${llMA}`), {...fEsc, timestamp: Date.now(), cargadoPor: vs.nombre}); alert("✅ Acta Final Guardada en el Sistema."); setMEdEsc(false);}} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-5 rounded-xl font-black shadow-lg text-lg mt-4">GUARDAR ACTA COMPLETA</button>
                  </div>
              )}
            </main>
          )}
        </div>
    );
}
