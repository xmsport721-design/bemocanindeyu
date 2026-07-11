import React, { useState, useEffect, useMemo } from "react";
import { ref, set, remove } from "firebase/database";
import { signOut } from "firebase/auth";
import { Unlock, Lock, ClipboardList } from "lucide-react";
import { generarLlave, generarLlaveMesa } from "../lib/llaves";

export default function AppVeedor({ padronGlobal, yaVotaronGlobal, mesasCerradas, asignacionesVeedores, escrutinioGlobal, configApp, auth, db }) {
    const [vs, setVs] = useState(null);
    const [ciIn, setCiIn] = useState("");
    const [fMesa, setFMesa] = useState("");

    const [fEsc, setFEsc] = useState({ intendente: "", concejales: {}, rivalesIntendente: [], rivalesConcejales: [], blancos: "", nulos: "" });
    const [mEdEsc, setMEdEsc] = useState(false);

    useEffect(() => { const g = localStorage.getItem('veedor_bemo_sesion'); if (g) { const p = JSON.parse(g); setVs(p); set(ref(db, `dia_d/veedores_online/${p.ci}`), true); } }, [db]);

    const llMA = vs ? generarLlaveMesa(vs.distrito, vs.mesa) : null;
    const isC = llMA && mesasCerradas[llMA];
    const miEsc = llMA ? escrutinioGlobal[llMA] : null;

    useEffect(() => {
        if(miEsc && !mEdEsc) {
            setFEsc({ intendente: miEsc.intendente || "", concejales: miEsc.concejales || {}, rivalesIntendente: miEsc.rivalesIntendente || [], rivalesConcejales: miEsc.rivalesConcejales || [], blancos: miEsc.blancos || "", nulos: miEsc.nulos || "" });
        } else if(!miEsc && isC) {
            const ic={}; (configApp.concejales||[]).forEach(c=>ic[c]="");
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
                      <button onClick={()=>{set(ref(db, `dia_d/escrutinio/${llMA}`), fEsc); alert("Acta Final Guardada en el Sistema."); setMEdEsc(false);}} className="w-full bg-blue-600 hover:bg-blue-700 transition-colors text-white py-5 rounded-xl font-black shadow-lg text-lg mt-8">GUARDAR ACTA COMPLETA</button>
                  </div>
              )}
            </main>
          )}
        </div>
    );
}
